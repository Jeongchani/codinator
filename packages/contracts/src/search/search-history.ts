import type { ImageSearchMode } from '../common/enums';

/**
 * [V3 Batch8] 최근 검색 기록 아이템
 *
 * - TEXT 검색: queryText 존재, imageAssetId/imageSearchMode = null
 * - IMAGE 검색: imageAssetId/imageSearchMode 존재, queryText = null
 */
export interface SearchHistoryItem {
  historyId: number;
  searchType: 'TEXT' | 'IMAGE';
  /** TEXT 검색어. IMAGE 검색 시 null */
  queryText: string | null;
  /** IMAGE 검색에 사용된 이미지 자산 ID. TEXT 검색 시 null */
  imageAssetId: number | null;
  /** IMAGE 검색 모드. TEXT 검색 시 null */
  imageSearchMode: ImageSearchMode | null;
  /** 검색 결과 수 */
  resultCount: number;
  createdAt: string;
}

/** GET /users/me/search-histories response */
export interface GetSearchHistoriesResponse {
  items: SearchHistoryItem[];
  /** 다음 페이지 cursor (마지막 historyId). 다음 페이지 없으면 null */
  nextCursor: number | null;
  hasMore: boolean;
}

/** DELETE /search/histories/:historyId response */
export interface DeleteSearchHistoryResponse {
  success: boolean;
  message: string;
}
