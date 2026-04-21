// V3 Batch11 — 관리자 제재 목록 조회 (GET /admin/sanctions)

export type SanctionType = 'TEMP_SUSPENSION' | 'PERMANENT_BAN' | 'POST_RESTRICTION';

export interface SanctionListItem {
  sanctionId: number;
  sanctionedUserId: number;
  sanctionedUserNickname: string;
  processedById: number;
  processedByNickname: string;
  type: SanctionType;
  reason: string;
  startsAt: string;
  /** null = 영구 제재 또는 종료 시각 미설정 */
  endsAt: string | null;
  createdAt: string;
}

export interface ListSanctionsResponse {
  items: SanctionListItem[];
  nextCursor: number | null;
  total: number;
}
