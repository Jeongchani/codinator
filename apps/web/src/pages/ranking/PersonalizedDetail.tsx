import { useMemo } from 'react';
import type { GetPersonalizedRankingsResponse, RankingPeriod } from '@codinator/contracts';
import {
  RankingDetailSheetContent,
  type PostDetailSheetData,
} from '../../components/postdetail/PostDetailBottomSheet';
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

function toSafeString(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
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

function extractAuthorNickname(item: PersonalizedItem): string {
  const raw = item as unknown as Record<string, unknown>;
  const author = isRecord(raw.author) ? raw.author : null;

  return (
    toSafeString(author?.nickname) ??
    toSafeString(author?.name) ??
    toSafeString(raw.authorNickname) ??
    toSafeString(raw.nickname) ??
    '닉네임'
  );
}

function extractContentText(item: PersonalizedItem): string {
  const raw = item as unknown as Record<string, unknown>;

  return (
    toSafeString(raw.content) ??
    toSafeString(raw.caption) ??
    toSafeString(raw.description) ??
    '코디 설명이 없습니다.'
  );
}

function extractKeywordLabels(item: PersonalizedItem): string[] {
  const raw = item as unknown as Record<string, unknown>;
  const candidates = [raw.keywords, raw.keywordLabels, raw.tags, raw.postKeywords];
  const labels: string[] = [];

  candidates.forEach((candidate) => {
    if (!Array.isArray(candidate)) return;

    candidate.forEach((keyword) => {
      if (typeof keyword === 'string' && keyword.trim()) {
        labels.push(keyword.trim());
        return;
      }

      if (!isRecord(keyword)) return;

      const label =
        toSafeString(keyword.label) ??
        toSafeString(keyword.name) ??
        toSafeString(keyword.keyword) ??
        toSafeString(keyword.keywordLabel);

      if (label) labels.push(label);
    });
  });

  return [...new Set(labels)].slice(0, 5);
}

function extractOutfitItems(item: PersonalizedItem): PostDetailSheetData['outfitItems'] {
  const raw = item as unknown as Record<string, unknown>;

  if (!Array.isArray(raw.outfitItems)) return [];

  return raw.outfitItems as PostDetailSheetData['outfitItems'];
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

function buildPersonalizedFallbackData(item: PersonalizedItem): PostDetailSheetData {
  const raw = item as unknown as Record<string, unknown>;
  const likeCount = toSafeNumber(raw.likeCount) ?? 0;
  const dislikeCount = toSafeNumber(raw.dislikeCount) ?? 0;
  const totalCountFromResponse = toSafeNumber(raw.totalCount);
  const totalCount = totalCountFromResponse ?? likeCount + dislikeCount;
  const rawLikeRate = toSafeNumber(raw.likeRate) ?? toSafeNumber(raw.likeRatio);
  const likePercent =
    totalCount > 0
      ? Math.round((likeCount / totalCount) * 100)
      : rawLikeRate !== null
        ? Math.round(rawLikeRate <= 1 ? rawLikeRate * 100 : rawLikeRate)
        : 0;
  const safeLikePercent = Math.min(Math.max(likePercent, 0), 100);

  return {
    postId: item.postId,
    authorUserId: extractAuthorUserId(item),
    authorNickname: extractAuthorNickname(item),
    contentText: extractContentText(item),
    keywordChips: extractKeywordLabels(item),
    likeCount,
    dislikeCount,
    totalCount,
    likePercent: safeLikePercent,
    dislikePercent: totalCount > 0 || rawLikeRate !== null ? 100 - safeLikePercent : 0,
    structuredFeedback: {
      likeRows: [],
      dislikeRows: [],
    },
    outfitItems: extractOutfitItems(item),
  };
}

export default function PersonalizedDetail({ item, hideFeedLink = false }: Props) {
  const fallbackData = useMemo(() => (item ? buildPersonalizedFallbackData(item) : null), [item]);

  if (!item || !fallbackData) {
    return (
      <div className={detailStyles.sheetContent}>개인화 상세 데이터를 불러올 수 없습니다.</div>
    );
  }

  const authorUserId = extractAuthorUserId(item);
  const period = authorUserId ? extractRankingPeriod(item) : undefined;

  return (
    <RankingDetailSheetContent
      postId={item.postId}
      authorUserId={authorUserId}
      {...(period ? { period } : {})}
      initialData={fallbackData}
      hideFeedLink={hideFeedLink || !authorUserId}
    />
  );
}
