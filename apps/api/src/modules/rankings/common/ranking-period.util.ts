import { BadRequestException } from '@nestjs/common';
import { RankingPeriod } from '@codinator/contracts';

const RANKING_PERIOD_SET = new Set<RankingPeriod>([
  RankingPeriod.WEEKLY,
  RankingPeriod.MONTHLY,
]);

export function validateRankingPeriod(period: RankingPeriod): void {
  if (!RANKING_PERIOD_SET.has(period)) {
    throw new BadRequestException(`Invalid ranking period: ${period}`);
  }
}