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
      items: ranking.entries
        .filter(
          (entry) =>
            entry.post.status === PostStatus.ACTIVE &&
            entry.post.deletedAt === null &&
            entry.post.publishedAt !== null,
        )
        .map((entry) => ({
          rank: entry.rank,
          postId: entry.post.id,
          thumbnailUrl: entry.post.images[0]?.thumbnailUrl ?? entry.post.images[0]?.imageUrl ?? '',
          likeCount: entry.likeCount,
          dislikeCount: entry.dislikeCount,
          totalCount: entry.totalCount,
          likeRate: Number(entry.likeRate),
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

    const rankingEntry = await this.prisma.rankingEntry.findFirst({
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

    if (!rankingEntry || !rankingEntry.post.evaluation) {
      throw new NotFoundException('랭킹 게시글을 찾을 수 없습니다.');
    }

    const myVote = rankingEntry.post.evaluation.votes.find((vote) => vote.voterId === userId) ?? null;

    return {
      postId: rankingEntry.post.id,
      author: {
        userId: rankingEntry.post.author.id,
        nickname: rankingEntry.post.author.nickname,
      },
      content: rankingEntry.post.content,
      status: rankingEntry.post.status,
      createdAt: rankingEntry.post.createdAt.toISOString(),
      image: {
        id: rankingEntry.post.images[0]?.id ?? 0,
        imageUrl: rankingEntry.post.images[0]?.imageUrl ?? '',
      },
      outfitItems: rankingEntry.post.outfitItems.map((item) => ({
        id: item.id,
        category: item.category,
        itemName: item.itemName,
        brand: item.brand,
      })),
      evaluation: {
        id: rankingEntry.post.evaluation.id,
        status: rankingEntry.post.evaluation.status,
        endsAt: rankingEntry.post.evaluation.endsAt.toISOString(),
      },
      hasVoted: !!myVote,
      canVote: false,
      voteSummary: {
        likeCount: rankingEntry.likeCount,
        dislikeCount: rankingEntry.dislikeCount,
        totalCount: rankingEntry.totalCount,
        likeRate: Number(rankingEntry.likeRate),
      },
      feedbackSummary: buildFeedbackSummary(rankingEntry.post.evaluation.votes),
      ranking: {
        period: ranking.period,
        rank: rankingEntry.rank,
        startDate: ranking.startDate.toISOString(),
        endDate: ranking.endDate.toISOString(),
      },
    };
  }

  async getVisibleRankingPeriods(postId: number): Promise<RankingPeriod[]> {
    const entries = await this.prisma.rankingEntry.findMany({
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

    return Array.from(new Set(entries.map((entry) => entry.ranking.period)));
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
        entries: {
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