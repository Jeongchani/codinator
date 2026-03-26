import { ApiProperty } from '@nestjs/swagger';
import type { RankingPeriod } from '@codinator/contracts';

export class GetRankingPostQueryDto {
  @ApiProperty({
    example: 'WEEKLY',
    enum: ['WEEKLY', 'MONTHLY'],
    description: '조회할 랭킹 기간',
  })
  period: RankingPeriod;
}
