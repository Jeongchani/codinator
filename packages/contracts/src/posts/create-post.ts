import type { AiBlurStatus, BlurMethod, GarmentCategory, PostStatus } from '../common/enums';

export interface CreateOutfitItemInput {
  category: GarmentCategory;
  itemName?: string | null;
  brand?: string | null;
}

/**
 * 구버전 호환용 입력.
 * 신규 구현은 imageAssetId 사용이 우선이다.
 */
export interface CreatePostImageInput {
  originalImageUrl: string;
  processedImageUrl?: string | null;
  thumbnailUrl?: string | null;
  storageKey?: string | null;
  blurMethod?: BlurMethod;
  aiBlurStatus?: AiBlurStatus;
}

export interface CreatePostRequest {
  content: string;
  imageAssetId?: number;
  image?: CreatePostImageInput;
  keywordIds?: number[];
  outfitItems?: CreateOutfitItemInput[];
}

export interface CreatePostResponse {
  postId: number;
  evaluationId: number;
  status: PostStatus;
}
