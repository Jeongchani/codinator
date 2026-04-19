import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import type {
  GetEvaluationHistoryResponse,
  GetEvaluationPostDetailResponse,
  GetEvaluationsResponse,
} from '@codinator/contracts';
import { EvaluationStatus, PostStatus } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import {
  buildFeedbackSummary,
  buildMyVoteContext,
  buildVoteSummary,
} from './common/evaluation-summary.util';
import { syncExpiredEvaluations } from './common/sync-expired-evaluations.util';
import {
  buildContentPreview, // V3 Batch6-Fix: contentPreview 파생값 helper
  IMAGE_ORDER_BY,
  mapOutfitItems,
  mapPostImages,
  mapPostKeywords,
  OUTFIT_ORDER_BY,
  pickPostThumbnail,
  POST_IMAGE_INCLUDE,
  POST_KEYWORD_ORDER_BY,
} from '../posts/common/post-presenter.util';

@Injectable()
export class EvaluationsService {
  constructor(private readonly prisma: PrismaService) {}

  async getEvaluations(params: {
    cursor?: number;
    limit?: number;
    userId: number;
  }): Promise<GetEvaluationsResponse> {
    await syncExpiredEvaluations(this.prisma);

    const limit = this.normalizeLimit(params.limit);
    const cursor = params.cursor ?? 0;

    const evaluations = await this.prisma.evaluation.findMany({
      where: {
        id: { gt: cursor },
        status: EvaluationStatus.OPEN,
        endsAt: { gt: new Date() },
        // 이미 투표한 평가는 DB 쿼리 레벨에서 제외 (재노출 방지)
        votes: { none: { voterId: params.userId } },
        post: {
          authorId: { not: params.userId },
          status: PostStatus.ACTIVE,
          deletedAt: null,
        },
      },
      orderBy: { id: 'asc' },
      take: limit + 1,
      include: {
        post: {
          include: {
            images: {
              orderBy: IMAGE_ORDER_BY,
              take: 1,
              include: POST_IMAGE_INCLUDE,
            },
            postKeywords: {
              orderBy: POST_KEYWORD_ORDER_BY,
              include: {
                keyword: {
                  select: { id: true, code: true, label: true },
                },
              },
            },
          },
        },
        votes: {
          where: { voterId: params.userId },
          select: { id: true },
        },
      },
    });

    const hasNextPage = evaluations.length > limit;
    const pageItems = hasNextPage ? evaluations.slice(0, limit) : evaluations;

    return {
      items: pageItems.map((evaluation) => ({
        evaluationId: evaluation.id,
        postId: evaluation.postId,
        thumbnailUrl: pickPostThumbnail(evaluation.post.images),
        content: evaluation.post.content,
        keywords: evaluation.post.postKeywords.map((pk) => ({
          id: pk.keyword.id,
          code: pk.keyword.code,
          label: pk.keyword.label,
        })),
        endsAt: evaluation.endsAt.toISOString(),
        hasVoted: evaluation.votes.length > 0,
      })),
      nextCursor: hasNextPage ? pageItems[pageItems.length - 1]?.id ?? null : null,
    };
  }

  async getEvaluationPostDetail(
    postId: number,
    userId: number,
  ): Promise<GetEvaluationPostDetailResponse> {
    await syncExpiredEvaluations(this.prisma);

    const post = await this.prisma.post.findFirst({
      where: {
        id: postId,
        status: PostStatus.ACTIVE,
        deletedAt: null,
        evaluation: {
          is: {
            status: EvaluationStatus.OPEN,
            endsAt: { gt: new Date() },
          },
        },
      },
      include: {
        images: {
          orderBy: IMAGE_ORDER_BY,
          include: POST_IMAGE_INCLUDE,
        },
        outfitItems: {
          orderBy: OUTFIT_ORDER_BY,
        },
        postKeywords: {
          orderBy: POST_KEYWORD_ORDER_BY,
          include: {
            keyword: true,
          },
        },
        evaluation: {
          include: {
            votes: {
              include: {
                feedbacks: {
                  include: {
                    tag: true,
                  },
                },
              },
            },
          },
        },
      },
    });

    if (!post || !post.evaluation) {
      throw new NotFoundException('진행 중인 평가 게시글을 찾을 수 없습니다.');
    }

    const voteContext = buildMyVoteContext(post.evaluation.votes, userId);
    const isOwner = post.authorId === userId;

    if (!isOwner && !voteContext.hasVoted) {
      throw new ForbiddenException('투표 후에만 평가 상세를 볼 수 있습니다.');
    }

    return {
      postId: post.id,
      content: post.content,
      status: post.status,
      createdAt: post.createdAt.toISOString(),
      images: mapPostImages(post.images),
      keywords: mapPostKeywords(post.postKeywords),
      outfitItems: mapOutfitItems(post.outfitItems),
      evaluation: {
        id: post.evaluation.id,
        status: post.evaluation.status,
        endsAt: post.evaluation.endsAt.toISOString(),
      },
      ...voteContext,
      canVote: !voteContext.hasVoted && !isOwner,
      voteSummary: buildVoteSummary(post.evaluation.votes),
      feedbackSummary: buildFeedbackSummary(post.evaluation.votes),
    };
  }

  async getMyEvaluationHistory(params: {
    cursor?: number;
    limit?: number;
    userId: number;
  }): Promise<GetEvaluationHistoryResponse> {
    // 만료된 평가를 ENDED로 전환한 뒤 조회 (stale 상태 방지)
    await syncExpiredEvaluations(this.prisma);

    const limit = this.normalizeLimit(params.limit);

    const votes = await this.prisma.vote.findMany({
      where: {
        voterId: params.userId,
        // 진행중인 평가 기록: evaluation.status = OPEN 인 건만 노출
        // 평가 완료(ENDED/CLOSED)된 게시글은 목록에서 제외
        evaluation: { status: EvaluationStatus.OPEN,
                post: {
        status: PostStatus.ACTIVE,
        deletedAt: null,
         },
        },
        ...(params.cursor !== undefined ? { id: { lt: params.cursor } } : {}),
      },
      orderBy: { id: 'desc' },
      take: limit + 1,
      include: {
        evaluation: {
          include: {
            post: {
              include: {
                images: {
                  orderBy: IMAGE_ORDER_BY,
                  take: 1,
                  include: POST_IMAGE_INCLUDE,
                },
              },
            },
          },
        },
        feedbacks: {
          select: { tagId: true },
          orderBy: { sortOrder: 'asc' },
        },
      },
    });

    const hasMore = votes.length > limit;
    const pageItems = hasMore ? votes.slice(0, limit) : votes;

    return {
      items: pageItems.map((vote) => ({
        // ── 핵심 공개 필드 (API 명세서 ZIP 기준) ──────────────────────────── // V3 Batch6-Fix
        postId: vote.evaluation.postId,
        evaluationId: vote.evaluationId,
        thumbnailUrl: pickPostThumbnail(vote.evaluation.post.images),
        contentPreview: buildContentPreview(vote.evaluation.post.content), // V3 Batch6-Fix
        myChoice: vote.choice,                                              // V3 Batch6-Fix: myVoteChoice → myChoice
        votedAt: vote.createdAt.toISOString(),                              // V3 Batch6-Fix: votes.createdAt
        // ── Optional extension 필드 (클라이언트 편의용) ───────────────────────
        endsAt: vote.evaluation.endsAt.toISOString(),
        evaluationStatus: vote.evaluation.status,
        myVoteId: vote.id,
        myFeedbackTagIds: vote.feedbacks.map((f) => f.tagId),
      })),
      nextCursor: hasMore ? (pageItems[pageItems.length - 1]?.id ?? null) : null,
      hasMore,
    };
  }

  private normalizeLimit(limit?: number): number {
    if (!limit || Number.isNaN(Number(limit))) {
      return 10;
    }

    return Math.min(Math.max(Number(limit), 1), 30);
  }
}
