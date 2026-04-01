import {
  Body,
  Controller,
  Headers,
  HttpCode,
  HttpStatus,
  Param,
  ParseIntPipe,
  Patch,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiBody,
  ApiBadRequestResponse,
  ApiForbiddenResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiTags,
} from '@nestjs/swagger';
import type {
  ReviewReportResponse,
  ChangePostStatusResponse,
} from '@codinator/contracts';
import { AuthTokenService } from '../auth/auth-token.service';
import { ReviewReportDto } from './dto/review-report.dto';
import { ChangePostStatusDto } from './dto/change-post-status.dto';
import { AdminService } from './admin.service';

@ApiTags('admin')
@Controller('admin')
export class AdminController {
  constructor(
    private readonly adminService: AdminService,
    private readonly authTokenService: AuthTokenService,
  ) {}

  // ─── PATCH /admin/post-reports/:reportId ──────────────────────────────────────

  @Patch('post-reports/:reportId')
  @HttpCode(HttpStatus.OK)
  @ApiBearerAuth()
  @ApiOperation({ summary: '게시글 신고 처리 (ADMIN)' })
  @ApiParam({ name: 'reportId', type: Number, example: 3, description: '신고 ID' })
  @ApiBody({ type: ReviewReportDto })
  @ApiOkResponse({
    description: '신고 처리 완료',
    schema: {
      example: { reportId: 3, status: 'RESOLVED', reviewedAt: '2026-03-30T12:00:00.000Z' },
    },
  })
  @ApiBadRequestResponse({ description: '잘못된 action 값 또는 이미 처리된 신고' })
  @ApiForbiddenResponse({ description: '관리자 권한 없음' })
  @ApiNotFoundResponse({ description: '신고를 찾을 수 없음' })
  async reviewReport(
    @Param('reportId', ParseIntPipe) reportId: number,
    @Body() body: ReviewReportDto,
    @Headers('authorization') authorization?: string,
  ): Promise<ReviewReportResponse> {
    const adminId = this.authTokenService.extractUserIdFromAuthorizationHeader(
      authorization,
      { required: true },
    );
    return this.adminService.reviewReport(adminId!, reportId, body);
  }

  // ─── PATCH /admin/user-reports/:reportId ────────────────────────────────────

  @Patch('user-reports/:reportId')
  @HttpCode(HttpStatus.OK)
  @ApiBearerAuth()
  @ApiOperation({ summary: '유저 신고 처리 (ADMIN)' })
  @ApiParam({ name: 'reportId', type: Number, example: 5, description: '유저 신고 ID' })
  @ApiBody({ type: ReviewReportDto })
  @ApiOkResponse({
    description: '유저 신고 처리 완료',
    schema: {
      example: { reportId: 5, status: 'REJECTED', reviewedAt: '2026-03-30T12:00:00.000Z' },
    },
  })
  @ApiBadRequestResponse({ description: '잘못된 action 값 또는 이미 처리된 신고' })
  @ApiForbiddenResponse({ description: '관리자 권한 없음' })
  @ApiNotFoundResponse({ description: '신고를 찾을 수 없음' })
  async reviewUserReport(
    @Param('reportId', ParseIntPipe) reportId: number,
    @Body() body: ReviewReportDto,
    @Headers('authorization') authorization?: string,
  ): Promise<ReviewReportResponse> {
    const adminId = this.authTokenService.extractUserIdFromAuthorizationHeader(
      authorization,
      { required: true },
    );
    return this.adminService.reviewUserReport(adminId!, reportId, body);
  }

  // ─── PATCH /admin/posts/:postId/status ───────────────────────────────────────

  @Patch('posts/:postId/status')
  @HttpCode(HttpStatus.OK)
  @ApiBearerAuth()
  @ApiOperation({ summary: '게시글 상태 강제 변경 (ADMIN)' })
  @ApiParam({ name: 'postId', type: Number, example: 12, description: '게시글 ID' })
  @ApiBody({ type: ChangePostStatusDto })
  @ApiOkResponse({
    description: '게시글 상태 변경 완료',
    schema: {
      example: {
        postId: 12,
        status: 'HIDDEN',
        hiddenAt: '2026-03-30T12:00:00.000Z',
        hiddenReason: '커뮤니티 가이드라인 위반',
        updatedAt: '2026-03-30T12:00:00.000Z',
      },
    },
  })
  @ApiBadRequestResponse({ description: '잘못된 status 값 또는 hiddenReason 규칙 위반' })
  @ApiForbiddenResponse({ description: '관리자 권한 없음' })
  @ApiNotFoundResponse({ description: '게시글을 찾을 수 없음 (이미 삭제됨 포함)' })
  async changePostStatus(
    @Param('postId', ParseIntPipe) postId: number,
    @Body() body: ChangePostStatusDto,
    @Headers('authorization') authorization?: string,
  ): Promise<ChangePostStatusResponse> {
    const adminId = this.authTokenService.extractUserIdFromAuthorizationHeader(
      authorization,
      { required: true },
    );
    return this.adminService.changePostStatus(adminId!, postId, body);
  }
}
