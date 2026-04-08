import { ApiPropertyOptional } from '@nestjs/swagger';

export class ListReportsQueryDto {
  @ApiPropertyOptional({
    description: '신고 상태 필터 (생략 시 전체 조회)',
    enum: ['PENDING', 'RESOLVED', 'REJECTED'],
    example: 'PENDING',
  })
  status?: 'PENDING' | 'RESOLVED' | 'REJECTED';

  @ApiPropertyOptional({
    description: '커서 페이지네이션 — 마지막 항목의 reportId',
    example: 10,
    type: Number,
  })
  cursor?: number;

  @ApiPropertyOptional({
    description: '한 페이지 최대 개수 (기본 20, 최대 100)',
    example: 20,
    type: Number,
  })
  limit?: number;
}
