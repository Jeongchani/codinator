import { Injectable, NotFoundException } from '@nestjs/common';
import type { GetPostDetailResponse } from '@codinator/contracts';
import { EvaluationStatus, PostStatus } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { buildFeedbackSummary, buildVoteSummary } from '../evaluations/common/evaluation-summary.util';

@Injectable()
export class PostsService {
  constructor(private readonly prisma: PrismaService) {}


  async getPostDetail(postId: number, userId?: number | null): Promise<GetPostDetailResponse> {
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

    const myVote = userId
      ? post.evaluation.votes.find((vote) => vote.voterId === userId)
      : null;

    const isEvaluationOpen =
      post.evaluation.status === EvaluationStatus.OPEN && post.evaluation.endsAt > new Date();

    return {
      postId: post.id,
      authorId: post.authorId,
      content: post.content,
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
      hasVoted: !!myVote,
      canVote: !!userId && isEvaluationOpen && !myVote && post.authorId !== userId,
      voteSummary: buildVoteSummary(post.evaluation.votes),
      feedbackSummary: buildFeedbackSummary(post.evaluation.votes),
    };
  }


}
