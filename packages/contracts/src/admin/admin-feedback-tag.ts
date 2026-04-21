import type { Id } from '../common/id';

/** [V3 Batch10] 관리자용 피드백 태그 아이템 (isActive 포함) */
export interface AdminFeedbackTagItem {
  id: Id;
  code: string;
  label: string;
  groupCode: string | null;
  voteChoice: 'LIKE' | 'DISLIKE';
  isActive: boolean;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
}

/** GET /admin/feedback-tags response */
export interface GetAdminFeedbackTagsResponse {
  items: AdminFeedbackTagItem[];
}

/** POST /admin/feedback-tags request */
export interface CreateFeedbackTagRequest {
  /** 운영 식별자. 생성 후 변경 불가. 영문 대문자+언더스코어 권장 (예: TRENDY_STYLE) */
  code: string;
  label: string;
  /** LIKE 또는 DISLIKE. 생성 후 변경 불가. */
  voteChoice: 'LIKE' | 'DISLIKE';
  groupCode?: string;
  sortOrder?: number;
  isActive?: boolean;
}

/** POST /admin/feedback-tags response */
export interface CreateFeedbackTagResponse {
  id: Id;
  code: string;
  label: string;
  groupCode: string | null;
  voteChoice: 'LIKE' | 'DISLIKE';
  isActive: boolean;
  sortOrder: number;
  createdAt: string;
}

/** PATCH /admin/feedback-tags/:tagId request — code·voteChoice 변경 불가 */
export interface UpdateFeedbackTagRequest {
  label?: string;
  groupCode?: string | null;
  sortOrder?: number;
  isActive?: boolean;
}

/** PATCH /admin/feedback-tags/:tagId response */
export interface UpdateFeedbackTagResponse {
  id: Id;
  code: string;
  label: string;
  groupCode: string | null;
  voteChoice: 'LIKE' | 'DISLIKE';
  isActive: boolean;
  sortOrder: number;
  updatedAt: string;
}

/** DELETE /admin/feedback-tags/:tagId response */
export interface DeleteFeedbackTagResponse {
  success: boolean;
  message: string;
}
