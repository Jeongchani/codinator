import { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import type { GetPersonalizedRankingsResponse } from '@codinator/contracts';
import {
  PostDetailBottomSheetContent,
  type PostDetailSheetData,
} from '../../components/postdetail/PostDetailBottomSheet';
import detailStyles from './RankingDetail.module.css';

type PersonalizedItem = GetPersonalizedRankingsResponse['items'][number];

type Props = {
  item: PersonalizedItem | null;
  hideFeedLink?: boolean;
};

type StructuredFeedbackRow = PostDetailSheetData['structuredFeedback']['likeRows'][number];

function toSafeNumber(value: unknown): number {
  if (typeof value === 'number' && Number.isFinite(value)) return value;

  if (typeof value === 'string') {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) return parsed;
  }

  return 0;
}

function toSafeText(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

function clampPercent(value: number) {
  return Math.min(Math.max(value, 0), 100);
}

function normalizeVoteChoice(value: unknown): 'LIKE' | 'DISLIKE' | null {
  const text = String(value ?? '').toUpperCase();

  if (text.includes('DISLIKE') || text.includes('NEGATIVE')) return 'DISLIKE';
  if (text.includes('LIKE') && !text.includes('UNLIKE')) return 'LIKE';

  return null;
}

function buildStructuredFeedback(
  item: PersonalizedItem,
): PostDetailSheetData['structuredFeedback'] {
  const feedbackSummary = Array.isArray(item.feedbackSummary) ? item.feedbackSummary : [];
  const likeRows: StructuredFeedbackRow[] = [];
  const dislikeRows: StructuredFeedbackRow[] = [];
  let likeTotal = 0;
  let dislikeTotal = 0;

  feedbackSummary.forEach((feedback) => {
    const label = toSafeText(feedback.label);
    const side = normalizeVoteChoice(feedback.voteChoice);
    const count = toSafeNumber(feedback.count);

    if (!label || !side || count <= 0) return;

    const row = {
      label,
      count,
      percent: 0,
      side,
    } satisfies StructuredFeedbackRow;

    if (side === 'LIKE') {
      likeRows.push(row);
      likeTotal += count;
      return;
    }

    dislikeRows.push(row);
    dislikeTotal += count;
  });

  return {
    likeRows: likeRows
      .sort((a, b) => b.count - a.count)
      .slice(0, 5)
      .map((row) => ({
        ...row,
        percent: likeTotal > 0 ? Math.round((row.count / likeTotal) * 100) : 0,
      })),
    dislikeRows: dislikeRows
      .sort((a, b) => b.count - a.count)
      .slice(0, 5)
      .map((row) => ({
        ...row,
        percent: dislikeTotal > 0 ? Math.round((row.count / dislikeTotal) * 100) : 0,
      })),
  };
}

function buildPersonalizedSheetData(item: PersonalizedItem): PostDetailSheetData {
  const likeCount = toSafeNumber(item.likeCount);
  const dislikeCount = toSafeNumber(item.dislikeCount);
  const responseTotalCount = toSafeNumber(item.totalCount);
  const totalCount = responseTotalCount > 0 ? responseTotalCount : likeCount + dislikeCount;
  const rawLikeRate = toSafeNumber(item.likeRate);

  const likePercent =
    totalCount > 0
      ? Math.round((likeCount / totalCount) * 100)
      : rawLikeRate > 0
        ? Math.round(rawLikeRate <= 1 ? rawLikeRate * 100 : rawLikeRate)
        : 0;
  const safeLikePercent = clampPercent(likePercent);

  return {
    postId: item.postId,
    authorUserId: item.author?.userId ?? null,
    authorNickname: toSafeText(item.author?.nickname) || '닉네임',
    contentText: toSafeText(item.content) || '코디 설명이 없습니다.',
    keywordChips: (Array.isArray(item.keywords) ? item.keywords : [])
      .map((keyword) => toSafeText(keyword.label))
      .filter(Boolean)
      .slice(0, 5),
    likeCount,
    dislikeCount,
    totalCount,
    likePercent: safeLikePercent,
    dislikePercent: totalCount > 0 || rawLikeRate > 0 ? 100 - safeLikePercent : 0,
    structuredFeedback: buildStructuredFeedback(item),
    outfitItems: (Array.isArray(item.outfitItems)
      ? item.outfitItems
      : []) as PostDetailSheetData['outfitItems'],
  };
}

export default function PersonalizedDetail({ item, hideFeedLink = false }: Props) {
  const navigate = useNavigate();
  const sheetData = useMemo(() => (item ? buildPersonalizedSheetData(item) : null), [item]);

  if (!item || !sheetData) {
    return (
      <div className={detailStyles.sheetContent}>개인화 상세 데이터를 불러올 수 없습니다.</div>
    );
  }

  const handleGoToUserFeed = () => {
    if (!sheetData.authorUserId) {
      window.alert('유저 정보를 찾을 수 없습니다.');
      return;
    }

    navigate(`/user/${sheetData.authorUserId}/feed`);
  };

  return (
    <PostDetailBottomSheetContent
      data={sheetData}
      loading={false}
      hideFeedLink={hideFeedLink || !sheetData.authorUserId}
      onGoToUserFeed={handleGoToUserFeed}
    />
  );
}
