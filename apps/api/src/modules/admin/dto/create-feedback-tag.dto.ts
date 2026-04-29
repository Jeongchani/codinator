import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsEnum, IsInt, IsNotEmpty, IsOptional, IsString, Matches, MaxLength, Min } from 'class-validator';
import type { CreateFeedbackTagRequest } from '@codinator/contracts';

export class CreateFeedbackTagDto implements CreateFeedbackTagRequest {
  @ApiProperty({
    description: '운영 식별자. 생성 후 변경 불가. 영문 대문자+언더스코어 권장',
    example: 'TRENDY_STYLE',
  })
  @IsString()
  @IsNotEmpty()
  @MaxLength(50)
  @Matches(/^[A-Z0-9_]+$/, { message: 'code는 영문 대문자, 숫자, 언더스코어만 허용됩니다.' })
  code!: string;

  @ApiProperty({ description: '표시 레이블', example: '트렌디한 스타일' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  label!: string;

  @ApiProperty({
    description: 'LIKE 또는 DISLIKE. 생성 후 변경 불가.',
    enum: ['LIKE', 'DISLIKE'],
    example: 'LIKE',
  })
  @IsEnum(['LIKE', 'DISLIKE'])
  voteChoice!: 'LIKE' | 'DISLIKE';

  @ApiPropertyOptional({ description: '그룹 코드 (예: STYLE, COLOR)', example: 'STYLE' })
  @IsOptional()
  @IsString()
  @MaxLength(50)
  groupCode?: string;

  @ApiPropertyOptional({ description: '정렬 순서 (기본 0)', example: 10 })
  @IsOptional()
  @IsInt()
  @Min(0)
  sortOrder?: number;

  @ApiPropertyOptional({ description: '활성 여부 (기본 true)', example: true })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
