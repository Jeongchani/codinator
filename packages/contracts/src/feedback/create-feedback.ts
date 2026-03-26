import type { Id } from '../common/id';
import type { VoteChoice } from '../common/enums';

export interface CreateFeedbackRequest {
  tagIds?: Id[];
}

export interface CreateFeedbackResponse {
  postId: Id;
  myVoteId: Id;
  myVoteChoice: VoteChoice;
  selectedTagIds: Id[];
  feedbackSubmitted: boolean;
}
