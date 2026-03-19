import type { Id } from '../common/id';
import type {
  FeedbackTagCode,
  FeedbackTagPolarity,
  VoteChoice,
} from '../common/enums';

export interface FeedbackTag {
  id: Id;
  code: FeedbackTagCode;
  label: string;
  polarity: FeedbackTagPolarity;
  voteChoice: VoteChoice;
  isActive: boolean;
}

export interface GetTagsResponse {
  items: FeedbackTag[];
}