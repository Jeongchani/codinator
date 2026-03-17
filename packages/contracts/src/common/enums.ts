// common/enums.ts
export type PostStatus = 'UNDER_REVIEW' | 'RANKED' | 'REMOVED';

export type PostZone = 'EVALUATION' | 'RANKING';

export type VoteChoice = 'LIKE' | 'DISLIKE';

export type RankingPeriod = 'DAILY' | 'WEEKLY' | 'MONTHLY';

export type ReportReason =
  | 'SPAM'
  | 'ABUSE'
  | 'INAPPROPRIATE'
  | 'OTHER';

export type GarmentCategory =
  | 'TOP'
  | 'BOTTOM'
  | 'OUTER'
  | 'SHOES'
  | 'BAG'
  | 'ACCESSORY'
  | 'ETC';

  export type FeedbackTagCode =
  | 'FIT'
  | 'COLOR'
  | 'MATCHING'
  | 'SEASON'
  | 'SILHOUETTE';