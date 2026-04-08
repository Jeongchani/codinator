import type { KeywordSummary, OutfitItem, PostImage } from '@codinator/contracts';

export const IMAGE_ORDER_BY = [
  { isPrimary: 'desc' as const },
  { sortOrder: 'asc' as const },
  { id: 'asc' as const },
];

export const OUTFIT_ORDER_BY = [{ sortOrder: 'asc' as const }, { id: 'asc' as const }];

export const POST_KEYWORD_ORDER_BY = [{ sortOrder: 'asc' as const }, { id: 'asc' as const }];

export function mapPostImages(
  images: Array<{
    id: number;
    storageKey: string | null;
    originalImageUrl: string;
    processedImageUrl: string | null;
    thumbnailUrl: string | null;
    blurMethod: PostImage['blurMethod'];
    aiBlurStatus: PostImage['aiBlurStatus'];
    sortOrder: number;
    isPrimary: boolean;
  }>,
): PostImage[] {
  return images.map((image) => ({
    id: image.id,
    storageKey: image.storageKey,
    originalImageUrl: image.originalImageUrl,
    processedImageUrl: image.processedImageUrl,
    thumbnailUrl: image.thumbnailUrl,
    blurMethod: image.blurMethod,
    aiBlurStatus: image.aiBlurStatus,
    sortOrder: image.sortOrder,
    isPrimary: image.isPrimary,
  }));
}

export function mapOutfitItems(
  items: Array<{
    id: number;
    category: OutfitItem['category'];
    itemName: string | null;
    brand: string | null;
  }>,
): OutfitItem[] {
  return items.map((item) => ({
    id: item.id,
    category: item.category,
    itemName: item.itemName,
    brand: item.brand,
  }));
}

export function mapPostKeywords(
  items: Array<{
    sortOrder: number;
    keyword: {
      id: number;
      code: string;
      label: string;
    };
  }>,
): KeywordSummary[] {
  return items.map((item) => ({
    id: item.keyword.id,
    code: item.keyword.code,
    label: item.keyword.label,
    sortOrder: item.sortOrder,
  }));
}

/**
 * 썸네일 URL 우선순위: thumbnailUrl → processedImageUrl → null
 *
 * ⚠️ originalImageUrl은 블러 처리 전 원본이므로 절대 외부에 반환하지 않는다.
 * processedImageUrl까지 없는 경우 null 반환 (이미지 처리 미완료 상태).
 */
export function pickPostThumbnail(
  images: Array<{
    thumbnailUrl: string | null;
    processedImageUrl: string | null;
  }>,
): string | null {
  const first = images[0];

  if (!first) {
    return null;
  }

  return first.thumbnailUrl ?? first.processedImageUrl ?? null;
}
