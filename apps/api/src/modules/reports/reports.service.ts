import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import type { CreateReportRequest, CreateReportResponse } from '@codinator/contracts';
import { PostStatus, ReportHistoryActionType, ReportReason, ReportStatus, ReportTargetType, UserStatus } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class ReportsService {
  private readonly logger = new Logger(ReportsService.name);

  constructor(private readonly prisma: PrismaService) {}

  // ─── 게시글 신고 (POST /posts/:postId/reports) ────────────────────────────────

  async reportPost(
    reporterId: number,
    postId: number,
    body: CreateReportRequest,
  ): Promise<CreateReportResponse> {
    this.validateReportBody(body);

    // 게시글 존재 및 DELETED 여부 확인
    const post = await this.prisma.post.findUnique({
      where: { id: postId },
      select: { id: true, authorId: true, status: true, deletedAt: true },
    });

    if (!post || post.status === PostStatus.DELETED || post.deletedAt) {
      throw new NotFoundException('게시글을 찾을 수 없습니다.');
    }

    // 정책 확인 필요: 본인 게시글 신고 — 보수적으로 차단
    if (post.authorId === reporterId) {
      throw new BadRequestException('본인 게시글은 신고할 수 없습니다.');
    }

    // PENDING 중복 체크 (@@unique([reporterId, postId])로 DB에서도 보장되나 명확한 메시지를 위해 사전 체크)
    const existing = await this.prisma.report.findUnique({
      where: { reporterId_postId: { reporterId, postId } },
      select: { id: true, status: true },
    });

    if (existing) {
      if (existing.status === ReportStatus.PENDING) {
        throw new ConflictException('이미 검토 대기 중인 신고가 있습니다.');
      }
      // RESOLVED / REJECTED — 스키마 unique 제약으로 재신고 불가
      throw new ConflictException('이미 처리된 신고 이력이 있습니다.');
    }

    const report = await this.prisma.report.create({
      data: {
        reporterId,
        postId,
        title: body.title.trim(),
        reason: body.reason as ReportReason,
        description: body.description?.trim() || null,
        status: ReportStatus.PENDING,
      },
      select: { id: true, status: true },
    });

    // 신고 생성 이력 기록
    try {
      await this.prisma.reportHistory.create({
        data: {
          targetType: ReportTargetType.POST_REPORT,
          targetId: report.id,
          actorId: reporterId,
          actionType: ReportHistoryActionType.CREATED,
          note: null,
        },
      });
    } catch (err) {
      this.logger.warn(`[ReportsService] reportPost history 기록 실패: reportId=${report.id}`, err);
    }

    return { reportId: report.id, status: report.status };
  }

  // ─── 유저 신고 (POST /users/:userId/reports) ──────────────────────────────────

  async reportUser(
    reporterId: number,
    reportedUserId: number,
    body: CreateReportRequest,
  ): Promise<CreateReportResponse> {
    this.validateReportBody(body);

    // 자기 자신 신고 차단 (정책 확인 필요 — 보수적으로 차단)
    if (reporterId === reportedUserId) {
      throw new BadRequestException('본인을 신고할 수 없습니다.');
    }

    // 대상 유저 존재 확인
    const targetUser = await this.prisma.user.findUnique({
      where: { id: reportedUserId },
      select: { id: true, status: true },
    });

    if (!targetUser || targetUser.status === UserStatus.DELETED) {
      throw new NotFoundException('사용자를 찾을 수 없습니다.');
    }

    // PENDING 중복 체크 (UserReport는 unique 제약 없음 — 명시적 체크 필수)
    const pendingExists = await this.prisma.userReport.findFirst({
      where: {
        reporterId,
        reportedUserId,
        status: ReportStatus.PENDING,
      },
      select: { id: true },
    });

    if (pendingExists) {
      throw new ConflictException('이미 검토 대기 중인 신고가 있습니다.');
    }

    const report = await this.prisma.userReport.create({
      data: {
        reporterId,
        reportedUserId,
        title: body.title.trim(),
        reason: body.reason as ReportReason,
        description: body.description?.trim() || null,
        status: ReportStatus.PENDING,
      },
      select: { id: true, status: true },
    });

    // 신고 생성 이력 기록
    try {
      await this.prisma.reportHistory.create({
        data: {
          targetType: ReportTargetType.USER_REPORT,
          targetId: report.id,
          actorId: reporterId,
          actionType: ReportHistoryActionType.CREATED,
          note: null,
        },
      });
    } catch (err) {
      this.logger.warn(`[ReportsService] reportUser history 기록 실패: reportId=${report.id}`, err);
    }

    return { reportId: report.id, status: report.status };
  }

  // ─── private helpers ──────────────────────────────────────────────────────────

  private validateReportBody(body: CreateReportRequest): void {
    if (!body.title || !body.title.trim()) {
      throw new BadRequestException('신고 제목은 필수입니다.');
    }
    if (body.title.trim().length > 100) {
      throw new BadRequestException('신고 제목은 최대 100자입니다.');
    }

    const validReasons: ReportReason[] = [
      ReportReason.SPAM,
      ReportReason.ABUSE,
      ReportReason.INAPPROPRIATE,
      ReportReason.ETC,
    ];
    if (!validReasons.includes(body.reason as ReportReason)) {
      throw new BadRequestException(
        `reason은 ${validReasons.join(', ')} 중 하나여야 합니다.`,
      );
    }

    if (body.description && body.description.trim().length > 500) {
      throw new BadRequestException('신고 상세 내용은 최대 500자입니다.');
    }
  }
}
