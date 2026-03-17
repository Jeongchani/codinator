import type { VoteChoice } from '../common/enums';
import type { VoteSummary } from '../posts/models';

export interface CreateVoteRequest {
  choice: VoteChoice;
}

export interface CreateVoteResponse {
  postId: number;
  myVote: VoteChoice;
  summary: VoteSummary;
}