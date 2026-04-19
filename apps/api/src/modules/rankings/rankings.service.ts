import { Injectable, NotFoundException } from '@nestjs/common';
import type {
  GetPersonalizedRankingsResponse, // V3 Batch7
  GetRankingPostDetailResponse,
  GetRankingsResponse,
  RankingPeriod,
} from '@codinator/contracts';
import { EvaluationStatus, PostStatus, RankingStatus, VoteChoice } from '@prisma/client'; // V3 Batch7: EvaluationStatus, VoteChoice 추가
import { PrismaService } from '../../prisma/prisma.service';
import {
  buildFeedbackSummary,
  buildMyVoteContext,
} from '../evaluations/common/evaluation-summary.util';
import { syncExpiredEvaluations } from '../evaluations/common/sync-expired-evaluations.util';
import { syncCurrentRankingPeriod } from './common/ranking-sync.util';
import { validateRankingPeriod } from './common/ranking-period.util';
import { getCurrentRankingWindow } from './common/ranking-window.util';
import {
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
export class RankingsService {
  constructor(private readonly prisma: PrismaService) {}

  async getRankings(period: RankingPeriod): Promise<GetRankingsResponse> {
    await syncExpiredEvaluations(this.prisma);
    validateRankingPeriod(period);
    await syncCurrentRankingPeriod(this.prisma, period);

    const ranking = await this.getCurrentReadyRanking(period);

    if (!ranking) {
      return {
        period,
        items: [],
      };
    }

    return {
      period,
      items: ranking.details
        .filter(
          (detail) =>
            detail.post.status === PostStatus.ACTIVE &&
            detail.post.deletedAt === null &&
            detail.post.hiddenAt === null &&
            detail.post.publishedAt !== null,
        )
        .map((detail) => ({
          rank: detail.rank,
          postId: detail.post.id,
          thumbnailUrl: pickPostThumbnail(detail.post.images),
          likeCount: detail.likeCount,
          dislikeCount: detail.dislikeCount,
          totalCount: detail.totalCount,
          likeRate: Number(detail.likeRate),
        })),
    };
  }

  async getRankingPostDetail(
    postId: number,
    period: RankingPeriod,
    userId: number,
  ): Promise<GetRankingPostDetailResponse> {
    await syncExpiredEvaluations(this.prisma);
    validateRankingPeriod(period);
    await syncCurrentRankingPeriod(this.prisma, period);

    const ranking = await this.getCurrentReadyRankingMeta(period);

    if (!ranking) {
      throw new NotFoundException('랭킹 게시글을 찾을 수 없습니다.');
    }

    const rankingDetail = await this.prisma.rankingDetail.findFirst({
      where: {
        rankingId: ranking.id,
        postId,
        post: {
          status: PostStatus.ACTIVE,
          deletedAt: null,
          hiddenAt: null,
          publishedAt: { not: null },
        },
      },
      include: {
        post: {
          include: {
            author: {
              select: {
                id: true,
                nickname: true,
              },
            },
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
        },
      },
    });

    if (!rankingDetail || !rankingDetail.post.evaluation) {
      throw new NotFoundException('랭킹 게시글을 찾을 수 없습니다.');
    }

    return {
      postId: rankingDetail.post.id,
      author: {
        userId: rankingDetail.post.author.id,
        nickname: rankingDetail.post.author.nickname,
      },
      content: rankingDetail.post.content,
      status: rankingDetail.post.status,
      createdAt: rankingDetail.post.createdAt.toISOString(),
      images: mapPostImages(rankingDetail.post.images),
      keywords: mapPostKeywords(rankingDetail.post.postKeywords),
      outfitItems: mapOutfitItems(rankingDetail.post.outfitItems),
      evaluation: {
        id: rankingDetail.post.evaluation.id,
        status: rankingDetail.post.evaluation.status,
        endsAt: rankingDetail.post.evaluation.endsAt.toISOString(),
      },
      ...buildMyVoteContext(rankingDetail.post.evaluation.votes, userId),
      canVote: false,
      voteSummary: {
        likeCount: rankingDetail.likeCount,
        dislikeCount: rankingDetail.dislikeCount,
        totalCount: rankingDetail.totalCount,
        likeRate: Number(rankingDetail.likeRate),
      },
      feedbackSummary: buildFeedbackSummary(rankingDetail.post.evaluation.votes),
      ranking: {
        period: ranking.period,
        rank: rankingDetail.rank,
        startDate: ranking.startDate.toISOString(),
        endDate: ranking.endDate.toISOString(),
      },
    };
  }

  // ── V3 Batch7: 개인화 추천 ────────────────────────────────────────────────────

  async getPersonalizedRankings(params: {
    cursor?: number;
    limit?: number;
    userId: number;
  }): Promise<GetPersonalizedRankingsResponse> {
    await syncExpiredEvaluations(this.prisma);

    const limit = this.normalizePersonalizedLimit(params.limit);

    // 1. 최근 활동 신호 수집 — 북마크(최근 50) + LIKE 투표(최근 50)
    const [recentBookmarkPostIds, recentLikedPostIds] = await Promise.all([
      this.prisma.bookmark
        .findMany({
          where: { userId: params.userId },
          orderBy: { id: 'desc' },
          take: 50,
          select: { postId: true },
        })
        .then((rows) => rows.map((r) => r.postId)),

      this.prisma.vote
        .findMany({
          where: { voterId: params.userId, choice: VoteChoice.LIKE },
          orderBy: { id: 'desc' },
          take: 50,
          include: { evaluation: { select: { postId: true } } },
        })
        .then((rows) => rows.map((r) => r.evaluation.postId)),
    ]);

    const signalPostIds = Array.from(new Set([...recentBookmarkPostIds, ...recentLikedPostIds]));

    // 2. 신호 게시글의 keyword codes 추출
    let preferredKeywordCodes: string[] = [];
    if (signalPostIds.length > 0) {
      const kws = await this.prisma.postKeyword.findMany({
        where: { postId: { in: signalPostIds } },
        include: { keyword: { select: { code: true } } },
        distinct: ['keywordId'],
      });
      preferredKeywordCodes = kws.map((k) => k.keyword.code);
    }

    // 3. 공개 조건 — 랭킹존 노출 대상 (V3 정책: 평가 완료 + ACTIVE + publishedAt + hiddenAt=null)
    //    rankingDetails 존재 여부는 공개 조건으로 사용하지 않는다.
    const publicWhere = {
      status: PostStatus.ACTIVE,
      deletedAt: null,
      hiddenAt: null,
      publishedAt: { not: null as null },
      evaluation: { is: { status: EvaluationStatus.ENDED } },
      postSearchIndex: { is: { isSearchable: true } }, // 검색/노출 인덱스 기준
      ...(params.cursor !== undefined ? { id: { lt: params.cursor } } : {}),
    };

    // 4. 개인화 쿼리 (keyword 필터) 또는 인기 fallback
    const posts = await this.prisma.post.findMany({
      where: {
        ...publicWhere,
        ...(preferredKeywordCodes.length > 0
          ? {
              // 신호 keyword와 겹치는 게시글 우선 추천
              postKeywords: {
                some: { keyword: { code: { in: preferredKeywordCodes } } },
              },
            }
          : {}
          // 신규 사용자 / 신호 없음 → keyword 필터 없이 전체 공개 게시글 (likeRatio 기준)
        ),
      },
      orderBy: [
        // likeRatio DESC 정렬 — 인기도 기반. cursor와의 완벽한 정합은 postId 보조 정렬로 보완.
        { postSearchIndex: { likeRatio: 'desc' } },
        { id: 'desc' },
      ],
      take: limit + 1,
      include: {
        images: {
          orderBy: IMAGE_ORDER_BY,
          take: 1,
          include: POST_IMAGE_INCLUDE,
        },
        evaluation: {
          include: {
            votes: { select: { choice: true } },
          },
        },
      },
    });

    // 5. 개인화 결과가 부족하면 인기 게시글로 보충 (신규 사용자 fallback)
    const MIN_THRESHOLD = Math.ceil(limit / 2);
    let finalPosts = posts;

    if (preferredKeywordCodes.length > 0 && posts.length < MIN_THRESHOLD) {
      const returnedIds = posts.map((p) => p.id);
      const fallbackPosts = await this.prisma.post.findMany({
        where: {
          ...publicWhere,
          // 이미 반환된 게시글 + keyword 일치 게시글 제외
          id: {
            ...(params.cursor !== undefined ? { lt: params.cursor } : {}),
            notIn: returnedIds,
          },
          NOT: {
            postKeywords: { some: { keyword: { code: { in: preferredKeywordCodes } } } },
          },
        },
        orderBy: [{ postSearchIndex: { likeRatio: 'desc' } }, { id: 'desc' }],
        take: limit + 1 - posts.length,
        include: {
          images: { orderBy: IMAGE_ORDER_BY, take: 1, include: POST_IMAGE_INCLUDE },
          evaluation: { include: { votes: { select: { choice: true } } } },
        },
      });
      finalPosts = [...posts, ...fallbackPosts];
    }

    const hasMore = finalPosts.length > limit;
    const pageItems = hasMore ? finalPosts.slice(0, limit) : finalPosts;

    return {
      items: pageItems.map((post) => {
        const votes = post.evaluation?.votes ?? [];
        const likeCount = votes.filter((v) => v.choice === VoteChoice.LIKE).length;
        const dislikeCount = votes.filter((v) => v.choice === VoteChoice.DISLIKE).length;
        const totalCount = votes.length;
        const likeRate = totalCount === 0 ? 0 : Number((likeCount / totalCount).toFixed(4));

        return {
          postId: post.id,
          thumbnailUrl: pickPostThumbnail(post.images),
          likeCount,
          dislikeCount,
          totalCount,
          likeRate,
        };
      }),
      nextCursor: hasMore ? (pageItems[pageItems.length - 1]?.id ?? null) : null,
      hasMore,
    };
  }

  async getVisibleRankingPeriods(postId: number): Promise<RankingPeriod[]> {
    const details = await this.prisma.rankingDetail.findMany({
      where: {
        postId,
        ranking: {
          status: RankingStatus.READY,
        },
      },
      include: {
        ranking: {
          select: {
            period: true,
          },
        },
      },
    });

    return Array.from(new Set(details.map((detail) => detail.ranking.period)));
  }

  // V3 Batch7: 개인화 추천 limit 정규화 (기본 20, 최대 50)
  private normalizePersonalizedLimit(limit?: number): number {
    const parsed = Number(limit);
    if (!limit || Number.isNaN(parsed) || parsed <= 0) return 20;
    return Math.min(Math.max(Math.floor(parsed), 1), 50);
  }

  private async getCurrentReadyRanking(period: RankingPeriod) {
    const window = getCurrentRankingWindow(period);

    return this.prisma.ranking.findFirst({
      where: {
        period,
        status: RankingStatus.READY,
        startDate: window.startDate,
        endDate: window.endDate,
      },
      orderBy: [{ generatedAt: 'desc' }, { id: 'desc' }],
      include: {
        details: {
          orderBy: { rank: 'asc' },
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
      },
    });
  }

  private async getCurrentReadyRankingMeta(period: RankingPeriod) {
    const window = getCurrentRankingWindow(period);

    return this.prisma.ranking.findFirst({
      where: {
        period,
        status: RankingStatus.READY,
        startDate: window.startDate,
        endDate: window.endDate,
      },
      orderBy: [{ generatedAt: 'desc' }, { id: 'desc' }],
      select: {
        id: true,
        period: true,
        startDate: true,
        endDate: true,
      },
    });
  }
}
