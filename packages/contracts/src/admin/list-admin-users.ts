// V3 Batch11 — 관리자 회원 목록 조회 (GET /admin/users)

export interface AdminUserListItem {
  userId: number;
  nickname: string;
  email: string;
  role: 'USER' | 'SUPER_ADMIN' | 'OPERATOR_ADMIN';
  status: 'ACTIVE' | 'SUSPENDED' | 'DELETED';
  createdAt: string;
  deletedAt: string | null;
}

export interface ListAdminUsersResponse {
  items: AdminUserListItem[];
  nextCursor: number | null;
  total: number;
}
