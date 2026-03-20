import { Injectable, NotFoundException } from '@nestjs/common';
import type {
  GetRankingPostDetailResponse,
  GetRankingsResponse,
  RankingPeriod,
} from '@codinator/contracts';
import { PostStatus } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { buildFeedbackSummary } from '../evaluations/common/evaluation-summary.util';
import { validateRankingPeriod } from './common/ranking-period.util';

@Injectable()
export class RankingsService {
  constructor(private readonly prisma: PrismaService) {}

  async getRankings(period: RankingPeriod): Promise<GetRankingsResponse> {
    validateRankingPeriod(period);

    const snapshot = await this.prisma.rankingSnapshot.findFirst({
      where: { period },
      orderBy: [{ endDate: 'desc' }, { createdAt: 'desc' }],
      include: {
        entries: {
          orderBy: { rank: 'asc' },
          include: {
            post: {
              include: {
                images: {
                  orderBy: { id: 'asc' },
                  take: 1,
                },
              },
            },
          },
        },
      },
    });

    if (!snapshot) {
      throw new NotFoundException('랭킹 스냅샷을 찾을 수 없습니다.');
    }

    return {
      period,
      items: snapshot.entries
        .filter((entry) => entry.post.status === PostStatus.ACTIVE && entry.post.deletedAt === null)
        .map((entry) => ({
          rank: entry.rank,
          postId: entry.postId,
          thumbnailUrl: entry.post.images[0]?.imageUrl ?? '',
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
    userId?: number | null,
  ): Promise<GetRankingPostDetailResponse> {
    validateRankingPeriod(period);

    const snapshot = await this.prisma.rankingSnapshot.findFirst({
      where: { period },
      orderBy: [{ endDate: 'desc' }, { createdAt: 'desc' }],
      select: {
        id: true,
        period: true,
        startDate: true,
        endDate: true,
      },
    });

    if (!snapshot) {
      throw new NotFoundException('랭킹 스냅샷을 찾을 수 없습니다.');
    }

    const rankingEntry = await this.prisma.rankingEntry.findFirst({
      where: {
        snapshotId: snapshot.id,
        postId,
        post: {
          status: PostStatus.ACTIVE,
          deletedAt: null,
        },
      },
      include: {
        post: {
          include: {
            images: {
              orderBy: { id: 'asc' },
            },
            outfitItems: {
              orderBy: { id: 'asc' },
            },
            evaluation: {
              include: {
                votes: {
                  include: {
                    feedbackTags: {
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

    const myVote = userId
      ? rankingEntry.post.evaluation.votes.find((vote) => vote.voterId === userId)
      : null;

    return {
      postId: rankingEntry.post.id,
      authorId: rankingEntry.post.authorId,
      content: rankingEntry.post.content,
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
        snapshotId: snapshot.id,
        period: snapshot.period,
        rank: rankingEntry.rank,
        startDate: snapshot.startDate.toISOString(),
        endDate: snapshot.endDate.toISOString(),
      },
    };
  }
}
