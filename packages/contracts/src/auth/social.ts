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

/**
 * 소셜 로그인 판정 결과.
 *
 * | isNewUser | canProceed | reason              | 프론트 대응                                                    |
 * |-----------|------------|---------------------|---------------------------------------------------------------|
 * | false     | true       | -                   | 기존 회원 → complete-profile 바로 호출                         |
 * | true      | true       | -                   | 신규 회원 → 프로필 입력 후 complete-profile 호출               |
 * | false     | false      | ACCOUNT_DELETED     | 탈퇴 계정 → 진행 불가, 오류 메시지 표시                        |
 * | false     | false      | ACCOUNT_SUSPENDED   | 정지 계정 → 진행 불가, 오류 메시지 표시                        |
 * | false     | false      | EMAIL_LINK_BLOCKED  | 동일 이메일 계정 존재 + 소셜 인증 불가 → 이메일 로그인 후 연동 |
 */
export interface SocialLoginResponse {
  isNewUser: boolean;
  /**
   * true: complete-profile 단계로 진행 가능.
   * false: 진행 불가 — reason 을 확인하여 적절한 안내 표시.
   */
  canProceed: boolean;
  /**
   * canProceed=false 일 때만 설정.
   * - ACCOUNT_DELETED    : 연결된(또는 동일 이메일) 계정이 탈퇴 처리됨.
   * - ACCOUNT_SUSPENDED  : 연결된(또는 동일 이메일) 계정이 정지 상태.
   * - EMAIL_LINK_BLOCKED : 동일 이메일의 기존 계정이 존재하지만 provider 이메일 인증 미확인으로 자동 연동 불가.
   *                        이메일/비밀번호 로그인 후 소셜 계정 연동을 안내.
   */
  reason?: 'ACCOUNT_DELETED' | 'ACCOUNT_SUSPENDED' | 'EMAIL_LINK_BLOCKED';
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