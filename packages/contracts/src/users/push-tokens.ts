import type { PushDevice } from '../common/enums';

// ── POST /users/me/push-tokens ──────────────────────────────────────────────

export interface RegisterPushTokenRequest {
  pushToken: string;
  deviceOs: PushDevice;
}

export interface RegisterPushTokenResponse {
  id: number;
  pushToken: string;
  deviceOs: PushDevice;
  isActive: boolean;
  createdAt: string;
}

// ── GET /users/me/push-tokens ───────────────────────────────────────────────

export interface PushTokenItem {
  id: number;
  pushToken: string;
  deviceOs: PushDevice;
  isActive: boolean;
  createdAt: string;
}

export interface GetPushTokensResponse {
  items: PushTokenItem[];
}

// ── DELETE /users/me/push-tokens/:tokenId ───────────────────────────────────

export interface DeletePushTokenResponse {
  success: boolean;
  message: string;
}
