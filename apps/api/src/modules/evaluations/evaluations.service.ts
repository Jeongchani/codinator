import { Injectable, NotFoundException } from '@nestjs/common';
import type {
  GetEvaluationPostDetailResponse,
  GetEvaluationsResponse,
} from '@codinator/contracts';
import { EvaluationStatus, PostStatus } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { buildFeedbackSummary, buildVoteSummary } from './common/evaluation-summary.util';

import {
  mapPostStatus,
  mapGarmentCategory,
  mapEvaluationStatus,
  mapVoteChoice,
} from '../../common/mappers/enums.mapper';

@Injectable()
export class EvaluationsService {
  constructor(private readonly prisma: PrismaService) {}

  async getEvaluations(params: {
    cursor?: number;
    limit?: number;
    userId: number;
  }): Promise<GetEvaluationsResponse> {
    const limit = this.normalizeLimit(params.limit);
    const cursor = params.cursor ?? 0;

    const evaluations = await this.prisma.evaluation.findMany({
      where: {
        id: { gt: cursor },
        status: EvaluationStatus.OPEN,
        endsAt: { gt: new Date() },
        post: {
          status: PostStatus.ACTIVE,
          deletedAt: null,
        },
      },
      orderBy: { id: 'asc' },
      take: limit + 1,
      include: {
        post: {
          include: {
            images: {
              orderBy: { id: 'asc' },
              take: 1,
            },
          },
        },
        votes: {
          where: { voterId: params.userId },
          select: { id: true },
        },
      },
    });

    const hasNextPage = evaluations.length > limit;
    const pageItems = hasNextPage ? evaluations.slice(0, limit) : evaluations;

    return {
      items: pageItems.map((evaluation) => ({
        evaluationId: evaluation.id,
        postId: evaluation.postId,
        thumbnailUrl: evaluation.post.images[0]?.imageUrl ?? '',
        endsAt: evaluation.endsAt.toISOString(),
        hasVoted: evaluation.votes.length > 0,
      })),
      nextCursor: hasNextPage ? pageItems[pageItems.length - 1]?.id ?? null : null,
    };
  }

  async getEvaluationPostDetail(
    postId: number,
    userId: number,
  ): Promise<GetEvaluationPostDetailResponse> {
    const post = await this.prisma.post.findFirst({
      where: {
        id: postId,
        status: PostStatus.ACTIVE,
        deletedAt: null,
      },
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
    });

    if (!post || !post.evaluation) {
      throw new NotFoundException('평가 게시글을 찾을 수 없습니다.');
    }

    const myVote = post.evaluation.votes.find((vote) => vote.voterId === userId) ?? null;
    const isEvaluationOpen =
      post.evaluation.status === EvaluationStatus.OPEN && post.evaluation.endsAt > new Date();
    const canRevealResult = post.authorId === userId || !!myVote || !isEvaluationOpen;

    return {
      postId: post.id,
      authorId: post.authorId,
      content: post.content,
      status: mapPostStatus(post.status),
      createdAt: post.createdAt.toISOString(),
      image: {
        id: post.images[0]?.id ?? 0,
        imageUrl: post.images[0]?.imageUrl ?? '',
      },
      outfitItems: post.outfitItems.map((item) => ({
        id: item.id,
        category: mapGarmentCategory(item.category),
        itemName: item.itemName,
        brand: item.brand,
      })),
      evaluation: {
        id: post.evaluation.id,
        status: mapEvaluationStatus(post.evaluation.status),
        endsAt: post.evaluation.endsAt.toISOString(),
      },
      hasVoted: !!myVote,
      canVote: isEvaluationOpen && !myVote && post.authorId !== userId,
      voteSummary: canRevealResult
        ? buildVoteSummary(
            post.evaluation.votes.map((v) => ({
              ...v,
              choice: mapVoteChoice(v.choice),
            })),
          )
        : undefined,
      feedbackSummary: canRevealResult
        ? buildFeedbackSummary(
            post.evaluation.votes.map((v) => ({
              ...v,
              choice: mapVoteChoice(v.choice),
            })),
          )
        : undefined,
    };
  }

  private normalizeLimit(limit?: number): number {
    if (!limit || Number.isNaN(Number(limit))) {
      return 10;
    }

    return Math.min(Math.max(Number(limit), 1), 30);
  }
}