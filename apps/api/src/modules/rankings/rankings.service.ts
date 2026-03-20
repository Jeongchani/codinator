import { Injectable, NotFoundException } from '@nestjs/common';
import type {
  GetRankingPostDetailResponse,
  GetRankingsResponse,
  RankingPeriod,
} from '@codinator/contracts';
import { PostStatus } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { buildFeedbackSummary, buildVoteSummary } from '../evaluations/common/evaluation-summary.util';
import { validateRankingPeriod } from './common/ranking-period.util';

type RankedPostRecord = Awaited<ReturnType<RankingsService['fetchRankingCandidates']>>[number];

@Injectable()
export class RankingsService {
  constructor(private readonly prisma: PrismaService) {}

  async getRankings(period: RankingPeriod): Promise<GetRankingsResponse> {
    validateRankingPeriod(period);

    const rankedPosts = await this.getRankedPosts(period);

    return {
      period,
      items: rankedPosts.map((entry) => ({
        rank: entry.rank,
        postId: entry.post.id,
        thumbnailUrl: entry.post.images[0]?.imageUrl ?? '',
        likeCount: entry.summary.likeCount,
        dislikeCount: entry.summary.dislikeCount,
        totalCount: entry.summary.totalCount,
        likeRate: entry.summary.likeRate,
      })),
    };
  }

  async getRankingPostDetail(
    postId: number,
    period: RankingPeriod,
    userId: number,
  ): Promise<GetRankingPostDetailResponse> {
    validateRankingPeriod(period);

    const rankedPosts = await this.getRankedPosts(period);
    const rankedPost = rankedPosts.find((entry) => entry.post.id === postId);

    if (!rankedPost || !rankedPost.post.evaluation) {
      throw new NotFoundException('랭킹 게시글을 찾을 수 없습니다.');
    }

    const myVote = rankedPost.post.evaluation.votes.find((vote) => vote.voterId === userId) ?? null;
    const { startDate, endDate } = this.getPeriodRange(period);

    return {
      postId: rankedPost.post.id,
      author: {
        userId: rankedPost.post.author.id,
        nickname: rankedPost.post.author.nickname,
      },
      content: rankedPost.post.content,
      status: rankedPost.post.status,
      createdAt: rankedPost.post.createdAt.toISOString(),
      image: {
        id: rankedPost.post.images[0]?.id ?? 0,
        imageUrl: rankedPost.post.images[0]?.imageUrl ?? '',
      },
      outfitItems: rankedPost.post.outfitItems.map((item) => ({
        id: item.id,
        category: item.category,
        itemName: item.itemName,
        brand: item.brand,
      })),
      evaluation: {
        id: rankedPost.post.evaluation.id,
        status: rankedPost.post.evaluation.status,
        endsAt: rankedPost.post.evaluation.endsAt.toISOString(),
      },
      hasVoted: !!myVote,
      canVote: false,
      voteSummary: rankedPost.summary,
      feedbackSummary: buildFeedbackSummary(rankedPost.post.evaluation.votes),
      ranking: {
        period,
        rank: rankedPost.rank,
        startDate: startDate.toISOString(),
        endDate: endDate.toISOString(),
      },
    };
  }

  async getVisibleRankingPeriods(postId: number): Promise<RankingPeriod[]> {
    const candidates = await this.fetchRankingCandidates();
    const periods: RankingPeriod[] = [];

    if (this.rankPostIdsByPeriod(candidates, 'WEEKLY').includes(postId)) {
      periods.push('WEEKLY');
    }

    if (this.rankPostIdsByPeriod(candidates, 'MONTHLY').includes(postId)) {
      periods.push('MONTHLY');
    }

    return periods;
  }

  private async getRankedPosts(period: RankingPeriod) {
    const candidates = await this.fetchRankingCandidates();
    const { startDate, endDate } = this.getPeriodRange(period);

    return candidates
      .filter((post) => post.evaluation && post.evaluation.endsAt >= startDate && post.evaluation.endsAt <= endDate)
      .map((post) => ({
        post,
        summary: buildVoteSummary(post.evaluation!.votes),
      }))
      .sort(
        (a, b) =>
          b.summary.likeCount - a.summary.likeCount ||
          b.summary.likeRate - a.summary.likeRate ||
          b.summary.totalCount - a.summary.totalCount ||
          a.post.id - b.post.id,
      )
      .map((entry, index) => ({
        ...entry,
        rank: index + 1,
      }));
  }

  private rankPostIdsByPeriod(candidates: RankedPostRecord[], period: RankingPeriod): number[] {
    const { startDate, endDate } = this.getPeriodRange(period);

    return candidates
      .filter((post) => post.evaluation && post.evaluation.endsAt >= startDate && post.evaluation.endsAt <= endDate)
      .map((post) => ({
        postId: post.id,
        summary: buildVoteSummary(post.evaluation!.votes),
      }))
      .sort(
        (a, b) =>
          b.summary.likeCount - a.summary.likeCount ||
          b.summary.likeRate - a.summary.likeRate ||
          b.summary.totalCount - a.summary.totalCount ||
          a.postId - b.postId,
      )
      .map((entry) => entry.postId);
  }

  private async fetchRankingCandidates() {
    return this.prisma.post.findMany({
      where: {
        status: PostStatus.ACTIVE,
        deletedAt: null,
        evaluation: {
          is: {
            endsAt: { lte: new Date() },
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
    });
  }

  private getPeriodRange(period: RankingPeriod) {
    const endDate = new Date();
    const startDate = new Date(endDate);

    if (period === 'WEEKLY') {
      startDate.setDate(startDate.getDate() - 7);
    } else {
      startDate.setMonth(startDate.getMonth() - 1);
    }

    return { startDate, endDate };
  }
}
