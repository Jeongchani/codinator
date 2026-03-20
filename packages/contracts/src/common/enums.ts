export type PostStatus = 'ACTIVE' | 'DELETED';

export type EvaluationStatus = 'OPEN' | 'ENDED';

export type VoteChoice = 'LIKE' | 'DISLIKE';

export type RankingPeriod = 'WEEKLY' | 'MONTHLY';

export type FeedbackTagPolarity = 'POSITIVE' | 'NEGATIVE';

export type GarmentCategory =
  | 'TOP'
  | 'BOTTOM'
  | 'OUTER'
  | 'SHOES'
  | 'BAG'
  | 'ACCESSORY'
  | 'ETC';

export type FeedbackTagCode =
  | 'POS_FIT_GOOD'
  | 'POS_POINT_GOOD'
  | 'NEG_SIZE_BAD'
  | 'NEG_COLOR_BAD'
  | 'NEG_MATCHING_BAD';
