import type {
  AiGarmentCategory,
  FeedbackTagCode,
  GarmentCategory,
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

export type SearchType = 'ALL' | 'NICKNAME' | 'KEYWORD' | 'POST';

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
  mode?: ImageSearchMode;
  garmentCategory?: AiGarmentCategory;
  limit?: number;

  /** publishedAt >= publishedFrom */
  publishedFrom?: string;
  /** publishedAt <= publishedTo */
  publishedTo?: string;

  /** 0.0 ~ 1.0 */
  minLikeRatio?: number;
  /** 0.0 ~ 1.0 */
  maxLikeRatio?: number;

  outfitCategories?: GarmentCategory[];
  keywordCodes?: string[];
  feedbackTagCodes?: FeedbackTagCode[];
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
  mode: ImageSearchMode;
  queryImageAssetId: number;
  analysisRunId: number;
  items: ImageSearchItem[];
}
