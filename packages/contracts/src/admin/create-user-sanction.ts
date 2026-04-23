// 사용자별 명세 호환 제재 생성
// POST /admin/users/:userId/sanctions/post-restriction
// POST /admin/users/:userId/sanctions/login-restriction
// (userId 는 path param 에서 추출 — body 에 불필요)

import type { CreateSanctionResponse } from './create-sanction';

export interface CreateUserSanctionRequest {
  reason: string;
  /** 제재 시작 시각 (ISO 8601). 생략 시 즉시 시작 */
  startsAt?: string;
  /** 제재 종료 시각 (ISO 8601). 생략 시 무기한(null) */
  endsAt?: string | null;
}

/** 응답은 기존 CreateSanctionResponse 와 동일 */
export type CreateUserSanctionResponse = CreateSanctionResponse;
