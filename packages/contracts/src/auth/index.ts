export * from './login';
export * from './signup';
export * from './logout';
export * from './refresh';
export * from './phone';
export * from './social';
export * from './social-code-exchange'; // SocialCodeExchange
export * from './password-reset';

export interface VerifyPhoneCodeResponse {
  /** /auth/signup 등에서 사용할 전화번호 인증 토큰 (10분 유효) */
  phoneVerificationToken: string;
  expiresAt: string; // ISO-8601
}