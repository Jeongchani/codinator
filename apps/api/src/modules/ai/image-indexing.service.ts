import {
  BadRequestException,
  Injectable,
  InternalServerErrorException,
  NotFoundException,
  UnprocessableEntityException, // V3 Batch9: SEARCH_QUERY 이미지 품질 불량 시 422 반환
} from '@nestjs/common';
import {
  AiGarmentCategory,
  BlurMethod,
  ImageAnalysisPurpose,
  ImageAnalysisStatus,
  ImageVectorScope,
  Prisma,
} from '@prisma/client';
import { promises as fs } from 'fs';
import { basename, join } from 'path';
import { PrismaService } from '../../prisma/prisma.service';
import { AiService, AnalyzeImageResult } from './ai.service';

@Injectable()
export class ImageIndexingService {
  private readonly uploadRoot = join(process.cwd(), 'uploads');

  constructor(
    private readonly prisma: PrismaService,
    private readonly aiService: AiService,
  ) {}

  async ensureCurrentAnalysisRun(
    imageAssetId: number,
    purpose: ImageAnalysisPurpose,
  ): Promise<number> {
    const current = await this.prisma.imageAnalysisRun.findFirst({
      where: {
        imageAssetId,
        purpose,
        isCurrent: true,
        status: ImageAnalysisStatus.SUCCEEDED,
      },
      select: {
        id: true,
        finishedAt: true,
        imageAsset: {
          select: {
            updatedAt: true,
          },
        },
      },
    });

    if (
      current &&
      current.finishedAt &&
      current.finishedAt >= current.imageAsset.updatedAt
    ) {
      return current.id;
    }

    return this.analyzeAndPersist(imageAssetId, purpose);
  }

  async invalidateCurrentRuns(
    imageAssetId: number,
    purpose?: ImageAnalysisPurpose,
  ): Promise<void> {
    await this.prisma.imageAnalysisRun.updateMany({
      where: {
        imageAssetId,
        isCurrent: true,
        ...(purpose ? { purpose } : {}),
      },
      data: {
        isCurrent: false,
        status: ImageAnalysisStatus.STALE,
      },
    });
  }

  async reindexPostAsset(imageAssetId: number): Promise<number> {
    await this.invalidateCurrentRuns(imageAssetId, ImageAnalysisPurpose.POST_INDEX);
    return this.analyzeAndPersist(imageAssetId, ImageAnalysisPurpose.POST_INDEX);
  }

  async getSearchVector(
    analysisRunId: number,
    mode: 'FULL_OUTFIT' | 'SINGLE_ITEM',
    garmentCategory?: AiGarmentCategory,
  ): Promise<number[]> {
    if (mode === 'FULL_OUTFIT') {
      const rows = await this.prisma.$queryRaw<Array<{ vectorText: string }>>(Prisma.sql`
        SELECT vector::text as "vectorText"
        FROM "image_vectors"
        WHERE "analysis_run_id" = ${analysisRunId}
          AND "target_scope" = 'OUTFIT'
          AND "is_active" = true
        ORDER BY "id" ASC
        LIMIT 1
      `);

      if (!rows[0]?.vectorText) {
        throw new NotFoundException('OUTFIT 벡터를 찾을 수 없습니다.');
      }

      return this.parseVectorText(rows[0].vectorText);
    }

    const rows = await this.prisma.$queryRaw<Array<{ vectorText: string }>>(Prisma.sql`
      SELECT iv.vector::text as "vectorText"
      FROM "image_vectors" iv
      JOIN "image_garments" ig ON ig.id = iv."garment_id"
      WHERE iv."analysis_run_id" = ${analysisRunId}
        AND iv."target_scope" = 'GARMENT'
        AND iv."is_active" = true
        ${garmentCategory ? Prisma.sql`AND ig."normalized_category" = ${garmentCategory}::"AiGarmentCategory"` : Prisma.empty}
      ORDER BY ig."sort_order" ASC, ig."id" ASC
      LIMIT 1
    `);

    if (!rows[0]?.vectorText) {
      throw new NotFoundException('GARMENT 벡터를 찾을 수 없습니다.');
    }

    return this.parseVectorText(rows[0].vectorText);
  }

  private async analyzeAndPersist(
    imageAssetId: number,
    purpose: ImageAnalysisPurpose,
  ): Promise<number> {
    const imageAsset = await this.prisma.imageAsset.findUnique({
      where: { id: imageAssetId },
      select: {
        id: true,
        storageKey: true,
        mimeType: true,
        blurMethod: true,
        processedImageUrl: true,
      },
    });

    if (!imageAsset) {
      throw new NotFoundException('이미지 자산을 찾을 수 없습니다.');
    }


    await this.prisma.imageAnalysisRun.updateMany({
      where: {
        imageAssetId,
        purpose,
        isCurrent: true,
      },
      data: {
        isCurrent: false,
        status: ImageAnalysisStatus.STALE,
      },
    });

    const run = await this.prisma.imageAnalysisRun.create({
      data: {
        imageAssetId,
        purpose,
        status: ImageAnalysisStatus.PROCESSING,
        isCurrent: true,
        startedAt: new Date(),
      },
      select: { id: true },
    });

    /** AI 서버 업로드 허용 최대 파일 크기 (10 MB) */
    const MAX_AI_UPLOAD_BYTES = 10 * 1024 * 1024;

    try {
      const analysisInput = this.resolveAnalysisInput(imageAsset);
      const buffer = await fs.readFile(analysisInput.filePath);
      const filename = basename(analysisInput.filePath);
      const mimeType = imageAsset.mimeType ?? this.guessMimeType(filename);

      // AI 서버에 보내기 전 파일 크기 사전 검사 — 초과 시 AI 호출 없이 즉시 실패
      if (buffer.length > MAX_AI_UPLOAD_BYTES) {
        throw new BadRequestException(
          `이미지 파일이 너무 큽니다. AI 서버 허용 최대 크기는 10MB 입니다. (현재 ${(buffer.length / 1024 / 1024).toFixed(1)}MB)`,
        );
      }

      const result = await this.aiService.analyzeImageBinary({
        buffer,
        filename,
        mimeType,
      });

      await this.persistAnalysisResult(run.id, result, analysisInput.isBlurredAsset);

      return run.id;
    } catch (error) {
      // V3 Batch9: 분석 실패 이유를 errorCode/errorMessage 로 기록
      const errorMessage = error instanceof Error ? error.message : String(error);

      await this.prisma.imageAnalysisRun.update({
        where: { id: run.id },
        data: {
          status: ImageAnalysisStatus.FAILED,
          errorCode: 'ANALYSIS_FAILED',
          errorMessage,
          finishedAt: new Date(),
        },
      });

      // V3 Batch9: SEARCH_QUERY 목적의 분석 실패는 422(UnprocessableEntity) 반환.
      // "이미지 품질이 너무 낮아 분석이 어려우면 검색 실패 메시지 제공" 정책 반영.
      // POST_INDEX / REINDEX 목적은 기존과 동일하게 500 유지.
      if (purpose === ImageAnalysisPurpose.SEARCH_QUERY) {
        throw new UnprocessableEntityException(
          '이미지를 분석할 수 없습니다. 전신 또는 의류가 명확히 보이는 이미지를 사용해 주세요.',
        );
      }

      throw new InternalServerErrorException(
        errorMessage || '이미지 분석 저장에 실패했습니다.',
      );
    }
  }

  private async persistAnalysisResult(
    runId: number,
    result: AnalyzeImageResult,
    isBlurredAsset: boolean,
  ) {
    const storedResult: AnalyzeImageResult = {
      ...result,
      blur: {
        ...result.blur,
        blurred: result.blur.blurred || isBlurredAsset,
      },
    };

    await this.prisma.$transaction(async (tx) => {
      await tx.imageAnalysisRun.update({
        where: { id: runId },
        data: {
          status: ImageAnalysisStatus.SUCCEEDED,
          pipelineVersion: storedResult.pipelineVersion,
          parserModelName: storedResult.meta.parserModelName,
          parserModelVersion: storedResult.meta.parserModelVersion,
          embedModelName: storedResult.meta.embedModelName,
          embedModelVersion: storedResult.meta.embedModelVersion,
          captionModelName: storedResult.meta.captionModelName,
          captionModelVersion: storedResult.meta.captionModelVersion,
          captionFallbackUsed: storedResult.meta.captionFallbackUsed,
          warnings: storedResult.meta.warnings,
          imageWidth: storedResult.image.width,
          imageHeight: storedResult.image.height,
          faceDetected: storedResult.blur.facesDetected,
          blurred: storedResult.blur.blurred,
          caption: storedResult.analysis.caption,
          summaryTags: storedResult.analysis.summaryTags,
          rawResponseJson: storedResult as unknown as Prisma.InputJsonValue,
          finishedAt: new Date(),
        },
      });

      const garmentIds: number[] = [];
      for (const [index, garment] of storedResult.analysis.garments.entries()) {
        const created = await tx.imageGarment.create({
          data: {
            analysisRunId: runId,
            sortOrder: index,
            parserLabel: garment.parserLabel ?? 'unknown',
            normalizedCategory: this.normalizeAiGarmentCategory(
              garment.normalizedCategory || garment.category,
            ),
            bboxJson: garment.bbox as unknown as Prisma.InputJsonValue,
            confidence: garment.confidence,
            areaRatio: garment.areaRatio ?? null,
            dominantColor: garment.dominantColor ?? null,
            colorTags: garment.colorTags,
            fitTags: garment.fitTags,
            lengthTags: garment.lengthTags,
            materialTags: garment.materialTags,
            styleTags: garment.styleTags,
            seasonTags: garment.seasonTags,
            occasionTags: garment.occasionTags,
          },
          select: { id: true },
        });
        garmentIds.push(created.id);
      }

      await this.insertVectorRow(
        tx,
        runId,
        null,
        ImageVectorScope.OUTFIT,
        storedResult.embeddings.outfit.modelName,
        storedResult.embeddings.outfit.modelVersion,
        storedResult.embeddings.outfit.dimension,
        storedResult.embeddings.outfit.vector,
      );

      for (const [index, embedding] of storedResult.embeddings.garments.entries()) {
        const garmentId = garmentIds[index] ?? null;
        if (!garmentId) {
          continue;
        }

        await this.insertVectorRow(
          tx,
          runId,
          garmentId,
          ImageVectorScope.GARMENT,
          embedding.modelName,
          embedding.modelVersion,
          embedding.dimension,
          embedding.vector,
        );
      }
    });
  }

  private resolveAnalysisInput(imageAsset: {
    storageKey: string | null;
    processedImageUrl: string | null;
    blurMethod: BlurMethod;
  }): { filePath: string; isBlurredAsset: boolean } {
    const isBlurredAsset = imageAsset.blurMethod !== BlurMethod.NONE;

    if (isBlurredAsset && imageAsset.processedImageUrl?.startsWith('/uploads/')) {
      const processedRelativePath = imageAsset.processedImageUrl.replace(/^\/uploads\//, '');
      return {
        filePath: join(this.uploadRoot, processedRelativePath),
        isBlurredAsset,
      };
    }


    return {
      filePath: join(this.uploadRoot, imageAsset.storageKey),
      isBlurredAsset,
    };
  }

  private async insertVectorRow(
    tx: Prisma.TransactionClient,
    analysisRunId: number,
    garmentId: number | null,
    targetScope: ImageVectorScope,
    modelName: string,
    modelVersion: string | null | undefined,
    dimension: number,
    vector: number[],
  ) {
    const vectorLiteral = this.toPgVectorLiteral(vector);
    const targetScopeSql = Prisma.raw(`'${targetScope}'::"ImageVectorScope"`);
    const vectorSql = Prisma.raw(`'${vectorLiteral}'::vector`);

    await tx.$executeRaw(Prisma.sql`
      INSERT INTO "image_vectors"
        ("analysis_run_id", "garment_id", "target_scope", "model_name", "model_version", "dimension", "vector", "is_active", "created_at", "updated_at")
      VALUES
        (${analysisRunId}, ${garmentId}, ${targetScopeSql}, ${modelName}, ${modelVersion ?? null}, ${dimension}, ${vectorSql}, true, NOW(), NOW())
    `);
  }

  private normalizeAiGarmentCategory(value: string): AiGarmentCategory {
    const normalized = String(value || 'ETC').toUpperCase();
    const allowed = new Set<AiGarmentCategory>([
      'TOP',
      'BOTTOM',
      'OUTER',
      'SHOES',
      'BAG',
      'ACCESSORY',
      'DRESS',
      'ETC',
    ]);

    return allowed.has(normalized as AiGarmentCategory)
      ? (normalized as AiGarmentCategory)
      : 'ETC';
  }

  private toPgVectorLiteral(vector: number[]): string {
    return `[${vector
      .map((value) => (Number.isFinite(value) ? String(Number(value)) : '0'))
      .join(',')}]`;
  }

  private parseVectorText(vectorText: string): number[] {
    const trimmed = vectorText.trim().replace(/^\[/, '').replace(/\]$/, '');
    if (!trimmed) {
      return [];
    }
    return trimmed.split(',').map((value) => Number(value.trim()));
  }

  private guessMimeType(filename: string): string {
    const lower = filename.toLowerCase();
    if (lower.endsWith('.png')) return 'image/png';
    if (lower.endsWith('.webp')) return 'image/webp';
    return 'image/jpeg';
  }
}
