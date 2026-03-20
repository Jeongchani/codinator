import { Injectable, NotFoundException } from '@nestjs/common';
import type {
  CreatePostRequest,
  CreatePostResponse,
  GetPostDetailResponse,
} from '@codinator/contracts';
import { EvaluationStatus, PostStatus } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';

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
          },
        },
        outfitItems: body.outfitItems?.length
          ? {
              create: body.outfitItems.map((item) => ({
                category: item.category,
                itemName: item.itemName ?? null,
                brand: item.brand ?? null,
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

  async getPostDetail(postId: number, _userId: number): Promise<GetPostDetailResponse> {
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
      },
    });

    if (!post) {
      throw new NotFoundException('게시글을 찾을 수 없습니다.');
    }

    return {
      postId: post.id,
      authorId: post.authorId,
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
    };
  }
}
