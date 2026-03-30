import { ApiProperty } from '@nestjs/swagger';
import type { ReviewReportRequest } from '@codinator/contracts';

export class ReviewReportDto implements ReviewReportRequest {
  @ApiProperty({
    description: '처리 결과',
    enum: ['RESOLVED', 'REJECTED'],
    example: 'RESOLVED',
  })
  action!: 'RESOLVED' | 'REJECTED';
}
