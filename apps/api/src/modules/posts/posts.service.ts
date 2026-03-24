import { Injectable, NotFoundException } from '@nestjs/common';
import type {
  CreatePostRequest,
  CreatePostResponse,
  GetPostDetailResponse,
} from '@codinator/contracts';
import { EvaluationStatus, PostStatus } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { buildFeedbackSummary, buildVoteSummary } from '../evaluations/common/evaluation-summary.util';
import { syncExpiredEvaluations } from '../evaluations/common/sync-expired-evaluations.util';

const IMAGE_ORDER_BY = [
  { isPrimary: 'desc' as const },
  { sortOrder: 'asc' as const },
  { id: 'asc' as const },
];

@Injectable()
export class PostsService {
  constructor(private readonly prisma: PrismaService) {}

  async createPost(authorId: number, body: CreatePostRequest): Promise<CreatePostResponse> {
    const now = new Date();
    const endsAt = new Date(now);
    endsAt.setDate(endsAt.getDate() + 7);

    const post = await this.prisma.post.create({
      data: {
        authorId,
        content: body.content ?? null,
        images: {
          create: {
            imageUrl: body.image.imageUrl,
            sortOrder: 0,
            isPrimary: true,
          },
        },
        outfitItems: body.outfitItems?.length
          ? {
              create: body.outfitItems.map((item, index) => ({
                category: item.category,
                itemName: item.itemName ?? null,
                brand: item.brand ?? null,
                sortOrder: index,
              })),
            }
          : undefined,
        evaluation: {
          create: {
            startsAt: now,
            endsAt,
            status: EvaluationStatus.OPEN,
          },
        },
      },
      include: {
        evaluation: true,
      },
    });

    return {
      postId: post.id,
      evaluationId: post.evaluation!.id,
      status: post.status,
    };
  }

  async getMyPostDetail(postId: number, userId: number): Promise<GetPostDetailResponse> {
    await syncExpiredEvaluations(this.prisma);

    const post = await this.prisma.post.findFirst({
      where: {
        id: postId,
        authorId: userId,
        status: PostStatus.ACTIVE,
        deletedAt: null,
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
    });

    if (!post || !post.evaluation) {
      throw new NotFoundException('내 게시글을 찾을 수 없습니다.');
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
    };
  }
}
