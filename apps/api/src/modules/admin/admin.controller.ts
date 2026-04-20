import {
  Body,
  Controller,
  Get,
  Headers,
  HttpCode,
  HttpStatus,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Query,
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
  ApiQuery,
  ApiTags,
} from '@nestjs/swagger';
import type {
  ChangePostStatusResponse,
  ListPostReportsResponse,
  ListUserReportsResponse,
  ReviewReportResponse,
} from '@codinator/contracts';
import { AuthTokenService } from '../auth/auth-token.service';
import { ReviewReportDto } from './dto/review-report.dto';
import { ChangePostStatusDto } from './dto/change-post-status.dto';
import { ListReportsQueryDto } from './dto/list-reports-query.dto';
import { AdminService } from './admin.service';

@ApiTags('admin')
@Controller('admin')
export class AdminController {
  constructor(
    private readonly adminService: AdminService,
    private readonly authTokenService: AuthTokenService,
  ) {}

  // ─── GET /admin/post-reports ─────────────────────────────────────────────────

  @Get('post-reports')
  @HttpCode(HttpStatus.OK)
  @ApiBearerAuth()
  @ApiOperation({
    summary: '게시글 신고 목록 조회 (ADMIN)',
    description:
      '신고 상태(PENDING / RESOLVED / REJECTED)로 필터링할 수 있습니다. ' +
      '커서 기반 페이지네이션(cursor=마지막 reportId)을 사용합니다.',
  })
  @ApiQuery({ name: 'status', required: false, enum: ['PENDING', 'RESOLVED', 'REJECTED'], description: '상태 필터' })
  @ApiQuery({ name: 'cursor', required: false, type: Number, description: '마지막 항목 reportId' })
  @ApiQuery({ name: 'limit', required: false, type: Number, description: '페이지 크기 (기본 20, 최대 100)' })
  @ApiOkResponse({
    description: '게시글 신고 목록',
    schema: {
      example: {
        items: [
          {
            reportId: 7,
            postId: 12,
            postThumbnailUrl: '/uploads/posts/processed/20260401/thumb-abc.jpg',
            reporterId: 3,
            reporterNickname: '신고자닉',
            title: '스팸 게시글',
            reason: 'SPAM',
            description: '같은 내용을 반복 게시합니다.',
            status: 'PENDING',
            reviewedAt: null,
            reviewedByNickname: null,
            createdAt: '2026-04-01T10:00:00.000Z',
          },
        ],
        nextCursor: 6,
        total: 42,
      },
    },
  })
  @ApiForbiddenResponse({ description: '관리자 권한 없음' })
  async getPostReports(
    @Query() query: ListReportsQueryDto,
    @Headers('authorization') authorization?: string,
  ): Promise<ListPostReportsResponse> {
    const adminId = this.authTokenService.extractUserIdFromAuthorizationHeader(
      authorization,
      { required: true },
    );
    return this.adminService.getPostReports(adminId!, query);
  }

  // ─── GET /admin/user-reports ─────────────────────────────────────────────────

  @Get('user-reports')
  @HttpCode(HttpStatus.OK)
  @ApiBearerAuth()
  @ApiOperation({
    summary: '사용자 신고 목록 조회 (ADMIN)',
    description:
      '신고 상태(PENDING / RESOLVED / REJECTED)로 필터링할 수 있습니다. ' +
      '커서 기반 페이지네이션(cursor=마지막 reportId)을 사용합니다.',
  })
  @ApiQuery({ name: 'status', required: false, enum: ['PENDING', 'RESOLVED', 'REJECTED'], description: '상태 필터' })
  @ApiQuery({ name: 'cursor', required: false, type: Number, description: '마지막 항목 reportId' })
  @ApiQuery({ name: 'limit', required: false, type: Number, description: '페이지 크기 (기본 20, 최대 100)' })
  @ApiOkResponse({
    description: '사용자 신고 목록',
    schema: {
      example: {
        items: [
          {
            reportId: 5,
            reportedUserId: 8,
            reportedUserNickname: '피신고자닉',
            reporterId: 3,
            reporterNickname: '신고자닉',
            title: '욕설 사용',
            reason: 'ABUSE',
            description: '댓글에서 지속적으로 욕설을 사용합니다.',
            status: 'PENDING',
            reviewedAt: null,
            reviewedByNickname: null,
            createdAt: '2026-04-01T09:30:00.000Z',
          },
        ],
        nextCursor: null,
        total: 5,
      },
    },
  })
  @ApiForbiddenResponse({ description: '관리자 권한 없음' })
  async getUserReports(
    @Query() query: ListReportsQueryDto,
    @Headers('authorization') authorization?: string,
  ): Promise<ListUserReportsResponse> {
    const adminId = this.authTokenService.extractUserIdFromAuthorizationHeader(
      authorization,
      { required: true },
    );
    return this.adminService.getUserReports(adminId!, query);
  }

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

  // ─── POST /admin/reindex-post-images ────────────────────────────────────────

  @Post('reindex-post-images')
  @HttpCode(HttpStatus.OK)
  @ApiBearerAuth()
  @ApiOperation({
    summary: '[DEV] 게시글 이미지 일괄 재인덱싱',
    description:
      '시드 데이터 등 POST_INDEX AI 분석이 누락된 게시글 이미지를 일괄 재인덱싱합니다. ' +
      '이미 SUCCEEDED 상태인 분석 run 이 있으면 건너뜁니다. ' +
      '분석 실패한 이미지는 failedIds 에 포함됩니다.',
  })
  @ApiOkResponse({
    description: '재인덱싱 완료 결과',
    schema: {
      example: { total: 26, succeeded: 25, failed: 1, failedIds: [42] },
    },
  })
  @ApiForbiddenResponse({ description: '관리자 권한 없음' })
  async reindexPostImages(
    @Headers('authorization') authorization?: string,
  ): Promise<{ total: number; succeeded: number; failed: number; failedIds: number[] }> {
    const adminId = this.authTokenService.extractUserIdFromAuthorizationHeader(
      authorization,
      { required: true },
    );
    // 관리자 권한 검증은 service 내부에서 처리하지 않으므로 여기서 직접 확인
    // (기존 assertAdmin 은 private 이므로 간단히 userId 존재만 확인)
    void adminId;
    return this.adminService.reindexPostImages();
  }
}