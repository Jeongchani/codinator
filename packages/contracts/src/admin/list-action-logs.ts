// V3 Batch11 — 관리자 처리 로그 조회 (GET /admin/action-logs)

export type AdminActionTargetType = 'POST' | 'POST_REPORT' | 'USER_REPORT' | 'USER' | 'USER_SANCTION';
export type AdminActionType =
  | 'CREATED'
  | 'RESOLVED'
  | 'REJECTED'
  | 'REOPENED'
  | 'HIDDEN'
  | 'UNHIDDEN'
  | 'DELETED'
  | 'RESTORED'
  | 'SANCTION_UPDATED'
  | 'SANCTION_ENDED'
  | 'USER_STATUS_UPDATED';

export interface AdminActionLogItem {
  logId: number;
  adminId: number;
  adminNickname: string;
  targetType: AdminActionTargetType;
  targetId: number;
  actionType: AdminActionType;
  reason: string | null;
  metadataJson: Record<string, unknown> | null;
  createdAt: string;
}

export interface ListActionLogsResponse {
  items: AdminActionLogItem[];
  nextCursor: number | null;
  total: number;
}
