import { ApiPropertyOptional } from '@nestjs/swagger';

export class GetEvaluationsQueryDto {
  @ApiPropertyOptional({ example: 0, description: '마지막으로 본 evaluationId 커서' })
  cursor?: number;

  @ApiPropertyOptional({ example: 10, description: '가져올 개수(기본 10, 최대 30)' })
  limit?: number;
}
