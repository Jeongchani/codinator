import { BadRequestException, Injectable } from '@nestjs/common';
import type { UploadPostImageResponse } from '@codinator/contracts';
import { promises as fs } from 'fs';
import { join, extname } from 'path';
import { randomUUID } from 'crypto';

@Injectable()
export class UploadsService {
  private readonly uploadRoot = join(process.cwd(), 'uploads');

  async savePostImage(file: Express.Multer.File): Promise<UploadPostImageResponse> {
    this.validateImage(file);

    const today = this.getDatePath();
    const originalDir = join(this.uploadRoot, 'posts', 'originals', today);
    const processedDir = join(this.uploadRoot, 'posts', 'processed', today);

    await Promise.all([
      fs.mkdir(originalDir, { recursive: true }),
      fs.mkdir(processedDir, { recursive: true }),
    ]);

    const extension = extname(file.originalname) || '.jpg';
    const filename = `${randomUUID()}${extension}`;
    const processedFilename = `processed-${filename}`;

    const originalFullPath = join(originalDir, filename);
    const processedFullPath = join(processedDir, processedFilename);

    await fs.writeFile(originalFullPath, file.buffer);
    await fs.writeFile(processedFullPath, file.buffer);

    const storageKey = `posts/originals/${today}/${filename}`;
    const originalImageUrl = `/uploads/${storageKey}`;
    const processedImageUrl = `/uploads/posts/processed/${today}/${processedFilename}`;

    return {
      originalImageUrl,
      processedImageUrl,
      thumbnailUrl: null,
      storageKey,
      blurMethod: 'NONE',
      aiBlurStatus: 'NONE',
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
