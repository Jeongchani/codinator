import type { SocialProvider } from '../common/enums';

// ── POST /auth/social/login ───────────────────────────────────────────────────

export interface SocialLoginRequest {
  provider: SocialProvider;
  /** Provider OAuth access token */
  accessToken: string;
}

export interface SocialLoginResponse {
  /**
   * 임시 소셜 로그인 토큰 (5분 유효).
   * - isNewUser=false: 기존 회원 → complete-profile 없이 세션 발급 가능
   * - isNewUser=true : 신규 회원 → complete-profile 호출 필요
   */
  socialLoginToken: string;
  isNewUser: boolean;
}

// ── POST /auth/social/complete-profile ───────────────────────────────────────

export interface SocialCompleteProfileRequest {
  provider: SocialProvider;
  socialLoginToken: string;
  /** 신규 회원 전용 필드 (isNewUser=true 일 때만 필수) */
  nickname?: string;
  birthDate?: string; // YYYY-MM-DD
  gender?: 'MALE' | 'FEMALE';
  phoneNumber?: string;
  phoneVerificationToken?: string; // purpose=SIGN_UP
}

export interface SocialCompleteProfileResponse {
  accessToken: string;
  refreshToken: string;
  user: {
    id: number;
    email: string | null;
    nickname: string;
  };
  isNewUser: boolean;
}
