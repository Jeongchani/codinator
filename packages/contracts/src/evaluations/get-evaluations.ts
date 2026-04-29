import type { Id } from '../common/id';

export interface GetEvaluationsRequest {
  cursor?: number;
  limit?: number;
}

export interface EvaluationListItem {
  evaluationId: Id;
  postId: Id;
  thumbnailUrl: string;
  endsAt: string;
  hasVoted: boolean;
}

export interface GetEvaluationsResponse {
  items: EvaluationListItem[];
  nextCursor?: number | null;
}