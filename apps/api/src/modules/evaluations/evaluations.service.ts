import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import type { GetEvaluationPostDetailResponse, GetEvaluationsResponse } from '@codinator/contracts';
import { EvaluationStatus, PostStatus } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import {
  buildFeedbackSummary,
  buildMyVoteContext,
  buildVoteSummary,
} from './common/evaluation-summary.util';
import { syncExpiredEvaluations } from './common/sync-expired-evaluations.util';
import {
  IMAGE_ORDER_BY,
  mapOutfitItems,
  mapPostImages,
  mapPostKeywords,
  OUTFIT_ORDER_BY,
  pickPostThumbnail,
  POST_IMAGE_INCLUDE,
  POST_KEYWORD_ORDER_BY,
} from '../posts/common/post-presenter.util';

@Injectable()
export class EvaluationsService {
  constructor(private readonly prisma: PrismaService) {}

  async getEvaluations(params: {
    cursor?: number;
    limit?: number;
    userId: number;
  }): Promise<GetEvaluationsResponse> {
    await syncExpiredEvaluations(this.prisma);

    const limit = this.normalizeLimit(params.limit);
    const cursor = params.cursor ?? 0;

    const evaluations = await this.prisma.evaluation.findMany({
      where: {
        id: { gt: cursor },
        status: EvaluationStatus.OPEN,
        endsAt: { gt: new Date() },
        // 이미 투표한 평가는 DB 쿼리 레벨에서 제외 (재노출 방지)
        votes: { none: { voterId: params.userId } },
        post: {
          authorId: { not: params.userId },
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
              orderBy: IMAGE_ORDER_BY,
              take: 1,
              include: POST_IMAGE_INCLUDE,
            },
            postKeywords: {
              orderBy: POST_KEYWORD_ORDER_BY,
              include: {
                keyword: {
                  select: { id: true, code: true, label: true },
                },
              },
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
        thumbnailUrl: pickPostThumbnail(evaluation.post.images),
        content: evaluation.post.content,
        keywords: evaluation.post.postKeywords.map((pk) => ({
          id: pk.keyword.id,
          code: pk.keyword.code,
          label: pk.keyword.label,
        })),
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
    await syncExpiredEvaluations(this.prisma);

    const post = await this.prisma.post.findFirst({
      where: {
        id: postId,
        status: PostStatus.ACTIVE,
        deletedAt: null,
        evaluation: {
          is: {
            status: EvaluationStatus.OPEN,
            endsAt: { gt: new Date() },
          },
        },
      },
      include: {
        images: {
          orderBy: IMAGE_ORDER_BY,
          include: POST_IMAGE_INCLUDE,
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
      throw new NotFoundException('진행 중인 평가 게시글을 찾을 수 없습니다.');
    }

    const voteContext = buildMyVoteContext(post.evaluation.votes, userId);
    const isOwner = post.authorId === userId;

    if (!isOwner && !voteContext.hasVoted) {
      throw new ForbiddenException('투표 후에만 평가 상세를 볼 수 있습니다.');
    }

    return {
      postId: post.id,
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
      ...voteContext,
      canVote: !voteContext.hasVoted && !isOwner,
      voteSummary: buildVoteSummary(post.evaluation.votes),
      feedbackSummary: buildFeedbackSummary(post.evaluation.votes),
    };
  }

  private normalizeLimit(limit?: number): number {
    if (!limit || Number.isNaN(Number(limit))) {
      return 10;
    }

    return Math.min(Math.max(Number(limit), 1), 30);
  }
}
