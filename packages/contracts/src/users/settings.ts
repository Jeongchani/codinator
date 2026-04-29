import type { ThemeMode } from '../common/enums';

// ── GET /users/me/settings ──────────────────────────────────────────────────

export interface GetSettingsResponse {
  theme: ThemeMode;
  pushEnabled: boolean;
  servicePushEnabled: boolean;
  marketingPushEnabled: boolean;
}

// ── PATCH /users/me/settings ────────────────────────────────────────────────

export interface UpdateSettingsRequest {
  theme?: ThemeMode;
  pushEnabled?: boolean;
  servicePushEnabled?: boolean;
  marketingPushEnabled?: boolean;
}

export interface UpdateSettingsResponse {
  theme: ThemeMode;
  pushEnabled: boolean;
  servicePushEnabled: boolean;
  marketingPushEnabled: boolean;
}
