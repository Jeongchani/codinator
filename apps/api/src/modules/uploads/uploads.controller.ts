import {
  Controller,
  Post,
  UploadedFile,
  UseInterceptors,
  BadRequestException,
  Headers,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiBearerAuth, ApiConsumes, ApiBody, ApiOperation, ApiTags } from '@nestjs/swagger';
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
  @UseInterceptors(FileInterceptor('file'))
  async uploadPostImage(
    @UploadedFile() file: Express.Multer.File,
    @Headers('authorization') authorization?: string,
  ) {
    this.authTokenService.extractUserIdFromAuthorizationHeader(authorization, {
      required: true,
    });

    if (!file) {
      throw new BadRequestException('이미지 파일이 필요합니다.');
    }

    return this.uploadsService.savePostImage(file);
  }
}