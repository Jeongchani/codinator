import type { Id } from '../common/id';
import type { FeedbackTagCode, VoteChoice } from '../common/enums';

export interface FeedbackTag {
  id: Id;
  code: FeedbackTagCode;
  label: string;
  groupCode?: string | null;
  voteChoice: VoteChoice;
  isActive: boolean;
  sortOrder: number;
}

export interface GetTagsResponse {
  items: FeedbackTag[];
}
