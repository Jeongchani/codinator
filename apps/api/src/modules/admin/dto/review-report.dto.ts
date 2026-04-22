import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsOptional, IsString, MaxLength } from 'class-validator';
import type { ReviewReportRequest } from '@codinator/contracts';

export class ReviewReportDto implements ReviewReportRequest {
  @ApiProperty({
    description: '처리 결과',
    enum: ['RESOLVED', 'REJECTED'],
    example: 'RESOLVED',
  })
  @IsEnum(['RESOLVED', 'REJECTED'])
  action!: 'RESOLVED' | 'REJECTED';

  // V3 Batch11: reviewReason 저장을 위한 선택 필드
  @ApiPropertyOptional({
    description: '처리 사유 (최대 300자, DB review_reason 필드에 저장)',
    example: '스팸 게시글로 확인됨',
    maxLength: 300,
  })
  @IsOptional()
  @IsString()
  @MaxLength(300)
  reason?: string;
}
