export interface PostReportListItem {
  reportId: number;
  postId: number;
  /** 게시글 제목 (이미지 없으면 null) */
  postThumbnailUrl: string | null;
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

export interface ListPostReportsQuery {
  /** 필터: PENDING | RESOLVED | REJECTED (생략 시 전체) */
  status?: 'PENDING' | 'RESOLVED' | 'REJECTED';
  /** 커서 (마지막 항목의 reportId) */
  cursor?: number;
  /** 페이지 당 개수 (기본 20, 최대 100) */
  limit?: number;
}

export interface ListPostReportsResponse {
  items: PostReportListItem[];
  nextCursor: number | null;
  total: number;
}
