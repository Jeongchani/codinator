import {
  BadRequestException,
  Controller,
  Post,
  Res,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import type { Response } from 'express';
import {
  ApiBody,
  ApiConsumes,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { AiService } from './ai.service';

@ApiTags('ai')
@Controller('ai')
export class AiController {
  constructor(private readonly aiService: AiService) {}

  @Post('blur-face')
  @ApiOperation({ summary: 'AI 얼굴 블러 프록시 테스트' })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        image: {
          type: 'string',
          format: 'binary',
        },
      },
      required: ['image'],
    },
  })
  @ApiOkResponse({
    description: 'AI 서버가 처리한 블러 이미지 바이너리',
  })
  @UseInterceptors(
    FileInterceptor('image', {
      storage: memoryStorage(),
      limits: {
        fileSize: 10 * 1024 * 1024,
      },
      fileFilter: (req, file, cb) => {
        const allowedMimeTypes = ['image/jpeg', 'image/png', 'image/webp'];

        if (!allowedMimeTypes.includes(file.mimetype)) {
          return cb(
            new BadRequestException('jpg, jpeg, png, webp 파일만 업로드 가능합니다.'),
            false,
          );
        }

        cb(null, true);
      },
    }),
  )
  async blurFace(
    @UploadedFile() image: Express.Multer.File,
    @Res({ passthrough: true }) response: Response,
  ) {
    if (!image) {
      throw new BadRequestException('이미지 파일이 필요합니다.');
    }

    const result = await this.aiService.blurFace(image);

    response.setHeader('Content-Type', result.mimeType);
    response.setHeader('X-AI-Faces-Detected', String(result.facesDetected));
    response.setHeader('X-AI-Blurred', result.blurred ? 'true' : 'false');
    response.setHeader('X-AI-Width', String(result.width));
    response.setHeader('X-AI-Height', String(result.height));

    return result.buffer;
  }
}
