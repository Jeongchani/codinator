export type UserRole = 'USER' | 'SUPER_ADMIN' | 'OPERATOR_ADMIN';

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

export type AiGarmentCategory =
  | 'TOP'
  | 'BOTTOM'
  | 'OUTER'
  | 'SHOES'
  | 'BAG'
  | 'ACCESSORY'
  | 'DRESS'
  | 'ETC';

export type ReportReason = 'SPAM' | 'ABUSE' | 'INAPPROPRIATE' | 'ETC';

export type ReportStatus = 'PENDING' | 'RESOLVED' | 'REJECTED';

export type BlurMethod = 'NONE' | 'AUTO' | 'MANUAL';

export type AiBlurStatus = 'NONE' | 'PENDING' | 'PROCESSING' | 'DONE' | 'FAILED';

export type ImageSearchMode = 'FULL_OUTFIT' | 'SINGLE_ITEM';

export type FeedbackTagCode = string;

// ── V3 추가 enums ────────────────────────────────────────────────────────────

export type SocialProvider = 'GOOGLE' | 'KAKAO' | 'NAVER';

export type PhoneVerificationPurpose = 'SIGN_UP' | 'PHONE_CHANGE' | 'PASSWORD_RESET';

export type PhoneVerificationStatus = 'PENDING' | 'VERIFIED' | 'USED' | 'EXPIRED' | 'FAILED';

export type ThemeMode = 'LIGHT' | 'DARK';

export type PushDevice = 'IOS' | 'ANDROID' | 'WEB';

export type SanctionType = 'TEMP_SUSPENSION' | 'PERMANENT_BAN' | 'POST_RESTRICTION';