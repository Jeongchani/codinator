//로그인 요청 타입 (프론트가 벡엔드로 보내는 값)
export interface LoginRequest {
  email: string;
  password: string;
}

//로그인 응답 타입 (벡엔드가 프론트로 보내는 값)
import type { PublicUser } from '../user/user';

export interface LoginResponse {
  accessToken: string;
  user: PublicUser;
}