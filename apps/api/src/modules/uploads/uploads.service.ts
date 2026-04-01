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
   * 자동 블러(AI)가 실패했을 때, 사용자가 직접 블러 처리한 이미지를 업로드하여
   * PostImage.processedImageUrl 을 교체하는 흐름.
   *
   * 허용 조건:
   *   - 요청자 = 게시글 작성자
   *   - post.status ≠ DELETED
   *   - 해당 게시글의 primary 이미지가 존재해야 함
   *   - aiBlurStatus = FAILED 인 경우만 허용
   *     (AUTO 성공 이미지를 의도치 않게 덮어쓰는 것 방지)
   *
   * 처리:
   *   - 업로드된 파일을 processed 디렉터리에 저장
   *   - PostImage.processedImageUrl 갱신
   *   - PostImage.blurMethod = MANUAL 로 변경
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

    // AI 블러가 성공한 이미지는 수동 블러 불필요 (AUTO 결과 보호)
    if (postImage.aiBlurStatus !== AiBlurStatus.FAILED) {
      throw new UnprocessableEntityException(
        'AI 블러가 실패한 이미지에만 수동 블러를 적용할 수 있습니다. ' +
        `현재 상태: aiBlurStatus=${postImage.aiBlurStatus}`,
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
