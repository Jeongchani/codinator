import type { UpdatePostRequest } from '@codinator/contracts';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { GarmentCategory } from '@prisma/client';
import { Transform, Type } from 'class-transformer';
import {
  IsArray,
  IsEnum,
  IsOptional,
  IsString,
  MaxLength,
  ValidateNested,
} from 'class-validator';

const trimString = ({ value }: { value: unknown }) =>
  typeof value === 'string' ? value.trim() : value;

const trimOptionalString = ({ value }: { value: unknown }) => {
  if (typeof value !== 'string') {
    return value;
  }

  const trimmed = value.trim();
  return trimmed === '' ? undefined : trimmed;
};

export class UpdatePostOutfitItemDto {
  @ApiProperty({
    enum: GarmentCategory,
    example: GarmentCategory.TOP,
  })
  @IsEnum(GarmentCategory)
  category!: GarmentCategory;

  @ApiPropertyOptional({
    example: '와이드 셔츠',
    maxLength: 100,
  })
  @IsOptional()
  @Transform(trimOptionalString)
  @IsString()
  @MaxLength(100)
  itemName?: string;

  @ApiPropertyOptional({
    example: '무신사',
    maxLength: 100,
  })
  @IsOptional()
  @Transform(trimOptionalString)
  @IsString()
  @MaxLength(100)
  brand?: string;
}

export class UpdatePostDto implements UpdatePostRequest {
  @ApiPropertyOptional({
    example: '평가 종료 후 수정된 코디 설명',
    maxLength: 500,
  })
  @IsOptional()
  @Transform(trimString)
  @IsString()
  @MaxLength(500)
  content?: string;

  @ApiPropertyOptional({
    type: () => [UpdatePostOutfitItemDto],
    example: [
      {
        category: GarmentCategory.TOP,
        itemName: '와이드 셔츠',
        brand: '무신사',
      },
    ],
  })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => UpdatePostOutfitItemDto)
  outfitItems?: UpdatePostOutfitItemDto[];
}