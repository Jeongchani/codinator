import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import type {
  ChangePostStatusRequest,
  ChangePostStatusResponse,
  ListPostReportsResponse,
  ListUserReportsResponse,
  ReviewReportRequest,
  ReviewReportResponse,
} from '@codinator/contracts';
import { PostStatus, ReportStatus, UserRole } from '@prisma/client';
import type { ListReportsQueryDto } from './dto/list-reports-query.dto';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class AdminService {
  constructor(private readonly prisma: PrismaService) {}

  // ─── ADMIN 권한 검증 헬퍼 ──────────────────────────────────────────────────────

  private async assertAdmin(adminId: number): Promise<void> {
    const user = await this.prisma.user.findUnique({
      where: { id: adminId },
      select: { role: true },
    });

    if (!user) {
      throw new UnauthorizedException('사용자를 찾을 수 없습니다.');
    }

    if (user.role !== UserRole.ADMIN) {
      throw new ForbiddenException('관리자 권한이 필요합니다.');
    }
  }

  // ─── 게시글 신고 처리 (PATCH /admin/reports/:id) ──────────────────────────────

  async reviewReport(
    adminId: number,
    reportId: number,
    body: ReviewReportRequest,
  ): Promise<ReviewReportResponse> {
    await this.assertAdmin(adminId);

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
      },
      select: { id: true, status: true, reviewedAt: true },
    });

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
    await this.assertAdmin(adminId);

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
      },
      select: { id: true, status: true, reviewedAt: true },
    });

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
    await this.assertAdmin(adminId);

    this.validateChangePostStatusBody(body);

    const post = await this.prisma.post.findUnique({
      where: { id: postId },
      select: { id: true, status: true, deletedAt: true },
    });

    if (!post || post.status === PostStatus.DELETED || post.deletedAt) {
      throw new NotFoundException('게시글을 찾을 수 없습니다.');
    }

    const targetStatus = body.status as PostStatus;
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
      // 숨김 해제: hidden 관련 필드 초기화
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
    await this.assertAdmin(adminId);

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
                select: { thumbnailUrl: true },
                take: 1,
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
        postThumbnailUrl: r.post.images[0]?.thumbnailUrl ?? null,
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
    await this.assertAdmin(adminId);

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