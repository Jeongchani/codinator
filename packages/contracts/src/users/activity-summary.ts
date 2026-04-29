// V3 - Batch 3 필수 기능: 내 활동 요약

export interface GetMyActivitySummaryResponse {
  /** 내가 작성한 게시글 수 (DELETED 제외) */
  myPostCount: number;
  /** 내가 투표한 평가 수 (distinct evaluationId 기준) */
  votedPostCount: number;
  /** 내 게시글이 TOP 10에 오른 건수 (distinct postId 기준) */
  top10Count: number;
}
