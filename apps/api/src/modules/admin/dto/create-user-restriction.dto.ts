// POST /admin/users/:userId/sanctions/post-restriction
// POST /admin/users/:userId/sanctions/login-restriction
// userId 는 path param 에서 추출 — body 에 포함하지 않음

import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsDateString, IsNotEmpty, IsOptional, IsString, MaxLength } from 'class-validator';
import type { CreateUserSanctionRequest } from '@codinator/contracts';

export class CreateUserRestrictionDto implements CreateUserSanctionRequest {
  @ApiProperty({ example: '반복 스팸 게시 행위', description: '제재 사유 (최대 255자)', maxLength: 255 })
  @IsNotEmpty()
  @IsString()
  @MaxLength(255)
  reason!: string;

  @ApiPropertyOptional({
    example: '2026-04-23T00:00:00.000Z',
    description: '제재 시작 시각 (ISO 8601). 생략 시 즉시 시작',
  })
  @IsOptional()
  @IsDateString()
  startsAt?: string;

  @ApiPropertyOptional({
    example: '2026-05-23T00:00:00.000Z',
    description: '제재 종료 시각 (ISO 8601). 생략 시 무기한(null)',
  })
  @IsOptional()
  @IsDateString()
  endsAt?: string | null;
}
