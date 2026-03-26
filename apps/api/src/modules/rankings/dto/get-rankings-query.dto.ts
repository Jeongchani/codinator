import { ApiProperty } from '@nestjs/swagger';
import type { RankingPeriod } from '@codinator/contracts';

export class GetRankingsQueryDto {
  @ApiProperty({
    example: 'WEEKLY',
    enum: ['WEEKLY', 'MONTHLY'],
    description: '조회할 랭킹 기간',
  })
  period: RankingPeriod;
}
