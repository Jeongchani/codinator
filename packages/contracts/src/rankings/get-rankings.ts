import type { RankingPeriod } from '../common/enums';

export interface GetRankingsRequest {
  period: RankingPeriod;
  cursor?: number;
  limit?: number;
}
