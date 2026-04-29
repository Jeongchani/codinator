import type { GarmentCategory, PostStatus } from '../common/enums';

export interface CreateOutfitItemInput {
  category: GarmentCategory;
  itemName?: string | null;
  brand?: string | null;
}

export interface CreatePostRequest {
  content?: string | null;
  image: {
    imageUrl: string;
    storageKey?: string | null;
    thumbnailUrl?: string | null;
  };
  outfitItems?: CreateOutfitItemInput[];
}

export interface CreatePostResponse {
  postId: number;
  evaluationId: number;
  status: PostStatus;
}
