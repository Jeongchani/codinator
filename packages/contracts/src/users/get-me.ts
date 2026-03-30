import type { Gender, UserRole, UserStatus } from '../common/enums';

export interface GetMeResponse {
  userId: number;
  email: string;
  nickname: string;
  gender: Gender;
  birthDate: string; // YYYY-MM-DD
  phoneNumber: string;
  role: UserRole;
  status: UserStatus;
  createdAt: string; // ISO 8601
}
