import type { GarmentCategory, PostStatus } from '../common/enums';

export interface CreateOutfitItemInput {
  category: GarmentCategory;
  itemName?: string | null;
  brand?: string | null;
}

export interface CreatePostRequest {
  content: string;
  imageAssetId: number;
  keywordIds?: number[];
  outfitItems?: CreateOutfitItemInput[];
}

export interface CreatePostResponse {
  postId: number;
  evaluationId: number;
  status: PostStatus;
}
