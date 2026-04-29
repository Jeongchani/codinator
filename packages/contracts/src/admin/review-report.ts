// POST-REPORT 신고 처리 (PATCH /admin/reports/:id)
// USER-REPORT 신고 처리 (PATCH /admin/user-reports/:id)

export type ReviewAction = 'RESOLVED' | 'REJECTED';

export interface ReviewReportRequest {
  action: ReviewAction;
  /** 처리 사유 (optional). DB의 review_reason 필드에 저장됨 */ // V3 Batch11
  reason?: string;
}

export interface ReviewReportResponse {
  reportId: number;
  status: ReviewAction;
  reviewedAt: string; // ISO 8601
}
