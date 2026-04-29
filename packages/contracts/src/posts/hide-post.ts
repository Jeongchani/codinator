/**
 * PATCH /posts/:postId/hide
 *
 * 숨김 가능 조건 (V3):
 *   - post.status === ACTIVE
 *   - evaluation.status === ENDED (평가 완료된 게시글만 가능)
 *   ※ rankingDetails 의존 없음 — 평가 완료 즉시 숨김 가능
 *
 * 처리 결과:
 *   - post.status → HIDDEN
 *   - hiddenAt, hiddenById, hiddenReason 기록
 *   - evaluation.status → 변경하지 않음 (ENDED 유지)
 *   - 타인 피드 / 공개 상세 / 검색 / 랭킹존에서 제외
 *   - 본인 피드에서는 계속 조회 가능
 */
export interface HidePostResponse {
  postId: number;
  status: 'HIDDEN';
  hiddenAt: string; // ISO 8601
}

/**
 * PATCH /posts/:postId/unhide
 *
 * 숨김 취소 가능 조건 (V3):
 *   - post.status === HIDDEN
 *   - 작성자 직접 숨긴 게시글만 (hiddenById === null || hiddenById === authorId)
 *   - 관리자에 의해 숨겨진 게시글은 이 API로 복구 불가
 *
 * 처리 결과:
 *   - post.status → ACTIVE
 *   - hiddenAt, hiddenById, hiddenReason → null
 *   - 공개 조건 만족 시 타인 피드 / 상세 / 검색에 다시 노출
 */
export interface UnhidePostResponse {
  postId: number;
  status: 'ACTIVE';
  updatedAt: string; // ISO 8601
}
