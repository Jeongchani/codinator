import type { Id } from '../common/id';
import type { FeedbackTagSummary, KeywordSummary, OutfitItem, PostAuthorSummary } from '../posts/models';

/**
 * [V3 Batch7] 개인화 추천 목록 아이템
 *
 * 추천 신호 우선순위: // V3 Batch7-Fix
 *   1. 최근 북마크 게시글의 keyword codes  (가장 높은 가중치, +3)
 *   2. 최근 LIKE 투표 게시글의 keyword codes (중간 가중치, +2)
 *   3. 최근 TEXT 검색 기록(queryText) → keyword label 포함 매칭 (낮은 가중치, +1)
 *   4. 신호 없으면 → 인기 게시글(likeRatio 기준) fallback
 *
 * 추천 풀: evaluation.status = ENDED + status = ACTIVE + publishedAt IS NOT NULL
 *          + hiddenAt IS NULL + deletedAt IS NULL + postSearchIndex.isSearchable = true
 *
 * ※ IMAGE search histories는 벡터 기반 처리가 필요하므로 Batch 9 이후 확장 예정
 *
 * 상세 필드(author/content/keywords/outfitItems/feedbackSummary)는
 * 개인화 상세 바텀시트에서 별도 API 호출 없이 바로 사용한다.
 */
export interface PersonalizedRankingItem {
  postId: Id;
  thumbnailUrl: string | null;
  // ── 투표 집계 ──
  likeCount: number;
  dislikeCount: number;
  totalCount: number;
  likeRate: number;
  // ── 상세 바텀시트용 필드 ──
  author: PostAuthorSummary;
  content: string;
  keywords: KeywordSummary[];
  outfitItems: OutfitItem[];
  feedbackSummary: FeedbackTagSummary[];
}

export interface GetPersonalizedRankingsResponse {
  items: PersonalizedRankingItem[];
  /** 다음 페이지 cursor (마지막 postId). 다음 페이지 없으면 null. */
  nextCursor: number | null;
  hasMore: boolean;
}
