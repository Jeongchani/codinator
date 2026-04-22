// V3 Batch11
import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsInt, IsOptional, Min } from 'class-validator';
import { Type } from 'class-transformer';

export class ListAdminUsersQueryDto {
  @ApiPropertyOptional({ enum: ['ACTIVE', 'SUSPENDED', 'DELETED'], description: '회원 상태 필터' })
  @IsOptional()
  @IsEnum(['ACTIVE', 'SUSPENDED', 'DELETED'])
  status?: 'ACTIVE' | 'SUSPENDED' | 'DELETED';

  @ApiPropertyOptional({ enum: ['USER', 'SUPER_ADMIN', 'OPERATOR_ADMIN'], description: '역할 필터' })
  @IsOptional()
  @IsEnum(['USER', 'SUPER_ADMIN', 'OPERATOR_ADMIN'])
  role?: 'USER' | 'SUPER_ADMIN' | 'OPERATOR_ADMIN';

  @ApiPropertyOptional({ type: Number, description: '커서 (마지막 userId)' })
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
