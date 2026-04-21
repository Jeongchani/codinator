import { ApiPropertyOptional } from '@nestjs/swagger';

export class GetEvaluationHistoryQueryDto {
  @ApiPropertyOptional({
    example: 50,
    description: '직전 페이지 마지막 voteId (커서). 생략 시 첫 페이지',
    type: Number,
  })
  cursor?: number;

  @ApiPropertyOptional({
    example: 10,
    description: '한 번에 가져올 개수 (기본 10, 최대 30)',
    type: Number,
  })
  limit?: number;
}
