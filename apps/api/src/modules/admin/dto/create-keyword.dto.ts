import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsInt, IsNotEmpty, IsOptional, IsString, Matches, MaxLength, Min } from 'class-validator';
import type { CreateKeywordRequest } from '@codinator/contracts';

export class CreateKeywordDto implements CreateKeywordRequest {
  @ApiProperty({
    description: '운영 식별자. 생성 후 변경 불가. 영문 대문자+언더스코어 권장',
    example: 'STREET_LOOK',
  })
  @IsString()
  @IsNotEmpty()
  @MaxLength(50)
  @Matches(/^[A-Z0-9_]+$/, { message: 'code는 영문 대문자, 숫자, 언더스코어만 허용됩니다.' })
  code!: string;

  @ApiProperty({ description: '표시 레이블', example: '스트릿 룩' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(50)
  label!: string;

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
