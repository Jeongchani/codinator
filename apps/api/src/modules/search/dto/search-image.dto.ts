import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsArray,
  IsDateString,
  IsEnum,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  Max,
  Min,
} from 'class-validator';
import { Transform, Type } from 'class-transformer';
import type {
  AiGarmentCategory,
  ImageSearchMode,
  ImageSearchRequest,
} from '@codinator/contracts';

export class SearchImageDto implements ImageSearchRequest {
  @ApiProperty({ example: 201, description: '검색용 업로드에서 받은 imageAssetId' })
  @IsInt()
  imageAssetId!: number;

  @ApiPropertyOptional({
    enum: ['FULL_OUTFIT', 'SINGLE_ITEM'],
    example: 'FULL_OUTFIT',
    description:
      '검색 모드. 생략 시 AI 분석 결과(감지된 의류 수·면적·얼굴 감지 여부)를 기반으로 ' +
      'FULL_OUTFIT 또는 SINGLE_ITEM 을 자동 판별합니다. ' +
      '명시하면 해당 모드를 그대로 사용합니다.', // Batch9-AutoMode
  })
  @IsOptional()
  @IsEnum(['FULL_OUTFIT', 'SINGLE_ITEM'])
  mode?: ImageSearchMode;

  @ApiPropertyOptional({
    enum: ['TOP', 'BOTTOM', 'OUTER', 'SHOES', 'BAG', 'ACCESSORY', 'ETC'],
    example: 'TOP',
    description:
      '[하위 호환 필드] 결과 게시글의 outfit category 필터로 동작합니다. ' +
      '새 연동은 outfitCategories 를 사용하세요. ' +
      '단일 카테고리를 지정하면 outfitCategories 로 병합 처리됩니다. ' +
      'DRESS 는 게시글 카테고리에 존재하지 않으므로 400 오류.',
  })
  @IsOptional()
  @IsEnum(['TOP', 'BOTTOM', 'OUTER', 'SHOES', 'BAG', 'ACCESSORY', 'DRESS', 'ETC'])
  garmentCategory?: AiGarmentCategory;

  @ApiPropertyOptional({
    type: [String],
    enum: ['TOP', 'BOTTOM', 'OUTER', 'SHOES', 'BAG', 'ACCESSORY', 'ETC'],
    example: ['TOP', 'OUTER'],
    description:
      '결과 게시글의 outfit category 필터 (post_search_index.outfitCategories 기준). ' +
      '텍스트 검색의 outfitCategories 와 동일한 의미. ' +
      '한국어(상의/하의/아우터/신발/가방/악세사리/기타) 또는 enum(TOP/BOTTOM/OUTER/SHOES/BAG/ACCESSORY/ETC) 모두 허용. ' +
      'DRESS / 원피스 는 게시글 카테고리에 존재하지 않으므로 400 오류. ' +
      '반복 파라미터로 전달: outfitCategories=TOP&outfitCategories=OUTER',
  })
  @IsOptional()
  @Transform(({ value }: { value: unknown }) =>
    Array.isArray(value) ? value : value != null ? [value] : [],
  )
  @IsArray()
  @IsString({ each: true })
  outfitCategories?: string[];

  @ApiPropertyOptional({
    example: 0,
    description: '커서 (offset 기반). 생략 시 첫 페이지 (기본 0)',
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  cursor?: number;

  @ApiPropertyOptional({
    example: 20,
    description: '페이지 크기 (기본 20, 최대 50)',
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(50)
  limit?: number;

  @ApiPropertyOptional({
    example: '2026-04-01T00:00:00.000Z',
    description: 'publishedAt 시작 시점 이상 (ISO 8601)',
  })
  @IsOptional()
  @IsDateString()
  periodFrom?: string;

  @ApiPropertyOptional({
    example: '2026-04-30T23:59:59.999Z',
    description: 'publishedAt 종료 시점 이하 (ISO 8601)',
  })
  @IsOptional()
  @IsDateString()
  periodTo?: string;

  @ApiPropertyOptional({
    example: 0.6,
    description: '최소 좋아요 비율 (0.0 ~ 1.0)',
  })
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(1)
  likeRatioMin?: number;

  @ApiPropertyOptional({
    type: [Number],
    example: [1, 2, 3],
    description: '키워드 ID 필터 (keyword.id 배열)',
  })
  @IsOptional()
  @IsArray()
  @IsInt({ each: true })
  keywordIds?: number[];

  @ApiPropertyOptional({
    type: [Number],
    example: [10, 11],
    description: '좋아요 피드백 태그 ID 필터 (voteChoice=LIKE)',
  })
  @IsOptional()
  @IsArray()
  @IsInt({ each: true })
  feedbackLikeTagIds?: number[];

  @ApiPropertyOptional({
    type: [Number],
    example: [20, 21],
    description: '싫어요 피드백 태그 ID 필터 (voteChoice=DISLIKE)',
  })
  @IsOptional()
  @IsArray()
  @IsInt({ each: true })
  feedbackDislikeTagIds?: number[];
}
