import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import type { ManualBlurResponse, UploadPostImageResponse } from '@codinator/contracts';
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

    let processedImageUrl = originalImageUrl;
    let blurMethod: BlurMethod = BlurMethod.NONE;
    let aiBlurStatus: AiBlurStatus = AiBlurStatus.FAILED;

    try {
      const processed = await this.aiService.blurFace(file);
      const processedExtension = processed.extension
        ? `.${processed.extension.replace(/^\./, '')}`
        : originalExtension;
      const processedFilename = `processed-${randomUUID()}${processedExtension}`;
      const processedFullPath = join(processedDir, processedFilename);

      await fs.writeFile(processedFullPath, processed.buffer);

      processedImageUrl = `/uploads/posts/processed/${today}/${processedFilename}`;
      blurMethod = processed.blurred ? BlurMethod.AUTO : BlurMethod.NONE;
      aiBlurStatus = AiBlurStatus.DONE;
    } catch (err) {
      this.logger.warn(
        `AI 블러 처리 실패 — 원본 이미지로 fallback 처리합니다. storageKey=${originalStorageKey}, error=${String(err)}`,
      );
    }

    const asset = await this.prisma.imageAsset.create({
      data: {
        ownerUserId: userId,
        sourceType: ImageAssetSourceType.POST,
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

  async saveSearchImage(
    userId: number,
    file: Express.Multer.File,
  ): Promise<UploadPostImageResponse> {
    this.validateImage(file);

    const today = this.getDatePath();
    const originalDir = join(this.uploadRoot, 'search', 'originals', today);
    await fs.mkdir(originalDir, { recursive: true });

    const originalExtension = extname(file.originalname) || '.jpg';
    const originalFilename = `${randomUUID()}${originalExtension}`;
    const originalFullPath = join(originalDir, originalFilename);

    await fs.writeFile(originalFullPath, file.buffer);

    const originalStorageKey = `search/originals/${today}/${originalFilename}`;
    const originalImageUrl = `/uploads/${originalStorageKey}`;

    const asset = await this.prisma.imageAsset.create({
      data: {
        ownerUserId: userId,
        sourceType: ImageAssetSourceType.SEARCH_QUERY,
        storageKey: originalStorageKey,
        originalImageUrl,
        processedImageUrl: originalImageUrl,
        thumbnailUrl: null,
        mimeType: file.mimetype,
        blurMethod: BlurMethod.NONE,
        aiBlurStatus: AiBlurStatus.NONE,
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
          select: {
            aiBlurStatus: true,
            blurMethod: true,
          },
        },
      },
    });

    if (!postImage) {
      throw new NotFoundException('게시글 이미지를 찾을 수 없습니다.');
    }

    const canManualBlur =
      (postImage.imageAsset.aiBlurStatus === AiBlurStatus.FAILED &&
        postImage.imageAsset.blurMethod === BlurMethod.NONE) ||
      (postImage.imageAsset.aiBlurStatus === AiBlurStatus.DONE &&
        postImage.imageAsset.blurMethod === BlurMethod.AUTO) ||
      postImage.imageAsset.blurMethod === BlurMethod.MANUAL;

    if (!canManualBlur) {
      throw new UnprocessableEntityException(
        `수동 블러를 적용할 수 없는 상태입니다. 현재: aiBlurStatus=${postImage.imageAsset.aiBlurStatus}, blurMethod=${postImage.imageAsset.blurMethod}`,
      );
    }

    const today = this.getDatePath();
    const processedDir = join(this.uploadRoot, 'posts', 'processed', today);
    await fs.mkdir(processedDir, { recursive: true });

    const ext = extname(file.originalname) || '.jpg';
    const filename = `manual-${randomUUID()}${ext}`;
    const fullPath = join(processedDir, filename);
    await fs.writeFile(fullPath, file.buffer);

    const processedImageUrl = `/uploads/posts/processed/${today}/${filename}`;

    const updatedAsset = await this.prisma.imageAsset.update({
      where: { id: postImage.imageAssetId },
      data: {
        processedImageUrl,
        blurMethod: BlurMethod.MANUAL,
      },
      select: { updatedAt: true },
    });

    this.logger.log(
      `수동 블러 적용 완료 — postId=${postId}, imageId=${postImage.id}, url=${processedImageUrl}`,
    );

    return {
      imageId: postImage.id,
      postId,
      processedImageUrl,
      blurMethod: 'MANUAL',
      updatedAt: updatedAsset.updatedAt.toISOString(),
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
