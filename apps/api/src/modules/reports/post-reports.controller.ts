import {
  Body,
  Controller,
  Headers,
  HttpCode,
  HttpStatus,
  Param,
  ParseIntPipe,
  Post,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiBody,
  ApiConflictResponse,
  ApiCreatedResponse,
  ApiForbiddenResponse,
  ApiNotFoundResponse,
  ApiOperation,
  ApiParam,
  ApiTags,
} from '@nestjs/swagger';
import type { CreateReportResponse } from '@codinator/contracts';
import { AuthTokenService } from '../auth/auth-token.service';
import { CreateReportDto } from './dto/create-report.dto';
import { ReportsService } from './reports.service';

@ApiTags('reports')
@Controller('posts')
export class PostReportsController {
  constructor(
    private readonly reportsService: ReportsService,
    private readonly authTokenService: AuthTokenService,
  ) {}

  // ─── POST /posts/:postId/reports ──────────────────────────────────────────────

  @Post(':postId/reports')
  @HttpCode(HttpStatus.CREATED)
  @ApiBearerAuth()
  @ApiOperation({ summary: '게시글 신고' })
  @ApiParam({ name: 'postId', type: Number, example: 12, description: '신고할 게시글 ID' })
  @ApiBody({ type: CreateReportDto })
  @ApiCreatedResponse({
    description: '신고 접수 완료 (PENDING)',
    schema: {
      example: { reportId: 3, status: 'PENDING' },
    },
  })
  @ApiConflictResponse({
    description: '이미 해당 게시글에 대한 신고 이력이 있습니다.',
  })
  @ApiForbiddenResponse({
    description: '본인 게시글은 신고할 수 없습니다.',
  })
  @ApiNotFoundResponse({
    description: '게시글을 찾을 수 없습니다.',
  })
  async reportPost(
    @Param('postId', ParseIntPipe) postId: number,
    @Body() body: CreateReportDto,
    @Headers('authorization') authorization?: string,
  ): Promise<CreateReportResponse> {
    const reporterId = this.authTokenService.extractUserIdFromAuthorizationHeader(
      authorization,
      { required: true },
    );
    return this.reportsService.reportPost(reporterId!, postId, body);
  }
}
