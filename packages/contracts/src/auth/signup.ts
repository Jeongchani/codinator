import type { Id } from '../common/id';

export interface SignupRequest {
  email: string;
  nickname: string;
  password: string;
}

export interface SignupResponse {
  userId: Id;
  email: string;
  nickname: string;
}
