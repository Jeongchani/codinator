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
import type { SearchRequest, SearchType } from '@codinator/contracts';

export class SearchQueryDto implements SearchRequest {
  @ApiProperty({
    description: '검색어 (1자 이상, 최대 100자)',
    example: '블랙',
    minLength: 1,
    maxLength: 100,
  })
  q!: string;

  // TextSearchAdvanced: OUTFIT_ITEM / OUTFIT_BRAND 추가
  @ApiPropertyOptional({
    description: '검색 타입. 생략 또는 ALL이면 통합 검색',
    enum: ['ALL', 'NICKNAME', 'KEYWORD', 'POST', 'OUTFIT_ITEM', 'OUTFIT_BRAND'],
    example: 'ALL',
  })
  @IsOptional()
  @IsEnum(['ALL', 'NICKNAME', 'KEYWORD', 'POST', 'OUTFIT_ITEM', 'OUTFIT_BRAND'])
  type?: SearchType;

  @ApiPropertyOptional({
    description: '단일 타입 검색용 커서. ALL 검색은 미지원',
    example: 50,
    type: Number,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  cursor?: number;

  @ApiPropertyOptional({
    description: '페이지 크기 (기본 20, 최대 50)',
    example: 20,
    type: Number,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(50)
  limit?: number;

  // ── TextSearchAdvanced: 고급 필터 ────────────────────────────────────────────

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
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  @Max(1)
  likeRatioMin?: number;

  @ApiPropertyOptional({
    type: [String],
    example: ['TOP', 'OUTER'],
    description: '착용 아이템 카테고리 필터. 대소문자 무관 (내부 정규화). 반복 파라미터로 전달: outfitCategories=TOP&outfitCategories=OUTER',
  })
  @IsOptional()
  @Transform(({ value }: { value: unknown }) =>
    Array.isArray(value) ? value : value != null ? [value] : [],
  )
  @IsArray()
  @IsString({ each: true })
  outfitCategories?: string[];

  @ApiPropertyOptional({
    type: [Number],
    example: [1, 2, 3],
    description: '키워드 ID 필터 (keyword.id 배열). 반복 파라미터로 전달: keywordIds=1&keywordIds=2',
  })
  @IsOptional()
  @Transform(({ value }: { value: unknown }) => {
    const arr = Array.isArray(value) ? value : value != null ? [value] : [];
    return arr.map((v: unknown) => parseInt(String(v), 10));
  })
  @IsArray()
  @IsInt({ each: true })
  keywordIds?: number[];

  @ApiPropertyOptional({
    type: [Number],
    example: [10, 11],
    description: '좋아요 피드백 태그 ID 필터 (voteChoice=LIKE). 반복 파라미터로 전달',
  })
  @IsOptional()
  @Transform(({ value }: { value: unknown }) => {
    const arr = Array.isArray(value) ? value : value != null ? [value] : [];
    return arr.map((v: unknown) => parseInt(String(v), 10));
  })
  @IsArray()
  @IsInt({ each: true })
  feedbackLikeTagIds?: number[];

  @ApiPropertyOptional({
    type: [Number],
    example: [20, 21],
    description: '싫어요 피드백 태그 ID 필터 (voteChoice=DISLIKE). 반복 파라미터로 전달',
  })
  @IsOptional()
  @Transform(({ value }: { value: unknown }) => {
    const arr = Array.isArray(value) ? value : value != null ? [value] : [];
    return arr.map((v: unknown) => parseInt(String(v), 10));
  })
  @IsArray()
  @IsInt({ each: true })
  feedbackDislikeTagIds?: number[];
}
