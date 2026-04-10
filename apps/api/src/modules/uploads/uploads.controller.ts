import {
  Controller,
  HttpCode,
  HttpStatus,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  UploadedFile,
  UseInterceptors,
  BadRequestException,
  Headers,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import {
  ApiBearerAuth,
  ApiBody,
  ApiConsumes,
  ApiForbiddenResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiTags,
  ApiUnprocessableEntityResponse,
} from '@nestjs/swagger';
import type { ManualBlurResponse, UploadPostImageResponse } from '@codinator/contracts';
import { AuthTokenService } from '../auth/auth-token.service';
import { UploadsService } from './uploads.service';

@ApiTags('uploads')
@Controller('uploads')
export class UploadsController {
  constructor(
    private readonly uploadsService: UploadsService,
    private readonly authTokenService: AuthTokenService,
  ) {}

  @Post('post-image')
  @ApiBearerAuth()
  @ApiOperation({ summary: '게시글 이미지 업로드' })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        file: {
          type: 'string',
          format: 'binary',
        },
      },
      required: ['file'],
    },
  })
  @ApiOkResponse({
    description: '게시글용 image asset 생성 결과',
  })
  @UseInterceptors(FileInterceptor('file'))
  async uploadPostImage(
    @UploadedFile() file: Express.Multer.File,
    @Headers('authorization') authorization?: string,
  ): Promise<UploadPostImageResponse> {
    const userId = this.authTokenService.extractUserIdFromAuthorizationHeader(authorization, {
      required: true,
    });

    if (!file) {
      throw new BadRequestException('이미지 파일이 필요합니다.');
    }

    return this.uploadsService.savePostImage(userId!, file);
  }

  @Post('search-image')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'AI 이미지 검색용 업로드' })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        file: {
          type: 'string',
          format: 'binary',
        },
      },
      required: ['file'],
    },
  })
  @ApiOkResponse({
    description: '검색용 image asset 생성 결과',
  })
  @UseInterceptors(FileInterceptor('file'))
  async uploadSearchImage(
    @UploadedFile() file: Express.Multer.File,
    @Headers('authorization') authorization?: string,
  ): Promise<UploadPostImageResponse> {
    const userId = this.authTokenService.extractUserIdFromAuthorizationHeader(authorization, {
      required: true,
    });

    if (!file) {
      throw new BadRequestException('이미지 파일이 필요합니다.');
    }

    return this.uploadsService.saveSearchImage(userId!, file);
  }

  @Patch('posts/:postId/manual-blur')
  @HttpCode(HttpStatus.OK)
  @ApiBearerAuth()
  @ApiOperation({
    summary: '수동 블러 이미지 적용',
    description: [
      '작성자가 직접 블러 처리한 이미지를 업로드하여 processedImageUrl을 교체합니다.',
      '',
      '**허용 조건 (아래 셋 중 하나):**',
      '- ① `aiBlurStatus=FAILED` + `blurMethod=NONE` — AI 블러 실패, 미처리 상태',
      '- ② `aiBlurStatus=DONE` + `blurMethod=AUTO` — AI 성공이지만 결과 부정확 → 작성자 override',
      '- ③ `blurMethod=MANUAL` — 이미 수동 처리됨 → 재처리(덮어쓰기)',
      '',
      '**처리 결과:**',
      '- `processedImageUrl` → 새 수동 블러 이미지 URL로 갱신',
      '- `blurMethod` → `MANUAL`로 변경',
      '- `aiBlurStatus` → 변경하지 않음 (AI 처리 기록 보존)',
    ].join('\n'),
  })
  @ApiParam({ name: 'postId', type: Number, example: 12, description: '게시글 ID' })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        file: {
          type: 'string',
          format: 'binary',
          description: '직접 블러 처리한 이미지 파일 (jpg/png/webp, 최대 5MB)',
        },
      },
      required: ['file'],
    },
  })
  @ApiOkResponse({
    description: '수동 블러 적용 완료',
    schema: {
      example: {
        imageId: 5,
        postId: 12,
        processedImageUrl: '/uploads/posts/processed/20260401/manual-abc123.jpg',
        blurMethod: 'MANUAL',
        updatedAt: '2026-04-01T03:00:00.000Z',
      },
    },
  })
  @ApiForbiddenResponse({ description: '본인 게시글에만 적용 가능' })
  @ApiNotFoundResponse({ description: '게시글 또는 이미지를 찾을 수 없음' })
  @ApiUnprocessableEntityResponse({
    description:
      '수동 블러 적용 불가 상태 — 허용: FAILED+NONE / DONE+AUTO / MANUAL 재처리. 예: PENDING, PROCESSING, DONE+NONE 등은 거부됨',
  })
  @UseInterceptors(FileInterceptor('file'))
  async applyManualBlur(
    @Param('postId', ParseIntPipe) postId: number,
    @UploadedFile() file: Express.Multer.File,
    @Headers('authorization') authorization?: string,
  ): Promise<ManualBlurResponse> {
    const userId = this.authTokenService.extractUserIdFromAuthorizationHeader(authorization, {
      required: true,
    });

    if (!file) {
      throw new BadRequestException('블러 처리된 이미지 파일이 필요합니다.');
    }

    return this.uploadsService.applyManualBlur(userId!, postId, file);
  }
}
