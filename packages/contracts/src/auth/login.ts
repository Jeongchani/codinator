import type { Id } from '../common/id';

export interface LoginRequest {
  email: string;
  password: string;
}

export interface LoginResponse {
  userId: Id;
  email: string;
  accessToken?: string; // JWT 도입 전까지는 없어도 됨
}