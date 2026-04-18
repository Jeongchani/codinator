import type { Id } from '../common/id';
import type { EvaluationStatus, VoteChoice } from '../common/enums';

export interface EvaluationHistoryItem {
  evaluationId: Id;
  postId: Id;
  thumbnailUrl: string | null;
  endsAt: string; // ISO 8601
  evaluationStatus: EvaluationStatus;
  myVoteId: Id;
  myVoteChoice: VoteChoice;
  myFeedbackTagIds: Id[];
}

export interface GetEvaluationHistoryResponse {
  items: EvaluationHistoryItem[];
  /** 다음 페이지 요청 시 cursor 값 (마지막 voteId). 다음 페이지 없으면 null. */
  nextCursor: number | null;
  hasMore: boolean;
}
