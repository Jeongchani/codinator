import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import type { UploadPostImageResponse } from '@codinator/contracts';
import { randomUUID } from 'crypto';
import { promises as fs } from 'fs';
import { extname, join } from 'path';
import { AiService } from '../ai/ai.service';

@Injectable()
export class UploadsService {
  private readonly uploadRoot = join(process.cwd(), 'uploads');
  private readonly logger = new Logger(UploadsService.name);

  constructor(private readonly aiService: AiService) {}

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
