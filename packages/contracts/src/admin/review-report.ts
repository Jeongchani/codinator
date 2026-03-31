// POST-REPORT 신고 처리 (PATCH /admin/reports/:id)
// USER-REPORT 신고 처리 (PATCH /admin/user-reports/:id)

export type ReviewAction = 'RESOLVED' | 'REJECTED';

export interface ReviewReportRequest {
  action: ReviewAction;
}

export interface ReviewReportResponse {
  reportId: number;
  status: ReviewAction;
  reviewedAt: string; // ISO 8601
}
