import { Injectable, NotFoundException } from '@nestjs/common';
import type { GetFeedPostDetailResponse, GetUserFeedResponse } from '@codinator/contracts';
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
}
