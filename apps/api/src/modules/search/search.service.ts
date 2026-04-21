import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common'; // V3 Batch8: ForbiddenException 추가
import type {
  DeleteSearchHistoryResponse,
  GetSearchHistoriesResponse,
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
  AiGarmentCategory,
  EvaluationStatus,
  ImageAnalysisPurpose,
  ImageAssetSourceType,
  ImageSearchMode,
  PostStatus,
  Prisma,
  SearchHistoryType,
  UserStatus,
} from '@prisma/client'; // V3 Batch8: SearchHistoryType 추가 | Batch9-AutoMode: AiGarmentCategory 추가
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

    const limit = this.normalizeLimit(body.limit);
    const offset = body.cursor !== undefined ? Number(body.cursor) : 0;

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

    // Batch9-AutoMode: mode 명시 시 그대로 사용, 미입력 시 AI 분석 결과로 자동 판별
    const resolvedMode = await this.resolveSearchMode(
      analysisRunId,
      body.mode as ImageSearchMode | undefined,
    );

    const filters = await this.resolveImageSearchFilters(body);

    // 1차 vector 검색
    let finalMode = resolvedMode;
    let rows = await this.executeVectorSearch({
      analysisRunId,
      mode: resolvedMode,
      garmentCategory: body.garmentCategory as AiGarmentCategory | undefined,
      filters,
      fetchLimit: limit + 1,
      offset,
    });

    // Batch9-AutoMode: fallback — mode를 명시하지 않은 경우에만 반대 mode로 1회 재시도
    if (rows.length === 0 && !body.mode) {
      const fallbackMode: ImageSearchMode =
        resolvedMode === ImageSearchMode.FULL_OUTFIT
          ? ImageSearchMode.SINGLE_ITEM
          : ImageSearchMode.FULL_OUTFIT;

      try {
        const fallbackRows = await this.executeVectorSearch({
          analysisRunId,
          mode: fallbackMode,
          garmentCategory: body.garmentCategory as AiGarmentCategory | undefined,
          filters,
          fetchLimit: limit + 1,
          offset,
        });

        if (fallbackRows.length > 0) {
          finalMode = fallbackMode; // fallback mode 로 확정
          rows = fallbackRows;
        }
      } catch {
        // fallback 벡터 없음 또는 쿼리 실패 → 빈 결과 유지
      }
    }

    const hasMore = rows.length > limit;
    const pageRows = hasMore ? rows.slice(0, limit) : rows;
    const nextCursor = hasMore ? offset + limit : null;

    const postIds = pageRows.map((row) => row.postId);
    const posts = postIds.length
      ? await this.prisma.post.findMany({
          where: { id: { in: postIds } },
          select: this.postSearchSelect(),
        })
      : [];

    const postMap = new Map(posts.map((post) => [post.id, post]));

    const items = pageRows
      .map((row) => {
        const post = postMap.get(row.postId);
        if (!post) return null;
        return this.mapImageSearchItem(post, Number(row.similarity));
      })
      .filter((item): item is ImageSearchItem => item !== null);

    await this.prisma.searchHistory.create({
      data: {
        userId,
        searchType: 'IMAGE',
        imageAssetId: imageAsset.id,
        imageSearchMode: finalMode, // Batch9-AutoMode: 최종 resolvedMode 저장
        resultCount: items.length,
      },
    });

    return {
      resolvedMode: finalMode, // Batch9-AutoMode: 최종 사용 mode 반환
      queryImageAssetId: imageAsset.id,
      analysisRunId,
      items,
      nextCursor,
      hasMore,
    };
  }

  /**
   * [Batch9-AutoMode] mode 자동 판별.
   * requestedMode가 있으면 그대로 반환.
   * 없으면 imageAnalysisRun + imageGarments 기반 휴리스틱 규칙 적용:
   *   - garment >= 2개 또는 faceDetected >= 1 → FULL_OUTFIT
   *   - garment == 1 + areaRatio >= 0.6 + faceDetected == 0 → SINGLE_ITEM
   *   - 나머지 → FULL_OUTFIT (기본값)
   */
  private async resolveSearchMode(
    analysisRunId: number,
    requestedMode?: ImageSearchMode,
  ): Promise<ImageSearchMode> {
    if (requestedMode) return requestedMode; // 명시된 mode 우선

    const [run, garments] = await Promise.all([
      this.prisma.imageAnalysisRun.findUnique({
        where: { id: analysisRunId },
        select: { faceDetected: true },
      }),
      this.prisma.imageGarment.findMany({
        where: { analysisRunId },
        select: { areaRatio: true },
      }),
    ]);

    const faceCount = run?.faceDetected ?? 0;
    const garmentCount = garments.length;

    // 복수 의류 또는 얼굴 감지 → 전체 착장 이미지
    if (garmentCount >= 2 || faceCount >= 1) {
      return ImageSearchMode.FULL_OUTFIT;
    }

    // 단일 의류 + 대면적 + 얼굴 없음 → 단품 이미지
    if (garmentCount === 1) {
      const areaRatio = Number(garments[0]?.areaRatio ?? 0);
      if (areaRatio >= 0.6 && faceCount === 0) {
        return ImageSearchMode.SINGLE_ITEM;
      }
    }

    // 기본값: FULL_OUTFIT
    return ImageSearchMode.FULL_OUTFIT;
  }

  /**
   * [Batch9-AutoMode] vector 유사도 검색 실행 helper.
   * searchImage()에서 분리하여 1차 검색 + fallback 재시도에서 재사용.
   */
  private async executeVectorSearch(params: {
    analysisRunId: number;
    mode: ImageSearchMode;
    garmentCategory?: AiGarmentCategory;
    filters: {
      periodFrom: Date | null;
      periodTo: Date | null;
      likeRatioMin: number | null;
      keywordCodes: string[];
      feedbackLikeCodes: string[];
      feedbackDislikeCodes: string[];
    };
    fetchLimit: number;
    offset: number;
  }): Promise<Array<{ postId: number; similarity: number }>> {
    const { analysisRunId, mode, garmentCategory, filters, fetchLimit, offset } = params;

    const queryVector = await this.imageIndexingService.getSearchVector(
      analysisRunId,
      mode,
      garmentCategory,
    );

    const vectorLiteral = `[${queryVector.map((v) => String(Number(v))).join(',')}]`;
    const vectorSql = Prisma.raw(`'${vectorLiteral}'::vector`);
    const targetScope = mode === ImageSearchMode.FULL_OUTFIT ? 'OUTFIT' : 'GARMENT';

    const garmentJoinSql =
      targetScope === 'GARMENT'
        ? Prisma.sql`JOIN "image_garments" ig ON ig.id = iv."garment_id"`
        : Prisma.empty;

    const garmentCategorySql =
      targetScope === 'GARMENT' && garmentCategory
        ? Prisma.sql`AND ig."normalized_category" = ${garmentCategory}::"AiGarmentCategory"`
        : Prisma.empty;

    const periodFromSql = filters.periodFrom
      ? Prisma.sql`AND p."published_at" >= ${filters.periodFrom}`
      : Prisma.empty;

    const periodToSql = filters.periodTo
      ? Prisma.sql`AND p."published_at" <= ${filters.periodTo}`
      : Prisma.empty;

    const likeRatioMinSql =
      filters.likeRatioMin !== null
        ? Prisma.sql`AND psi."like_ratio" >= ${filters.likeRatioMin}`
        : Prisma.empty;

    const keywordCodesSql = filters.keywordCodes.length
      ? Prisma.sql`AND psi."keyword_codes" && ARRAY[${Prisma.join(filters.keywordCodes)}]::text[]`
      : Prisma.empty;

    // like / dislike 피드백 필터는 각각 독립 조건 (AND 교집합, OR 아님)
    const feedbackLikeCodesSql = filters.feedbackLikeCodes.length
      ? Prisma.sql`AND psi."feedback_like_codes" && ARRAY[${Prisma.join(filters.feedbackLikeCodes)}]::text[]`
      : Prisma.empty;

    const feedbackDislikeCodesSql = filters.feedbackDislikeCodes.length
      ? Prisma.sql`AND psi."feedback_dislike_codes" && ARRAY[${Prisma.join(filters.feedbackDislikeCodes)}]::text[]`
      : Prisma.empty;

    return this.prisma.$queryRaw<Array<{ postId: number; similarity: number }>>(Prisma.sql`
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
          ${periodFromSql}
          ${periodToSql}
          ${likeRatioMinSql}
          ${keywordCodesSql}
          ${feedbackLikeCodesSql}
          ${feedbackDislikeCodesSql}
      )
      SELECT "postId", similarity
      FROM ranked_vectors
      WHERE rn = 1
      ORDER BY similarity DESC, "postId" DESC
      LIMIT ${fetchLimit}
      OFFSET ${offset}
    `);
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

  // ── V3 Batch8: 최근 검색 기록 조회 ──────────────────────────────────────────

  /**
   * GET /users/me/search-histories
   * - 본인 기록만 조회 (userId 필터)
   * - searchType 필터 지원 (TEXT / IMAGE / 생략 시 전체)
   * - 커서 기반 페이지네이션 (historyId DESC)
   */
  async getMySearchHistories(params: {
    userId: number;
    searchType?: 'TEXT' | 'IMAGE';
    cursor?: number;
    limit?: number;
  }): Promise<GetSearchHistoriesResponse> {
    const limit = this.normalizeLimit(params.limit);

    const histories = await this.prisma.searchHistory.findMany({
      where: {
        userId: params.userId,
        ...(params.searchType
          ? { searchType: params.searchType as SearchHistoryType }
          : {}),
        ...(params.cursor !== undefined ? { id: { lt: params.cursor } } : {}),
      },
      orderBy: { id: 'desc' },
      take: limit + 1,
    });

    const hasMore = histories.length > limit;
    const pageItems = hasMore ? histories.slice(0, limit) : histories;

    return {
      items: pageItems.map((h) => ({
        historyId: h.id,
        searchType: h.searchType as 'TEXT' | 'IMAGE',
        queryText: h.queryText ?? null,
        imageAssetId: h.imageAssetId ?? null,
        imageSearchMode: h.imageSearchMode ?? null,
        resultCount: h.resultCount,
        createdAt: h.createdAt.toISOString(),
      })),
      nextCursor: hasMore ? (pageItems[pageItems.length - 1]?.id ?? null) : null,
      hasMore,
    };
  }

  // ── V3 Batch8: 검색 기록 삭제 ──────────────────────────────────────────────

  /**
   * DELETE /search/histories/:historyId
   * - 본인 기록만 삭제 가능
   * - soft delete 없음 → 실제 delete
   * - 존재하지 않으면 404, 타인 기록이면 403
   */
  async deleteSearchHistory(
    userId: number,
    historyId: number,
  ): Promise<DeleteSearchHistoryResponse> {
    const history = await this.prisma.searchHistory.findUnique({
      where: { id: historyId },
      select: { id: true, userId: true },
    });

    if (!history) {
      throw new NotFoundException('검색 기록을 찾을 수 없습니다.');
    }

    if (history.userId !== userId) {
      throw new ForbiddenException('본인의 검색 기록만 삭제할 수 있습니다.');
    }

    await this.prisma.searchHistory.delete({ where: { id: historyId } });

    return { success: true, message: '검색 기록이 삭제되었습니다.' };
  }

  // ── Private helpers ──────────────────────────────────────────────────────

  private normalizeLimit(limit?: number): number {
    if (!limit || Number.isNaN(Number(limit))) return 20;
    return Math.min(Math.max(Number(limit), 1), 50);
  }

  /**
   * [V3 Batch9] 이미지 검색 필터 정규화 — ID→code 비동기 매핑 포함
   *
   * - keywordIds: keyword.id 배열 → keyword.code 배열 변환
   * - feedbackLikeTagIds: feedback_tag.id 배열 → voteChoice=LIKE 검증 후 code 배열 변환
   * - feedbackDislikeTagIds: feedback_tag.id 배열 → voteChoice=DISLIKE 검증 후 code 배열 변환
   */
  private async resolveImageSearchFilters(body: ImageSearchRequest) {
    const periodFrom = this.parseOptionalDate(body.periodFrom, 'periodFrom');
    const periodTo = this.parseOptionalDate(body.periodTo, 'periodTo');

    if (periodFrom && periodTo && periodFrom > periodTo) {
      throw new BadRequestException('periodFrom은 periodTo보다 늦을 수 없습니다.');
    }

    const likeRatioMin = this.parseOptionalRatio(body.likeRatioMin, 'likeRatioMin');

    const [keywordCodes, feedbackLikeCodes, feedbackDislikeCodes] = await Promise.all([
      this.resolveKeywordCodes(body.keywordIds),
      this.resolveFeedbackCodes(body.feedbackLikeTagIds, 'LIKE'),
      this.resolveFeedbackCodes(body.feedbackDislikeTagIds, 'DISLIKE'),
    ]);

    return {
      periodFrom,
      periodTo,
      likeRatioMin,
      keywordCodes,
      feedbackLikeCodes,
      feedbackDislikeCodes,
    };
  }

  /**
   * keyword ID 배열 → keyword code 배열 변환.
   * 존재하지 않는 ID가 있으면 400.
   */
  private async resolveKeywordCodes(ids?: number[]): Promise<string[]> {
    if (!ids?.length) return [];
    const uniqueIds = [...new Set(ids)];

    const rows = await this.prisma.keyword.findMany({
      where: { id: { in: uniqueIds }, isActive: true },
      select: { id: true, code: true },
    });

    if (rows.length !== uniqueIds.length) {
      const foundIds = new Set(rows.map((r) => r.id));
      const missing = uniqueIds.filter((id) => !foundIds.has(id));
      throw new BadRequestException(`유효하지 않은 keywordIds: ${missing.join(', ')}`);
    }

    return rows.map((r) => r.code);
  }

  /**
   * feedback_tag ID 배열 → code 배열 변환 (voteChoice 검증 포함).
   * 존재하지 않는 ID나 voteChoice 불일치 시 400.
   */
  private async resolveFeedbackCodes(
    ids: number[] | undefined,
    expectedVoteChoice: 'LIKE' | 'DISLIKE',
  ): Promise<string[]> {
    if (!ids?.length) return [];
    const uniqueIds = [...new Set(ids)];

    const rows = await this.prisma.feedbackTag.findMany({
      where: { id: { in: uniqueIds }, isActive: true },
      select: { id: true, code: true, voteChoice: true },
    });

    if (rows.length !== uniqueIds.length) {
      const foundIds = new Set(rows.map((r) => r.id));
      const missing = uniqueIds.filter((id) => !foundIds.has(id));
      const fieldName =
        expectedVoteChoice === 'LIKE' ? 'feedbackLikeTagIds' : 'feedbackDislikeTagIds';
      throw new BadRequestException(`유효하지 않은 ${fieldName}: ${missing.join(', ')}`);
    }

    const wrongChoice = rows.filter((r) => r.voteChoice !== expectedVoteChoice);
    if (wrongChoice.length) {
      const fieldName =
        expectedVoteChoice === 'LIKE' ? 'feedbackLikeTagIds' : 'feedbackDislikeTagIds';
      throw new BadRequestException(
        `${fieldName}에 ${expectedVoteChoice === 'LIKE' ? 'DISLIKE' : 'LIKE'} 태그가 포함되어 있습니다: ${wrongChoice.map((r) => r.id).join(', ')}`,
      );
    }

    return rows.map((r) => r.code);
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
}
