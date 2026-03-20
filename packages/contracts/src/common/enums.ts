// 게시글 상태
export enum PostStatus {
  ACTIVE = 'ACTIVE',
  DELETED = 'DELETED',
}

// 평가 상태
export enum EvaluationStatus {
  ACTIVE = 'ACTIVE',
  INACTIVE = 'INACTIVE',
  COMPLETED = 'COMPLETED',
  OPEN = 'OPEN',
  CLOSED = 'CLOSED',
  ENDED = 'ENDED',
}

// 투표 선택
export enum VoteChoice {
  LIKE = 'LIKE',
  DISLIKE = 'DISLIKE',
}

// 랭킹 기간
export enum RankingPeriod {
  WEEKLY = 'WEEKLY',
  MONTHLY = 'MONTHLY',
}

// 피드백 태그 극성
export enum FeedbackTagPolarity {
  POSITIVE = 'POSITIVE',
  NEGATIVE = 'NEGATIVE',
}

// 의류 카테고리
export enum GarmentCategory {
  TOP = 'TOP',
  BOTTOM = 'BOTTOM',
  OUTER = 'OUTER',
  SHOES = 'SHOES',
  BAG = 'BAG',
  ACCESSORY = 'ACCESSORY',
  ETC = 'ETC',
}

// 피드백 태그 코드
export enum FeedbackTagCode {
  POS_FIT_GOOD = 'POS_FIT_GOOD',
  POS_POINT_GOOD = 'POS_POINT_GOOD',
  NEG_SIZE_BAD = 'NEG_SIZE_BAD',
  NEG_COLOR_BAD = 'NEG_COLOR_BAD',
  NEG_MATCHING_BAD = 'NEG_MATCHING_BAD',
}
