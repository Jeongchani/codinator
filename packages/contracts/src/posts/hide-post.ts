/**
 * PATCH /posts/:postId/hide
 *
 * 숨김 가능 조건:
 *   - post.status === ACTIVE
 *   - evaluation.status === ENDED  (평가 완료된 게시글만 가능)
 *   - rankingDetails 에 READY 상태 랭킹 등재 1건 이상 존재
 *
 * 처리 결과:
 *   - post.status → HIDDEN
 *   - hiddenAt 기록
 *   - evaluation.status → 변경하지 않음 (ENDED 유지)
 */
export interface HidePostResponse {
  postId: number;
  hidden: true;
}

/**
 * PATCH /posts/:postId/unhide
 *
 * 숨김 취소 가능 조건:
 *   - post.status === HIDDEN
 *
 * 처리 결과:
 *   - post.status → ACTIVE
 *   - hiddenAt → null
 *   - evaluation.status → 변경하지 않음 (ENDED 유지)
 */
export interface UnhidePostResponse {
  postId: number;
  hidden: false;
}
