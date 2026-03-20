import type { Id } from '../common/id';
import type { RankingPeriod } from '../common/enums';
import type { PostDetail } from '../posts/models';

export interface RankingInfo {
  snapshotId: Id;
  period: RankingPeriod;
  rank: number;
  startDate: string;
  endDate: string;
}

export interface RankingPostDetail extends PostDetail {
  ranking: RankingInfo;
}

export type GetRankingPostDetailResponse = RankingPostDetail;
