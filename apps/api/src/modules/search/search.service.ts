import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import type {
  ImageSearchItem,
  ImageSearchRequest,
  ImageSearchResponse,
  PostSearchItem,
  PostSearchKeyword,
  SearchResponse,
  SearchType,
  UserSearchItem,
} from '@codinator/contracts';
import {
  EvaluationStatus,
  ImageAnalysisPurpose,
  ImageAssetSourceType,
  ImageSearchMode,
  PostStatus,
  Prisma,
  UserStatus,
} from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import {
  IMAGE_ORDER_BY,
  pickPostThumbnail,
  POST_IMAGE_INCLUDE,
  POST_KEYWORD_ORDER_BY,
} from '../posts/common/post-presenter.util';
import { ImageIndexingService } from '../ai/image-indexing.service';

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
  constructor(
    private readonly prisma: PrismaService,
    private readonly imageIndexingService: ImageIndexingService,
  ) {}

  async search(params: {
    userId: number;
    q: string;
    type?: SearchType;
    cursor?: number;
    limit?: number;
  }): Promise<SearchResponse> {
    const q = (params.q ?? '').trim();

    if (!q) {
      throw new BadRequestException('검색어(q)는 필수입니다.');
    }
    if (q.length > 100) {
      throw new BadRequestException('검색어는 최대 100자입니다.');
    }

    const limit = this.normalizeLimit(params.limit);
    const cursor = params.cursor;

    let response: SearchResponse;

    switch (params.type) {
      case 'NICKNAME':
        response = await this.searchByNickname(q, cursor, limit);
        break;
      case 'KEYWORD':
        response = await this.searchByKeyword(q, cursor, limit);
        break;
      case 'POST':
        response = await this.searchByText(q, cursor, limit);
        break;
      default:
        response = await this.searchAll(q, limit);
        break;
    }

    await this.prisma.searchHistory.create({
      data: {
        userId: params.userId,
        searchType: 'TEXT',
        queryText: q,
        resultCount: response.posts.length + response.users.length,
      },
    });

    return response;
  }

  async searchImage(
    userId: number,
    body: ImageSearchRequest,
  ): Promise<ImageSearchResponse> {
    const imageAssetId = Number(body.imageAssetId);
    if (!Number.isInteger(imageAssetId) || imageAssetId <= 0) {
      throw new BadRequestException('유효한 imageAssetId가 필요합니다.');
    }

    const mode: ImageSearchMode = body.mode ?? 'FULL_OUTFIT';
    const limit = this.normalizeLimit(body.limit);
    const filters = this.normalizeImageSearchFilters(body);

    const imageAsset = await this.prisma.imageAsset.findFirst({
      where: {
        id: imageAssetId,
        ownerUserId: userId,
        sourceType: ImageAssetSourceType.SEARCH_QUERY,
      },
      select: { id: true },
    });

    if (!imageAsset) {
      throw new NotFoundException('검색용 이미지 자산을 찾을 수 없습니다.');
    }

    const analysisRunId = await this.imageIndexingService.ensureCurrentAnalysisRun(
      imageAsset.id,
      ImageAnalysisPurpose.SEARCH_QUERY,
    );

    const queryVector = await this.imageIndexingService.getSearchVector(
      analysisRunId,
      mode,
      body.garmentCategory,
    );

    const vectorLiteral = `[${queryVector.map((value) => String(Number(value))).join(',')}]`;
    const vectorSql = Prisma.raw(`'${vectorLiteral}'::vector`);
    const targetScope = mode === 'FULL_OUTFIT' ? 'OUTFIT' : 'GARMENT';

    const garmentJoinSql =
      targetScope === 'GARMENT'
        ? Prisma.sql`JOIN "image_garments" ig ON ig.id = iv."garment_id"`
        : Prisma.empty;

    const garmentCategorySql =
      targetScope === 'GARMENT' && body.garmentCategory
        ? Prisma.sql`AND ig."normalized_category" = ${body.garmentCategory}::"AiGarmentCategory"`
        : Prisma.empty;

    const publishedFromSql = filters.publishedFrom
      ? Prisma.sql`AND p."published_at" >= ${filters.publishedFrom}`
      : Prisma.empty;

    const publishedToSql = filters.publishedTo
      ? Prisma.sql`AND p."published_at" <= ${filters.publishedTo}`
      : Prisma.empty;

    const minLikeRatioSql =
      filters.minLikeRatio !== null
        ? Prisma.sql`AND psi."like_ratio" >= ${filters.minLikeRatio}`
        : Prisma.empty;

    const maxLikeRatioSql =
      filters.maxLikeRatio !== null
        ? Prisma.sql`AND psi."like_ratio" <= ${filters.maxLikeRatio}`
        : Prisma.empty;

    const outfitCategoriesSql = filters.outfitCategories.length
      ? Prisma.sql`AND psi."outfit_categories" && ARRAY[${Prisma.join(filters.outfitCategories)}]::text[]`
      : Prisma.empty;

    const keywordCodesSql = filters.keywordCodes.length
      ? Prisma.sql`AND psi."keyword_codes" && ARRAY[${Prisma.join(filters.keywordCodes)}]::text[]`
      : Prisma.empty;

    const feedbackTagCodesSql = filters.feedbackTagCodes.length
      ? Prisma.sql`AND (
          psi."feedback_like_codes" && ARRAY[${Prisma.join(filters.feedbackTagCodes)}]::text[]
          OR psi."feedback_dislike_codes" && ARRAY[${Prisma.join(filters.feedbackTagCodes)}]::text[]
        )`
      : Prisma.empty;

    const rows = await this.prisma.$queryRaw<Array<{ postId: number; similarity: number }>>(Prisma.sql`
      WITH ranked_vectors AS (
        SELECT
          p.id AS "postId",
          1 - (iv.vector <=> ${vectorSql}) AS similarity,
          ROW_NUMBER() OVER (
            PARTITION BY p.id
            ORDER BY iv.vector <=> ${vectorSql} ASC
          ) AS rn
        FROM "image_vectors" iv
        JOIN "image_analysis_runs" iar
          ON iar.id = iv."analysis_run_id"
         AND iar."status" = 'SUCCEEDED'
         AND iar."is_current" = true
        JOIN "image_assets" ia
          ON ia.id = iar."image_asset_id"
        JOIN "post_images" pi
          ON pi."image_asset_id" = ia.id
         AND pi."is_primary" = true
        JOIN "posts" p
          ON p.id = pi."post_id"
        JOIN "evaluations" e
          ON e."post_id" = p.id
         AND e."status" = 'ENDED'
        JOIN "post_search_index" psi
          ON psi."post_id" = p.id
         AND psi."is_searchable" = true
        ${garmentJoinSql}
        WHERE iv."target_scope" = ${Prisma.raw(`'${targetScope}'::"ImageVectorScope"`)}
          AND iv."is_active" = true
          AND p."status" = 'ACTIVE'
          AND p."deleted_at" IS NULL
          AND p."hidden_at" IS NULL
          AND p."published_at" IS NOT NULL
          ${garmentCategorySql}
          ${publishedFromSql}
          ${publishedToSql}
          ${minLikeRatioSql}
          ${maxLikeRatioSql}
          ${outfitCategoriesSql}
          ${keywordCodesSql}
          ${feedbackTagCodesSql}
      )
      SELECT "postId", similarity
      FROM ranked_vectors
      WHERE rn = 1
      ORDER BY similarity DESC, "postId" DESC
      LIMIT ${limit}
    `);

    const postIds = rows.map((row) => row.postId);
    const posts = postIds.length
      ? await this.prisma.post.findMany({
          where: { id: { in: postIds } },
          select: this.postSearchSelect(),
        })
      : [];

    const postMap = new Map(posts.map((post) => [post.id, post]));

    const items = rows
      .map((row) => {
        const post = postMap.get(row.postId);
        if (!post) {
          return null;
        }

        return this.mapImageSearchItem(post, Number(row.similarity));
      })
      .filter((item): item is ImageSearchItem => item !== null);

    await this.prisma.searchHistory.create({
      data: {
        userId,
        searchType: 'IMAGE',
        imageAssetId: imageAsset.id,
        imageSearchMode: mode,
        resultCount: items.length,
      },
    });

    return {
      mode,
      queryImageAssetId: imageAsset.id,
      analysisRunId,
      items,
    };
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

  private mapImageSearchItem(post: {
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
  }, similarity: number): ImageSearchItem {
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
      similarity,
      keywords,
    };
  }

  private normalizeLimit(limit?: number): number {
    if (!limit || Number.isNaN(Number(limit))) return 20;
    return Math.min(Math.max(Number(limit), 1), 50);
  }

  private normalizeImageSearchFilters(body: ImageSearchRequest) {
    const publishedFrom = this.parseOptionalDate(body.publishedFrom, 'publishedFrom');
    const publishedTo = this.parseOptionalDate(body.publishedTo, 'publishedTo');

    const minLikeRatio = this.parseOptionalRatio(body.minLikeRatio, 'minLikeRatio');
    const maxLikeRatio = this.parseOptionalRatio(body.maxLikeRatio, 'maxLikeRatio');

    if (minLikeRatio !== null && maxLikeRatio !== null && minLikeRatio > maxLikeRatio) {
      throw new BadRequestException('minLikeRatio는 maxLikeRatio보다 클 수 없습니다.');
    }

    if (publishedFrom && publishedTo && publishedFrom > publishedTo) {
      throw new BadRequestException('publishedFrom은 publishedTo보다 늦을 수 없습니다.');
    }

    return {
      publishedFrom,
      publishedTo,
      minLikeRatio,
      maxLikeRatio,
      outfitCategories: this.normalizeStringArray(body.outfitCategories),
      keywordCodes: this.normalizeStringArray(body.keywordCodes),
      feedbackTagCodes: this.normalizeStringArray(body.feedbackTagCodes),
    };
  }

  private parseOptionalDate(value: string | undefined, fieldName: string): Date | null {
    if (!value) {
      return null;
    }

    const parsed = new Date(value);
    if (Number.isNaN(parsed.getTime())) {
      throw new BadRequestException(`${fieldName}는 올바른 날짜 형식이어야 합니다.`);
    }

    return parsed;
  }

  private parseOptionalRatio(value: number | undefined, fieldName: string): number | null {
    if (value === undefined || value === null) {
      return null;
    }

    const ratio = Number(value);
    if (Number.isNaN(ratio) || ratio < 0 || ratio > 1) {
      throw new BadRequestException(`${fieldName}는 0 이상 1 이하이어야 합니다.`);
    }

    return ratio;
  }

  private normalizeStringArray(values?: string[]): string[] {
    if (!values?.length) {
      return [];
    }

    return Array.from(
      new Set(
        values
          .map((value) => String(value ?? '').trim())
          .filter((value) => value.length > 0),
      ),
    );
  }
}
