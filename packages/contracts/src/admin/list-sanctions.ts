// V3 Batch11 — 관리자 제재 목록 조회 (GET /admin/sanctions)

import type { SanctionType } from '../common/enums'; // Batch11-Fix: common에서 가져옴 (중복 제거)
export type { SanctionType }; // re-export so existing imports from './list-sanctions' still work

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
