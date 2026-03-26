import type { Id } from '../common/id';
import type { RankingPeriod } from '../common/enums';

export interface GetRankingsRequest {
  period: RankingPeriod;
}

export interface RankingItem {
  rank: number;
  postId: Id;
  thumbnailUrl: string;
  likeCount: number;
  dislikeCount: number;
  totalCount: number;
  likeRate: number;
}

export interface GetRankingsResponse {
  period: RankingPeriod;
  items: RankingItem[];
}