import { Injectable, NotFoundException } from '@nestjs/common';
import type {
  GetFeedPostDetailResponse,
  GetMyFeedResponse,
  GetUserFeedResponse,
} from '@codinator/contracts';
import { EvaluationStatus, PostStatus, RankingStatus } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import {
  buildFeedbackSummary,
  buildMyVoteContext,
  buildVoteSummary,
} from '../evaluations/common/evaluation-summary.util';
import { syncExpiredEvaluations } from '../evaluations/common/sync-expired-evaluations.util';
import { syncCurrentRankings } from '../rankings/common/ranking-sync.util';
import { RankingsService } from '../rankings/rankings.service';
import {
  IMAGE_ORDER_BY,
  mapOutfitItems,
  mapPostImages,
  mapPostKeywords,
  OUTFIT_ORDER_BY,
  pickPostThumbnail,
  POST_KEYWORD_ORDER_BY,
} from '../posts/common/post-presenter.util';

@Injectable()
export class FeedsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly rankingsService: RankingsService,
  ) {}

  // ─── 내 피드 (V2) ────────────────────────────────────────────────────────────
  /**
   * GET /users/me/feed
   * V2 정책: postStatus=DELETED 제외, OPEN + HIDDEN + ENDED 모두 포함.
   * 커서 기반 페이지네이션 (DESC 방향: cursor는 직전 페이지 마지막 postId).
   */
  async getMyOwnFeed(
    userId: number,
    params: { cursor?: number; limit?: number },
  ): Promise<GetMyFeedResponse> {
    await syncExpiredEvaluations(this.prisma);
    await syncCurrentRankings(this.prisma);

    const limit = this.normalizeLimit(params.limit);

    const posts = await this.prisma.post.findMany({
      where: {
        authorId: userId,
        status: { not: PostStatus.DELETED },
        deletedAt: null,
        ...(params.cursor !== undefined ? { id: { lt: params.cursor } } : {}),
      },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      take: limit + 1,
      include: {
        images: {
          orderBy: IMAGE_ORDER_BY,
          take: 1,
        },
        evaluation: {
          select: {
            id: true,
            status: true,
            endsAt: true,
            votes: {
              select: { choice: true },
            },
          },
        },
        // READY 상태의 rankingDetails만 포함해 isRankingPublished / rankInfo 도출
        rankingDetails: {
          where: {
            ranking: { status: RankingStatus.READY },
          },
          include: {
            ranking: {
              select: { period: true },
            },
          },
          orderBy: { rank: 'asc' },
          take: 1,
        },
      },
    });

    const hasMore = posts.length > limit;
    const pageItems = hasMore ? posts.slice(0, limit) : posts;

    return {
      items: pageItems.map((post) => {
        const likeCount =
          post.evaluation?.votes.filter((v) => v.choice === 'LIKE').length ?? 0;
        const dislikeCount =
          post.evaluation?.votes.filter((v) => v.choice === 'DISLIKE').length ?? 0;
        const topRankDetail = post.rankingDetails[0] ?? null;

        return {
          postId: post.id,
          thumbnailUrl: pickPostThumbnail(post.images) || null,
          content: post.content,
          postStatus: post.status,
          evaluation: post.evaluation
            ? {
                evaluationId: post.evaluation.id,
                status: post.evaluation.status,
                endsAt: post.evaluation.endsAt.toISOString(),
              }
            : null,
          voteSummary: { likeCount, dislikeCount },
          isRankingPublished: post.rankingDetails.length > 0,
          rankInfo: topRankDetail
            ? { rank: topRankDetail.rank, period: topRankDetail.ranking.period }
            : null,
          createdAt: post.createdAt.toISOString(),
        };
      }),
      nextCursor: hasMore ? (pageItems[pageItems.length - 1]?.id ?? null) : null,
      hasMore,
    };
  }

  // ─── 타 사용자 피드 (기존 유지) ───────────────────────────────────────────────

  async getUserFeed(targetUserId: number, _viewerUserId: number): Promise<GetUserFeedResponse> {
    await syncExpiredEvaluations(this.prisma);
    await syncCurrentRankings(this.prisma);

    const user = await this.prisma.user.findUnique({
      where: { id: targetUserId },
      select: {
        id: true,
        nickname: true,
      },
    });

    if (!user) {
      throw new NotFoundException('사용자를 찾을 수 없습니다.');
    }

    const posts = await this.prisma.post.findMany({
      where: {
        authorId: targetUserId,
        status: PostStatus.ACTIVE,
        deletedAt: null,
        publishedAt: { not: null },
        evaluation: {
          is: {
            status: EvaluationStatus.ENDED,
            endsAt: { lte: new Date() },
          },
        },
        rankingDetails: {
          some: {
            ranking: {
              status: RankingStatus.READY,
            },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
      include: {
        images: {
          orderBy: IMAGE_ORDER_BY,
          take: 1,
        },
      },
    });

    const items = await Promise.all(
      posts.map(async (post) => ({
        postId: post.id,
        thumbnailUrl: pickPostThumbnail(post.images),
        createdAt: post.createdAt.toISOString(),
        rankingPeriods: await this.rankingsService.getVisibleRankingPeriods(post.id),
      })),
    );

    return {
      user: {
        userId: user.id,
        nickname: user.nickname,
      },
      items,
    };
  }

  async getFeedPostDetail(
    targetUserId: number,
    postId: number,
    viewerUserId: number,
  ): Promise<GetFeedPostDetailResponse> {
    await syncExpiredEvaluations(this.prisma);
    await syncCurrentRankings(this.prisma);

    const post = await this.prisma.post.findFirst({
      where: {
        id: postId,
        authorId: targetUserId,
        status: PostStatus.ACTIVE,
        deletedAt: null,
        publishedAt: { not: null },
        evaluation: {
          is: {
            status: EvaluationStatus.ENDED,
            endsAt: { lte: new Date() },
          },
        },
        rankingDetails: {
          some: {
            ranking: {
              status: RankingStatus.READY,
            },
          },
        },
      },
      include: {
        author: {
          select: {
            id: true,
            nickname: true,
          },
        },
        images: {
          orderBy: IMAGE_ORDER_BY,
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
      throw new NotFoundException('피드 게시글을 찾을 수 없습니다.');
    }

    return {
      postId: post.id,
      author: {
        userId: post.author.id,
        nickname: post.author.nickname,
      },
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
      ...buildMyVoteContext(post.evaluation.votes, viewerUserId),
      voteSummary: buildVoteSummary(post.evaluation.votes),
      feedbackSummary: buildFeedbackSummary(post.evaluation.votes),
      rankingPeriods: await this.rankingsService.getVisibleRankingPeriods(post.id),
    };
  }

  // ─── 내부 유틸 ────────────────────────────────────────────────────────────────

  private normalizeLimit(limit?: number): number {
    if (!limit || Number.isNaN(Number(limit))) {
      return 20;
    }
    return Math.min(Math.max(Number(limit), 1), 50);
  }
}
