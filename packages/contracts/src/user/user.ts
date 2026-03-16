// 공개 사용자 타입 (DB 전체가 아닌 밖으로 보여줄 사용자 정보만)

export type UserRole = 'USER' | 'ADMIN';

export interface PublicUser {
  id: number;
  email: string;
  nickname: string;
  role: UserRole;
  profileImageUrl?: string | null;
}

// 외부 계약 타입에 넣으면 안되는 값
// password: string
// passwordHash: string
// refreshToken: string