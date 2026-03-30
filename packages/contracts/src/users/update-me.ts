import type { Gender, UserRole, UserStatus } from '../common/enums';

export interface UpdateMeRequest {
  nickname?: string;
  phoneNumber?: string;
}

export interface UpdateMeResponse {
  userId: number;
  email: string;
  nickname: string;
  gender: Gender;
  birthDate: string; // YYYY-MM-DD
  phoneNumber: string;
  role: UserRole;
  status: UserStatus;
  updatedAt: string; // ISO 8601
}
