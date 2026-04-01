import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import type { CreateReportRequest, ReportReason } from '@codinator/contracts';

export class CreateReportDto implements CreateReportRequest {
  @ApiProperty({
    example: '스팸 게시글입니다',
    description: '신고 제목 (최대 100자)',
  })
  title: string;

  @ApiProperty({
    example: 'SPAM',
    enum: ['SPAM', 'ABUSE', 'INAPPROPRIATE', 'ETC'],
    description: '신고 사유',
  })
  reason: ReportReason;

  @ApiPropertyOptional({
    example: '반복적으로 스팸 광고를 올리는 게시글입니다.',
    description: '신고 상세 내용 (최대 500자)',
  })
  description?: string;
}
