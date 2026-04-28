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
  EvaluationStatus,
  ImageAnalysisPurpose,
  ImageAssetSourceType,
  ImageSearchMode,
  PostStatus,
  Prisma,
  SearchHistoryType,
  UserStatus,
} from '@prisma/client'; // V3 Batch8: SearchHistoryType 추가 | Batch9-AutoMode: AiGarmentCategory 제거(결과 필터 분리)
import { PrismaService } from '../../prisma/prisma.service';
import {
  IMAGE_ORDER_BY,
  pickPostThumbnail,
  POST_IMAGE_INCLUDE,
  POST_KEYWORD_ORDER_BY,
} from '../posts/common/post-presenter.util';
import { ImageIndexingService } from '../ai/image-indexing.service';

// ── Category 정규화: 한국어 UI 값 / AiGarmentCategory / enum 문자열 → GarmentCategory ──
// DRESS 는 GarmentCategory 에 없으므로 ETC 로 매핑
const KOREAN_TO_GARMENT_CATEGORY: Record<string, string> = {
  '상의': 'TOP',
  '하의': 'BOTTOM',
  '아우터': 'OUTER',
  '신발': 'SHOES',
  '가방': 'BAG',
  '악세사리': 'ACCESSORY',
  '악세서리': 'ACCESSORY', // 표기 변형 허용
  '기타': 'ETC',
  '원피스': 'ETC', // AiGarmentCategory.DRESS → GarmentCategory 없음 → ETC
};
const VALID_GARMENT_CATEGORIES = new Set(['TOP', 'BOTTOM', 'OUTER', 'SHOES', 'BAG', 'ACCESSORY', 'ETC']);

/**
 * 한국어 UI 값, AiGarmentCategory(DRESS 포함), GarmentCategory enum 문자열을
 * 게시글 도메인 GarmentCategory 로 정규화.
 * 알 수 없는 값은 null 반환 → 호출부에서 filter 처리.
 */
function normalizeToGarmentCategory(value: string): string | null {
  const trimmed = value.trim();
  // 한국어 UI 값
  if (KOREAN_TO_GARMENT_CATEGORY[trimmed]) return KOREAN_TO_GARMENT_CATEGORY[trimmed];
  // enum 문자열 (대소문자 무관)
  const upper = trimmed.toUpperCase();
  if (VALID_GARMENT_CATEGORIES.has(upper)) return upper;
  // AiGarmentCategory.DRESS → ETC
  if (upper === 'DRESS') return 'ETC';
  return null; // 알 수 없는 값 → 무시
}

// ── AI 이미지 검색 필터 해결 결과 타입 ───────────────────────────────────────────
interface ResolvedImageFilters {
  periodFrom: Date | null;
  periodTo: Date | null;
  likeRatioMin: number | null;
  outfitCategories: string[];    // 결과 게시글 outfit category 필터 (GarmentCategory 기준)
  keywordCodes: string[];
  feedbackLikeCodes: string[];
  feedbackDislikeCodes: string[];
}

// ── TextSearchAdvanced: 텍스트 검색 필터 해결 결과 타입 ────────────────────────
interface ResolvedTextFilters {
  periodFrom: Date | null;
  periodTo: Date | null;
  likeRatioMin: number | null;
  outfitCategories: string[];   // 정규화(대문자) 완료
  keywordCodes: string[];        // keyword id → code 변환 완료
  feedbackLikeCodes: string[];   // feedbackTag id → code 변환 완료
  feedbackDislikeCodes: string[]; // feedbackTag id → code 변환 완료
}

// ── TextSearchAdvanced: 빈 필터 (고급 필터 없는 경우) ───────────────────────────
function emptyFilters(): ResolvedTextFilters {
  return {
    periodFrom: null,
    periodTo: null,
    likeRatioMin: null,
    outfitCategories: [],
    keywordCodes: [],
    feedbackLikeCodes: [],
    feedbackDislikeCodes: [],
  };
}

// ── TextSearchAdvanced: postSearchIndex 레벨 필터 조건 빌더 ─────────────────────
function buildPostIndexFilterConditions(filters: ResolvedTextFilters) {
  const cond: Record<string, unknown> = {};
  if (filters.likeRatioMin !== null) {
    cond['likeRatio'] = { gte: filters.likeRatioMin };
  }
  if (filters.outfitCategories.length > 0) {
    cond['outfitCategories'] = { hasSome: filters.outfitCategories };
  }
  if (filters.keywordCodes.length > 0) {
    cond['keywordCodes'] = { hasSome: filters.keywordCodes };
  }
  if (filters.feedbackLikeCodes.length > 0) {
    cond['feedbackLikeCodes'] = { hasSome: filters.feedbackLikeCodes };
  }
  if (filters.feedbackDislikeCodes.length > 0) {
    cond['feedbackDislikeCodes'] = { hasSome: filters.feedbackDislikeCodes };
  }
  return cond;
}

// ── TextSearchAdvanced: publishedAt 날짜 필터 빌더 ──────────────────────────────
function buildPublishedAtFilter(filters: ResolvedTextFilters): Record<string, unknown> {
  const dateFilter: Record<string, unknown> = { not: null };
  if (filters.periodFrom) dateFilter['gte'] = filters.periodFrom;
  if (filters.periodTo) dateFilter['lte'] = filters.periodTo;
  return dateFilter;
}

// ── TextSearchAdvanced: 공개 게시글 + 고급 필터 통합 WHERE 빌더 ─────────────────
function buildTextSearchPostWhere(filters: ResolvedTextFilters) {
  return {
    status: PostStatus.ACTIVE,
    deletedAt: null,
    hiddenAt: null,
    publishedAt: buildPublishedAtFilter(filters),
    evaluation: {
      is: {
        status: EvaluationStatus.ENDED,
      },
    },
    postSearchIndex: {
      is: {
        isSearchable: true,
        ...buildPostIndexFilterConditions(filters),
      },
    },
  };
}

// ── 공개 게시글 기본 WHERE (고급 필터 없음, 하위 호환) ───────────────────────────
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
    // TextSearchAdvanced: 고급 필터
    periodFrom?: string;
    periodTo?: string;
    likeRatioMin?: number;
    outfitCategories?: string[];
    keywordIds?: number[];
    feedbackLikeTagIds?: number[];
    feedbackDislikeTagIds?: number[];
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

    // TextSearchAdvanced: 고급 필터 정규화 (ID → code 변환 포함)
    const filters = await this.resolveTextSearchFilters(params);

    let response: SearchResponse;

    switch (params.type) {
      case 'NICKNAME':
        // NICKNAME은 유저 검색 — 고급 필터 적용 불가 (유저는 likeRatio/category 없음)
        response = await this.searchByNickname(q, cursor, limit);
        break;
      case 'KEYWORD':
        response = await this.searchByKeyword(q, cursor, limit, filters); // TextSearchAdvanced
        break;
      case 'POST':
        response = await this.searchByText(q, cursor, limit, filters); // TextSearchAdvanced
        break;
      case 'OUTFIT_ITEM': // TextSearchAdvanced: 착용 아이템 상품명 검색
        response = await this.searchByOutfitItem(q, cursor, limit, filters);
        break;
      case 'OUTFIT_BRAND': // TextSearchAdvanced: 착용 아이템 브랜드 검색
        response = await this.searchByOutfitBrand(q, cursor, limit, filters);
        break;
      default:
        response = await this.searchAll(q, limit, filters); // TextSearchAdvanced
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
    // garmentCategory 는 query vector 선택에서 분리 — filters.outfitCategories 로 결과 필터링
    let finalMode = resolvedMode;
    let rows = await this.executeVectorSearch({
      analysisRunId,
      mode: resolvedMode,
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
        select: { areaRatio: true, confidence: true },
      }),
    ]);

    const faceCount = run?.faceDetected ?? 0;

    // confidence 낮은 garment 제거
    const validGarments = garments.filter(
    (g) => Number(g.areaRatio ?? 0) > 0.01,
  );

    const garmentCount = validGarments.length;
    const largestArea = Math.max(
    0,
    ...validGarments.map((g) => Number(g.areaRatio ?? 0)),
    );

    // 단품 우선 판별:
    // 가장 큰 garment가 충분히 크고 얼굴이 없으면,
    // garment가 2개로 쪼개져도 단품 가능성 높게 본다.
    if (faceCount === 0 && largestArea >= 0.6) {
    return ImageSearchMode.SINGLE_ITEM;
    }

    // 복수 의류 또는 얼굴 감지 → 전체 착장 이미지
    if (garmentCount >= 2 || faceCount >= 1) {
      return ImageSearchMode.FULL_OUTFIT;
    }

    // 단일 의류면 단품
    if (garmentCount === 1) {
      return ImageSearchMode.SINGLE_ITEM;
    }

    // 기본값: FULL_OUTFIT
    return ImageSearchMode.FULL_OUTFIT;
  }

  /**
   * [Batch9-AutoMode → FilterUnification] vector 유사도 검색 실행 helper.
   * searchImage()에서 분리하여 1차 검색 + fallback 재시도에서 재사용.
   *
   * ▸ garmentCategory 는 query vector 선택 조건에서 완전히 분리됨.
   *   mode(FULL_OUTFIT/SINGLE_ITEM)는 resolveSearchMode 가 자동 결정.
   *   category filter 는 결과 게시글의 psi."outfit_categories" 기준으로만 적용.
   */
  private async executeVectorSearch(params: {
    analysisRunId: number;
    mode: ImageSearchMode;
    filters: ResolvedImageFilters;
    fetchLimit: number;
    offset: number;
  }): Promise<Array<{ postId: number; similarity: number }>> {
    const { analysisRunId, mode, filters, fetchLimit, offset } = params;

    // query vector 선택: mode 기반, garmentCategory 힌트 없이 최적 벡터 자동 선택
    const queryVector = await this.imageIndexingService.getSearchVector(
      analysisRunId,
      mode,
      // garmentCategory 힌트 제거 — category 는 결과 필터로만 사용
    );

    const vectorLiteral = `[${queryVector.map((v) => String(Number(v))).join(',')}]`;
    const vectorSql = Prisma.raw(`'${vectorLiteral}'::vector`);
    const targetScope = mode === ImageSearchMode.FULL_OUTFIT ? 'OUTFIT' : 'GARMENT';

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

    // outfitCategories: 결과 게시글의 outfit category 필터 (GarmentCategory 기준)
    // → 텍스트 검색의 outfitCategories 필터와 완전히 동일한 의미
    const outfitCategoriesSql = filters.outfitCategories.length
      ? Prisma.sql`AND psi."outfit_categories" && ARRAY[${Prisma.join(filters.outfitCategories)}]::text[]`
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
        WHERE iv."target_scope" = ${Prisma.raw(`'${targetScope}'::"ImageVectorScope"`)}
          AND iv."is_active" = true
          AND p."status" = 'ACTIVE'
          AND p."deleted_at" IS NULL
          AND p."hidden_at" IS NULL
          AND p."published_at" IS NOT NULL
          ${outfitCategoriesSql}
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

  // ── 닉네임 검색 (고급 필터 미적용 — 유저 검색은 post 속성과 무관) ──────────────

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

  // ── 키워드 라벨 기반 검색 (type=KEYWORD) + TextSearchAdvanced 고급 필터 적용 ──

  private async searchByKeyword(
    q: string,
    cursor: number | undefined,
    limit: number,
    filters: ResolvedTextFilters, // TextSearchAdvanced
  ): Promise<SearchResponse> {
    const posts = await this.prisma.post.findMany({
      where: {
        ...buildTextSearchPostWhere(filters), // TextSearchAdvanced
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

  // ── searchText 기반 게시글 검색 (type=POST) + TextSearchAdvanced 고급 필터 적용 ─

  private async searchByText(
    q: string,
    cursor: number | undefined,
    limit: number,
    filters: ResolvedTextFilters, // TextSearchAdvanced
  ): Promise<SearchResponse> {
    const posts = await this.prisma.post.findMany({
      where: {
        ...buildTextSearchPostWhere(filters), // TextSearchAdvanced
        postSearchIndex: {
          is: {
            isSearchable: true,
            ...buildPostIndexFilterConditions(filters), // TextSearchAdvanced
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

  // ── TextSearchAdvanced: 착용 아이템 상품명 검색 (type=OUTFIT_ITEM) ──────────────

  private async searchByOutfitItem(
    q: string,
    cursor: number | undefined,
    limit: number,
    filters: ResolvedTextFilters,
  ): Promise<SearchResponse> {
    const posts = await this.prisma.post.findMany({
      where: {
        ...buildTextSearchPostWhere(filters),
        outfitItems: {
          some: {
            itemName: { contains: q, mode: 'insensitive' },
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
      type: 'OUTFIT_ITEM',
      users: [],
      posts: pageItems.map((p) => this.mapPostItem(p)),
      nextCursor: hasMore ? (pageItems[pageItems.length - 1]?.id ?? null) : null,
      hasMore,
    };
  }

  // ── TextSearchAdvanced: 착용 아이템 브랜드 검색 (type=OUTFIT_BRAND) ───────────

  private async searchByOutfitBrand(
    q: string,
    cursor: number | undefined,
    limit: number,
    filters: ResolvedTextFilters,
  ): Promise<SearchResponse> {
    const posts = await this.prisma.post.findMany({
      where: {
        ...buildTextSearchPostWhere(filters),
        outfitItems: {
          some: {
            brand: { contains: q, mode: 'insensitive' },
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
      type: 'OUTFIT_BRAND',
      users: [],
      posts: pageItems.map((p) => this.mapPostItem(p)),
      nextCursor: hasMore ? (pageItems[pageItems.length - 1]?.id ?? null) : null,
      hasMore,
    };
  }

  // ── 통합 검색 (type=ALL or default) + TextSearchAdvanced 고급 필터 적용 ─────────

  private async searchAll(
    q: string,
    limit: number,
    filters: ResolvedTextFilters, // TextSearchAdvanced
  ): Promise<SearchResponse> {
    const [users, posts] = await Promise.all([
      // 유저 검색: 고급 필터 미적용 (유저 속성 아님)
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
      // 게시글 검색: searchText(=content+nickname+keyword+outfit) OR keyword label
      // TextSearchAdvanced: 고급 필터 적용
      this.prisma.post.findMany({
        where: {
          ...buildTextSearchPostWhere(filters), // TextSearchAdvanced
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
   * TextSearchAdvanced: 텍스트 검색 고급 필터 정규화.
   * 이미지 검색의 resolveImageSearchFilters와 동일한 helpers를 재사용.
   * outfitCategories는 대문자로 정규화.
   */
  private async resolveTextSearchFilters(params: {
    periodFrom?: string;
    periodTo?: string;
    likeRatioMin?: number;
    outfitCategories?: string[];
    keywordIds?: number[];
    feedbackLikeTagIds?: number[];
    feedbackDislikeTagIds?: number[];
  }): Promise<ResolvedTextFilters> {
    // 고급 필터가 하나도 없으면 빠른 반환
    if (
      !params.periodFrom &&
      !params.periodTo &&
      params.likeRatioMin === undefined &&
      !params.outfitCategories?.length &&
      !params.keywordIds?.length &&
      !params.feedbackLikeTagIds?.length &&
      !params.feedbackDislikeTagIds?.length
    ) {
      return emptyFilters();
    }

    const periodFrom = this.parseOptionalDate(params.periodFrom, 'periodFrom');
    const periodTo = this.parseOptionalDate(params.periodTo, 'periodTo');

    if (periodFrom && periodTo && periodFrom > periodTo) {
      throw new BadRequestException('periodFrom은 periodTo보다 늦을 수 없습니다.');
    }

    const likeRatioMin = this.parseOptionalRatio(params.likeRatioMin, 'likeRatioMin');

    // outfitCategories: 대소문자 무관 → 대문자 정규화 (post-search-index.util의 normalizeCategory와 동일)
    const outfitCategories = (params.outfitCategories ?? [])
      .map((s) => s.trim().toUpperCase())
      .filter(Boolean);

    const [keywordCodes, feedbackLikeCodes, feedbackDislikeCodes] = await Promise.all([
      this.resolveKeywordCodes(params.keywordIds),
      this.resolveFeedbackCodes(params.feedbackLikeTagIds, 'LIKE'),
      this.resolveFeedbackCodes(params.feedbackDislikeTagIds, 'DISLIKE'),
    ]);

    return {
      periodFrom,
      periodTo,
      likeRatioMin,
      outfitCategories,
      keywordCodes,
      feedbackLikeCodes,
      feedbackDislikeCodes,
    };
  }

  /**
   * [V3 Batch9 → FilterUnification] 이미지 검색 필터 정규화.
   *
   * outfitCategories: 결과 게시글의 outfit category 필터.
   *   - body.outfitCategories (신규 명시 필드) 와
   *     body.garmentCategory (하위 호환: 기존 프론트가 단일 카테고리로 보내던 필드) 를
   *     모두 합쳐서 GarmentCategory 기준으로 정규화.
   *   - 텍스트 검색의 outfitCategories 와 동일한 의미.
   *   - 한국어 UI 값 / AiGarmentCategory / GarmentCategory enum 모두 수용.
   *
   * 주의: garmentCategory 는 더 이상 query 이미지 garment vector 선택 조건이 아님.
   *       query vector 선택은 resolveSearchMode / executeVectorSearch 가 독립적으로 처리.
   */
  private async resolveImageSearchFilters(
    body: ImageSearchRequest & { outfitCategories?: string[] },
  ): Promise<ResolvedImageFilters> {
    const periodFrom = this.parseOptionalDate(body.periodFrom, 'periodFrom');
    const periodTo = this.parseOptionalDate(body.periodTo, 'periodTo');

    if (periodFrom && periodTo && periodFrom > periodTo) {
      throw new BadRequestException('periodFrom은 periodTo보다 늦을 수 없습니다.');
    }

    const likeRatioMin = this.parseOptionalRatio(body.likeRatioMin, 'likeRatioMin');

    // outfitCategories: 신규 필드 + 하위 호환 garmentCategory 병합 → GarmentCategory 정규화
    const rawCategories: string[] = [
      ...(body.outfitCategories ?? []),
      ...(body.garmentCategory ? [body.garmentCategory] : []),
    ];
    const outfitCategories = [
      ...new Set(
        rawCategories
          .map(normalizeToGarmentCategory)
          .filter((c): c is string => c !== null),
      ),
    ];

    const [keywordCodes, feedbackLikeCodes, feedbackDislikeCodes] = await Promise.all([
      this.resolveKeywordCodes(body.keywordIds),
      this.resolveFeedbackCodes(body.feedbackLikeTagIds, 'LIKE'),
      this.resolveFeedbackCodes(body.feedbackDislikeTagIds, 'DISLIKE'),
    ]);

    return {
      periodFrom,
      periodTo,
      likeRatioMin,
      outfitCategories,
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
