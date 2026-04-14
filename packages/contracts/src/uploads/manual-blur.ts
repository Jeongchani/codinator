export interface ManualBlurResponse {
  imageAssetId: number;
  postId: number;
  processedImageUrl: string;
  blurMethod: 'MANUAL';
  updatedAt: string;
}