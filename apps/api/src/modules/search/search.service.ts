import { BadRequestException, Injectable } from '@nestjs/common';
import type {
  PostSearchItem,
  PostSearchKeyword,
  SearchResponse,
  SearchType,
  UserSearchItem,
} from '@codinator/contracts';
import { EvaluationStatus, PostStatus, RankingStatus, UserStatus } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import {
  IMAGE_ORDER_BY,
  pickPostThumbnail,
} from '../posts/common/post-presenter.util';

/**
 * 공개 가능 게시글 Where 조건 (V2 확정)
 *
 * 검색 결과에 포함되려면:
 *   1. Post.status = ACTIVE       (HIDDEN / DELETED 제외 — 작성자 숨김/관리자 숨김 게시글 제외)
 *   2. Post.deletedAt IS NULL
 *   3. evaluation.status = ENDED  (OPEN 평가중 제외 — 익명성 보호, CLOSED 제외 — 숨긴 게시글)
 *   4. rankingDetails 에 READY 상태 랭킹이 1건 이상 존재 (랭킹 미등재 게시글 제외)
 */
function publicPostWhere() {
  return {
    status: PostStatus.ACTIVE,
    deletedAt: null,
    evaluation: {
      is: {
        status: EvaluationStatus.ENDED,
      },
    },
    rankingDetails: {
      some: {
        ranking: { status: RankingStatus.READY },
      },
    },
  } as const;
}

/**
 * 공개 가능 사용자 Where 조건
 *   1. User.status = ACTIVE   (SUSPENDED / DELETED 제외)
 *   2. User.deletedAt IS NULL
 */
function publicUserWhere() {
  return {
    status: UserStatus.ACTIVE,
    deletedAt: null,
  } as const;
}

@Injectable()
export class SearchService {
  constructor(private readonly prisma: PrismaService) {}

  // ─── 진입점 ────────────────────────────────────────────────────────────────────

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
        return this.searchByContent(q, cursor, limit);
      default:
        // type 미지정 → ALL 검색 (cursor 미지원, 각 카테고리에서 limit건씩)
        return this.searchAll(q, limit);
    }
  }

  // ─── NICKNAME 검색 ─────────────────────────────────────────────────────────────
  /**
   * 닉네임 부분 일치 검색.
   * 정렬: id ASC (등록순) — 커서 방향: id > cursor (ASC 방향)
   */
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
        // 유저의 최근 랭킹 등재 게시글 대표 이미지 1장
        posts: {
          where: publicPostWhere(),
          orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
          take: 1,
          select: {
            images: {
              orderBy: IMAGE_ORDER_BY,
              take: 1,
              select: { thumbnailUrl: true, processedImageUrl: true },
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

  // ─── KEYWORD 검색 ─────────────────────────────────────────────────────────────
  /**
   * 게시글에 달린 키워드의 label이 검색어를 포함하는 게시글 검색.
   * 정렬: [createdAt DESC, id DESC] — 커서 방향: id < cursor (DESC 방향)
   * OPEN 평가 게시글 제외 (익명성 보호).
   * 게시글 검색 결과에는 author를 반환하지 않는다 (익명성 정책).
   */
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
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      take: limit + 1,
      select: {
        id: true,
        authorId: true,
        content: true,
        createdAt: true,
        images: { orderBy: IMAGE_ORDER_BY, take: 1, select: { thumbnailUrl: true, processedImageUrl: true } },
        postKeywords: {
          orderBy: { sortOrder: 'asc' as const },
          select: { keyword: { select: { id: true, label: true } } },
        },
      },
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

  // ─── POST(본문) 검색 ──────────────────────────────────────────────────────────
  /**
   * 게시글 본문(content) 부분 일치 검색.
   * 정렬: [createdAt DESC, id DESC] — 커서 방향: id < cursor (DESC 방향)
   * OPEN 평가 게시글 제외 (익명성 보호).
   * 게시글 검색 결과에는 author를 반환하지 않는다 (익명성 정책).
   */
  private async searchByContent(
    q: string,
    cursor: number | undefined,
    limit: number,
  ): Promise<SearchResponse> {
    const posts = await this.prisma.post.findMany({
      where: {
        ...publicPostWhere(),
        content: { contains: q, mode: 'insensitive' },
        ...(cursor !== undefined ? { id: { lt: cursor } } : {}),
      },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      take: limit + 1,
      select: {
        id: true,
        authorId: true,
        content: true,
        createdAt: true,
        images: { orderBy: IMAGE_ORDER_BY, take: 1, select: { thumbnailUrl: true, processedImageUrl: true } },
        postKeywords: {
          orderBy: { sortOrder: 'asc' as const },
          select: { keyword: { select: { id: true, label: true } } },
        },
      },
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

  // ─── 전체(ALL) 검색 ────────────────────────────────────────────────────────────
  /**
   * type 미지정 시 닉네임 + 키워드 + 본문을 병합 검색.
   *
   * 정렬 규칙:
   *   - users: id ASC (등록순)
   *   - posts: [createdAt DESC, id DESC] (최신순)
   *     게시글은 키워드 label 매칭 + 본문 매칭 결과를 OR 조건으로 단일 쿼리 처리,
   *     postId 기준 중복 제거 (KEYWORD / POST 동시 매칭 게시글).
   *
   * cursor 미지원: ALL 타입에서는 nextCursor=null, hasMore=false 고정.
   * 각 limit건씩 독립적으로 가져옴.
   *
   * 게시글 검색 결과에는 author를 반환하지 않는다 (익명성 정책).
   */
  private async searchAll(q: string, limit: number): Promise<SearchResponse> {
    const [users, posts] = await Promise.all([
      // 사용자 닉네임 검색
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
          // 유저의 최근 랭킹 등재 게시글 대표 이미지 1장
          posts: {
            where: publicPostWhere(),
            orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
            take: 1,
            select: {
              images: {
                orderBy: IMAGE_ORDER_BY,
                take: 1,
                select: { thumbnailUrl: true, processedImageUrl: true },
              },
            },
          },
        },
      }),

      // 게시글 검색 (키워드 label OR 본문 포함)
      this.prisma.post.findMany({
        where: {
          ...publicPostWhere(),
          OR: [
            {
              postKeywords: {
                some: {
                  keyword: { label: { contains: q, mode: 'insensitive' } },
                },
              },
            },
            {
              content: { contains: q, mode: 'insensitive' },
            },
          ],
        },
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        take: limit,
        select: {
          id: true,
          authorId: true,
          content: true,
          createdAt: true,
          images: { orderBy: IMAGE_ORDER_BY, take: 1, select: { thumbnailUrl: true, processedImageUrl: true } },
          postKeywords: {
            orderBy: { sortOrder: 'asc' as const },
            select: { keyword: { select: { id: true, label: true } } },
          },
        },
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

  // ─── 공통 헬퍼 ────────────────────────────────────────────────────────────────

  /**
   * Prisma Post 결과를 PostSearchItem으로 변환.
   * 닉네임은 익명성 정책에 따라 반환하지 않으나,
   * userId는 피드 상세 페이지 이동에 필요하므로 포함한다.
   */
  private mapPostItem(post: {
    id: number;
    authorId: number;
    content: string;
    createdAt: Date;
    images: Array<{
      thumbnailUrl: string | null;
      processedImageUrl: string | null;
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
      createdAt: post.createdAt.toISOString(),
      keywords,
    };
  }

  private normalizeLimit(limit?: number): number {
    if (!limit || Number.isNaN(Number(limit))) return 20;
    return Math.min(Math.max(Number(limit), 1), 50);
  }
}
