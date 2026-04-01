export interface ManualBlurResponse {
  imageId: number;
  postId: number;
  processedImageUrl: string;
  blurMethod: 'MANUAL';
  updatedAt: string; // ISO 8601
}
