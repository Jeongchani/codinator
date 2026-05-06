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
} from '@nestjs/swagger';
import type { ManualBlurResponse, UploadPostImageResponse, UploadSearchImageResponse } from '@codinator/contracts'; // V3 Batch9: UploadSearchImageResponse 추가
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
    const userId = this.authTokenService.extractUserIdFromAuthorizationHeader(
      authorization,
      { required: true },
    );

    if (!file) {
      throw new BadRequestException('이미지 파일이 필요합니다.');
    }

    return this.uploadsService.savePostImage(userId!, file);
  }

  // ── POST /uploads/search-image ────────────────────────────────────────────
  // V3 Batch9: 검색용 이미지 업로드 (face blur 없음, imageAssetId만 반환)

  @Post('search-image')
  @ApiBearerAuth()
  @ApiOperation({
    summary: '이미지 검색용 업로드 (V3)',
    description: [
      '검색에 사용할 이미지 1장을 업로드합니다.',
      '지원 형식: jpg/jpeg, png, webp (최대 50MB (10MB 초과 시 자동 리사이징)).',
      '검색용 이미지는 공개되지 않으므로 face blur가 적용되지 않습니다.',
      '응답으로 받은 imageAssetId를 POST /search/image 에서 사용하세요.',
      'AI 분석(garment 감지 + 임베딩 추출)은 /search/image 호출 시 자동으로 수행됩니다.',
    ].join(' '),
  })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        file: {
          type: 'string',
          format: 'binary',
          description: '검색용 이미지 파일 (jpg/jpeg/png/webp, 최대 50MB (10MB 초과 시 자동 리사이징))',
        },
      },
      required: ['file'],
    },
  })
  @ApiOkResponse({
    description: '검색용 이미지 자산 생성 완료. imageAssetId를 /search/image 에서 사용',
    schema: {
      example: {
        imageAssetId: 201,
        originalImageUrl: '/uploads/search/originals/20260420/uuid.jpg',
      },
    },
  })
  @UseInterceptors(FileInterceptor('file'))
  async uploadSearchImage(
    @UploadedFile() file: Express.Multer.File,
    @Headers('authorization') authorization?: string,
  ): Promise<UploadSearchImageResponse> { // V3 Batch9: UploadPostImageResponse → UploadSearchImageResponse
    const userId = this.authTokenService.extractUserIdFromAuthorizationHeader(
      authorization,
      { required: true },
    );

    if (!file) {
      throw new BadRequestException('이미지 파일이 필요합니다.');
    }

    return this.uploadsService.saveSearchImage(userId!, file);
  }

  // imageAssetId 기준 수동 블러 적용 (V3 표준 흐름)
  @Patch('image-assets/:imageAssetId/manual-blur')
  @HttpCode(HttpStatus.OK)
  @ApiBearerAuth()
  @ApiOperation({
    summary: '수동 블러 이미지 적용 (imageAssetId 기반)',
    description:
      '게시글 생성 전 업로드 단계에서 imageAssetId 기준으로 수동 블러를 적용합니다. ' +
      'V3 흐름: 이미지 업로드 → AI 블러 결과 확인 → 수동 블러 선택 시 이 endpoint 호출 → 게시글 생성. ' +
      'aiBlurStatus는 AI 파이프라인 결과이므로 변경되지 않으며, blurMethod만 MANUAL로 업데이트됩니다.',
  })
  @ApiParam({ name: 'imageAssetId', type: Number, example: 42, description: '이미지 자산 ID' })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        file: {
          type: 'string',
          format: 'binary',
          description: '직접 블러 처리한 이미지 파일 (jpg/png/webp, 최대 50MB (10MB 초과 시 자동 리사이징))',
        },
      },
      required: ['file'],
    },
  })
  @ApiOkResponse({ description: '수동 블러 적용 완료 (postId 없음 — 게시글 생성 전)' })
  @ApiForbiddenResponse({ description: '본인 이미지 자산에만 적용 가능' })
  @ApiNotFoundResponse({ description: '이미지 자산을 찾을 수 없음' })
  @UseInterceptors(FileInterceptor('file'))
  async applyManualBlurByAsset(
    @Param('imageAssetId', ParseIntPipe) imageAssetId: number,
    @UploadedFile() file: Express.Multer.File,
    @Headers('authorization') authorization?: string,
  ): Promise<ManualBlurResponse> {
    const userId = this.authTokenService.extractUserIdFromAuthorizationHeader(
      authorization,
      { required: true },
    );

    if (!file) {
      throw new BadRequestException('블러 처리된 이미지 파일이 필요합니다.');
    }

    return this.uploadsService.applyManualBlurByAsset(userId!, imageAssetId, file);
  }
}