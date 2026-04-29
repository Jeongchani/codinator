import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsBoolean } from 'class-validator';
import { Transform } from 'class-transformer';

export class ListAdminKeywordsQueryDto {
  /** isActive 필터 (생략 시 전체 반환) */
  @ApiPropertyOptional({
    description: 'isActive 필터 (생략 시 전체)',
    example: true,
  })
  @IsOptional()
  @Transform(({ value }) => {
    if (value === 'true') return true;
    if (value === 'false') return false;
    return value;
  })
  @IsBoolean()
  isActive?: boolean;
}
