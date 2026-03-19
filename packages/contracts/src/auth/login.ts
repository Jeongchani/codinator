import type { Id } from '../common/id';

export interface LoginRequest {
  email: string;
  password: string;
}

export interface LoginResponse {
  userId: Id;
  email: string;
  accessToken: string;
}