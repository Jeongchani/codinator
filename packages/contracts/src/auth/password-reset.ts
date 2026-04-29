// ── PATCH /auth/password-reset ────────────────────────────────────────────────

export interface PasswordResetRequest {
  phoneNumber: string;
  /** purpose=PASSWORD_RESET 로 발급된 전화번호 인증 토큰 */
  phoneVerificationToken: string;
  newPassword: string;
}

export interface PasswordResetResponse {
  success: boolean;
  message: string;
}
