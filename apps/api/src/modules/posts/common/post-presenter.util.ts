import type { KeywordSummary, OutfitItem, PostImage } from '@codinator/contracts';

export const IMAGE_ORDER_BY = [
  { isPrimary: 'desc' as const },
  { sortOrder: 'asc' as const },
  { id: 'asc' as const },
];

export const POST_IMAGE_INCLUDE = {
  imageAsset: true,
};

export const POST_IMAGE_SELECT = {
  id: true,
  sortOrder: true,
  isPrimary: true,
  imageAsset: {
    select: {
      storageKey: true,
      originalImageUrl: true,
      processedImageUrl: true,
      thumbnailUrl: true,
      blurMethod: true,
      aiBlurStatus: true,
    },
  },
};

export const POST_THUMBNAIL_SELECT = {
  imageAsset: {
    select: {
      thumbnailUrl: true,
      processedImageUrl: true,
    },
  },
};

export const OUTFIT_ORDER_BY = [{ sortOrder: 'asc' as const }, { id: 'asc' as const }];

export const POST_KEYWORD_ORDER_BY = [{ sortOrder: 'asc' as const }, { id: 'asc' as const }];

export function mapPostImages(
  images: Array<{
    id: number;
    sortOrder: number;
    isPrimary: boolean;
    imageAsset: {
      storageKey: string | null;
      originalImageUrl: string;
      processedImageUrl: string | null;
      thumbnailUrl: string | null;
      blurMethod: PostImage['blurMethod'];
      aiBlurStatus: PostImage['aiBlurStatus'];
    };
  }>,
): PostImage[] {
  return images.map((image) => ({
    id: image.id,
    storageKey: image.imageAsset.storageKey,
    originalImageUrl: image.imageAsset.originalImageUrl,
    processedImageUrl: image.imageAsset.processedImageUrl,
    thumbnailUrl: image.imageAsset.thumbnailUrl,
    blurMethod: image.imageAsset.blurMethod,
    aiBlurStatus: image.imageAsset.aiBlurStatus,
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

export function pickPostThumbnail(
  images: Array<{
    imageAsset: {
      thumbnailUrl: string | null;
      processedImageUrl: string | null;
    };
  }>,
): string | null {
  const first = images[0];

  if (!first) {
    return null;
  }

  return first.imageAsset.thumbnailUrl ?? first.imageAsset.processedImageUrl ?? null;
}
