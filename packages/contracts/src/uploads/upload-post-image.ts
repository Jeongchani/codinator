import type { AiBlurStatus, BlurMethod } from '../common/enums';

export interface UploadPostImageResponse {
  imageAssetId: number;
  originalImageUrl: string;
  processedImageUrl: string;
  thumbnailUrl?: string | null;
  storageKey?: string | null;
  blurMethod: BlurMethod;
  aiBlurStatus: AiBlurStatus;
}

/**
 * [V3 Batch9] 검색용 이미지 업로드 응답
 *
 * - 검색용 이미지는 공개되지 않으므로 face blur 불필요 → blurMethod/aiBlurStatus 미포함
 * - 클라이언트는 imageAssetId만 받아 POST /search/image 에서 사용
 * - processedImageUrl / thumbnailUrl 은 검색용 이미지에선 null (blur/썸네일 처리 없음)
 */
export interface UploadSearchImageResponse {
  imageAssetId: number;
  sourceType: string;
  originalImageUrl: string;
  processedImageUrl: string | null;
  thumbnailUrl: string | null;
}
