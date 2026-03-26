import type { AiBlurStatus, BlurMethod } from '../common/enums';

export interface UploadPostImageResponse {
  originalImageUrl: string;
  processedImageUrl: string;
  thumbnailUrl?: string | null;
  storageKey?: string | null;
  blurMethod: BlurMethod;
  aiBlurStatus: AiBlurStatus;
}
