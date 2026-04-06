import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import type { ManualBlurResponse, UploadPostImageResponse } from '@codinator/contracts';
import { AiBlurStatus, BlurMethod, PostStatus } from '@prisma/client';
import { randomUUID } from 'crypto';
import { promises as fs } from 'fs';
import { extname, join } from 'path';
import { PrismaService } from '../../prisma/prisma.service';
import { AiService } from '../ai/ai.service';

@Injectable()
export class UploadsService {
  private readonly uploadRoot = join(process.cwd(), 'uploads');
  private readonly logger = new Logger(UploadsService.name);

  constructor(
    private readonly aiService: AiService,
    private readonly prisma: PrismaService,
  ) {}

  async savePostImage(file: Express.Multer.File): Promise<UploadPostImageResponse> {
    this.validateImage(file);

    const today = this.getDatePath();
    const originalDir = join(this.uploadRoot, 'posts', 'originals', today);
    const processedDir = join(this.uploadRoot, 'posts', 'processed', today);

    await Promise.all([
      fs.mkdir(originalDir, { recursive: true }),
      fs.mkdir(processedDir, { recursive: true }),
    ]);

    const originalExtension = extname(file.originalname) || '.jpg';
    const originalFilename = `${randomUUID()}${originalExtension}`;
    const originalFullPath = join(originalDir, originalFilename);

    await fs.writeFile(originalFullPath, file.buffer);

    const originalStorageKey = `posts/originals/${today}/${originalFilename}`;
    const originalImageUrl = `/uploads/${originalStorageKey}`;

    // AI 블러 처리 — 실패 시 원본 이미지로 fallback (업로드 자체는 성공 처리)
    try {
      const processed = await this.aiService.blurFace(file);
      const processedExtension = processed.extension
        ? `.${processed.extension.replace(/^\./, '')}`
        : originalExtension;
      const processedFilename = `processed-${randomUUID()}${processedExtension}`;
      const processedFullPath = join(processedDir, processedFilename);

      await fs.writeFile(processedFullPath, processed.buffer);

      const processedImageUrl = `/uploads/posts/processed/${today}/${processedFilename}`;

      return {
        originalImageUrl,
        processedImageUrl,
        thumbnailUrl: null,
        storageKey: originalStorageKey,
        blurMethod: processed.blurred ? 'AUTO' : 'NONE',
        aiBlurStatus: 'DONE',
      };
    } catch (err) {
      this.logger.warn(
        `AI 블러 처리 실패 — 원본 이미지로 fallback 처리합니다. storageKey=${originalStorageKey}, error=${String(err)}`,
      );

      // 블러 실패 시 원본을 processedImageUrl 로 사용, 수동 블러 대기 상태로 저장
      return {
        originalImageUrl,
        processedImageUrl: originalImageUrl,
        thumbnailUrl: null,
        storageKey: originalStorageKey,
        blurMethod: 'NONE',
        aiBlurStatus: 'FAILED',
      };
    }
  }

  // ─── 수동 블러 적용 ───────────────────────────────────────────────────────────
  /**
   * PATCH /uploads/posts/:postId/manual-blur
   *
   * 작성자가 직접 블러 처리한 이미지를 업로드하여 PostImage.processedImageUrl 을 교체.
   * AI 실패(FAILED) 또는 AI 성공 후 부정확 판단(DONE+AUTO) 모두 허용.
   *
   * 허용 조건 (아래 셋 중 하나):
   *   ① aiBlurStatus=FAILED  + blurMethod=NONE   — AI 실패, 미처리 상태
   *   ② aiBlurStatus=DONE    + blurMethod=AUTO   — AI 성공이지만 결과 부정확 → override
   *   ③                        blurMethod=MANUAL — 이미 수동 처리됨 → 재처리(덮어쓰기)
   *
   * 처리 결과:
   *   - processedImageUrl → 새 수동 블러 이미지 URL 로 갱신
   *   - blurMethod        → MANUAL 로 변경
   *   - aiBlurStatus      → 기존 값 유지 (AI 처리 기록 보존)
   *                         DONE+AUTO → override 후 DONE+MANUAL
   *                         FAILED+NONE → 처리 후 FAILED+MANUAL
   */
  async applyManualBlur(
    userId: number,
    postId: number,
    file: Express.Multer.File,
  ): Promise<ManualBlurResponse> {
    this.validateImage(file);

    // 게시글 + 소유자 확인
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

    // primary 이미지 조회
    const postImage = await this.prisma.postImage.findFirst({
      where: { postId, isPrimary: true },
      select: {
        id: true,
        aiBlurStatus: true,
        blurMethod: true,
      },
    });

    if (!postImage) {
      throw new NotFoundException('게시글 이미지를 찾을 수 없습니다.');
    }

    // 수동 블러 허용 조건:
    //   ① FAILED + NONE  — AI 실패, 미처리 상태
    //   ② DONE  + AUTO   — AI 성공이지만 결과 부정확 → 작성자 override
    //   ③ 이미 MANUAL    — 재수동 처리(덮어쓰기) 허용
    const canManualBlur =
      (postImage.aiBlurStatus === AiBlurStatus.FAILED && postImage.blurMethod === BlurMethod.NONE) ||
      (postImage.aiBlurStatus === AiBlurStatus.DONE && postImage.blurMethod === BlurMethod.AUTO) ||
      postImage.blurMethod === BlurMethod.MANUAL;

    if (!canManualBlur) {
      throw new UnprocessableEntityException(
        `수동 블러를 적용할 수 없는 상태입니다. ` +
        `허용: AI 실패(FAILED+NONE), AI 성공 후 작성자 override(DONE+AUTO), 수동 재처리(MANUAL). ` +
        `현재: aiBlurStatus=${postImage.aiBlurStatus}, blurMethod=${postImage.blurMethod}`,
      );
    }

    // 파일 저장
    const today = this.getDatePath();
    const processedDir = join(this.uploadRoot, 'posts', 'processed', today);
    await fs.mkdir(processedDir, { recursive: true });

    const ext = extname(file.originalname) || '.jpg';
    const filename = `manual-${randomUUID()}${ext}`;
    const fullPath = join(processedDir, filename);
    await fs.writeFile(fullPath, file.buffer);

    const processedImageUrl = `/uploads/posts/processed/${today}/${filename}`;

    // DB 갱신
    const updated = await this.prisma.postImage.update({
      where: { id: postImage.id },
      data: {
        processedImageUrl,
        blurMethod: BlurMethod.MANUAL,
      },
      select: { id: true, updatedAt: true },
    });

    this.logger.log(
      `수동 블러 적용 완료 — postId=${postId}, imageId=${postImage.id}, url=${processedImageUrl}`,
    );

    return {
      imageId: updated.id,
      postId,
      processedImageUrl,
      blurMethod: 'MANUAL',
      updatedAt: updated.updatedAt.toISOString(),
    };
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