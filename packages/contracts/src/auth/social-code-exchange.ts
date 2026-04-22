// SocialCodeExchange: Kakao / Naver 인가코드 교환 전용 contract

// ── POST /auth/social/kakao/exchange-code ─────────────────────────────────────

export interface ExchangeKakaoCodeRequest {
  /** Kakao 인가코드 (프론트에서 redirect_uri 로 받은 code 파라미터) */
  code: string;
  /** Kakao 앱 설정의 redirect_uri 와 정확히 일치해야 함 */
  redirectUri: string;
  /**
   * 로그인 상태 유지 여부.
   * complete-profile 단계에서 그대로 전달할 값이며, 교환 단계에서는 세션을 생성하지 않음.
   */
  rememberMe?: boolean;
}

// ── POST /auth/social/naver/exchange-code ─────────────────────────────────────

export interface ExchangeNaverCodeRequest {
  /** Naver 인가코드 */
  code: string;
  /** CSRF 방지용 state 값 (Naver 필수) */
  state: string;
  /** Naver 앱 설정의 redirect_uri */
  redirectUri: string;
  /** 로그인 상태 유지 여부 */
  rememberMe?: boolean;
}

// ── 공통 응답 ─────────────────────────────────────────────────────────────────

export interface SocialCodeExchangeResponse {
  /**
   * code 교환으로 얻은 provider access token.
   * 이후 POST /auth/social/complete-profile 의 providerToken 필드로 그대로 사용.
   */
  providerToken: string;
  /** false = 기존 회원 → complete-profile 바로 호출 가능. true = 신규 회원 → 프로필 입력 필요 */
  isNewUser: boolean;
}
