// V3 Batch11 — 관리자 제재 생성 (POST /admin/sanctions)

import type { SanctionType } from './list-sanctions';

export interface CreateSanctionRequest {
  sanctionedUserId: number;
  type: SanctionType;
  reason: string;
  /** 제재 시작 시각 (ISO 8601). 생략 시 즉시 시작 */
  startsAt?: string;
  /** 제재 종료 시각 (ISO 8601). PERMANENT_BAN 은 null */
  endsAt?: string | null;
}

export interface CreateSanctionResponse {
  sanctionId: number;
  sanctionedUserId: number;
  type: SanctionType;
  reason: string;
  startsAt: string;
  endsAt: string | null;
  createdAt: string;
}
