// V3 Batch11 — 관리자 제재 조기 종료 (PATCH /admin/sanctions/:sanctionId/end)

export interface EndSanctionRequest {
  /** 종료 사유 (admin_action_logs reason 필드에 저장됨) */
  reason?: string;
}

export interface EndSanctionResponse {
  sanctionId: number;
  endsAt: string; // 종료 처리된 시각 (ISO 8601)
}
