import type { Id } from '../common/id';

/** [V3 Batch10] 관리자용 키워드 아이템 (isActive 포함) */
export interface AdminKeywordItem {
  id: Id;
  code: string;
  label: string;
  sortOrder: number;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

/** GET /admin/keywords response */
export interface GetAdminKeywordsResponse {
  items: AdminKeywordItem[];
}

/** POST /admin/keywords request */
export interface CreateKeywordRequest {
  /** 운영 식별자. 생성 후 변경 불가. 영문 대문자+언더스코어 권장 (예: STREET_LOOK) */
  code: string;
  label: string;
  sortOrder?: number;
  isActive?: boolean;
}

/** POST /admin/keywords response */
export interface CreateKeywordResponse {
  id: Id;
  code: string;
  label: string;
  sortOrder: number;
  isActive: boolean;
  createdAt: string;
}

/** PATCH /admin/keywords/:keywordId request — code는 변경 불가 */
export interface UpdateKeywordRequest {
  label?: string;
  sortOrder?: number;
  isActive?: boolean;
}

/** PATCH /admin/keywords/:keywordId response */
export interface UpdateKeywordResponse {
  id: Id;
  code: string;
  label: string;
  sortOrder: number;
  isActive: boolean;
  updatedAt: string;
}

/** DELETE /admin/keywords/:keywordId response */
export interface DeleteKeywordResponse {
  success: boolean;
  message: string;
}
