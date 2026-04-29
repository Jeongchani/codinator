import type { Gender, SocialProvider, UserRole, UserStatus } from '../common/enums';

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
  /**
   * 비밀번호 설정 여부.
   * - true  : 이메일/비밀번호 로그인 가능 (일반 가입 또는 신규 소셜가입 시 password 필드 설정됨)
   * - false : 레거시 소셜 전용 계정 (passwordHash null).
   *           현재 비밀번호를 새로 설정하는 전용 엔드포인트는 제공되지 않음.
   *           기존 비밀번호가 있는 경우 PATCH /users/me/password 로 변경 가능.
   *           비밀번호를 분실한 경우 PATCH /auth/password-reset (전화번호 인증) 으로 재설정 가능.
   */
  hasPassword: boolean;
  /**
   * 연결된 소셜 제공자 목록.
   * 프론트가 계정 관리 UI(소셜 연동/해제, 비밀번호 변경 등)를 분기하는 데 사용.
   */
  socialProviders: SocialProvider[];
}
