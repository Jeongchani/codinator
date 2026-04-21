// V3 Batch11
import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsInt, IsOptional, Min } from 'class-validator';
import { Type } from 'class-transformer';

export class ListAdminPostsQueryDto {
  @ApiPropertyOptional({ enum: ['ACTIVE', 'HIDDEN', 'DELETED'], description: '게시글 상태 필터' })
  @IsOptional()
  @IsEnum(['ACTIVE', 'HIDDEN', 'DELETED'])
  status?: 'ACTIVE' | 'HIDDEN' | 'DELETED';

  @ApiPropertyOptional({ type: Number, description: '커서 (마지막 postId)' })
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
