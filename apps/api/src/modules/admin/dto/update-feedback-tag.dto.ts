import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsInt, IsNotEmpty, IsOptional, IsString, MaxLength, Min } from 'class-validator';
import type { UpdateFeedbackTagRequest } from '@codinator/contracts';

export class UpdateFeedbackTagDto implements UpdateFeedbackTagRequest {
  @ApiPropertyOptional({ description: '표시 레이블', example: '세련된 스타일' })
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  label?: string;

  @ApiPropertyOptional({ description: '그룹 코드 (null 전달 시 제거)', example: 'COLOR', nullable: true })
  @IsOptional()
  @IsString()
  @MaxLength(50)
  groupCode?: string | null;

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
