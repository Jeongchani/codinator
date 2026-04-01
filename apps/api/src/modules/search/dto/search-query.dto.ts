import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import type { SearchRequest, SearchType } from '@codinator/contracts';

export class SearchQueryDto implements SearchRequest {
  @ApiProperty({
    description: '검색어 (1자 이상, 최대 100자)',
    example: '블랙',
    minLength: 1,
    maxLength: 100,
  })
  q!: string;

  @ApiPropertyOptional({
    description: '검색 타입. 생략 또는 ALL이면 통합 검색',
    enum: ['ALL', 'NICKNAME', 'KEYWORD', 'POST'],
    example: 'ALL',
  })
  type?: SearchType;

  @ApiPropertyOptional({
    description: '단일 타입 검색용 커서. ALL 검색은 미지원',
    example: 50,
    type: Number,
  })
  cursor?: number;

  @ApiPropertyOptional({
    description: '페이지 크기 (기본 20, 최대 50)',
    example: 20,
    type: Number,
  })
  limit?: number;
}