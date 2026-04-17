// ── PATCH /users/me/phone ─────────────────────────────────────────────────────

export interface ChangePhoneRequest {
  phoneNumber: string;
  /** purpose=PHONE_CHANGE 로 발급된 전화번호 인증 토큰 */
  phoneVerificationToken: string;
}

export interface ChangePhoneResponse {
  success: boolean;
  message: string;
  phoneNumber: string;
}
