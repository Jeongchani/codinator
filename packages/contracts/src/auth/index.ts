export * from './login';
export * from './signup';
export * from './logout';
export * from './refresh';

// ── Phone Verification (V3) ────────────────────────────────────────────────
// phone.ts 파일 생성 불가(마운트 제약)로 인라인 선언
import type { PhoneVerificationPurpose } from '../common/enums';

export interface SendPhoneVerificationRequest {
  phoneNumber: string;
  purpose: PhoneVerificationPurpose;
}

export interface SendPhoneVerificationResponse {
  message: string;
  expiresAt: string; // ISO-8601
  /** 비운영 환경에서만 포함 */
  debugCode?: string;
}

export interface VerifyPhoneCodeRequest {
  phoneNumber: string;
  purpose: PhoneVerificationPurpose;
  code: string;
}

export interface VerifyPhoneCodeResponse {
  /** /auth/signup 등에서 사용할 전화번호 인증 토큰 (10분 유효) */
  phoneVerificationToken: string;
  expiresAt: string; // ISO-8601
}