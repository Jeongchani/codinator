// V3 Batch11 — 관리자 회원 상태 변경 (PATCH /admin/users/:userId/status)

export interface ChangeUserStatusRequest {
  status: 'ACTIVE' | 'SUSPENDED' | 'DELETED';
  /** 변경 사유 (admin_action_logs reason 필드에 저장됨) */
  reason?: string;
}

export interface ChangeUserStatusResponse {
  userId: number;
  status: 'ACTIVE' | 'SUSPENDED' | 'DELETED';
  updatedAt: string;
}
