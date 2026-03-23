import type { RankingPeriod } from '@codinator/contracts';

const KST_OFFSET_MS = 9 * 60 * 60 * 1000;
const MS_PER_DAY = 24 * 60 * 60 * 1000;

export type RankingWindow = {
  period: RankingPeriod;
  timezone: 'Asia/Seoul';
  startDate: Date;
  endDate: Date;
  rangeStartUtc: Date;
  rangeEndExclusiveUtc: Date;
};

function toKstDateParts(date: Date): {
  year: number;
  month: number;
  day: number;
  weekday: number;
} {
  const kstDate = new Date(date.getTime() + KST_OFFSET_MS);

  return {
    year: kstDate.getUTCFullYear(),
    month: kstDate.getUTCMonth(),
    day: kstDate.getUTCDate(),
    weekday: kstDate.getUTCDay(),
  };
}

function createDateField(year: number, month: number, day: number): Date {
  return new Date(Date.UTC(year, month, day));
}

function toUtcAtKstMidnight(dateField: Date): Date {
  return new Date(dateField.getTime() - KST_OFFSET_MS);
}

export function getCurrentRankingWindow(period: RankingPeriod, now = new Date()): RankingWindow {
  const { year, month, day, weekday } = toKstDateParts(now);

  if (period === 'WEEKLY') {
    const diff = weekday === 0 ? 6 : weekday - 1;
    const startDate = createDateField(year, month, day - diff);
    const endDate = createDateField(year, month, day - diff + 6);

    return {
      period,
      timezone: 'Asia/Seoul',
      startDate,
      endDate,
      rangeStartUtc: toUtcAtKstMidnight(startDate),
      rangeEndExclusiveUtc: new Date(toUtcAtKstMidnight(endDate).getTime() + MS_PER_DAY),
    };
  }

  const startDate = createDateField(year, month, 1);
  const endDate = createDateField(year, month + 1, 0);

  return {
    period,
    timezone: 'Asia/Seoul',
    startDate,
    endDate,
    rangeStartUtc: toUtcAtKstMidnight(startDate),
    rangeEndExclusiveUtc: toUtcAtKstMidnight(createDateField(year, month + 1, 1)),
  };
}

export function getAllCurrentRankingWindows(now = new Date()): RankingWindow[] {
  return [getCurrentRankingWindow('WEEKLY', now), getCurrentRankingWindow('MONTHLY', now)];
}