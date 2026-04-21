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
