import { BadRequestException } from '@nestjs/common';
import type { RankingPeriod } from '@codinator/contracts';

const RANKING_PERIOD_SET = new Set<RankingPeriod>(['WEEKLY', 'MONTHLY']);

export function validateRankingPeriod(
  period: string | undefined,
  fieldName = 'period',
): asserts period is RankingPeriod {
  if (!period || !RANKING_PERIOD_SET.has(period as RankingPeriod)) {
    throw new BadRequestException(`${fieldName}은 WEEKLY 또는 MONTHLY 여야 합니다.`);
  }
}
