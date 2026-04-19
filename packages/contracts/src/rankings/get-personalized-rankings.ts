import type { Id } from '../common/id';

/**
 * [V3 Batch7] 개인화 추천 목록 아이템
 *
 * 추천 풀: evaluation.status = ENDED + status = ACTIVE + publishedAt IS NOT NULL
 *          + hiddenAt IS NULL + deletedAt IS NULL + postSearchIndex.isSearchable = true
 *
 * 추천 신호 우선순위:
 *   1. 최근 북마크 게시글의 keyword codes
 *   2. 최근 LIKE 투표 게시글의 keyword codes
 *   3. 신호 없으면 → 인기 게시글(likeRatio 기준) fallback
 */
export interface PersonalizedRankingItem {
  postId: Id;
  thumbnailUrl: string | null;
  likeCount: number;
  dislikeCount: number;
  totalCount: number;
  likeRate: number;
}

export interface GetPersonalizedRankingsResponse {
  items: PersonalizedRankingItem[];
  /** 다음 페이지 cursor (마지막 postId). 다음 페이지 없으면 null. */
  nextCursor: number | null;
  hasMore: boolean;
}
