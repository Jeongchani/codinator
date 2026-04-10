import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import type {
  AiGarmentCategory,
  FeedbackTagCode,
  GarmentCategory,
  ImageSearchMode,
  ImageSearchRequest,
} from '@codinator/contracts';

export class SearchImageDto implements ImageSearchRequest {
  @ApiProperty({ example: 201, description: '검색용 업로드에서 받은 imageAssetId' })
  imageAssetId!: number;

  @ApiPropertyOptional({
    enum: ['FULL_OUTFIT', 'SINGLE_ITEM'],
    example: 'FULL_OUTFIT',
    description: '검색 모드',
  })
  mode?: ImageSearchMode;

  @ApiPropertyOptional({
    enum: ['TOP', 'BOTTOM', 'OUTER', 'SHOES', 'BAG', 'ACCESSORY', 'DRESS', 'ETC'],
    example: 'TOP',
    description: 'SINGLE_ITEM 모드에서 우선 사용할 의류 카테고리',
  })
  garmentCategory?: AiGarmentCategory;

  @ApiPropertyOptional({ example: 20, description: '최대 결과 수 (기본 20, 최대 50)' })
  limit?: number;

  @ApiPropertyOptional({
    example: '2026-04-01T00:00:00.000Z',
    description: 'publishedAt 시작 시점 이상',
  })
  publishedFrom?: string;

  @ApiPropertyOptional({
    example: '2026-04-30T23:59:59.999Z',
    description: 'publishedAt 종료 시점 이하',
  })
  publishedTo?: string;

  @ApiPropertyOptional({
    example: 0.6,
    description: '최소 좋아요 비율 (0.0 ~ 1.0)',
  })
  minLikeRatio?: number;

  @ApiPropertyOptional({
    example: 0.95,
    description: '최대 좋아요 비율 (0.0 ~ 1.0)',
  })
  maxLikeRatio?: number;

  @ApiPropertyOptional({
    type: [String],
    enum: ['TOP', 'BOTTOM', 'OUTER', 'SHOES', 'BAG', 'ACCESSORY', 'ETC'],
    description: 'outfit 카테고리 필터',
  })
  outfitCategories?: GarmentCategory[];

  @ApiPropertyOptional({
    type: [String],
    example: ['DATE_LOOK', 'DAILY_LOOK'],
    description: '키워드 코드 필터',
  })
  keywordCodes?: string[];

  @ApiPropertyOptional({
    type: [String],
    example: ['POS_FIT_GOOD', 'NEG_COLOR_BAD'],
    description: '피드백 태그 코드 필터',
  })
  feedbackTagCodes?: FeedbackTagCode[];
}
