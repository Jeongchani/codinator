import { Injectable } from '@nestjs/common';
import type { GetMyFeedResponse } from '@codinator/contracts';
import { EvaluationStatus, PostStatus } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';

import {
  mapEvaluationStatus,
  mapRankingPeriod,
} from '../../common/mappers/enums.mapper';

@Injectable()
export class FeedService {
  constructor(private readonly prisma: PrismaService) {}

  /** 내 피드: 내가 올린 모든 게시글 */
  async getMyFeed(userId: number): Promise<GetMyFeedResponse> {
    const posts = await this.prisma.post.findMany({
      where: { authorId: userId, deletedAt: null, status: PostStatus.ACTIVE },
      include: {
        images: { orderBy: { id: 'asc' }, take: 1 },
        evaluation: true,
        rankingEntries: {
          include: { snapshot: true },
          orderBy: { rank: 'asc' },
          take: 1,
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    return {
      userId,
      items: posts.map((post) => ({
        postId: post.id,
        thumbnailUrl: post.images[0]?.imageUrl ?? '',
        createdAt: post.createdAt.toISOString(),
        evaluationStatus: post.evaluation
          ? mapEvaluationStatus(post.evaluation.status)
          : null,
        rankingPeriod: post.rankingEntries[0]?.snapshot?.period
          ? mapRankingPeriod(post.rankingEntries[0].snapshot.period)
          : null,
      })),
    };
  }

  /** 상대방 피드: 투표 진행 중(OPEN)인 게시글 제외 */
  async getUserFeed(userId: number): Promise<GetMyFeedResponse> {
    const posts = await this.prisma.post.findMany({
      where: {
        authorId: userId,
        deletedAt: null,
        status: PostStatus.ACTIVE,
        evaluation: {
          status: { not: EvaluationStatus.OPEN },
        },
      },
      include: {
        images: { orderBy: { id: 'asc' }, take: 1 },
        evaluation: true,
        rankingEntries: {
          include: { snapshot: true },
          orderBy: { rank: 'asc' },
          take: 1,
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    return {
      userId,
      items: posts.map((post) => ({
        postId: post.id,
        thumbnailUrl: post.images[0]?.imageUrl ?? '',
        createdAt: post.createdAt.toISOString(),
        evaluationStatus: post.evaluation
          ? mapEvaluationStatus(post.evaluation.status)
          : null,
        rankingPeriod: post.rankingEntries[0]?.snapshot?.period
          ? mapRankingPeriod(post.rankingEntries[0].snapshot.period)
          : null,
      })),
    };
  }
}
