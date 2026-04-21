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
  ImageAnalysisPurpose,
  ImageAssetSourceType,
  PostStatus,
} from '@prisma/client';
import { randomUUID } from 'crypto';
import { promises as fs } from 'fs';
import { extname, join } from 'path';
import { PrismaService } from '../../prisma/prisma.service';
import { AiService } from '../ai/ai.service';
import { ImageIndexingService } from '../ai/image-indexing.service';

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

  async saveSearchImage(
    userId: number,
    file: Express.Multer.File,
  ): Promise<UploadPostImageResponse> {
    return this.saveImageAsset(userId, file, ImageAssetSourceType.SEARCH_QUERY, 'search');
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

    if (postImage.imageAsset.blurMethod === BlurMethod.AUTO) {
      throw new UnprocessableEntityException(
        `이미 AUTO 블러가 적용된 이미지입니다. blurMethod=${postImage.imageAsset.blurMethod}, aiBlurStatus=${postImage.imageAsset.aiBlurStatus}`,
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
      select: {
        id: true,
        updatedAt: true,
      },
    });

    try {
      await this.imageIndexingService.invalidateCurrentRuns(
        updatedAsset.id,
        ImageAnalysisPurpose.POST_INDEX,
      );
      await this.imageIndexingService.ensureCurrentAnalysisRun(
        updatedAsset.id,
        ImageAnalysisPurpose.POST_INDEX,
      );
    } catch (error) {
      this.logger.warn(
        `수동 블러 재분석 실패 — postId=${postId}, imageAssetId=${updatedAsset.id}, error=${error instanceof Error ? error.message : String(error)}`,
      );
    }

    this.logger.log(
      `수동 블러 적용 완료 — postId=${postId}, imageAssetId=${updatedAsset.id}, url=${processedImageUrl}`,
    );

    return {
      imageAssetId: updatedAsset.id,
      postId,
      processedImageUrl,
      blurMethod: 'MANUAL',
      updatedAt: updatedAsset.updatedAt.toISOString(),
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
        const processedExtension = processed.extension
          ? `.${processed.extension.replace(/^\./, '')}`
          : originalExtension;
        const processedFilename = `processed-${randomUUID()}${processedExtension}`;
        const processedFullPath = join(processedDir, processedFilename);

        await fs.writeFile(processedFullPath, processed.buffer);

        processedImageUrl = `/uploads/${folderPrefix}/processed/${today}/${processedFilename}`;
        blurMethod = BlurMethod.AUTO;
        aiBlurStatus = AiBlurStatus.DONE;
      } else {
        processedImageUrl = originalImageUrl;
        blurMethod = BlurMethod.NONE;
        aiBlurStatus = AiBlurStatus.NONE;
      }
    } catch (err) {
      this.logger.warn(
        `AI 블러 실패 fallback: storageKey=${originalStorageKey}, error=${String(err)}`,
      );
      processedImageUrl = originalImageUrl;
      blurMethod = BlurMethod.NONE;
      aiBlurStatus = AiBlurStatus.FAILED;
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