import type { Id } from '../common/id';

export interface SignupRequest {
  email: string;
  password: string;
}

export interface SignupResponse {
  userId: Id;
  email: string;
}