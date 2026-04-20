import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import type { ManualBlurResponse, UploadPostImageResponse, UploadSearchImageResponse } from '@codinator/contracts'; // V3 Batch9: UploadSearchImageResponse 추가
import {
  AiBlurStatus,
  BlurMethod,
  ImageAssetSourceType,
  PostStatus,
} from '@prisma/client';
import { randomUUID } from 'crypto';
import { promises as fs } from 'fs';
import { extname, join } from 'path';
import { PrismaService } from '../../prisma/prisma.service';
import { AiService } from '../ai/ai.service';

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

  // ── PATCH /uploads/posts/:postId/manual-blur ─────────────────────────────
  // 게시글 생성 이후 postId 기준으로 수동 블러를 적용하는 기존 endpoint.
  // Batch4: AUTO 차단 로직 제거 → 시나리오 3 (AI 성공 후 수동 override) 허용.

  async applyManualBlur(
    userId: number,
    postId: number,
    file: Express.Multer.File,
  ): Promise<ManualBlurResponse> {
    this.validateImage(file);

    const post = await this.prisma.post.findUnique({
      where: { id: postId },
      select: { id: true, authorId: true, status: true, deletedAt: true },
    });

    if (!post || post.status === PostStatus.DELETED || post.deletedAt) {
      throw new NotFoundException('게시글을 찾을 수 없습니다.');
    }

    if (post.authorId !== userId) {
      throw new ForbiddenException('본인 게시글에만 수동 블러를 적용할 수 있습니다.');
    }

    const postImage = await this.prisma.postImage.findFirst({
      where: { postId, isPrimary: true },
      select: {
        id: true,
        imageAssetId: true,
        imageAsset: {
          select: { aiBlurStatus: true, blurMethod: true },
        },
      },
    });

    if (!postImage) {
      throw new NotFoundException('게시글 이미지를 찾을 수 없습니다.');
    }

    // Batch4: AUTO 후 수동 override 허용 (기존 422 차단 제거)
    // blurMethod가 무엇이든 사용자가 manual blur를 선택하면 processedImageUrl을 교체한다.
    // aiBlurStatus는 AI 파이프라인 결과이므로 변경하지 않는다.

    const processedImageUrl = await this.persistManualBlurFile(file);

    const updatedAsset = await this.prisma.imageAsset.update({
      where: { id: postImage.imageAssetId },
      data: {
        processedImageUrl,
        blurMethod: BlurMethod.MANUAL, // 최종 채택 방식 = MANUAL
        // aiBlurStatus: 변경 없음 — AI 파이프라인 결과 보존
      },
      select: { id: true, updatedAt: true },
    });

    this.logger.log(
      `수동 블러 적용(postId) — postId=${postId}, imageAssetId=${updatedAsset.id}, ` +
        `이전blurMethod=${postImage.imageAsset.blurMethod}, url=${processedImageUrl}`,
    );

    return {
      imageAssetId: updatedAsset.id,
      postId,
      processedImageUrl,
      blurMethod: 'MANUAL',
      updatedAt: updatedAsset.updatedAt.toISOString(),
    };
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

    const originalExtension = extname(file.originalname) || '.jpg';
    const originalFilename = `${randomUUID()}${originalExtension}`;
    const originalFullPath = join(originalDir, originalFilename);
    await fs.writeFile(originalFullPath, file.buffer);

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
        originalImageUrl: true,
      },
    });

    this.logger.log(
      `검색용 이미지 저장 완료 — imageAssetId=${asset.id}, storageKey=${storageKey}`,
    );

    return {
      imageAssetId: asset.id,
      originalImageUrl: asset.originalImageUrl,
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

    const originalExtension = extname(file.originalname) || '.jpg';
    const originalFilename = `${randomUUID()}${originalExtension}`;
    const originalFullPath = join(originalDir, originalFilename);

    await fs.writeFile(originalFullPath, file.buffer);

    const originalStorageKey = `${folderPrefix}/originals/${today}/${originalFilename}`;
    const originalImageUrl = `/uploads/${originalStorageKey}`;

    let processedImageUrl = originalImageUrl;
    let blurMethod: BlurMethod = BlurMethod.NONE;
    let aiBlurStatus: AiBlurStatus = AiBlurStatus.NONE;

    try {
      const processed = await this.aiService.blurFace(file);

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

    const ext = extname(file.originalname) || '.jpg';
    const filename = `manual-${randomUUID()}${ext}`;
    const fullPath = join(processedDir, filename);
    await fs.writeFile(fullPath, file.buffer);

    return `/uploads/posts/processed/${today}/${filename}`;
  }

  private validateImage(file: Express.Multer.File) {
    const allowed = ['image/jpeg', 'image/png', 'image/webp'];
    if (!allowed.includes(file.mimetype)) {
      throw new BadRequestException('jpg, png, webp 파일만 업로드할 수 있습니다.');
    }

    const maxSize = 5 * 1024 * 1024;
    if (file.size > maxSize) {
      throw new BadRequestException('이미지 최대 크기는 5MB입니다.');
    }
  }

  private getDatePath() {
    const now = new Date();
    const yyyy = now.getFullYear();
    const mm = String(now.getMonth() + 1).padStart(2, '0');
    const dd = String(now.getDate()).padStart(2, '0');
    return `${yyyy}${mm}${dd}`;
  }
}
