import type { GarmentCategory } from '../common/enums';

// Batch5: V3 정책 — 일반 사용자 수정 범위는 outfitItems 중심.
// content / imageAssetId / keywordIds는 이 API로 수정하지 않는다.

export interface UpdatePostOutfitItemRequest {
  category: GarmentCategory;
  itemName?: string | null;
  brand?: string | null;
}

/** PATCH /posts/:postId 요청 본문 (V3) */
export interface UpdatePostRequest {
  /** 착장 아이템 목록. 전체 교체 방식. 빈 배열 전송 시 전체 삭제. */
  outfitItems: UpdatePostOutfitItemRequest[];
}

export interface UpdatedPostOutfitItem {
  category: GarmentCategory;
  itemName: string | null;
  brand: string | null;
  sortOrder: number;
}

/** PATCH /posts/:postId 응답 (V3) */
export interface UpdatePostResponse {
  postId: number;
  outfitItems: UpdatedPostOutfitItem[];
  updatedAt: string; // ISO 8601
}
