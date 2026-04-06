export interface UserReportListItem {
  reportId: number;
  reportedUserId: number;
  reportedUserNickname: string;
  reporterId: number;
  reporterNickname: string;
  title: string;
  reason: 'SPAM' | 'ABUSE' | 'INAPPROPRIATE' | 'ETC';
  description: string | null;
  status: 'PENDING' | 'RESOLVED' | 'REJECTED';
  reviewedAt: string | null;
  reviewedByNickname: string | null;
  createdAt: string;
}

export interface ListUserReportsQuery {
  /** 필터: PENDING | RESOLVED | REJECTED (생략 시 전체) */
  status?: 'PENDING' | 'RESOLVED' | 'REJECTED';
  /** 커서 (마지막 항목의 reportId) */
  cursor?: number;
  /** 페이지 당 개수 (기본 20, 최대 100) */
  limit?: number;
}

export interface ListUserReportsResponse {
  items: UserReportListItem[];
  nextCursor: number | null;
  total: number;
}
