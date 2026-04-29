// V3 Batch11 — 신고 처리 이력 조회 (GET /admin/report-histories)

export type ReportTargetType = 'POST_REPORT' | 'USER_REPORT';
export type ReportHistoryActionType = 'CREATED' | 'RESOLVED' | 'REJECTED' | 'REOPENED';

export interface ReportHistoryItem {
  historyId: number;
  targetType: ReportTargetType;
  targetId: number;
  actorId: number | null;
  actorNickname: string | null;
  actionType: ReportHistoryActionType;
  note: string | null;
  createdAt: string;
}

export interface ListReportHistoriesResponse {
  items: ReportHistoryItem[];
  nextCursor: number | null;
  total: number;
}
