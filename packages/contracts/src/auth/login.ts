export interface LoginRequest {
  email: string;
  password: string;
  /**
   * 로그인 상태 유지 여부.
   * true  → refresh token 발급 + user_sessions 저장 (7일 유지)
   * false | 미입력 → access token만 발급, 세션 저장 없음
   */ // RememberMe
  rememberMe?: boolean;
}

export interface LoginResponse {
  accessToken: string;
  /**
   * rememberMe=true 일 때만 포함.
   * rememberMe=false 또는 미입력이면 undefined.
   */ // RememberMe
  refreshToken?: string;
  user: {
    id: number;
    email: string;
    nickname: string;
  };
}
