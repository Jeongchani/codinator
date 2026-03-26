import type { Gender } from '../common/enums';
import type { Id } from '../common/id';

export interface SignupRequest {
  email: string;
  nickname: string;
  password: string;
  birthDate: string;
  gender: Gender;
  phoneNumber: string;
}

export interface SignupResponse {
  userId: Id;
  email: string;
  nickname: string;
  birthDate: string;
  gender: Gender;
  phoneNumber: string;
}
