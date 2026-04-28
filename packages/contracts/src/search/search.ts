import type {
  AiGarmentCategory,
  ImageSearchMode,
} from '../common/enums';

/**
 * GET /search
 *
 * 검색 대상:
 *   - 랭킹존에 공개된 게시글만 포함
 *   - 즉 Post.status = ACTIVE, deletedAt IS NULL, hiddenAt IS NULL,
 *     publishedAt IS NOT NULL, Evaluation.status = ENDED,
 *     PostSearchIndex.isSearchable = true 조건을 동시에 만족해야 함
 *
 * 검색 방식:
 *   - 텍스트 검색과 AI 이미지 검색은 분리
 *   - 기간 필터는 publishedAt 기준
 */

// TextSearchAdvanced: OUTFIT_ITEM / OUTFIT_BRAND 추가
export type SearchType = 'ALL' | 'NICKNAME' | 'KEYWORD' | 'POST' | 'OUTFIT_ITEM' | 'OUTFIT_BRAND';

export interface UserSearchItem {
  userId: number;
  nickname: string;
  /** 유저의 최근 공개 게시글 대표 썸네일. 없으면 null */
  thumbnailUrl: string | null;
}

export interface PostSearchKeyword {
  keywordId: number;
  label: string;
}

export interface PostSearchItem {
  postId: number;
  userId: number;
  thumbnailUrl: string | null;
  content: string;
  createdAt: string;
  keywords: PostSearchKeyword[];
}

export interface SearchRequest {
  q: string;
  type?: SearchType;
  cursor?: number;
  limit?: number;

  // TextSearchAdvanced: 고급 필터 (이미지 검색과 동일 구조)
  /** publishedAt >= periodFrom (ISO 8601) */
  periodFrom?: string;
  /** publishedAt <= periodTo (ISO 8601) */
  periodTo?: string;
  /** 0.0 ~ 1.0 최소 좋아요 비율 */
  likeRatioMin?: number;
  /** 착용 아이템 카테고리 필터 (post_search_index.outfitCategories 기준) */
  outfitCategories?: string[];
  /** 키워드 ID 필터 → 내부에서 keywordCode로 변환 후 keywordCodes 매칭 */
  keywordIds?: number[];
  /** 좋아요 피드백 태그 ID 필터 (voteChoice=LIKE) */
  feedbackLikeTagIds?: number[];
  /** 싫어요 피드백 태그 ID 필터 (voteChoice=DISLIKE) */
  feedbackDislikeTagIds?: number[];
}

export interface SearchResponse {
  type: SearchType;
  users: UserSearchItem[];
  posts: PostSearchItem[];
  nextCursor: number | null;
  hasMore: boolean;
}

export interface ImageSearchRequest {
  imageAssetId: number;
  /**
   * 검색 모드. 생략 시 AI 분석 결과(garment 수·면적·얼굴 감지 여부)로 자동 판별.
   * 프론트가 보내지 않아도 백엔드가 자동으로 결정한다.
   */
  mode?: ImageSearchMode;
  /**
   * [내부 전용 hint] SINGLE_ITEM 모드에서 우선 사용할 query 이미지 garment 카테고리.
   * **결과 게시글 필터 아님** — 결과 outfit category 필터는 outfitCategories 를 사용할 것.
   * 하위 호환을 위해 garmentCategory 를 보내면 outfitCategories 결과 필터로도 함께 적용됨.
   */
  garmentCategory?: AiGarmentCategory;
  /**
   * 결과 게시글의 outfit 카테고리 필터 (post_search_index.outfitCategories 기준).
   * 텍스트 검색의 outfitCategories 와 동일한 의미.
   * 한국어 UI 값(상의/하의/…) 또는 enum 문자열(TOP/BOTTOM/…) 모두 허용 — 내부 정규화.
   * garmentCategory 도 함께 오면 병합 처리.
   */
  outfitCategories?: string[];

  /** 커서 (offset 기반). 생략 시 첫 페이지 */
  cursor?: number;
  /** 페이지 크기 (기본 20, 최대 50) */
  limit?: number;

  /** publishedAt >= periodFrom (ISO 8601) */
  periodFrom?: string;
  /** publishedAt <= periodTo (ISO 8601) */
  periodTo?: string;

  /** 0.0 ~ 1.0 최소 좋아요 비율 */
  likeRatioMin?: number;

  /** 키워드 ID 필터 */
  keywordIds?: number[];
  /** 좋아요 피드백 태그 ID 필터 (voteChoice=LIKE) */
  feedbackLikeTagIds?: number[];
  /** 싫어요 피드백 태그 ID 필터 (voteChoice=DISLIKE) */
  feedbackDislikeTagIds?: number[];
}

export interface ImageSearchItem {
  postId: number;
  userId: number;
  thumbnailUrl: string | null;
  content: string;
  createdAt: string;
  similarity: number;
  keywords: PostSearchKeyword[];
}

export interface ImageSearchResponse {
  /** 최종 사용된 검색 모드. mode를 명시했으면 그 값, 생략했으면 AI 분석 결과로 자동 판별된 값 */ // Batch9-AutoMode
  resolvedMode: ImageSearchMode;
  queryImageAssetId: number;
  analysisRunId: number;
  items: ImageSearchItem[];
  /** 다음 페이지 커서 (offset). 다음 페이지가 없으면 null */
  nextCursor: number | null;
  /** 다음 페이지 존재 여부 */
  hasMore: boolean;
}
