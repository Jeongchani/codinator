import type { ReportReason, ReportStatus } from '../common/enums';

export interface CreateReportRequest {
  title: string;
  reason: ReportReason;
  description?: string;
}

export interface CreateReportResponse {
  reportId: number;
  status: ReportStatus; // 항상 'PENDING'
}
