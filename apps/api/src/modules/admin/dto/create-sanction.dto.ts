// V3 Batch11
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsDateString, IsEnum, IsInt, IsOptional, IsString, MaxLength, Min } from 'class-validator';
import type { CreateSanctionRequest } from '@codinator/contracts';

export class CreateSanctionDto implements CreateSanctionRequest {
  @ApiProperty({ type: Number, example: 5, description: '제재 대상 userId' })
  @IsInt()
  @Min(1)
  sanctionedUserId!: number;

  @ApiProperty({
    enum: ['TEMP_SUSPENSION', 'PERMANENT_BAN', 'POST_RESTRICTION'],
    example: 'TEMP_SUSPENSION',
    description: '제재 유형. PERMANENT_BAN은 SUPER_ADMIN만 가능',
  })
  @IsEnum(['TEMP_SUSPENSION', 'PERMANENT_BAN', 'POST_RESTRICTION'])
  type!: 'TEMP_SUSPENSION' | 'PERMANENT_BAN' | 'POST_RESTRICTION';

  @ApiProperty({ example: '반복 스팸 행위', description: '제재 사유 (최대 255자)', maxLength: 255 })
  @IsString()
  @MaxLength(255)
  reason!: string;

  @ApiPropertyOptional({
    example: '2026-04-21T00:00:00.000Z',
    description: '제재 시작 시각 (ISO 8601). 생략 시 즉시 시작',
  })
  @IsOptional()
  @IsDateString()
  startsAt?: string;

  @ApiPropertyOptional({
    example: '2026-05-21T00:00:00.000Z',
    description: '제재 종료 시각 (ISO 8601). PERMANENT_BAN은 null로 보내거나 생략',
  })
  @IsOptional()
  @IsDateString()
  endsAt?: string | null;
}
