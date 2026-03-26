import { Injectable, NotFoundException } from '@nestjs/common';
import type {
  GetRankingPostDetailResponse,
  GetRankingsResponse,
  RankingPeriod,
} from '@codinator/contracts';
import { PostStatus, RankingStatus } from '@prisma/client';
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

  private async getCurrentReadyRanking(period: RankingPeriod) {
    const window = getCurrentRankingWindow(period);

    return this.prisma.ranking.findFirst({
      where: {
        period,
        status: RankingStatus.READY,
        startDate: window.startDate,
        endDate: window.endDate,
      },
      include: {
        details: {
          orderBy: { rank: 'asc' },
          include: {
            post: {
              include: {
                images: {
                  orderBy: IMAGE_ORDER_BY,
                  take: 1,
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
      select: {
        id: true,
        period: true,
        startDate: true,
        endDate: true,
      },
    });
  }
}
