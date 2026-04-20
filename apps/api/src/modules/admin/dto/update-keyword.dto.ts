import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsInt, IsNotEmpty, IsOptional, IsString, MaxLength, Min } from 'class-validator';
import type { UpdateKeywordRequest } from '@codinator/contracts';

export class UpdateKeywordDto implements UpdateKeywordRequest {
  @ApiPropertyOptional({ description: '표시 레이블', example: '캐주얼 룩' })
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MaxLength(50)
  label?: string;

  @ApiPropertyOptional({ description: '정렬 순서', example: 5 })
  @IsOptional()
  @IsInt()
  @Min(0)
  sortOrder?: number;

  @ApiPropertyOptional({ description: '활성 여부', example: false })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
