import type { VoteChoice } from '../common/enums';

// Batch4: 피드백 태그 목록 조회 contract

export interface FeedbackTagItem {
  id: number;
  code: string;
  label: string;
  /** LIKE | DISLIKE */
  voteChoice: VoteChoice;
  /** 태그 그룹 코드 (선택적) */
  groupCode?: string | null;
  sortOrder: number;
}

export interface GetFeedbackTagsResponse {
  items: FeedbackTagItem[];
}
