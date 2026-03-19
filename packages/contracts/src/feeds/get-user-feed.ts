import type { Id } from '../common/id';
import type { EvaluationStatus, RankingPeriod } from '../common/enums';

export interface GetMyFeedResponse {
  userId: Id;
  items: Array<{
    postId: Id;
    thumbnailUrl: string;
    createdAt: string;
    evaluationStatus: EvaluationStatus;
    rankingPeriod?: RankingPeriod | null;
  }>;
}