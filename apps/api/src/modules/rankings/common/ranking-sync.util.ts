import type { RankingPeriod } from '@codinator/contracts';
import { EvaluationStatus, PostStatus, RankingStatus, VoteChoice } from '@prisma/client';
import { PrismaService } from '../../../prisma/prisma.service';
import { getAllCurrentRankingWindows, getCurrentRankingWindow } from './ranking-window.util';

const RANKING_TIMEZONE = 'Asia/Seoul';
const RANKING_ALGORITHM_VERSION = 1;

type RankedPostDetail = {
  postId: number;
  score: number;
  likeCount: number;
  dislikeCount: number;
  totalCount: number;
  likeRate: number;
};

function buildRankedPostDetails(
  posts: Array<{
    id: number;
    evaluation: {
      votes: Array<{
        choice: VoteChoice;
      }>;
    } | null;
  }>,
): RankedPostDetail[] {
  return posts
    .map((post) => {
      const votes = post.evaluation?.votes ?? [];
      const likeCount = votes.filter((vote) => vote.choice === VoteChoice.LIKE).length;
      const dislikeCount = votes.filter((vote) => vote.choice === VoteChoice.DISLIKE).length;
      const totalCount = votes.length;
      const likeRate = totalCount === 0 ? 0 : likeCount / totalCount;

      return {
        postId: post.id,
        score: likeCount,
        likeCount,
        dislikeCount,
        totalCount,
        likeRate,
      };
    })
    .sort((left, right) => {
      if (right.likeCount !== left.likeCount) {
        return right.likeCount - left.likeCount;
      }

      if (right.likeRate !== left.likeRate) {
        return right.likeRate - left.likeRate;
      }

      if (right.totalCount !== left.totalCount) {
        return right.totalCount - left.totalCount;
      }

      return left.postId - right.postId;
    });
}

export async function syncCurrentRankingPeriod(
  prisma: PrismaService,
  period: RankingPeriod,
): Promise<void> {
  const now = new Date();
  const window = getCurrentRankingWindow(period, now);

  const posts = await prisma.post.findMany({
    where: {
      status: PostStatus.ACTIVE,
      deletedAt: null,
      publishedAt: {
        not: null,
        gte: window.rangeStartUtc,
        lt: window.rangeEndExclusiveUtc,
      },
      evaluation: {
        is: {
          status: EvaluationStatus.ENDED,
        },
      },
    },
    select: {
      id: true,
      evaluation: {
        select: {
          votes: {
            select: {
              choice: true,
            },
          },
        },
      },
    },
  });

  const rankedDetails = buildRankedPostDetails(posts);

  await prisma.$transaction(async (tx) => {
    const ranking = await tx.ranking.upsert({
      where: {
        period_startDate_endDate_timezone_algorithmVersion: {
          period,
          startDate: window.startDate,
          endDate: window.endDate,
          timezone: RANKING_TIMEZONE,
          algorithmVersion: RANKING_ALGORITHM_VERSION,
        },
      },
      update: {
        status: RankingStatus.READY,
        generatedAt: now,
      },
      create: {
        period,
        startDate: window.startDate,
        endDate: window.endDate,
        timezone: RANKING_TIMEZONE,
        algorithmVersion: RANKING_ALGORITHM_VERSION,
        status: RankingStatus.READY,
        generatedAt: now,
      },
    });

    await tx.rankingDetail.deleteMany({
      where: {
        rankingId: ranking.id,
      },
    });

    if (rankedDetails.length > 0) {
      await tx.rankingDetail.createMany({
        data: rankedDetails.map((detail, index) => ({
          rankingId: ranking.id,
          postId: detail.postId,
          rank: index + 1,
          score: detail.score,
          likeCount: detail.likeCount,
          dislikeCount: detail.dislikeCount,
          totalCount: detail.totalCount,
          likeRate: detail.likeRate,
        })),
      });
    }
  });
}

export async function syncCurrentRankings(prisma: PrismaService): Promise<void> {
  const windows = getAllCurrentRankingWindows();

  for (const window of windows) {
    await syncCurrentRankingPeriod(prisma, window.period);
  }
}