import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, MaxLength } from 'class-validator';
import type { ReopenReportRequest } from '@codinator/contracts';

export class ReopenReportDto implements ReopenReportRequest {
  @ApiPropertyOptional({
    example: '추가 조사가 필요합니다.',
    description: '재오픈 사유 (최대 500자)',
    maxLength: 500,
  })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  reason?: string;
}
