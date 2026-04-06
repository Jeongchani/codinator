import type { EvaluationStatus, PostStatus } from '../common/enums';

export interface BookmarkRankInfo {
  rank: number;
  period: string; // 'WEEKLY' | 'MONTHLY'
}

export interface BookmarkListItem {
  bookmarkId: number;
  postId: number;

  /**
   * 북마크 카드에 표시할 대표 이미지 URL
   * 우선순위:
   * 1) processedImageUrl
   * 2) originalImageUrl
   * 없으면 null
   */
  thumbnailUrl: string | null;

  content: string | null;
  postStatus: PostStatus;

  /** 평가 상태 (OPEN / ENDED / CLOSED). evaluation이 없는 경우 null. */
  evaluationStatus: EvaluationStatus | null;

  /** 평가 종료 시각 (ISO 8601). evaluation이 없는 경우 null. */
  evaluationEndsAt: string | null;

  /** 랭킹 등재 여부 */
  isRankingPublished: boolean;

  /** 가장 높은 랭킹 정보. 랭킹 미등재 시 null. */
  rankInfo: BookmarkRankInfo | null;

  bookmarkedAt: string; // ISO 8601
}

export interface GetMyBookmarksResponse {
  items: BookmarkListItem[];
  nextCursor: number | null; // 다음 페이지 요청 시 cursor 값 (마지막 bookmarkId)
  hasMore: boolean;
}