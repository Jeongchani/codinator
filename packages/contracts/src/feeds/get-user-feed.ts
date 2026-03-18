import type { Id } from '../common/id';
export interface GetMyFeedResponse {
  userId: Id;
  items: Array<{
    postId: Id;
    thumbnailUrl: string;
    createdAt: string;
    evaluationStatus: 'OPEN' | 'CLOSED' | 'ENDED';
    rankingPeriod?: 'WEEKLY' | 'MONTHLY' | null;
  }>;
}