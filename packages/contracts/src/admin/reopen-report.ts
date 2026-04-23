// 신고 재오픈
// PATCH /admin/post-reports/:reportId/reopen
// PATCH /admin/user-reports/:reportId/reopen

export interface ReopenReportRequest {
  /** 재오픈 사유 (optional). report_histories / admin_action_logs reason 필드에 저장됨 */
  reason?: string;
}

export interface ReopenReportResponse {
  reportId: number;
  /** 재오픈 후 상태: 항상 PENDING */
  status: 'PENDING';
  reopenedAt: string; // ISO 8601
}
