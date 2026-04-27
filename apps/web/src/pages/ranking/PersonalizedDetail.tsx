import type { GetPersonalizedRankingsResponse, RankingPeriod } from '@codinator/contracts';
import { RankingDetailSheetContent } from '../../components/postdetail/PostDetailBottomSheet';
import detailStyles from './RankingDetail.module.css';

type PersonalizedItem = GetPersonalizedRankingsResponse['items'][number];

type Props = {
  item: PersonalizedItem | null;
  hideFeedLink?: boolean;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function toSafeNumber(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) return value;

  if (typeof value === 'string') {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) return parsed;
  }

  return null;
}

function normalizeRankingPeriod(value: unknown): RankingPeriod | null {
  const text = String(value ?? '').toUpperCase();

  if (text === 'WEEKLY') return 'WEEKLY';
  if (text === 'MONTHLY') return 'MONTHLY';

  return null;
}

function extractAuthorUserId(item: PersonalizedItem): number | null {
  const raw = item as unknown as Record<string, unknown>;
  const author = isRecord(raw.author) ? raw.author : null;

  return (
    toSafeNumber(author?.userId) ??
    toSafeNumber(author?.id) ??
    toSafeNumber(raw.authorUserId) ??
    toSafeNumber(raw.userId)
  );
}

function extractRankingPeriod(item: PersonalizedItem): RankingPeriod | undefined {
  const raw = item as unknown as Record<string, unknown>;
  const candidates = [raw.rankingPeriod, raw.period, raw.primaryPeriod];

  for (const candidate of candidates) {
    const period = normalizeRankingPeriod(candidate);
    if (period) return period;
  }

  const arrayCandidates = [raw.rankingPeriods, raw.periods];

  for (const candidate of arrayCandidates) {
    if (!Array.isArray(candidate)) continue;

    const weekly = candidate.some((value) => normalizeRankingPeriod(value) === 'WEEKLY');
    if (weekly) return 'WEEKLY';

    const monthly = candidate.some((value) => normalizeRankingPeriod(value) === 'MONTHLY');
    if (monthly) return 'MONTHLY';
  }

  return undefined;
}

export default function PersonalizedDetail({ item, hideFeedLink = false }: Props) {
  if (!item) {
    return <div className={detailStyles.sheetContent}>개인화 상세 데이터를 불러올 수 없습니다.</div>;
  }

  return (
    <RankingDetailSheetContent
      postId={item.postId}
      authorUserId={extractAuthorUserId(item)}
      period={extractRankingPeriod(item)}
      hideFeedLink={hideFeedLink}
    />
  );
}
