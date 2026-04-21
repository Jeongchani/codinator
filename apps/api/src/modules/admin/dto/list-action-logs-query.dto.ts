// V3 Batch11
import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsInt, IsOptional, Min } from 'class-validator';
import { Type } from 'class-transformer';

export class ListActionLogsQueryDto {
  @ApiPropertyOptional({ type: Number, description: '특정 관리자 adminId 필터' })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  adminId?: number;

  @ApiPropertyOptional({
    enum: ['POST', 'POST_REPORT', 'USER_REPORT', 'USER', 'USER_SANCTION'],
    description: '대상 타입 필터',
  })
  @IsOptional()
  @IsEnum(['POST', 'POST_REPORT', 'USER_REPORT', 'USER', 'USER_SANCTION'])
  targetType?: string;

  @ApiPropertyOptional({
    enum: ['CREATED', 'RESOLVED', 'REJECTED', 'REOPENED', 'HIDDEN', 'UNHIDDEN', 'DELETED', 'RESTORED', 'SANCTION_UPDATED', 'SANCTION_ENDED', 'USER_STATUS_UPDATED'],
    description: '액션 타입 필터',
  })
  @IsOptional()
  @IsEnum(['CREATED', 'RESOLVED', 'REJECTED', 'REOPENED', 'HIDDEN', 'UNHIDDEN', 'DELETED', 'RESTORED', 'SANCTION_UPDATED', 'SANCTION_ENDED', 'USER_STATUS_UPDATED'])
  actionType?: string;

  @ApiPropertyOptional({ type: Number, description: '커서 (마지막 logId)' })
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
