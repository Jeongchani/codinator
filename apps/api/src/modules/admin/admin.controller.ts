import {
  Body,
  Controller,
  Delete,
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
  ApiConflictResponse,
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
  CreateFeedbackTagResponse,
  CreateKeywordResponse,
  DeleteFeedbackTagResponse,
  DeleteKeywordResponse,
  GetAdminFeedbackTagsResponse,
  GetAdminKeywordsResponse,
  ListPostReportsResponse,
  ListUserReportsResponse,
  ReviewReportResponse,
  UpdateFeedbackTagResponse,
  UpdateKeywordResponse,
} from '@codinator/contracts';
import { AuthTokenService } from '../auth/auth-token.service';
import { ReviewReportDto } from './dto/review-report.dto';
import { ChangePostStatusDto } from './dto/change-post-status.dto';
import { ListReportsQueryDto } from './dto/list-reports-query.dto';
import { ListAdminKeywordsQueryDto } from './dto/list-admin-keywords-query.dto';
import { CreateKeywordDto } from './dto/create-keyword.dto';
import { UpdateKeywordDto } from './dto/update-keyword.dto';
import { ListAdminFeedbackTagsQueryDto } from './dto/list-admin-feedback-tags-query.dto';
import { CreateFeedbackTagDto } from './dto/create-feedback-tag.dto';
import { UpdateFeedbackTagDto } from './dto/update-feedback-tag.dto';
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

  // ─── [Batch10] GET /admin/keywords ──────────────────────────────────────────

  @Get('keywords')
  @HttpCode(HttpStatus.OK)
  @ApiBearerAuth()
  @ApiOperation({
    summary: '키워드 목록 조회 (ADMIN)',
    description: 'isActive 필터 가능. 생략 시 전체 반환. sortOrder ASC → id ASC 정렬.',
  })
  @ApiQuery({ name: 'isActive', required: false, type: Boolean, description: 'isActive 필터' })
  @ApiOkResponse({
    description: '키워드 목록',
    schema: {
      example: {
        items: [
          { id: 1, code: 'STREET_LOOK', label: '스트릿 룩', sortOrder: 0, isActive: true, createdAt: '2026-01-01T00:00:00.000Z', updatedAt: '2026-01-01T00:00:00.000Z' },
        ],
      },
    },
  })
  @ApiForbiddenResponse({ description: '관리자 권한 없음' })
  async getAdminKeywords(
    @Query() query: ListAdminKeywordsQueryDto,
    @Headers('authorization') authorization?: string,
  ): Promise<GetAdminKeywordsResponse> {
    const adminId = this.authTokenService.extractUserIdFromAuthorizationHeader(
      authorization,
      { required: true },
    );
    return this.adminService.getAdminKeywords(adminId!, query);
  }

  // ─── [Batch10] POST /admin/keywords ─────────────────────────────────────────

  @Post('keywords')
  @HttpCode(HttpStatus.OK)
  @ApiBearerAuth()
  @ApiOperation({ summary: '키워드 생성 (ADMIN)' })
  @ApiBody({ type: CreateKeywordDto })
  @ApiOkResponse({
    description: '생성된 키워드',
    schema: {
      example: { id: 10, code: 'STREET_LOOK', label: '스트릿 룩', sortOrder: 0, isActive: true, createdAt: '2026-04-21T00:00:00.000Z' },
    },
  })
  @ApiBadRequestResponse({ description: '유효성 검사 실패' })
  @ApiConflictResponse({ description: 'code 중복' })
  @ApiForbiddenResponse({ description: '관리자 권한 없음' })
  async createKeyword(
    @Body() body: CreateKeywordDto,
    @Headers('authorization') authorization?: string,
  ): Promise<CreateKeywordResponse> {
    const adminId = this.authTokenService.extractUserIdFromAuthorizationHeader(
      authorization,
      { required: true },
    );
    return this.adminService.createKeyword(adminId!, body);
  }

  // ─── [Batch10] PATCH /admin/keywords/:keywordId ──────────────────────────────

  @Patch('keywords/:keywordId')
  @HttpCode(HttpStatus.OK)
  @ApiBearerAuth()
  @ApiOperation({ summary: '키워드 수정 (ADMIN) — code 변경 불가' })
  @ApiParam({ name: 'keywordId', type: Number, example: 1 })
  @ApiBody({ type: UpdateKeywordDto })
  @ApiOkResponse({
    description: '수정된 키워드',
    schema: {
      example: { id: 1, code: 'STREET_LOOK', label: '스트릿 스타일', sortOrder: 5, isActive: true, updatedAt: '2026-04-21T00:00:00.000Z' },
    },
  })
  @ApiBadRequestResponse({ description: '유효성 검사 실패' })
  @ApiForbiddenResponse({ description: '관리자 권한 없음' })
  @ApiNotFoundResponse({ description: '키워드를 찾을 수 없음' })
  async updateKeyword(
    @Param('keywordId', ParseIntPipe) keywordId: number,
    @Body() body: UpdateKeywordDto,
    @Headers('authorization') authorization?: string,
  ): Promise<UpdateKeywordResponse> {
    const adminId = this.authTokenService.extractUserIdFromAuthorizationHeader(
      authorization,
      { required: true },
    );
    return this.adminService.updateKeyword(adminId!, keywordId, body);
  }

  // ─── [Batch10] DELETE /admin/keywords/:keywordId ─────────────────────────────

  @Delete('keywords/:keywordId')
  @HttpCode(HttpStatus.OK)
  @ApiBearerAuth()
  @ApiOperation({ summary: '키워드 삭제 (ADMIN) — 미사용 키워드만 가능' })
  @ApiParam({ name: 'keywordId', type: Number, example: 1 })
  @ApiOkResponse({
    description: '삭제 성공',
    schema: { example: { success: true, message: '키워드가 삭제되었습니다.' } },
  })
  @ApiConflictResponse({ description: '게시글에서 사용 중 — isActive=false로 비활성화 권장' })
  @ApiForbiddenResponse({ description: '관리자 권한 없음' })
  @ApiNotFoundResponse({ description: '키워드를 찾을 수 없음' })
  async deleteKeyword(
    @Param('keywordId', ParseIntPipe) keywordId: number,
    @Headers('authorization') authorization?: string,
  ): Promise<DeleteKeywordResponse> {
    const adminId = this.authTokenService.extractUserIdFromAuthorizationHeader(
      authorization,
      { required: true },
    );
    return this.adminService.deleteKeyword(adminId!, keywordId);
  }

  // ─── [Batch10] GET /admin/feedback-tags ─────────────────────────────────────

  @Get('feedback-tags')
  @HttpCode(HttpStatus.OK)
  @ApiBearerAuth()
  @ApiOperation({
    summary: '피드백 태그 목록 조회 (ADMIN)',
    description: 'voteChoice / groupCode / isActive 필터 가능. 생략 시 전체 반환.',
  })
  @ApiQuery({ name: 'voteChoice', required: false, enum: ['LIKE', 'DISLIKE'], description: 'voteChoice 필터' })
  @ApiQuery({ name: 'groupCode', required: false, type: String, description: 'groupCode 필터' })
  @ApiQuery({ name: 'isActive', required: false, type: Boolean, description: 'isActive 필터' })
  @ApiOkResponse({
    description: '피드백 태그 목록',
    schema: {
      example: {
        items: [
          { id: 1, code: 'TRENDY_STYLE', label: '트렌디한 스타일', groupCode: 'STYLE', voteChoice: 'LIKE', isActive: true, sortOrder: 0, createdAt: '2026-01-01T00:00:00.000Z', updatedAt: '2026-01-01T00:00:00.000Z' },
        ],
      },
    },
  })
  @ApiForbiddenResponse({ description: '관리자 권한 없음' })
  async getAdminFeedbackTags(
    @Query() query: ListAdminFeedbackTagsQueryDto,
    @Headers('authorization') authorization?: string,
  ): Promise<GetAdminFeedbackTagsResponse> {
    const adminId = this.authTokenService.extractUserIdFromAuthorizationHeader(
      authorization,
      { required: true },
    );
    return this.adminService.getAdminFeedbackTags(adminId!, query);
  }

  // ─── [Batch10] POST /admin/feedback-tags ────────────────────────────────────

  @Post('feedback-tags')
  @HttpCode(HttpStatus.OK)
  @ApiBearerAuth()
  @ApiOperation({ summary: '피드백 태그 생성 (ADMIN)' })
  @ApiBody({ type: CreateFeedbackTagDto })
  @ApiOkResponse({
    description: '생성된 피드백 태그',
    schema: {
      example: { id: 5, code: 'TRENDY_STYLE', label: '트렌디한 스타일', groupCode: 'STYLE', voteChoice: 'LIKE', isActive: true, sortOrder: 0, createdAt: '2026-04-21T00:00:00.000Z' },
    },
  })
  @ApiBadRequestResponse({ description: '유효성 검사 실패' })
  @ApiConflictResponse({ description: 'code 중복' })
  @ApiForbiddenResponse({ description: '관리자 권한 없음' })
  async createFeedbackTag(
    @Body() body: CreateFeedbackTagDto,
    @Headers('authorization') authorization?: string,
  ): Promise<CreateFeedbackTagResponse> {
    const adminId = this.authTokenService.extractUserIdFromAuthorizationHeader(
      authorization,
      { required: true },
    );
    return this.adminService.createFeedbackTag(adminId!, body);
  }

  // ─── [Batch10] PATCH /admin/feedback-tags/:tagId ────────────────────────────

  @Patch('feedback-tags/:tagId')
  @HttpCode(HttpStatus.OK)
  @ApiBearerAuth()
  @ApiOperation({ summary: '피드백 태그 수정 (ADMIN) — code·voteChoice 변경 불가' })
  @ApiParam({ name: 'tagId', type: Number, example: 1 })
  @ApiBody({ type: UpdateFeedbackTagDto })
  @ApiOkResponse({
    description: '수정된 피드백 태그',
    schema: {
      example: { id: 1, code: 'TRENDY_STYLE', label: '세련된 스타일', groupCode: 'STYLE', voteChoice: 'LIKE', isActive: true, sortOrder: 5, updatedAt: '2026-04-21T00:00:00.000Z' },
    },
  })
  @ApiBadRequestResponse({ description: '유효성 검사 실패' })
  @ApiForbiddenResponse({ description: '관리자 권한 없음' })
  @ApiNotFoundResponse({ description: '피드백 태그를 찾을 수 없음' })
  async updateFeedbackTag(
    @Param('tagId', ParseIntPipe) tagId: number,
    @Body() body: UpdateFeedbackTagDto,
    @Headers('authorization') authorization?: string,
  ): Promise<UpdateFeedbackTagResponse> {
    const adminId = this.authTokenService.extractUserIdFromAuthorizationHeader(
      authorization,
      { required: true },
    );
    return this.adminService.updateFeedbackTag(adminId!, tagId, body);
  }

  // ─── [Batch10] DELETE /admin/feedback-tags/:tagId ───────────────────────────

  @Delete('feedback-tags/:tagId')
  @HttpCode(HttpStatus.OK)
  @ApiBearerAuth()
  @ApiOperation({ summary: '피드백 태그 삭제 (ADMIN) — 미사용 태그만 가능' })
  @ApiParam({ name: 'tagId', type: Number, example: 1 })
  @ApiOkResponse({
    description: '삭제 성공',
    schema: { example: { success: true, message: '피드백 태그가 삭제되었습니다.' } },
  })
  @ApiConflictResponse({ description: '피드백에서 사용 중 — isActive=false로 비활성화 권장' })
  @ApiForbiddenResponse({ description: '관리자 권한 없음' })
  @ApiNotFoundResponse({ description: '피드백 태그를 찾을 수 없음' })
  async deleteFeedbackTag(
    @Param('tagId', ParseIntPipe) tagId: number,
    @Headers('authorization') authorization?: string,
  ): Promise<DeleteFeedbackTagResponse> {
    const adminId = this.authTokenService.extractUserIdFromAuthorizationHeader(
      authorization,
      { required: true },
    );
    return this.adminService.deleteFeedbackTag(adminId!, tagId);
  }
}