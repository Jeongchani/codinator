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