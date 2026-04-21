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
  /**
   * 로그인 상태 유지 여부.
   * true  → refresh token 발급 + user_sessions 저장 (7일 유지)
   * false | 미입력 → access token만 발급, 세션 저장 없음
   */ // RememberMe
  rememberMe?: boolean;
}

export interface SocialCompleteProfileResponse {
  accessToken: string;
  /**
   * rememberMe=true 일 때만 포함.
   * rememberMe=false 또는 미입력이면 undefined.
   */ // RememberMe
  refreshToken?: string;
  user: {
    id: number;
    email: string | null;
    nickname: string;
  };
  isNewUser: boolean;
}
