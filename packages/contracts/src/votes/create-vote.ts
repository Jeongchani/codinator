import type { Id } from '../common/id';
import type { VoteChoice } from '../common/enums';
import type { VoteSummary } from '../posts/models';

export interface CreateVoteRequest {
  choice: VoteChoice;
}

export interface CreateVoteResponse {
  postId: Id;
  voteId: Id;
  myVoteChoice: VoteChoice;
  myFeedbackTagIds: Id[];
  summary: VoteSummary;
}
