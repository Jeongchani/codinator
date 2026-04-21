import type { SocialProvider } from '../common/enums';

// ── POST /auth/social/login ───────────────────────────────────────────────────

export interface SocialLoginRequest {
  provider: SocialProvider;
  /**
   * Provider별 해석:
   * - GOOGLE : Google ID token (OpenID Connect)
   * - KAKAO  : Kakao OAuth access token
   * - NAVER  : Naver OAuth access token
   */
  providerToken: string;
}

export interface SocialLoginResponse {
  /**
   * 임시 소셜 로그인 상태 토큰 (5분 유효).
   * isNewUser 여부를 클라이언트에 전달하기 위한 마커.
   * complete-profile 에는 원본 providerToken 을 그대로 사용.
   */
  socialLoginToken: string;
  isNewUser: boolean;
}

// ── POST /auth/social/complete-profile ───────────────────────────────────────

export interface SocialCompleteProfileRequest {
  provider: SocialProvider;
  /**
   * social/login 에 전달한 원본 Provider token.
   * 서버가 다시 Provider API 로 검증하여 providerUserId 를 확인한다.
   */
  providerToken: string;
  /** 신규 회원 전용 (isNewUser=true 일 때만 필수) */
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
