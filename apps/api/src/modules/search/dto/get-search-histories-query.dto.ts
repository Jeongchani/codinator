import { ApiPropertyOptional } from '@nestjs/swagger';

/** GET /users/me/search-histories query DTO — V3 Batch8 */
export class GetSearchHistoriesQueryDto {
  @ApiPropertyOptional({
    enum: ['TEXT', 'IMAGE'],
    description: '검색 타입 필터. 생략 시 TEXT/IMAGE 모두 반환',
    example: 'TEXT',
  })
  searchType?: 'TEXT' | 'IMAGE';

  @ApiPropertyOptional({
    type: Number,
    description: '직전 페이지 마지막 historyId (커서). 생략 시 첫 페이지',
    example: 42,
  })
  cursor?: number;

  @ApiPropertyOptional({
    type: Number,
    description: '페이지 크기 (기본 20, 최대 50)',
    example: 20,
  })
  limit?: number;
}
