export type UserRole = 'USER' | 'ADMIN';

export type UserStatus = 'ACTIVE' | 'SUSPENDED' | 'DELETED';

export type Gender = 'MALE' | 'FEMALE';

export type PostStatus = 'ACTIVE' | 'HIDDEN' | 'DELETED';

export type EvaluationStatus = 'OPEN' | 'CLOSED' | 'ENDED';

export type VoteChoice = 'LIKE' | 'DISLIKE';

export type RankingPeriod = 'WEEKLY' | 'MONTHLY';

export type RankingStatus = 'PENDING' | 'READY' | 'FAILED';

export type GarmentCategory =
  | 'TOP'
  | 'BOTTOM'
  | 'OUTER'
  | 'SHOES'
  | 'BAG'
  | 'ACCESSORY'
  | 'ETC';

export type ReportReason = 'SPAM' | 'ABUSE' | 'INAPPROPRIATE' | 'ETC';

export type ReportStatus = 'PENDING' | 'RESOLVED' | 'REJECTED';

export type BlurMethod = 'NONE' | 'AUTO' | 'MANUAL';

export type AiBlurStatus = 'NONE' | 'PENDING' | 'PROCESSING' | 'DONE' | 'FAILED';

export type FeedbackTagCode = string;
