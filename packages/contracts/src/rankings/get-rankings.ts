import type { RankingPeriod } from '../common/enums';
import type { PostCard } from '../posts/models';

export interface GetRankingsRequest {
  period: RankingPeriod;
  cursor?: number;
  limit?: number;
}

export interface GetRankingsResponse {
  period: RankingPeriod;
  items: Array<
    PostCard & {
      rank: number;
      likeRate: number;
    }
  >;
  nextCursor?: number | null;
}