import type { AiBlurStatus, BlurMethod, GarmentCategory, PostStatus } from '../common/enums';

export interface CreateOutfitItemInput {
  category: GarmentCategory;
  itemName?: string | null;
  brand?: string | null;
}

export interface CreatePostImageInput {
  originalImageUrl: string;
  processedImageUrl?: string | null;
  thumbnailUrl?: string | null;
  storageKey?: string | null;
  blurMethod?: BlurMethod;
  aiBlurStatus?: AiBlurStatus;
}

export interface CreatePostRequest {
  content: string; // V2 정책: 필수값
  image: CreatePostImageInput;
  keywordIds?: number[];
  outfitItems?: CreateOutfitItemInput[];
}

export interface CreatePostResponse {
  postId: number;
  evaluationId: number;
  status: PostStatus;
}
