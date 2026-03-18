import type { Id } from '../common/id';

export interface LoginResponse {
  userId: Id;
  email: string;
  accessToken: string;
}