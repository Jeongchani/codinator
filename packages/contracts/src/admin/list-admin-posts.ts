// V3 Batch11 — 관리자 게시글 목록 조회 (GET /admin/posts)

export interface AdminPostListItem {
  postId: number;
  authorId: number;
  authorNickname: string;
  status: 'ACTIVE' | 'HIDDEN' | 'DELETED';
  thumbnailUrl: string | null;
  content: string;
  publishedAt: string | null;
  hiddenAt: string | null;
  hiddenReason: string | null;
  deletedAt: string | null;
  createdAt: string;
}

export interface ListAdminPostsResponse {
  items: AdminPostListItem[];
  nextCursor: number | null;
  total: number;
}
