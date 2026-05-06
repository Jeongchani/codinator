import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import type { ManualBlurResponse, UploadPostImageResponse, UploadSearchImageResponse } from '@codinator/contracts'; // V3 Batch9: UploadSearchImageResponse 추가
import {
  AiBlurStatus,
  BlurMethod,
  ImageAnalysisPurpose,
  ImageAssetSourceType,
} from '@prisma/client';
import { randomUUID } from 'crypto';
import { spawn } from 'child_process';
import { promises as fs } from 'fs';
import { extname, join } from 'path';
import { PrismaService } from '../../prisma/prisma.service';
import { AiService } from '../ai/ai.service';
import { ImageIndexingService } from '../ai/image-indexing.service';

// ── 리사이징 정책 상수 ──────────────────────────────────────────────────────
// 목적: 휴대폰 원본 사진처럼 해상도가 과도하게 커서 파일 용량이 큰 경우만 축소.
// "10MB 이하라도 무조건 리사이징" 하지 않는다.
const RESIZE_THRESHOLD_BYTES = 3 * 1024 * 1024; // 3MB 이상일 때만 리사이징 검토
const RESIZE_THRESHOLD_PX = 1920;               // 긴 변이 1920px 이상일 때 리사이징
const RESIZE_TARGET_PX = 1440;                  // 리사이징 후 긴 변 목표 크기
const RESIZE_QUALITY = 85;                      // JPEG/WebP 출력 품질

/**
 * Batch4 — blurMethod / aiBlurStatus 상태 전이 정책
 *
 * aiBlurStatus: AI 자동 블러 파이프라인 처리 결과
 *   NONE    — AI 호출 자체를 하지 않았거나 얼굴이 없어 블러 불필요
 *   DONE    — AI 블러 성공 (블러 이미지 저장됨)
 *   FAILED  — AI 블러 실패 (에러 발생)
 *
 * blurMethod: 사용자가 최종적으로 채택한 이미지 생성 방식
 *   NONE    — 블러 미적용 (AI가 얼굴을 감지하지 못했거나, 블러 불필요)
 *   AUTO    — AI 자동 블러 결과를 그대로 승인
 *   MANUAL  — 사용자가 직접 블러 처리한 이미지 사용
 *
 * 시나리오별 최종 상태:
 *   1) AI 성공 + 블러 적용 + 사용자 승인  → aiBlurStatus=DONE,   blurMethod=AUTO
 *   2) AI 실패 + 수동 블러 적용           → aiBlurStatus=FAILED, blurMethod=MANUAL
 *   3) AI 성공 + 수동 블러 override       → aiBlurStatus=DONE,   blurMethod=MANUAL
 *   4) AI 성공 + 얼굴 없음               → aiBlurStatus=NONE,   blurMethod=NONE
 */
@Injectable()
export class UploadsService {
  private readonly uploadRoot = join(process.cwd(), 'uploads');
  private readonly logger = new Logger(UploadsService.name);

  constructor(
    private readonly aiService: AiService,
    private readonly prisma: PrismaService,
    private readonly imageIndexingService: ImageIndexingService,
  ) {}

  async savePostImage(
    userId: number,
    file: Express.Multer.File,
  ): Promise<UploadPostImageResponse> {
    return this.saveImageAsset(userId, file, ImageAssetSourceType.POST, 'posts');
  }

  // ── V3 Batch9: 검색용 이미지 저장 (face blur 없음) ───────────────────────────
  // 검색용 이미지는 공개되지 않으므로 face blur가 불필요하다.
  // AI 분석(garment detection + embedding)은 POST /search/image 호출 시 on-demand 실행.
  async saveSearchImage(
    userId: number,
    file: Express.Multer.File,
  ): Promise<UploadSearchImageResponse> {
    return this.saveSearchImageAsset(userId, file);
  }

  // ── PATCH /uploads/image-assets/:imageAssetId/manual-blur ─────────────────
  // Batch4: 게시글 생성 전(업로드 단계)에 imageAssetId 기준으로 수동 블러 적용.
  // V3 흐름: 이미지 업로드 → 수동 블러 선택 → 게시글 생성

  async applyManualBlurByAsset(
    userId: number,
    imageAssetId: number,
    file: Express.Multer.File,
  ): Promise<ManualBlurResponse> {
    this.validateImage(file);

    const asset = await this.prisma.imageAsset.findUnique({
      where: { id: imageAssetId },
      select: {
        id: true,
        ownerUserId: true,
        sourceType: true,
        aiBlurStatus: true,
        blurMethod: true,
      },
    });

    if (!asset || asset.ownerUserId !== userId) {
      throw new NotFoundException('이미지 자산을 찾을 수 없습니다.');
    }

    if (asset.sourceType !== ImageAssetSourceType.POST) {
      throw new BadRequestException('게시글용 이미지에만 수동 블러를 적용할 수 있습니다.');
    }

    // Batch4: AUTO / NONE / FAILED 모두 허용
    // 수동 블러는 항상 original image 기반으로 사용자가 직접 처리한 파일을 업로드하는 방식.
    // aiBlurStatus는 AI 파이프라인 결과이므로 변경하지 않는다.

    const processedImageUrl = await this.persistManualBlurFile(file);

    const updatedAsset = await this.prisma.imageAsset.update({
      where: { id: imageAssetId },
      data: {
        processedImageUrl,
        blurMethod: BlurMethod.MANUAL, // 최종 채택 방식 = MANUAL
        // aiBlurStatus: 변경 없음 — AI 파이프라인 결과 보존
      },
      select: { id: true, updatedAt: true },
    });

    this.logger.log(
      `수동 블러 적용(imageAssetId) — imageAssetId=${imageAssetId}, ` +
        `이전blurMethod=${asset.blurMethod}, url=${processedImageUrl}`,
    );

    return {
      imageAssetId: updatedAsset.id,
      // postId 없음 — 게시글 생성 전 단계
      processedImageUrl,
      blurMethod: 'MANUAL',
      updatedAt: updatedAsset.updatedAt.toISOString(),
    };
  }

  // ── Private helpers ───────────────────────────────────────────────────────

  /**
   * [V3 Batch9] 검색용 이미지 전용 저장 메서드.
   * - face blur를 실행하지 않는다 (검색 쿼리 이미지는 비공개, blur 불필요).
   * - originalImageUrl만 저장하며, AI 임베딩 분석은 POST /search/image 시 on-demand 수행.
   * - blurMethod=NONE, aiBlurStatus=NONE 으로 고정.
   */
  private async saveSearchImageAsset(
    userId: number,
    file: Express.Multer.File,
  ): Promise<UploadSearchImageResponse> {
    this.validateImage(file);

    const today = this.getDatePath();
    const originalDir = join(this.uploadRoot, 'search', 'originals', today);
    await fs.mkdir(originalDir, { recursive: true });

    const { buffer: normalizedBuffer, resized } = await this.normalizeBuffer(file);
    if (resized) {
      this.logger.log(
        `검색이미지 리사이징 적용 — 원본크기=${file.size}B → 리사이징후=${normalizedBuffer.length}B`,
      );
    }

    const originalExtension = resized ? '.jpg' : (extname(file.originalname) || '.jpg');
    const originalFilename = `${randomUUID()}${originalExtension}`;
    const originalFullPath = join(originalDir, originalFilename);
    await fs.writeFile(originalFullPath, normalizedBuffer);

    const storageKey = `search/originals/${today}/${originalFilename}`;
    const originalImageUrl = `/uploads/${storageKey}`;

    const asset = await this.prisma.imageAsset.create({
      data: {
        ownerUserId: userId,
        sourceType: ImageAssetSourceType.SEARCH_QUERY,
        storageKey,
        originalImageUrl,
        processedImageUrl: null, // 검색용 이미지는 processed 불필요 // V3 Batch9
        thumbnailUrl: null,
        mimeType: file.mimetype,
        blurMethod: BlurMethod.NONE, // face blur 생략 // V3 Batch9
        aiBlurStatus: AiBlurStatus.NONE, // AI blur 파이프라인 대상 아님 // V3 Batch9
      },
      select: {
        id: true,
        sourceType: true,
        originalImageUrl: true,
        processedImageUrl: true,
        thumbnailUrl: true,
      },
    });

    this.logger.log(
      `검색용 이미지 저장 완료 — imageAssetId=${asset.id}, storageKey=${storageKey}`,
    );

    return {
      imageAssetId: asset.id,
      sourceType: asset.sourceType,
      originalImageUrl: asset.originalImageUrl,
      processedImageUrl: asset.processedImageUrl,
      thumbnailUrl: asset.thumbnailUrl,
    };
  }

  private async saveImageAsset(
    userId: number,
    file: Express.Multer.File,
    sourceType: ImageAssetSourceType,
    folderPrefix: 'posts' | 'search',
  ): Promise<UploadPostImageResponse> {
    this.validateImage(file);

    const today = this.getDatePath();
    const originalDir = join(this.uploadRoot, folderPrefix, 'originals', today);
    const processedDir = join(this.uploadRoot, folderPrefix, 'processed', today);

    await Promise.all([
      fs.mkdir(originalDir, { recursive: true }),
      fs.mkdir(processedDir, { recursive: true }),
    ]);

    // 필요한 경우에만 리사이징 (휴대폰 고해상도 원본 대응)
    const { buffer: normalizedBuffer, resized } = await this.normalizeBuffer(file);
    const normalizedFile: Express.Multer.File = resized
      ? { ...file, buffer: normalizedBuffer, size: normalizedBuffer.length, mimetype: 'image/jpeg' }
      : file;

    if (resized) {
      this.logger.log(
        `이미지 리사이징 적용 — 원본크기=${file.size}B → 리사이징후=${normalizedBuffer.length}B`,
      );
    }

    const originalExtension = resized ? '.jpg' : (extname(file.originalname) || '.jpg');
    const originalFilename = `${randomUUID()}${originalExtension}`;
    const originalFullPath = join(originalDir, originalFilename);

    await fs.writeFile(originalFullPath, normalizedFile.buffer);

    const originalStorageKey = `${folderPrefix}/originals/${today}/${originalFilename}`;
    const originalImageUrl = `/uploads/${originalStorageKey}`;

    let processedImageUrl = originalImageUrl;
    let blurMethod: BlurMethod = BlurMethod.NONE;
    let aiBlurStatus: AiBlurStatus = AiBlurStatus.NONE;

    try {
      const processed = await this.aiService.blurFace(normalizedFile);

      if (processed.blurred) {
        // 시나리오 1 대기 상태: AI 성공 + 블러 적용 → aiBlurStatus=DONE, blurMethod=AUTO
        // 사용자가 이 결과를 승인하면 blurMethod=AUTO 그대로 게시글 생성.
        // 사용자가 마음에 들지 않아 수동 override하면 applyManualBlur*로 blurMethod=MANUAL 전환.
        const processedExtension = processed.extension
          ? `.${processed.extension.replace(/^\./, '')}`
          : originalExtension;
        const processedFilename = `processed-${randomUUID()}${processedExtension}`;
        const processedFullPath = join(processedDir, processedFilename);

        await fs.writeFile(processedFullPath, processed.buffer);

        processedImageUrl = `/uploads/${folderPrefix}/processed/${today}/${processedFilename}`;
        blurMethod = BlurMethod.AUTO;   // Batch4: 자동 블러 채택 상태
        aiBlurStatus = AiBlurStatus.DONE;
      } else {
        // 시나리오 4: AI 성공 + 얼굴 없음 → 블러 불필요
        processedImageUrl = originalImageUrl;
        blurMethod = BlurMethod.NONE;
        aiBlurStatus = AiBlurStatus.NONE;
      }
    } catch (err) {
      // 시나리오 2 대기 상태: AI 실패 → aiBlurStatus=FAILED, blurMethod=NONE
      // 클라이언트는 이 상태를 받아 수동 블러 적용 flow로 유도해야 한다.
      this.logger.warn(
        `AI 블러 실패 fallback: storageKey=${originalStorageKey}, error=${String(err)}`,
      );
      processedImageUrl = originalImageUrl;
      blurMethod = BlurMethod.NONE;
      aiBlurStatus = AiBlurStatus.FAILED; // Batch4: FAILED → 수동 블러 유도 신호
    }

    const asset = await this.prisma.imageAsset.create({
      data: {
        ownerUserId: userId,
        sourceType,
        storageKey: originalStorageKey,
        originalImageUrl,
        processedImageUrl,
        thumbnailUrl: null,
        mimeType: file.mimetype,
        blurMethod,
        aiBlurStatus,
      },
      select: {
        id: true,
        originalImageUrl: true,
        processedImageUrl: true,
        thumbnailUrl: true,
        storageKey: true,
        blurMethod: true,
        aiBlurStatus: true,
      },
    });

    return {
      imageAssetId: asset.id,
      originalImageUrl: asset.originalImageUrl,
      processedImageUrl: asset.processedImageUrl ?? asset.originalImageUrl,
      thumbnailUrl: asset.thumbnailUrl,
      storageKey: asset.storageKey,
      blurMethod: asset.blurMethod,
      aiBlurStatus: asset.aiBlurStatus,
    };
  }

  /**
   * 수동 블러 이미지 파일을 posts/processed 디렉터리에 저장하고 URL을 반환.
   * 수동 블러는 항상 original image 기반으로 사용자가 직접 처리한 파일을 받아 저장하는 방식. // Batch4
   */
  private async persistManualBlurFile(file: Express.Multer.File): Promise<string> {
    const today = this.getDatePath();
    const processedDir = join(this.uploadRoot, 'posts', 'processed', today);
    await fs.mkdir(processedDir, { recursive: true });

    const { buffer: normalizedBuffer, resized } = await this.normalizeBuffer(file);
    if (resized) {
      this.logger.log(
        `수동블러 이미지 리사이징 적용 — 원본크기=${file.size}B → 리사이징후=${normalizedBuffer.length}B`,
      );
    }

    const ext = resized ? '.jpg' : (extname(file.originalname) || '.jpg');
    const filename = `manual-${randomUUID()}${ext}`;
    const fullPath = join(processedDir, filename);
    await fs.writeFile(fullPath, normalizedBuffer);

    return `/uploads/posts/processed/${today}/${filename}`;
  }

  private validateImage(file: Express.Multer.File) {
    const allowed = ['image/jpeg', 'image/png', 'image/webp'];
    if (!allowed.includes(file.mimetype)) {
      throw new BadRequestException('jpg, png, webp 파일만 업로드할 수 있습니다.');
    }

    const maxSize = 10 * 1024 * 1024; // 10MB
    if (file.size > maxSize) {
      throw new BadRequestException('이미지 최대 크기는 10MB입니다.');
    }
  }

  /**
   * 필요한 경우에만 이미지를 리사이징한 Buffer를 반환한다.
   * Python + Pillow를 사용하므로 외부 npm 의존성 불필요.
   *
   * 리사이징 조건 (AND):
   *   1. 파일 크기 >= RESIZE_THRESHOLD_BYTES (3MB)
   *   2. 긴 변 >= RESIZE_THRESHOLD_PX (1920px)
   *
   * 조건 미충족 시 원본 buffer를 그대로 반환 (리사이징 없음).
   * 목적: 휴대폰 원본 사진처럼 해상도가 과도해서 용량이 큰 경우만 줄임.
   */
  /**
   * 필요한 경우에만 이미지를 리사이징한 Buffer를 반환한다.
   * Python3 + Pillow를 사용 (외부 npm 의존성 불필요).
   *
   * 리사이징 조건 (AND):
   *   1. 파일 크기 >= RESIZE_THRESHOLD_BYTES (3MB)
   *   2. 긴 변 >= RESIZE_THRESHOLD_PX (1920px)
   *
   * 조건 미충족 시 원본 buffer를 그대로 반환 (리사이징 없음).
   * 목적: 휴대폰 원본 사진처럼 해상도가 과도해서 용량이 큰 경우만 줄임.
   */
  private normalizeBuffer(
    file: Express.Multer.File,
  ): Promise<{ buffer: Buffer; resized: boolean }> {
    // 1차 조건: 파일 크기가 기준 미만이면 즉시 원본 반환 (Python 호출 없음)
    if (file.size < RESIZE_THRESHOLD_BYTES) {
      return Promise.resolve({ buffer: file.buffer, resized: false });
    }

    const pythonScript = [
      'import sys, io',
      'from PIL import Image',
      'data = sys.stdin.buffer.read()',
      'img = Image.open(io.BytesIO(data))',
      'w, h = img.size',
      'longer = max(w, h)',
      `if longer < ${RESIZE_THRESHOLD_PX}:`,
      '    sys.stdout.buffer.write(b"SKIP"); sys.exit(0)',
      `img.thumbnail((${RESIZE_TARGET_PX}, ${RESIZE_TARGET_PX}), Image.LANCZOS)`,
      'out = io.BytesIO()',
      `img.convert("RGB").save(out, format="JPEG", quality=${RESIZE_QUALITY})`,
      'sys.stdout.buffer.write(out.getvalue())',
    ].join('\n');

    return new Promise((resolve) => {
      const child = spawn('python3', ['-c', pythonScript]);
      const chunks: Buffer[] = [];
      const errChunks: Buffer[] = [];

      child.stdout.on('data', (chunk: Buffer) => chunks.push(chunk));
      child.stderr.on('data', (chunk: Buffer) => errChunks.push(chunk));

      child.on('error', (err) => {
        this.logger.warn(`이미지 리사이징 실패(spawn error), 원본 사용: ${err.message}`);
        resolve({ buffer: file.buffer, resized: false });
      });

      child.on('close', (code) => {
        if (code !== 0) {
          const errMsg = Buffer.concat(errChunks).toString().trim();
          this.logger.warn(`이미지 리사이징 실패(exit ${code}), 원본 사용: ${errMsg}`);
          resolve({ buffer: file.buffer, resized: false });
          return;
        }

        const result = Buffer.concat(chunks);
        if (result.slice(0, 4).toString('utf8') === 'SKIP') {
          resolve({ buffer: file.buffer, resized: false });
        } else {
          resolve({ buffer: result, resized: true });
        }
      });

      child.stdin.write(file.buffer);
      child.stdin.end();
    });
  }

  private getDatePath() {
    const now = new Date();
    const yyyy = now.getFullYear();
    const mm = String(now.getMonth() + 1).padStart(2, '0');
    const dd = String(now.getDate()).padStart(2, '0');
    return `${yyyy}${mm}${dd}`;
  }
}
