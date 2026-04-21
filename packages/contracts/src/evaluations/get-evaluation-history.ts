import type { Id } from '../common/id';
import type { EvaluationStatus, VoteChoice } from '../common/enums';

/**
 * [V3] 진행중인 평가 기록 목록 아이템
 *
 * 핵심 6개 필드는 API 명세서 ZIP 기준.
 * Optional extension 필드는 클라이언트 편의용 — 향후 제거 가능.
 */
export interface EvaluationHistoryItem {
  // ── 핵심 공개 필드 (API 명세서 ZIP 기준) ─────────────────────────────────
  postId: Id;
  evaluationId: Id;
  thumbnailUrl: string | null; // imageAsset.thumbnailUrl → processedImageUrl → null
  contentPreview: string;      // post.content를 최대 60자로 자른 파생값
  myChoice: VoteChoice;        // votes.choice
  votedAt: string;             // votes.createdAt (ISO 8601)

  // ── Optional extension 필드 ───────────────────────────────────────────────
  endsAt?: string;              // evaluations.endsAt (ISO 8601)
  evaluationStatus?: EvaluationStatus; // evaluations.status
  myVoteId?: Id;                // votes.id
  myFeedbackTagIds?: Id[];      // feedbacks.tagId[]
}

export interface GetEvaluationHistoryResponse {
  items: EvaluationHistoryItem[];
  /** 다음 페이지 요청 시 cursor 값 (마지막 voteId). 다음 페이지 없으면 null. */
  nextCursor: number | null;
  hasMore: boolean;
}
