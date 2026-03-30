import type { GarmentCategory } from '../common/enums';

export interface UpdatePostOutfitItemRequest {
  category: GarmentCategory;
  itemName?: string;
  brand?: string;
}

export interface UpdatePostRequest {
  content?: string;
  outfitItems?: UpdatePostOutfitItemRequest[];
}

export interface UpdatedPostOutfitItem {
  category: GarmentCategory;
  itemName: string | null;
  brand: string | null;
  sortOrder: number;
}

export interface UpdatePostResponse {
  postId: number;
  content: string;
  outfitItems: UpdatedPostOutfitItem[];
  updatedAt: string; // ISO 8601
}
