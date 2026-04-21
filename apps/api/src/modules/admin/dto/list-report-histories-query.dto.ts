// V3 Batch11
import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsInt, IsOptional, Min } from 'class-validator';
import { Type } from 'class-transformer';

export class ListReportHistoriesQueryDto {
  @ApiPropertyOptional({
    enum: ['POST_REPORT', 'USER_REPORT'],
    description: '신고 대상 타입 필터',
  })
  @IsOptional()
  @IsEnum(['POST_REPORT', 'USER_REPORT'])
  targetType?: 'POST_REPORT' | 'USER_REPORT';

  @ApiPropertyOptional({ type: Number, description: '특정 신고 ID 필터 (targetId)' })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  targetId?: number;

  @ApiPropertyOptional({ type: Number, description: '커서 (마지막 historyId)' })
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
