import type { FeedListItem, FeedPostDetail, PostAuthorSummary } from '../posts/models';
import type { EvaluationStatus, PostStatus, RankingPeriod } from '../common/enums';

// ─── 타 사용자 피드 (기존 유지) ───────────────────────────────────────────────

export interface GetUserFeedResponse {
  user: PostAuthorSummary;
  items: FeedListItem[];
}

export type GetFeedPostDetailResponse = FeedPostDetail;

// ─── 내 피드 (V2 신규 타입) ────────────────────────────────────────────────────

export interface MyFeedEvaluationInfo {
  evaluationId: number;
  status: EvaluationStatus;
  endsAt: string;
}

export interface MyFeedVoteSummary {
  likeCount: number;
  dislikeCount: number;
}

export interface MyFeedRankInfo {
  rank: number;
  period: RankingPeriod;
}

/** GET /users/me/feed 응답의 목록 아이템 */
export interface MyFeedListItem {
  postId: number;
  thumbnailUrl: string | null;
  content: string | null;
  postStatus: PostStatus;
  /** 모든 게시글은 평가와 함께 생성되므로 항상 존재. 데이터 이상 시 null 가능 */
  evaluation: MyFeedEvaluationInfo | null;
  voteSummary: MyFeedVoteSummary;
  isRankingPublished: boolean;
  rankInfo: MyFeedRankInfo | null;
  createdAt: string;
}

/** GET /users/me/feed 응답 */
export interface GetMyFeedResponse {
  items: MyFeedListItem[];
  nextCursor: number | null;
  hasMore: boolean;
}
