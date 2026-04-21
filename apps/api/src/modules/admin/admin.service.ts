import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import type {
  AdminFeedbackTagItem,
  AdminKeywordItem,
  ChangePostStatusRequest,
  ChangePostStatusResponse,
  ChangeUserStatusRequest,
  ChangeUserStatusResponse,
  CreateFeedbackTagRequest,
  CreateFeedbackTagResponse,
  CreateKeywordRequest,
  CreateKeywordResponse,
  CreateSanctionRequest,
  CreateSanctionResponse,
  DeleteFeedbackTagResponse,
  DeleteKeywordResponse,
  EndSanctionRequest,
  EndSanctionResponse,
  GetAdminFeedbackTagsResponse,
  GetAdminKeywordsResponse,
  ListActionLogsResponse,
  ListAdminPostsResponse,
  ListAdminUsersResponse,
  ListPostReportsResponse,
  ListReportHistoriesResponse,
  ListSanctionsResponse,
  ListUserReportsResponse,
  ReviewReportRequest,
  ReviewReportResponse,
  UpdateFeedbackTagRequest,
  UpdateFeedbackTagResponse,
  UpdateKeywordRequest,
  UpdateKeywordResponse,
} from '@codinator/contracts';
import {
  AdminActionTargetType,
  AdminActionType,
  ImageAnalysisPurpose,
  PostStatus,
  ReportHistoryActionType,
  ReportStatus,
  ReportTargetType,
  SanctionType,
  UserRole,
  UserStatus,
  VoteChoice,
} from '@prisma/client';
import { POST_IMAGE_INCLUDE } from '../posts/common/post-presenter.util';
import type { ListReportsQueryDto } from './dto/list-reports-query.dto';
import type { ListAdminKeywordsQueryDto } from './dto/list-admin-keywords-query.dto';
import type { ListAdminFeedbackTagsQueryDto } from './dto/list-admin-feedback-tags-query.dto';
import type { ListAdminPostsQueryDto } from './dto/list-admin-posts-query.dto';
import type { ListAdminUsersQueryDto } from './dto/list-admin-users-query.dto';
import type { ListSanctionsQueryDto } from './dto/list-sanctions-query.dto';
import type { ListActionLogsQueryDto } from './dto/list-action-logs-query.dto';
import type { ListReportHistoriesQueryDto } from './dto/list-report-histories-query.dto';
import { PrismaService } from '../../prisma/prisma.service';
import { ImageIndexingService } from '../ai/image-indexing.service';
import { syncPostSearchIndex } from '../search/common/post-search-index.util';

@Injectable()
export class AdminService {
  private readonly logger = new Logger(AdminService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly imageIndexingService: ImageIndexingService,
  ) {}

  // ─── 권한 검증 헬퍼 ────────────────────────────────────────────────────────────

  /**
   * OPERATOR_ADMIN 이상 (OPERATOR_ADMIN + SUPER_ADMIN) 허용.
   * 기존 assertAdmin과 동일하며 일상 운영 처리용. // V3 Batch11
   */
  private async assertOperatorAdmin(adminId: number): Promise<void> {
    const user = await this.prisma.user.findUnique({
      where: { id: adminId },
      select: { role: true },
    });

    if (!user) {
      throw new UnauthorizedException('사용자를 찾을 수 없습니다.');
    }

    if (user.role !== UserRole.SUPER_ADMIN && user.role !== UserRole.OPERATOR_ADMIN) {
      throw new ForbiddenException('관리자 권한이 필요합니다.');
    }
  }

  /**
   * SUPER_ADMIN 전용 작업 검증. // V3 Batch11
   * 게시글 DELETED / 회원 DELETED / PERMANENT_BAN / 재인덱싱 / 키워드·피드백태그 CRUD 등에 사용.
   */
  private async assertSuperAdmin(adminId: number): Promise<void> {
    const user = await this.prisma.user.findUnique({
      where: { id: adminId },
      select: { role: true },
    });

    if (!user) {
      throw new UnauthorizedException('사용자를 찾을 수 없습니다.');
    }

    if (user.role !== UserRole.SUPER_ADMIN) {
      throw new ForbiddenException('SUPER_ADMIN 권한이 필요합니다.');
    }
  }

  // ─── 로그/이력 헬퍼 ────────────────────────────────────────────────────────────

  /** admin_action_logs 단건 기록 // V3 Batch11 */
  private async logAdminAction(params: {
    adminId: number;
    targetType: AdminActionTargetType;
    targetId: number;
    actionType: AdminActionType;
    reason?: string | null;
    metadataJson?: Record<string, unknown> | null;
  }): Promise<void> {
    try {
      await this.prisma.adminActionLog.create({
        data: {
          adminId: params.adminId,
          targetType: params.targetType,
          targetId: params.targetId,
          actionType: params.actionType,
          reason: params.reason ?? null,
          metadataJson: params.metadataJson ?? undefined,
        },
      });
    } catch (err) {
      this.logger.warn(`[adminActionLog] 기록 실패: ${String(err)}`);
    }
  }

  /** report_histories 단건 기록 // V3 Batch11 */
  private async logReportHistory(params: {
    targetType: ReportTargetType;
    targetId: number;
    actorId: number | null;
    actionType: ReportHistoryActionType;
    note?: string | null;
  }): Promise<void> {
    try {
      await this.prisma.reportHistory.create({
        data: {
          targetType: params.targetType,
          targetId: params.targetId,
          actorId: params.actorId ?? null,
          actionType: params.actionType,
          note: params.note ?? null,
        },
      });
    } catch (err) {
      this.logger.warn(`[reportHistory] 기록 실패: ${String(err)}`);
    }
  }

  // ─── 게시글 신고 처리 (PATCH /admin/post-reports/:id) ────────────────────────

  async reviewReport(
    adminId: number,
    reportId: number,
    body: ReviewReportRequest,
  ): Promise<ReviewReportResponse> {
    await this.assertOperatorAdmin(adminId);
    this.validateReviewAction(body.action);

    const report = await this.prisma.report.findUnique({
      where: { id: reportId },
      select: { id: true, status: true },
    });

    if (!report) {
      throw new NotFoundException('신고를 찾을 수 없습니다.');
    }

    if (report.status !== ReportStatus.PENDING) {
      throw new BadRequestException('이미 처리된 신고입니다.');
    }

    const now = new Date();
    const updated = await this.prisma.report.update({
      where: { id: reportId },
      data: {
        status: body.action as ReportStatus,
        reviewedAt: now,
        reviewedById: adminId,
        reviewReason: body.reason?.trim() || null, // V3 Batch11: reviewReason 저장
      },
      select: { id: true, status: true, reviewedAt: true },
    });

    // V3 Batch11: report_histories + admin_action_logs 동시 기록
    const actionType = body.action === 'RESOLVED'
      ? ReportHistoryActionType.RESOLVED
      : ReportHistoryActionType.REJECTED;
    const adminActionType = body.action === 'RESOLVED'
      ? AdminActionType.RESOLVED
      : AdminActionType.REJECTED;

    await Promise.all([
      this.logReportHistory({
        targetType: ReportTargetType.POST_REPORT,
        targetId: reportId,
        actorId: adminId,
        actionType,
        note: body.reason?.trim() || null,
      }),
      this.logAdminAction({
        adminId,
        targetType: AdminActionTargetType.POST_REPORT,
        targetId: reportId,
        actionType: adminActionType,
        reason: body.reason?.trim() || null,
      }),
    ]);

    return {
      reportId: updated.id,
      status: updated.status as 'RESOLVED' | 'REJECTED',
      reviewedAt: updated.reviewedAt!.toISOString(),
    };
  }

  // ─── 유저 신고 처리 (PATCH /admin/user-reports/:id) ──────────────────────────

  async reviewUserReport(
    adminId: number,
    reportId: number,
    body: ReviewReportRequest,
  ): Promise<ReviewReportResponse> {
    await this.assertOperatorAdmin(adminId);
    this.validateReviewAction(body.action);

    const report = await this.prisma.userReport.findUnique({
      where: { id: reportId },
      select: { id: true, status: true },
    });

    if (!report) {
      throw new NotFoundException('신고를 찾을 수 없습니다.');
    }

    if (report.status !== ReportStatus.PENDING) {
      throw new BadRequestException('이미 처리된 신고입니다.');
    }

    const now = new Date();
    const updated = await this.prisma.userReport.update({
      where: { id: reportId },
      data: {
        status: body.action as ReportStatus,
        reviewedAt: now,
        reviewedById: adminId,
        reviewReason: body.reason?.trim() || null, // V3 Batch11: reviewReason 저장
      },
      select: { id: true, status: true, reviewedAt: true },
    });

    // V3 Batch11: report_histories + admin_action_logs 동시 기록
    const actionType = body.action === 'RESOLVED'
      ? ReportHistoryActionType.RESOLVED
      : ReportHistoryActionType.REJECTED;
    const adminActionType = body.action === 'RESOLVED'
      ? AdminActionType.RESOLVED
      : AdminActionType.REJECTED;

    await Promise.all([
      this.logReportHistory({
        targetType: ReportTargetType.USER_REPORT,
        targetId: reportId,
        actorId: adminId,
        actionType,
        note: body.reason?.trim() || null,
      }),
      this.logAdminAction({
        adminId,
        targetType: AdminActionTargetType.USER_REPORT,
        targetId: reportId,
        actionType: adminActionType,
        reason: body.reason?.trim() || null,
      }),
    ]);

    return {
      reportId: updated.id,
      status: updated.status as 'RESOLVED' | 'REJECTED',
      reviewedAt: updated.reviewedAt!.toISOString(),
    };
  }

  // ─── 게시글 상태 강제 변경 (PATCH /admin/posts/:postId/status) ────────────────

  async changePostStatus(
    adminId: number,
    postId: number,
    body: ChangePostStatusRequest,
  ): Promise<ChangePostStatusResponse> {
    this.validateChangePostStatusBody(body);

    const targetStatus = body.status as PostStatus;

    // V3 Batch11: DELETED는 SUPER_ADMIN만, 나머지는 OPERATOR_ADMIN 이상
    if (targetStatus === PostStatus.DELETED) {
      await this.assertSuperAdmin(adminId);
    } else {
      await this.assertOperatorAdmin(adminId);
    }

    const post = await this.prisma.post.findUnique({
      where: { id: postId },
      select: { id: true, status: true, deletedAt: true },
    });

    if (!post || post.status === PostStatus.DELETED || post.deletedAt) {
      throw new NotFoundException('게시글을 찾을 수 없습니다.');
    }

    const now = new Date();
    const updateData: {
      status: PostStatus;
      hiddenAt?: Date | null;
      hiddenReason?: string | null;
      hiddenById?: number | null;
      deletedAt?: Date | null;
    } = { status: targetStatus };

    if (targetStatus === PostStatus.HIDDEN) {
      updateData.hiddenAt = now;
      updateData.hiddenReason = body.hiddenReason?.trim() || null;
      updateData.hiddenById = adminId;
    } else if (targetStatus === PostStatus.ACTIVE) {
      updateData.hiddenAt = null;
      updateData.hiddenReason = null;
      updateData.hiddenById = null;
    } else if (targetStatus === PostStatus.DELETED) {
      updateData.deletedAt = now;
    }

    const updated = await this.prisma.post.update({
      where: { id: postId },
      data: updateData,
      select: {
        id: true,
        status: true,
        hiddenAt: true,
        hiddenReason: true,
        updatedAt: true,
      },
    });

    // V3 Batch11: search index 정합성 반영 (isSearchable 재계산)
    try {
      await syncPostSearchIndex(this.prisma, postId);
    } catch (err) {
      this.logger.warn(`[changePostStatus] search index sync 실패 postId=${postId}: ${String(err)}`);
    }

    // V3 Batch11: admin_action_logs 기록
    const actionTypeMap: Record<PostStatus, AdminActionType> = {
      [PostStatus.HIDDEN]: AdminActionType.HIDDEN,
      [PostStatus.ACTIVE]: AdminActionType.UNHIDDEN,
      [PostStatus.DELETED]: AdminActionType.DELETED,
    };
    await this.logAdminAction({
      adminId,
      targetType: AdminActionTargetType.POST,
      targetId: postId,
      actionType: actionTypeMap[targetStatus],
      reason: body.hiddenReason?.trim() || null,
      metadataJson: { previousStatus: post.status, newStatus: targetStatus },
    });

    return {
      postId: updated.id,
      status: updated.status as 'ACTIVE' | 'HIDDEN' | 'DELETED',
      hiddenAt: updated.hiddenAt ? updated.hiddenAt.toISOString() : null,
      hiddenReason: updated.hiddenReason ?? null,
      updatedAt: updated.updatedAt.toISOString(),
    };
  }

  // ─── 게시글 신고 목록 조회 (GET /admin/post-reports) ─────────────────────────

  async getPostReports(
    adminId: number,
    query: ListReportsQueryDto,
  ): Promise<ListPostReportsResponse> {
    await this.assertOperatorAdmin(adminId);

    const limit = Math.min(query.limit ?? 20, 100);
    const cursor = query.cursor;
    const statusFilter = query.status as ReportStatus | undefined;

    const where = {
      ...(statusFilter ? { status: statusFilter } : {}),
      ...(cursor ? { id: { lt: cursor } } : {}),
    };

    const [items, total] = await this.prisma.$transaction([
      this.prisma.report.findMany({
        where,
        orderBy: { id: 'desc' },
        take: limit + 1,
        select: {
          id: true,
          postId: true,
          title: true,
          reason: true,
          description: true,
          status: true,
          reviewedAt: true,
          createdAt: true,
          reporter: { select: { id: true, nickname: true } },
          post: {
            select: {
              images: {
                where: { isPrimary: true },
                take: 1,
                include: POST_IMAGE_INCLUDE,
              },
            },
          },
          reviewedBy: { select: { nickname: true } },
        },
      }),
      this.prisma.report.count({
        where: statusFilter ? { status: statusFilter } : {},
      }),
    ]);

    const hasNext = items.length > limit;
    if (hasNext) items.pop();

    return {
      items: items.map((r) => ({
        reportId: r.id,
        postId: r.postId,
        postThumbnailUrl:
          r.post.images[0]?.imageAsset.thumbnailUrl ??
          r.post.images[0]?.imageAsset.processedImageUrl ??
          null,
        reporterId: r.reporter.id,
        reporterNickname: r.reporter.nickname,
        title: r.title,
        reason: r.reason as 'SPAM' | 'ABUSE' | 'INAPPROPRIATE' | 'ETC',
        description: r.description ?? null,
        status: r.status as 'PENDING' | 'RESOLVED' | 'REJECTED',
        reviewedAt: r.reviewedAt ? r.reviewedAt.toISOString() : null,
        reviewedByNickname: r.reviewedBy?.nickname ?? null,
        createdAt: r.createdAt.toISOString(),
      })),
      nextCursor: hasNext ? items[items.length - 1].id : null,
      total,
    };
  }

  // ─── 사용자 신고 목록 조회 (GET /admin/user-reports) ─────────────────────────

  async getUserReports(
    adminId: number,
    query: ListReportsQueryDto,
  ): Promise<ListUserReportsResponse> {
    await this.assertOperatorAdmin(adminId);

    const limit = Math.min(query.limit ?? 20, 100);
    const cursor = query.cursor;
    const statusFilter = query.status as ReportStatus | undefined;

    const where = {
      ...(statusFilter ? { status: statusFilter } : {}),
      ...(cursor ? { id: { lt: cursor } } : {}),
    };

    const [items, total] = await this.prisma.$transaction([
      this.prisma.userReport.findMany({
        where,
        orderBy: { id: 'desc' },
        take: limit + 1,
        select: {
          id: true,
          reportedUserId: true,
          title: true,
          reason: true,
          description: true,
          status: true,
          reviewedAt: true,
          createdAt: true,
          reporter: { select: { id: true, nickname: true } },
          reportedUser: { select: { nickname: true } },
          reviewedBy: { select: { nickname: true } },
        },
      }),
      this.prisma.userReport.count({
        where: statusFilter ? { status: statusFilter } : {},
      }),
    ]);

    const hasNext = items.length > limit;
    if (hasNext) items.pop();

    return {
      items: items.map((r) => ({
        reportId: r.id,
        reportedUserId: r.reportedUserId,
        reportedUserNickname: r.reportedUser.nickname,
        reporterId: r.reporter.id,
        reporterNickname: r.reporter.nickname,
        title: r.title,
        reason: r.reason as 'SPAM' | 'ABUSE' | 'INAPPROPRIATE' | 'ETC',
        description: r.description ?? null,
        status: r.status as 'PENDING' | 'RESOLVED' | 'REJECTED',
        reviewedAt: r.reviewedAt ? r.reviewedAt.toISOString() : null,
        reviewedByNickname: r.reviewedBy?.nickname ?? null,
        createdAt: r.createdAt.toISOString(),
      })),
      nextCursor: hasNext ? items[items.length - 1].id : null,
      total,
    };
  }

  // ─── [Batch11] 관리자 게시글 목록 조회 (GET /admin/posts) ─────────────────────

  async getAdminPosts(
    adminId: number,
    query: ListAdminPostsQueryDto,
  ): Promise<ListAdminPostsResponse> {
    await this.assertOperatorAdmin(adminId);

    const limit = Math.min(query.limit ?? 20, 100);
    const where: Record<string, unknown> = {};
    if (query.status) where['status'] = query.status as PostStatus;
    if (query.cursor) where['id'] = { lt: query.cursor };

    const [items, total] = await this.prisma.$transaction([
      this.prisma.post.findMany({
        where,
        orderBy: { id: 'desc' },
        take: limit + 1,
        select: {
          id: true,
          authorId: true,
          content: true,
          status: true,
          publishedAt: true,
          hiddenAt: true,
          hiddenReason: true,
          deletedAt: true,
          createdAt: true,
          author: { select: { nickname: true } },
          images: {
            where: { isPrimary: true },
            take: 1,
            include: POST_IMAGE_INCLUDE,
          },
        },
      }),
      this.prisma.post.count({ where: query.status ? { status: query.status as PostStatus } : {} }),
    ]);

    const hasNext = items.length > limit;
    if (hasNext) items.pop();

    return {
      items: items.map((p) => ({
        postId: p.id,
        authorId: p.authorId,
        authorNickname: p.author.nickname,
        status: p.status as 'ACTIVE' | 'HIDDEN' | 'DELETED',
        thumbnailUrl:
          p.images[0]?.imageAsset.thumbnailUrl ??
          p.images[0]?.imageAsset.processedImageUrl ??
          null,
        content: p.content,
        publishedAt: p.publishedAt ? p.publishedAt.toISOString() : null,
        hiddenAt: p.hiddenAt ? p.hiddenAt.toISOString() : null,
        hiddenReason: p.hiddenReason ?? null,
        deletedAt: p.deletedAt ? p.deletedAt.toISOString() : null,
        createdAt: p.createdAt.toISOString(),
      })),
      nextCursor: hasNext ? items[items.length - 1].id : null,
      total,
    };
  }

  // ─── [Batch11] 관리자 회원 목록 조회 (GET /admin/users) ──────────────────────

  async getAdminUsers(
    adminId: number,
    query: ListAdminUsersQueryDto,
  ): Promise<ListAdminUsersResponse> {
    await this.assertOperatorAdmin(adminId);

    const limit = Math.min(query.limit ?? 20, 100);
    const where: Record<string, unknown> = {};
    if (query.status) where['status'] = query.status as UserStatus;
    if (query.role) where['role'] = query.role as UserRole;
    if (query.cursor) where['id'] = { lt: query.cursor };

    const countWhere: Record<string, unknown> = {};
    if (query.status) countWhere['status'] = query.status as UserStatus;
    if (query.role) countWhere['role'] = query.role as UserRole;

    const [items, total] = await this.prisma.$transaction([
      this.prisma.user.findMany({
        where,
        orderBy: { id: 'desc' },
        take: limit + 1,
        select: {
          id: true,
          nickname: true,
          email: true,
          role: true,
          status: true,
          createdAt: true,
          deletedAt: true,
        },
      }),
      this.prisma.user.count({ where: countWhere }),
    ]);

    const hasNext = items.length > limit;
    if (hasNext) items.pop();

    return {
      items: items.map((u) => ({
        userId: u.id,
        nickname: u.nickname,
        email: u.email,
        role: u.role as 'USER' | 'SUPER_ADMIN' | 'OPERATOR_ADMIN',
        status: u.status as 'ACTIVE' | 'SUSPENDED' | 'DELETED',
        createdAt: u.createdAt.toISOString(),
        deletedAt: u.deletedAt ? u.deletedAt.toISOString() : null,
      })),
      nextCursor: hasNext ? items[items.length - 1].id : null,
      total,
    };
  }

  // ─── [Batch11] 관리자 회원 상태 변경 (PATCH /admin/users/:userId/status) ───────

  async changeUserStatus(
    adminId: number,
    userId: number,
    body: ChangeUserStatusRequest,
  ): Promise<ChangeUserStatusResponse> {
    const targetStatus = body.status as UserStatus;

    // V3 Batch11: DELETED는 SUPER_ADMIN만, 나머지는 OPERATOR_ADMIN 이상
    if (targetStatus === UserStatus.DELETED) {
      await this.assertSuperAdmin(adminId);
    } else {
      await this.assertOperatorAdmin(adminId);
    }

    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, status: true, deletedAt: true },
    });

    if (!user || user.status === UserStatus.DELETED || user.deletedAt) {
      throw new NotFoundException('회원을 찾을 수 없습니다.');
    }

    if (user.status === targetStatus) {
      throw new BadRequestException('이미 해당 상태입니다.');
    }

    const now = new Date();
    const updateData: { status: UserStatus; deletedAt?: Date | null } = { status: targetStatus };
    if (targetStatus === UserStatus.DELETED) {
      updateData.deletedAt = now;
    }

    const updated = await this.prisma.user.update({
      where: { id: userId },
      data: updateData,
      select: { id: true, status: true, updatedAt: true },
    });

    // V3 Batch11: admin_action_logs 기록
    await this.logAdminAction({
      adminId,
      targetType: AdminActionTargetType.USER,
      targetId: userId,
      actionType: AdminActionType.USER_STATUS_UPDATED,
      reason: body.reason?.trim() || null,
      metadataJson: { previousStatus: user.status, newStatus: targetStatus },
    });

    return {
      userId: updated.id,
      status: updated.status as 'ACTIVE' | 'SUSPENDED' | 'DELETED',
      updatedAt: updated.updatedAt.toISOString(),
    };
  }

  // ─── [Batch11] 관리자 제재 목록 조회 (GET /admin/sanctions) ──────────────────

  async getSanctions(
    adminId: number,
    query: ListSanctionsQueryDto,
  ): Promise<ListSanctionsResponse> {
    await this.assertOperatorAdmin(adminId);

    const limit = Math.min(query.limit ?? 20, 100);
    const where: Record<string, unknown> = {};
    if (query.userId) where['sanctionedUserId'] = query.userId;
    if (query.type) where['type'] = query.type as SanctionType;
    if (query.cursor) where['id'] = { lt: query.cursor };

    const countWhere: Record<string, unknown> = {};
    if (query.userId) countWhere['sanctionedUserId'] = query.userId;
    if (query.type) countWhere['type'] = query.type as SanctionType;

    const [items, total] = await this.prisma.$transaction([
      this.prisma.userSanction.findMany({
        where,
        orderBy: { id: 'desc' },
        take: limit + 1,
        select: {
          id: true,
          sanctionedUserId: true,
          processedById: true,
          type: true,
          reason: true,
          startsAt: true,
          endsAt: true,
          createdAt: true,
          sanctionedUser: { select: { nickname: true } },
          processedBy: { select: { nickname: true } },
        },
      }),
      this.prisma.userSanction.count({ where: countWhere }),
    ]);

    const hasNext = items.length > limit;
    if (hasNext) items.pop();

    return {
      items: items.map((s) => ({
        sanctionId: s.id,
        sanctionedUserId: s.sanctionedUserId,
        sanctionedUserNickname: s.sanctionedUser.nickname,
        processedById: s.processedById,
        processedByNickname: s.processedBy.nickname,
        type: s.type as 'TEMP_SUSPENSION' | 'PERMANENT_BAN' | 'POST_RESTRICTION',
        reason: s.reason,
        startsAt: s.startsAt.toISOString(),
        endsAt: s.endsAt ? s.endsAt.toISOString() : null,
        createdAt: s.createdAt.toISOString(),
      })),
      nextCursor: hasNext ? items[items.length - 1].id : null,
      total,
    };
  }

  // ─── [Batch11] 관리자 제재 생성 (POST /admin/sanctions) ──────────────────────

  async createSanction(
    adminId: number,
    body: CreateSanctionRequest,
  ): Promise<CreateSanctionResponse> {
    const sanctionType = body.type as SanctionType;

    // V3 Batch11: PERMANENT_BAN은 SUPER_ADMIN만, 나머지는 OPERATOR_ADMIN 이상
    if (sanctionType === SanctionType.PERMANENT_BAN) {
      await this.assertSuperAdmin(adminId);
    } else {
      await this.assertOperatorAdmin(adminId);
    }

    const targetUser = await this.prisma.user.findUnique({
      where: { id: body.sanctionedUserId },
      select: { id: true, status: true, deletedAt: true },
    });

    if (!targetUser || targetUser.status === UserStatus.DELETED || targetUser.deletedAt) {
      throw new NotFoundException('제재 대상 회원을 찾을 수 없습니다.');
    }

    const startsAt = body.startsAt ? new Date(body.startsAt) : new Date();
    const endsAt = body.endsAt ? new Date(body.endsAt) : null;

    if (endsAt && endsAt <= startsAt) {
      throw new BadRequestException('endsAt은 startsAt보다 늦어야 합니다.');
    }

    if (sanctionType === SanctionType.PERMANENT_BAN && endsAt) {
      throw new BadRequestException('PERMANENT_BAN은 endsAt을 설정할 수 없습니다.');
    }

    const sanction = await this.prisma.userSanction.create({
      data: {
        sanctionedUserId: body.sanctionedUserId,
        processedById: adminId,
        type: sanctionType,
        reason: body.reason.trim(),
        startsAt,
        endsAt,
      },
      select: {
        id: true,
        sanctionedUserId: true,
        type: true,
        reason: true,
        startsAt: true,
        endsAt: true,
        createdAt: true,
      },
    });

    // V3 Batch11: admin_action_logs 기록
    await this.logAdminAction({
      adminId,
      targetType: AdminActionTargetType.USER_SANCTION,
      targetId: sanction.id,
      actionType: AdminActionType.CREATED,
      reason: body.reason.trim(),
      metadataJson: {
        sanctionedUserId: body.sanctionedUserId,
        type: sanctionType,
        startsAt: startsAt.toISOString(),
        endsAt: endsAt?.toISOString() ?? null,
      },
    });

    return {
      sanctionId: sanction.id,
      sanctionedUserId: sanction.sanctionedUserId,
      type: sanction.type as 'TEMP_SUSPENSION' | 'PERMANENT_BAN' | 'POST_RESTRICTION',
      reason: sanction.reason,
      startsAt: sanction.startsAt.toISOString(),
      endsAt: sanction.endsAt ? sanction.endsAt.toISOString() : null,
      createdAt: sanction.createdAt.toISOString(),
    };
  }

  // ─── [Batch11] 관리자 제재 조기 종료 (PATCH /admin/sanctions/:sanctionId/end) ─

  async endSanction(
    adminId: number,
    sanctionId: number,
    body: EndSanctionRequest,
  ): Promise<EndSanctionResponse> {
    const sanction = await this.prisma.userSanction.findUnique({
      where: { id: sanctionId },
      select: { id: true, type: true, endsAt: true },
    });

    if (!sanction) {
      throw new NotFoundException('제재를 찾을 수 없습니다.');
    }

    // V3 Batch11: PERMANENT_BAN 종료는 SUPER_ADMIN만
    if (sanction.type === SanctionType.PERMANENT_BAN) {
      await this.assertSuperAdmin(adminId);
    } else {
      await this.assertOperatorAdmin(adminId);
    }

    const now = new Date();
    if (sanction.endsAt && sanction.endsAt <= now) {
      throw new BadRequestException('이미 종료된 제재입니다.');
    }

    const updated = await this.prisma.userSanction.update({
      where: { id: sanctionId },
      data: { endsAt: now },
      select: { id: true, endsAt: true },
    });

    // V3 Batch11: admin_action_logs 기록
    await this.logAdminAction({
      adminId,
      targetType: AdminActionTargetType.USER_SANCTION,
      targetId: sanctionId,
      actionType: AdminActionType.SANCTION_ENDED,
      reason: body.reason?.trim() || null,
    });

    return {
      sanctionId: updated.id,
      endsAt: updated.endsAt!.toISOString(),
    };
  }

  // ─── [Batch11] 관리자 처리 로그 조회 (GET /admin/action-logs) ─────────────────

  async getActionLogs(
    adminId: number,
    query: ListActionLogsQueryDto,
  ): Promise<ListActionLogsResponse> {
    await this.assertOperatorAdmin(adminId);

    const limit = Math.min(query.limit ?? 20, 100);
    const where: Record<string, unknown> = {};
    if (query.adminId) where['adminId'] = query.adminId;
    if (query.targetType) where['targetType'] = query.targetType;
    if (query.actionType) where['actionType'] = query.actionType;
    if (query.cursor) where['id'] = { lt: query.cursor };

    const countWhere: Record<string, unknown> = {};
    if (query.adminId) countWhere['adminId'] = query.adminId;
    if (query.targetType) countWhere['targetType'] = query.targetType;
    if (query.actionType) countWhere['actionType'] = query.actionType;

    const [items, total] = await this.prisma.$transaction([
      this.prisma.adminActionLog.findMany({
        where,
        orderBy: { id: 'desc' },
        take: limit + 1,
        select: {
          id: true,
          adminId: true,
          targetType: true,
          targetId: true,
          actionType: true,
          reason: true,
          metadataJson: true,
          createdAt: true,
          admin: { select: { nickname: true } },
        },
      }),
      this.prisma.adminActionLog.count({ where: countWhere }),
    ]);

    const hasNext = items.length > limit;
    if (hasNext) items.pop();

    return {
      items: items.map((l) => ({
        logId: l.id,
        adminId: l.adminId,
        adminNickname: l.admin.nickname,
        targetType: l.targetType as 'POST' | 'POST_REPORT' | 'USER_REPORT' | 'USER' | 'USER_SANCTION',
        targetId: l.targetId,
        actionType: l.actionType as string,
        reason: l.reason ?? null,
        metadataJson: l.metadataJson as Record<string, unknown> | null,
        createdAt: l.createdAt.toISOString(),
      })),
      nextCursor: hasNext ? items[items.length - 1].id : null,
      total,
    };
  }

  // ─── [Batch11] 신고 처리 이력 조회 (GET /admin/report-histories) ─────────────

  async getReportHistories(
    adminId: number,
    query: ListReportHistoriesQueryDto,
  ): Promise<ListReportHistoriesResponse> {
    await this.assertOperatorAdmin(adminId);

    const limit = Math.min(query.limit ?? 20, 100);
    const where: Record<string, unknown> = {};
    if (query.targetType) where['targetType'] = query.targetType;
    if (query.targetId) where['targetId'] = query.targetId;
    if (query.cursor) where['id'] = { lt: query.cursor };

    const countWhere: Record<string, unknown> = {};
    if (query.targetType) countWhere['targetType'] = query.targetType;
    if (query.targetId) countWhere['targetId'] = query.targetId;

    const [items, total] = await this.prisma.$transaction([
      this.prisma.reportHistory.findMany({
        where,
        orderBy: { id: 'desc' },
        take: limit + 1,
        select: {
          id: true,
          targetType: true,
          targetId: true,
          actorId: true,
          actionType: true,
          note: true,
          createdAt: true,
          actor: { select: { nickname: true } },
        },
      }),
      this.prisma.reportHistory.count({ where: countWhere }),
    ]);

    const hasNext = items.length > limit;
    if (hasNext) items.pop();

    return {
      items: items.map((h) => ({
        historyId: h.id,
        targetType: h.targetType as 'POST_REPORT' | 'USER_REPORT',
        targetId: h.targetId,
        actorId: h.actorId ?? null,
        actorNickname: h.actor?.nickname ?? null,
        actionType: h.actionType as 'CREATED' | 'RESOLVED' | 'REJECTED' | 'REOPENED',
        note: h.note ?? null,
        createdAt: h.createdAt.toISOString(),
      })),
      nextCursor: hasNext ? items[items.length - 1].id : null,
      total,
    };
  }

  // ─── [DEV] 게시글 이미지 일괄 재인덱싱 ─────────────────────────────────────────

  async reindexPostImages(): Promise<{ total: number; succeeded: number; failed: number; failedIds: number[] }> {
    const primaryImages = await this.prisma.postImage.findMany({
      where: { isPrimary: true },
      select: { imageAssetId: true },
    });

    const assetIds = [...new Set(primaryImages.map((pi) => pi.imageAssetId))];
    this.logger.log(`재인덱싱 대상 imageAsset 수: ${assetIds.length}`);

    let succeeded = 0;
    let failed = 0;
    const failedIds: number[] = [];

    for (const assetId of assetIds) {
      try {
        await this.imageIndexingService.ensureCurrentAnalysisRun(
          assetId,
          ImageAnalysisPurpose.POST_INDEX,
        );
        succeeded++;
        this.logger.log(`[OK] imageAssetId=${assetId}`);
      } catch (error) {
        failed++;
        failedIds.push(assetId);
        this.logger.warn(
          `[FAIL] imageAssetId=${assetId}: ${error instanceof Error ? error.message : String(error)}`,
        );
      }
    }

    this.logger.log(`재인덱싱 완료 — 성공: ${succeeded}, 실패: ${failed}`);
    return { total: assetIds.length, succeeded, failed, failedIds };
  }

  // ─── [Batch10] 키워드 마스터 CRUD (SUPER_ADMIN only) ──────────────────────────

  async getAdminKeywords(
    adminId: number,
    query: ListAdminKeywordsQueryDto,
  ): Promise<GetAdminKeywordsResponse> {
    await this.assertSuperAdmin(adminId); // V3 Batch11: SUPER_ADMIN only

    const where = query.isActive !== undefined ? { isActive: query.isActive } : {};
    const rows = await this.prisma.keyword.findMany({
      where,
      orderBy: [{ sortOrder: 'asc' }, { id: 'asc' }],
    });

    return {
      items: rows.map((k): AdminKeywordItem => ({
        id: k.id,
        code: k.code,
        label: k.label,
        sortOrder: k.sortOrder,
        isActive: k.isActive,
        createdAt: k.createdAt.toISOString(),
        updatedAt: k.updatedAt.toISOString(),
      })),
    };
  }

  async createKeyword(
    adminId: number,
    body: CreateKeywordRequest,
  ): Promise<CreateKeywordResponse> {
    await this.assertSuperAdmin(adminId); // V3 Batch11: SUPER_ADMIN only

    const exists = await this.prisma.keyword.findUnique({ where: { code: body.code } });
    if (exists) {
      throw new ConflictException(`code '${body.code}'는 이미 사용 중입니다.`);
    }

    const keyword = await this.prisma.keyword.create({
      data: {
        code: body.code,
        label: body.label,
        sortOrder: body.sortOrder ?? 0,
        isActive: body.isActive ?? true,
      },
    });

    return {
      id: keyword.id,
      code: keyword.code,
      label: keyword.label,
      sortOrder: keyword.sortOrder,
      isActive: keyword.isActive,
      createdAt: keyword.createdAt.toISOString(),
    };
  }

  async updateKeyword(
    adminId: number,
    keywordId: number,
    body: UpdateKeywordRequest,
  ): Promise<UpdateKeywordResponse> {
    await this.assertSuperAdmin(adminId); // V3 Batch11: SUPER_ADMIN only

    const keyword = await this.prisma.keyword.findUnique({ where: { id: keywordId } });
    if (!keyword) {
      throw new NotFoundException('키워드를 찾을 수 없습니다.');
    }

    const labelChanged = body.label !== undefined && body.label !== keyword.label;

    const updated = await this.prisma.keyword.update({
      where: { id: keywordId },
      data: {
        ...(body.label !== undefined ? { label: body.label } : {}),
        ...(body.sortOrder !== undefined ? { sortOrder: body.sortOrder } : {}),
        ...(body.isActive !== undefined ? { isActive: body.isActive } : {}),
      },
    });

    if (labelChanged) {
      const affected = await this.prisma.postKeyword.findMany({
        where: { keywordId },
        select: { postId: true },
      });
      for (const { postId } of affected) {
        try {
          await syncPostSearchIndex(this.prisma, postId);
        } catch (err) {
          this.logger.warn(`[keyword label sync] postId=${postId} 실패: ${String(err)}`);
        }
      }
    }

    return {
      id: updated.id,
      code: updated.code,
      label: updated.label,
      sortOrder: updated.sortOrder,
      isActive: updated.isActive,
      updatedAt: updated.updatedAt.toISOString(),
    };
  }

  async deleteKeyword(
    adminId: number,
    keywordId: number,
  ): Promise<DeleteKeywordResponse> {
    await this.assertSuperAdmin(adminId); // V3 Batch11: SUPER_ADMIN only

    const keyword = await this.prisma.keyword.findUnique({ where: { id: keywordId } });
    if (!keyword) {
      throw new NotFoundException('키워드를 찾을 수 없습니다.');
    }

    const usageCount = await this.prisma.postKeyword.count({ where: { keywordId } });
    if (usageCount > 0) {
      throw new ConflictException(
        `${usageCount}개의 게시글에서 사용 중입니다. 삭제 대신 isActive=false로 비활성화하세요.`,
      );
    }

    await this.prisma.keyword.delete({ where: { id: keywordId } });
    return { success: true, message: '키워드가 삭제되었습니다.' };
  }

  // ─── [Batch10] 피드백 태그 마스터 CRUD (SUPER_ADMIN only) ────────────────────

  async getAdminFeedbackTags(
    adminId: number,
    query: ListAdminFeedbackTagsQueryDto,
  ): Promise<GetAdminFeedbackTagsResponse> {
    await this.assertSuperAdmin(adminId); // V3 Batch11: SUPER_ADMIN only

    const where: Record<string, unknown> = {};
    if (query.voteChoice !== undefined) where.voteChoice = query.voteChoice as VoteChoice;
    if (query.groupCode !== undefined) where.groupCode = query.groupCode;
    if (query.isActive !== undefined) where.isActive = query.isActive;

    const rows = await this.prisma.feedbackTag.findMany({
      where,
      orderBy: [{ voteChoice: 'asc' }, { sortOrder: 'asc' }, { id: 'asc' }],
    });

    return {
      items: rows.map((t): AdminFeedbackTagItem => ({
        id: t.id,
        code: t.code,
        label: t.label,
        groupCode: t.groupCode,
        voteChoice: t.voteChoice as 'LIKE' | 'DISLIKE',
        isActive: t.isActive,
        sortOrder: t.sortOrder,
        createdAt: t.createdAt.toISOString(),
        updatedAt: t.updatedAt.toISOString(),
      })),
    };
  }

  async createFeedbackTag(
    adminId: number,
    body: CreateFeedbackTagRequest,
  ): Promise<CreateFeedbackTagResponse> {
    await this.assertSuperAdmin(adminId); // V3 Batch11: SUPER_ADMIN only

    const exists = await this.prisma.feedbackTag.findUnique({ where: { code: body.code } });
    if (exists) {
      throw new ConflictException(`code '${body.code}'는 이미 사용 중입니다.`);
    }

    const tag = await this.prisma.feedbackTag.create({
      data: {
        code: body.code,
        label: body.label,
        voteChoice: body.voteChoice as VoteChoice,
        groupCode: body.groupCode ?? null,
        sortOrder: body.sortOrder ?? 0,
        isActive: body.isActive ?? true,
      },
    });

    return {
      id: tag.id,
      code: tag.code,
      label: tag.label,
      groupCode: tag.groupCode,
      voteChoice: tag.voteChoice as 'LIKE' | 'DISLIKE',
      isActive: tag.isActive,
      sortOrder: tag.sortOrder,
      createdAt: tag.createdAt.toISOString(),
    };
  }

  async updateFeedbackTag(
    adminId: number,
    tagId: number,
    body: UpdateFeedbackTagRequest,
  ): Promise<UpdateFeedbackTagResponse> {
    await this.assertSuperAdmin(adminId); // V3 Batch11: SUPER_ADMIN only

    const tag = await this.prisma.feedbackTag.findUnique({ where: { id: tagId } });
    if (!tag) {
      throw new NotFoundException('피드백 태그를 찾을 수 없습니다.');
    }

    const updated = await this.prisma.feedbackTag.update({
      where: { id: tagId },
      data: {
        ...(body.label !== undefined ? { label: body.label } : {}),
        ...(body.groupCode !== undefined ? { groupCode: body.groupCode } : {}),
        ...(body.sortOrder !== undefined ? { sortOrder: body.sortOrder } : {}),
        ...(body.isActive !== undefined ? { isActive: body.isActive } : {}),
      },
    });

    return {
      id: updated.id,
      code: updated.code,
      label: updated.label,
      groupCode: updated.groupCode,
      voteChoice: updated.voteChoice as 'LIKE' | 'DISLIKE',
      isActive: updated.isActive,
      sortOrder: updated.sortOrder,
      updatedAt: updated.updatedAt.toISOString(),
    };
  }

  async deleteFeedbackTag(
    adminId: number,
    tagId: number,
  ): Promise<DeleteFeedbackTagResponse> {
    await this.assertSuperAdmin(adminId); // V3 Batch11: SUPER_ADMIN only

    const tag = await this.prisma.feedbackTag.findUnique({ where: { id: tagId } });
    if (!tag) {
      throw new NotFoundException('피드백 태그를 찾을 수 없습니다.');
    }

    const usageCount = await this.prisma.feedback.count({ where: { tagId } });
    if (usageCount > 0) {
      throw new ConflictException(
        `${usageCount}개의 피드백에서 사용 중입니다. 삭제 대신 isActive=false로 비활성화하세요.`,
      );
    }

    await this.prisma.feedbackTag.delete({ where: { id: tagId } });
    return { success: true, message: '피드백 태그가 삭제되었습니다.' };
  }

  // ─── private helpers ──────────────────────────────────────────────────────────

  private validateReviewAction(action: unknown): void {
    if (action !== 'RESOLVED' && action !== 'REJECTED') {
      throw new BadRequestException(
        'action은 RESOLVED 또는 REJECTED 중 하나여야 합니다.',
      );
    }
  }

  private validateChangePostStatusBody(body: ChangePostStatusRequest): void {
    const validStatuses = ['ACTIVE', 'HIDDEN', 'DELETED'];
    if (!validStatuses.includes(body.status)) {
      throw new BadRequestException(
        `status는 ${validStatuses.join(', ')} 중 하나여야 합니다.`,
      );
    }

    if (body.hiddenReason !== undefined) {
      if (body.status !== 'HIDDEN') {
        throw new BadRequestException(
          'hiddenReason은 status가 HIDDEN일 때만 허용됩니다.',
        );
      }
      if (body.hiddenReason.trim().length > 255) {
        throw new BadRequestException('hiddenReason은 최대 255자입니다.');
      }
    }
  }
}
