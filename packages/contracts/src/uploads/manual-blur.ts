export interface ManualBlurResponse {
  imageAssetId: number;
  /** postId 기반 endpoint에서만 채워짐. imageAsset 기반 endpoint에서는 undefined. */ // Batch4
  postId?: number;
  processedImageUrl: string;
  blurMethod: 'MANUAL';
  updatedAt: string;
}