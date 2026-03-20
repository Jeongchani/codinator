// contracts의 타입을 “실제 enum”으로 변환한 완성본
export enum PostStatus {
  ACTIVE = "ACTIVE",
  DELETED = "DELETED",
}

export enum EvaluationStatus {
  OPEN = "OPEN",
  CLOSED = "CLOSED",
  ENDED = "ENDED",
}

export enum VoteChoice {
  LIKE = "LIKE",
  DISLIKE = "DISLIKE",
}

export enum RankingPeriod {
  WEEKLY = "WEEKLY",
  MONTHLY = "MONTHLY",
}

export enum FeedbackTagPolarity {
  POSITIVE = "POSITIVE",
  NEGATIVE = "NEGATIVE",
}

export enum GarmentCategory {
  TOP = "TOP",
  BOTTOM = "BOTTOM",
  OUTER = "OUTER",
  SHOES = "SHOES",
  BAG = "BAG",
  ACCESSORY = "ACCESSORY",
  ETC = "ETC",
}

export enum FeedbackTagCode {
  POS_FIT_GOOD = "POS_FIT_GOOD",
  POS_POINT_GOOD = "POS_POINT_GOOD",
  NEG_SIZE_BAD = "NEG_SIZE_BAD",
  NEG_COLOR_BAD = "NEG_COLOR_BAD",
  NEG_MATCHING_BAD = "NEG_MATCHING_BAD",
}