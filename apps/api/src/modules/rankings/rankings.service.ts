import { Injectable, NotFoundException } from '@nestjs/common';
import type {
  GetRankingPostDetailResponse,
  GetRankingsResponse,
  RankingPeriod,
} from '@codinator/contracts';
import { PostStatus, RankingStatus } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { buildFeedbackSummary } from '../evaluations/common/evaluation-summary.util';
import { syncExpiredEvaluations } from '../evaluations/common/sync-expired-evaluations.util';
import { syncCurrentRankingPeriod } from './common/ranking-sync.util';
import { validateRankingPeriod } from './common/ranking-period.util';
import { getCurrentRankingWindow } from './common/ranking-window.util';

const IMAGE_ORDER_BY = [
  { isPrimary: 'desc' as const },
  { sortOrder: 'asc' as const },
  { id: 'asc' as const },
];

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
          thumbnailUrl: detail.post.images[0]?.thumbnailUrl ?? detail.post.images[0]?.imageUrl ?? '',
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
              orderBy: [{ sortOrder: 'asc' }, { id: 'asc' }],
            },
            evaluation: {
              include: {
                votes: {
                  include: {
                    feedback: {
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

    const myVote = rankingDetail.post.evaluation.votes.find((vote) => vote.voterId === userId) ?? null;

    return {
      postId: rankingDetail.post.id,
      author: {
        userId: rankingDetail.post.author.id,
        nickname: rankingDetail.post.author.nickname,
      },
      content: rankingDetail.post.content,
      status: rankingDetail.post.status,
      createdAt: rankingDetail.post.createdAt.toISOString(),
      image: {
        id: rankingDetail.post.images[0]?.id ?? 0,
        imageUrl: rankingDetail.post.images[0]?.imageUrl ?? '',
      },
      outfitItems: rankingDetail.post.outfitItems.map((item) => ({
        id: item.id,
        category: item.category,
        itemName: item.itemName,
        brand: item.brand,
      })),
      evaluation: {
        id: rankingDetail.post.evaluation.id,
        status: rankingDetail.post.evaluation.status,
        endsAt: rankingDetail.post.evaluation.endsAt.toISOString(),
      },
      hasVoted: !!myVote,
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