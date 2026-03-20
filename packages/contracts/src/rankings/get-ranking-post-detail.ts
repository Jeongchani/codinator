import type { Id } from '../common/id';
import type { RankingPeriod } from '../common/enums';
import type { EvaluationPostDetail } from '../posts/models';

export interface RankingInfo {
  snapshotId: Id;
  period: RankingPeriod;
  rank: number;
  startDate: string;
  endDate: string;
}

export interface RankingPostDetail extends EvaluationPostDetail {
  ranking: RankingInfo;
}

export type GetRankingPostDetailResponse = RankingPostDetail;
