import type { GarmentCategory } from '../common/enums';

export interface CreatePostImageInput {
  imageUrl: string;
  sortOrder: number;
  isRepresentative: boolean;
}

export interface CreateOutfitItemInput {
  category: GarmentCategory;
  itemName: string;
  brand?: string | null;
}

export interface CreatePostRequest {
  content?: string | null;
  images: CreatePostImageInput[];
  outfitItems: CreateOutfitItemInput[];
}

export interface CreatePostResponse {
  postId: number;
  status: 'UNDER_REVIEW';
}