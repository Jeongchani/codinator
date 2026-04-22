import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsEnum, IsOptional, IsString, MaxLength } from 'class-validator';
import { Transform } from 'class-transformer';

export class ListAdminFeedbackTagsQueryDto {
  @ApiPropertyOptional({
    description: 'voteChoice 필터',
    enum: ['LIKE', 'DISLIKE'],
    example: 'LIKE',
  })
  @IsOptional()
  @IsEnum(['LIKE', 'DISLIKE'])
  voteChoice?: 'LIKE' | 'DISLIKE';

  @ApiPropertyOptional({
    description: 'groupCode 필터 (생략 시 전체)',
    example: 'STYLE',
  })
  @IsOptional()
  @IsString()
  @MaxLength(50)
  groupCode?: string;

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
