import { ApiPropertyOptional } from '@nestjs/swagger';

export class GetBookmarksQueryDto {
  @ApiPropertyOptional({
    example: 42,
    description: '직전 페이지 마지막 bookmarkId (커서). 생략 시 첫 페이지',
    type: Number,
  })
  cursor?: number;

  @ApiPropertyOptional({
    example: 20,
    description: '한 번에 가져올 개수 (기본 20, 최대 50)',
    type: Number,
  })
  limit?: number;
}
