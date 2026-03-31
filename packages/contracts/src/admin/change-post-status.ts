// 게시글 상태 강제 변경 (PATCH /admin/posts/:postId/status)

export type AdminPostStatus = 'ACTIVE' | 'HIDDEN' | 'DELETED';

export interface ChangePostStatusRequest {
  status: AdminPostStatus;
  /** status === 'HIDDEN' 일 때 사유 (선택, 최대 255자) */
  hiddenReason?: string;
}

export interface ChangePostStatusResponse {
  postId: number;
  status: AdminPostStatus;
  hiddenAt: string | null;   // ISO 8601 or null
  hiddenReason: string | null;
  updatedAt: string;         // ISO 8601
}
