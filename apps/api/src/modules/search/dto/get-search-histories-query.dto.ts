import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsInt, IsOptional, Min } from 'class-validator'; // V3 Batch9: class-validator 추가
import { Type } from 'class-transformer'; // V3 Batch9: 쿼리 파라미터 숫자 변환

/** GET /users/me/search-histories query DTO — V3 Batch8 / Batch9 보정 */
export class GetSearchHistoriesQueryDto {
  @ApiPropertyOptional({
    enum: ['TEXT', 'IMAGE'],
    description: '검색 타입 필터. 생략 시 TEXT/IMAGE 모두 반환',
    example: 'TEXT',
  })
  @IsOptional()
  @IsEnum(['TEXT', 'IMAGE'], { message: 'searchType은 TEXT 또는 IMAGE 중 하나여야 합니다.' }) // V3 Batch9: 유효하지 않은 값이 Prisma까지 도달하는 문제 방지
  searchType?: 'TEXT' | 'IMAGE';

  @ApiPropertyOptional({
    type: Number,
    description: '직전 페이지 마지막 historyId (커서). 생략 시 첫 페이지',
    example: 42,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt({ message: 'cursor는 정수여야 합니다.' })
  @Min(1, { message: 'cursor는 1 이상이어야 합니다.' })
  cursor?: number;

  @ApiPropertyOptional({
    type: Number,
    description: '페이지 크기 (기본 20, 최대 50)',
    example: 20,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt({ message: 'limit는 정수여야 합니다.' })
  @Min(1, { message: 'limit는 1 이상이어야 합니다.' })
  limit?: number;
}
