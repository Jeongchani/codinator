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
   * 신규 소셜가입 전용 (isNewUser=true 일 때만 필수).
   * 일반 로그인 비밀번호 정책과 동일: 8자 이상, 영문·숫자·특수문자 각 1개 이상.
   * 기존 일반회원 연동(isNewUser=false) 시에는 무시되며 기존 passwordHash 를 덮어쓰지 않는다.
   */
  password?: string;
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
