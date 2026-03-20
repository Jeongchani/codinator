import { Injectable, NotFoundException } from '@nestjs/common';
import type { GetFeedPostDetailResponse, GetUserFeedResponse } from '@codinator/contracts';
import { EvaluationStatus, PostStatus } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { buildFeedbackSummary, buildVoteSummary } from '../evaluations/common/evaluation-summary.util';
import { syncExpiredEvaluations } from '../evaluations/common/sync-expired-evaluations.util';
import { RankingsService } from '../rankings/rankings.service';

@Injectable()
export class FeedsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly rankingsService: RankingsService,
  ) {}

  async getUserFeed(targetUserId: number, _viewerUserId: number): Promise<GetUserFeedResponse> {
    await syncExpiredEvaluations(this.prisma);

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
        evaluation: {
          is: {
            status: EvaluationStatus.ENDED,
            endsAt: { lte: new Date() },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
      include: {
        images: {
          orderBy: { id: 'asc' },
          take: 1,
        },
      },
    });

    const items = await Promise.all(
      posts.map(async (post) => ({
        postId: post.id,
        thumbnailUrl: post.images[0]?.imageUrl ?? '',
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
    _viewerUserId: number,
  ): Promise<GetFeedPostDetailResponse> {
    await syncExpiredEvaluations(this.prisma);

    const post = await this.prisma.post.findFirst({
      where: {
        id: postId,
        authorId: targetUserId,
        status: PostStatus.ACTIVE,
        deletedAt: null,
        evaluation: {
          is: {
            status: EvaluationStatus.ENDED,
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
      image: {
        id: post.images[0]?.id ?? 0,
        imageUrl: post.images[0]?.imageUrl ?? '',
      },
      outfitItems: post.outfitItems.map((item) => ({
        id: item.id,
        category: item.category,
        itemName: item.itemName,
        brand: item.brand,
      })),
      evaluation: {
        id: post.evaluation.id,
        status: post.evaluation.status,
        endsAt: post.evaluation.endsAt.toISOString(),
      },
      voteSummary: buildVoteSummary(post.evaluation.votes),
      feedbackSummary: buildFeedbackSummary(post.evaluation.votes),
      rankingPeriods: await this.rankingsService.getVisibleRankingPeriods(post.id),
    };
  }
}
