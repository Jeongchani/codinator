// V3 Batch11
import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsInt, IsOptional, Min } from 'class-validator';
import { Type } from 'class-transformer';

export class ListSanctionsQueryDto {
  @ApiPropertyOptional({ type: Number, description: '특정 제재 대상 userId 필터' })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  userId?: number;

  @ApiPropertyOptional({
    enum: ['TEMP_SUSPENSION', 'PERMANENT_BAN', 'POST_RESTRICTION'],
    description: '제재 유형 필터',
  })
  @IsOptional()
  @IsEnum(['TEMP_SUSPENSION', 'PERMANENT_BAN', 'POST_RESTRICTION'])
  type?: 'TEMP_SUSPENSION' | 'PERMANENT_BAN' | 'POST_RESTRICTION';

  @ApiPropertyOptional({ type: Number, description: '커서 (마지막 sanctionId)' })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  cursor?: number;

  @ApiPropertyOptional({ type: Number, description: '페이지 크기 (기본 20, 최대 100)' })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  limit?: number;
}
