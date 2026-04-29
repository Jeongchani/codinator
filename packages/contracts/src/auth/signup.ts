import type { Gender } from '../common/enums';
import type { Id } from '../common/id';

export interface SignupRequest {
  email: string;
  nickname: string;
  password: string;
  birthDate: string;
  gender: Gender;
  phoneNumber: string;
  /** POST /auth/phone/verify 응답으로 받은 전화번호 인증 토큰 (SIGN_UP 목적, 10분 유효) */
  phoneVerificationToken: string;
}

export interface SignupResponse {
  userId: Id;
  email: string;
  nickname: string;
  birthDate: string;
  gender: Gender;
  phoneNumber: string;
}
