import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import type {
  CreatePostRequest,
  CreatePostResponse,
  GetPostDetailResponse,
} from '@codinator/contracts';
import { AiBlurStatus, BlurMethod, EvaluationStatus, PostStatus } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import {
  buildFeedbackSummary,
  buildMyVoteContext,
  buildVoteSummary,
} from '../evaluations/common/evaluation-summary.util';
import { syncExpiredEvaluations } from '../evaluations/common/sync-expired-evaluations.util';
import {
  IMAGE_ORDER_BY,
  mapOutfitItems,
  mapPostImages,
  mapPostKeywords,
  OUTFIT_ORDER_BY,
  POST_KEYWORD_ORDER_BY,
} from './common/post-presenter.util';

@Injectable()
export class PostsService {
  constructor(private readonly prisma: PrismaService) {}

  async createPost(authorId: number, body: CreatePostRequest): Promise<CreatePostResponse> {
    const now = new Date();
    const endsAt = new Date(now);
    endsAt.setDate(endsAt.getDate() + 7);

    const keywordIds = this.normalizeKeywordIds(body.keywordIds);
    const validKeywordIds = await this.loadValidKeywordIds(keywordIds);

    const post = await this.prisma.post.create({
      data: {
        authorId,
        content: body.content ?? null,
        images: {
          create: {
            originalImageUrl: body.image.originalImageUrl,
            processedImageUrl: body.image.processedImageUrl ?? body.image.originalImageUrl,
            storageKey: body.image.storageKey ?? null,
            thumbnailUrl: body.image.thumbnailUrl ?? null,
            blurMethod: body.image.blurMethod ?? BlurMethod.NONE,
            aiBlurStatus: body.image.aiBlurStatus ?? AiBlurStatus.NONE,
            sortOrder: 0,
            isPrimary: true,
          },
        },
        postKeywords: validKeywordIds.length
          ? {
              create: validKeywordIds.map((keywordId, index) => ({
                keywordId,
                sortOrder: index,
              })),
            }
          : undefined,
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
      images: mapPostImages(post.images),
      keywords: mapPostKeywords(post.postKeywords),
      outfitItems: mapOutfitItems(post.outfitItems),
      evaluation: {
        id: post.evaluation.id,
        status: post.evaluation.status,
        endsAt: post.evaluation.endsAt.toISOString(),
      },
      ...buildMyVoteContext(post.evaluation.votes, userId),
      voteSummary: buildVoteSummary(post.evaluation.votes),
      feedbackSummary: buildFeedbackSummary(post.evaluation.votes),
    };
  }

  private normalizeKeywordIds(keywordIds?: number[]): number[] {
    if (!keywordIds?.length) {
      return [];
    }

    const normalized = keywordIds.map((value) => Number(value));

    if (normalized.some((value) => !Number.isInteger(value) || value <= 0)) {
      throw new BadRequestException('keywordIds는 양의 정수 배열이어야 합니다.');
    }

    const unique = Array.from(new Set(normalized));

    if (unique.length !== normalized.length) {
      throw new BadRequestException('중복된 키워드는 선택할 수 없습니다.');
    }

    return unique;
  }

  private async loadValidKeywordIds(keywordIds: number[]): Promise<number[]> {
    if (keywordIds.length === 0) {
      return [];
    }

    const keywords = await this.prisma.keyword.findMany({
      where: {
        id: { in: keywordIds },
        isActive: true,
      },
      select: {
        id: true,
      },
    });

    if (keywords.length !== keywordIds.length) {
      throw new BadRequestException('유효하지 않은 키워드가 포함되어 있습니다.');
    }

    return keywordIds;
  }
}
