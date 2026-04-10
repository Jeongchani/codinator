import { BadRequestException, Injectable } from '@nestjs/common';
import type {
  PostSearchItem,
  PostSearchKeyword,
  SearchResponse,
  SearchType,
  UserSearchItem,
} from '@codinator/contracts';
import { EvaluationStatus, PostStatus, UserStatus } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import {
  IMAGE_ORDER_BY,
  pickPostThumbnail,
  POST_IMAGE_INCLUDE,
  POST_KEYWORD_ORDER_BY,
} from '../posts/common/post-presenter.util';

function publicPostWhere() {
  return {
    status: PostStatus.ACTIVE,
    deletedAt: null,
    hiddenAt: null,
    publishedAt: { not: null },
    evaluation: {
      is: {
        status: EvaluationStatus.ENDED,
      },
    },
    postSearchIndex: {
      is: {
        isSearchable: true,
      },
    },
  } as const;
}

function publicUserWhere() {
  return {
    status: UserStatus.ACTIVE,
    deletedAt: null,
  } as const;
}

@Injectable()
export class SearchService {
  constructor(private readonly prisma: PrismaService) {}

  async search(params: {
    q: string;
    type?: SearchType;
    cursor?: number;
    limit?: number;
  }): Promise<SearchResponse> {
    const q = (params.q ?? '').trim();

    if (!q || q.length === 0) {
      throw new BadRequestException('검색어(q)는 필수입니다.');
    }
    if (q.length > 100) {
      throw new BadRequestException('검색어는 최대 100자입니다.');
    }

    const limit = this.normalizeLimit(params.limit);
    const cursor = params.cursor;

    switch (params.type) {
      case 'NICKNAME':
        return this.searchByNickname(q, cursor, limit);
      case 'KEYWORD':
        return this.searchByKeyword(q, cursor, limit);
      case 'POST':
        return this.searchByText(q, cursor, limit);
      default:
        return this.searchAll(q, limit);
    }
  }

  private async searchByNickname(
    q: string,
    cursor: number | undefined,
    limit: number,
  ): Promise<SearchResponse> {
    const users = await this.prisma.user.findMany({
      where: {
        ...publicUserWhere(),
        nickname: { contains: q, mode: 'insensitive' },
        ...(cursor !== undefined ? { id: { gt: cursor } } : {}),
      },
      orderBy: [{ id: 'asc' }],
      take: limit + 1,
      select: {
        id: true,
        nickname: true,
        posts: {
          where: publicPostWhere(),
          orderBy: [{ publishedAt: 'desc' }, { id: 'desc' }],
          take: 1,
          select: {
            images: {
              orderBy: IMAGE_ORDER_BY,
              take: 1,
              include: POST_IMAGE_INCLUDE,
            },
          },
        },
      },
    });

    const hasMore = users.length > limit;
    const pageItems = hasMore ? users.slice(0, limit) : users;

    return {
      type: 'NICKNAME',
      users: pageItems.map<UserSearchItem>((u) => ({
        userId: u.id,
        nickname: u.nickname,
        thumbnailUrl: u.posts[0]?.images.length
          ? pickPostThumbnail(u.posts[0].images)
          : null,
      })),
      posts: [],
      nextCursor: hasMore ? (pageItems[pageItems.length - 1]?.id ?? null) : null,
      hasMore,
    };
  }

  private async searchByKeyword(
    q: string,
    cursor: number | undefined,
    limit: number,
  ): Promise<SearchResponse> {
    const posts = await this.prisma.post.findMany({
      where: {
        ...publicPostWhere(),
        postKeywords: {
          some: {
            keyword: {
              label: { contains: q, mode: 'insensitive' },
            },
          },
        },
        ...(cursor !== undefined ? { id: { lt: cursor } } : {}),
      },
      orderBy: [{ publishedAt: 'desc' }, { id: 'desc' }],
      take: limit + 1,
      select: this.postSearchSelect(),
    });

    const hasMore = posts.length > limit;
    const pageItems = hasMore ? posts.slice(0, limit) : posts;

    return {
      type: 'KEYWORD',
      users: [],
      posts: pageItems.map((p) => this.mapPostItem(p)),
      nextCursor: hasMore ? (pageItems[pageItems.length - 1]?.id ?? null) : null,
      hasMore,
    };
  }

  private async searchByText(
    q: string,
    cursor: number | undefined,
    limit: number,
  ): Promise<SearchResponse> {
    const posts = await this.prisma.post.findMany({
      where: {
        ...publicPostWhere(),
        postSearchIndex: {
          is: {
            isSearchable: true,
            searchText: { contains: q, mode: 'insensitive' },
          },
        },
        ...(cursor !== undefined ? { id: { lt: cursor } } : {}),
      },
      orderBy: [{ publishedAt: 'desc' }, { id: 'desc' }],
      take: limit + 1,
      select: this.postSearchSelect(),
    });

    const hasMore = posts.length > limit;
    const pageItems = hasMore ? posts.slice(0, limit) : posts;

    return {
      type: 'POST',
      users: [],
      posts: pageItems.map((p) => this.mapPostItem(p)),
      nextCursor: hasMore ? (pageItems[pageItems.length - 1]?.id ?? null) : null,
      hasMore,
    };
  }

  private async searchAll(q: string, limit: number): Promise<SearchResponse> {
    const [users, posts] = await Promise.all([
      this.prisma.user.findMany({
        where: {
          ...publicUserWhere(),
          nickname: { contains: q, mode: 'insensitive' },
        },
        orderBy: [{ id: 'asc' }],
        take: limit,
        select: {
          id: true,
          nickname: true,
          posts: {
            where: publicPostWhere(),
            orderBy: [{ publishedAt: 'desc' }, { id: 'desc' }],
            take: 1,
            select: {
              images: {
                orderBy: IMAGE_ORDER_BY,
                take: 1,
                include: POST_IMAGE_INCLUDE,
              },
            },
          },
        },
      }),
      this.prisma.post.findMany({
        where: {
          ...publicPostWhere(),
          OR: [
            {
              postSearchIndex: {
                is: {
                  isSearchable: true,
                  searchText: { contains: q, mode: 'insensitive' },
                },
              },
            },
            {
              postKeywords: {
                some: {
                  keyword: { label: { contains: q, mode: 'insensitive' } },
                },
              },
            },
          ],
        },
        orderBy: [{ publishedAt: 'desc' }, { id: 'desc' }],
        take: limit,
        select: this.postSearchSelect(),
      }),
    ]);

    return {
      type: 'ALL',
      users: users.map<UserSearchItem>((u) => ({
        userId: u.id,
        nickname: u.nickname,
        thumbnailUrl: u.posts[0]?.images.length
          ? pickPostThumbnail(u.posts[0].images)
          : null,
      })),
      posts: posts.map((p) => this.mapPostItem(p)),
      nextCursor: null,
      hasMore: false,
    };
  }

  private postSearchSelect() {
    return {
      id: true,
      authorId: true,
      content: true,
      publishedAt: true,
      images: { orderBy: IMAGE_ORDER_BY, take: 1, include: POST_IMAGE_INCLUDE },
      postKeywords: {
        orderBy: POST_KEYWORD_ORDER_BY,
        select: { keyword: { select: { id: true, label: true } } },
      },
    } as const;
  }

  private mapPostItem(post: {
    id: number;
    authorId: number;
    content: string;
    publishedAt: Date | null;
    images: Array<{
      imageAsset: {
        thumbnailUrl: string | null;
        processedImageUrl: string | null;
      };
    }>;
    postKeywords: Array<{
      keyword: { id: number; label: string };
    }>;
  }): PostSearchItem {
    const keywords: PostSearchKeyword[] = post.postKeywords.map((pk) => ({
      keywordId: pk.keyword.id,
      label: pk.keyword.label,
    }));

    return {
      postId: post.id,
      userId: post.authorId,
      thumbnailUrl: post.images.length > 0 ? pickPostThumbnail(post.images) : null,
      content: post.content,
      createdAt: (post.publishedAt ?? new Date()).toISOString(),
      keywords,
    };
  }

  private normalizeLimit(limit?: number): number {
    if (!limit || Number.isNaN(Number(limit))) return 20;
    return Math.min(Math.max(Number(limit), 1), 50);
  }
}
