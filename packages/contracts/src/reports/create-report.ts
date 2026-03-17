import type { ReportReason } from '../common/enums';

export interface CreateReportRequest {
  postId: number;
  reason: ReportReason;
  detail?: string | null;
}

export interface CreateReportResponse {
  reportId: number;
  success: true;
}