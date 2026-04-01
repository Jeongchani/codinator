import type { Id } from '../common/id';

export interface GetEvaluationsRequest {
  cursor?: number;
  limit?: number;
}

export interface EvaluationKeywordItem {
  id: Id;
  code: string;
  label: string;
}

export interface EvaluationListItem {
  evaluationId: Id;
  postId: Id;
  thumbnailUrl: string | null;
  /** 게시글 본문 — 평가존 카드 텍스트 표시용 */
  content: string;
  /** 게시글 키워드 태그 목록 */
  keywords: EvaluationKeywordItem[];
  endsAt: string;
  hasVoted: boolean;
}

export interface GetEvaluationsResponse {
  items: EvaluationListItem[];
  nextCursor?: number | null;
}
