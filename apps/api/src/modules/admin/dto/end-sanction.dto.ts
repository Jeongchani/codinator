// V3 Batch11
import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, MaxLength } from 'class-validator';
import type { EndSanctionRequest } from '@codinator/contracts';

export class EndSanctionDto implements EndSanctionRequest {
  @ApiPropertyOptional({
    description: '종료 사유 (최대 300자)',
    example: '당사자 요청으로 조기 종료',
    maxLength: 300,
  })
  @IsOptional()
  @IsString()
  @MaxLength(300)
  reason?: string;
}
