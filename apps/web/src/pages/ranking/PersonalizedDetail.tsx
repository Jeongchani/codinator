import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import type { GetPersonalizedRankingsResponse } from '@codinator/contracts';
import {
  clearAuthTokens,
  fetchMyBookmarkMap,
  isAuthError,
  subscribeBookmarkUpdated,
  togglePostBookmark,
} from '../../lib/api';
import { PostDetailBottomSheetContent } from '../../components/postdetail/PostDetailBottomSheet';
import styles from './PersonalizedDetail.module.css';

type PersonalizedItem = GetPersonalizedRankingsResponse['items'][number];

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function toSafeString(value: unknown): string | undefined {
  if (typeof value !== 'string') return undefined;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

function toSafeNumber(value: unknown): number | undefined {
  if (typeof value === 'number' && Number.isFinite(value)) return value;

  if (typeof value === 'string') {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) return parsed;
  }

  return undefined;
}

function normalizeVoteChoice(value: unknown): 'LIKE' | 'DISLIKE' | undefined {
  const text = String(value ?? '').toUpperCase();
  if (text.includes('LIKE') && !text.includes('DISLIKE') && !text.includes('UNLIKE')) {
    return 'LIKE';
  }
  if (text.includes('DISLIKE') || text.includes('NEGATIVE')) return 'DISLIKE';
  return undefined;
}

function formatKeywordLabel(keyword: string) {
  return keyword.startsWith('#') ? keyword : `#${keyword}`;
}

function extractKeywordLabels(item: PersonalizedItem | null): string[] {
  if (!item) return [];
  const raw = item as unknown as Record<string, unknown>;
  const candidates = [raw.keywords, raw.keywordLabels, raw.tags, raw.postKeywords];
  const labels: string[] = [];

  candidates.forEach((candidate) => {
    if (!Array.isArray(candidate)) return;
    candidate.forEach((entry) => {
      if (typeof entry === 'string' && entry.trim()) {
        labels.push(formatKeywordLabel(entry.trim()));
        return;
      }

      if (isRecord(entry)) {
        const label =
          toSafeString(entry.label) ??
          toSafeString(entry.name) ??
          toSafeString(entry.keyword) ??
          toSafeString(entry.keywordLabel);

        if (label) labels.push(formatKeywordLabel(label));
      }
    });
  });

  return [...new Set(labels)].slice(0, 5);
}

function extractStructuredFeedback(item: PersonalizedItem | null) {
  if (!item) {
    return {
      likeRows: [] as Array<{
        label: string;
        count: number;
        percent: number;
        side: 'LIKE' | 'DISLIKE';
      }>,
      dislikeRows: [] as Array<{
        label: string;
        count: number;
        percent: number;
        side: 'LIKE' | 'DISLIKE';
      }>,
    };
  }

  const raw = item as unknown as Record<string, unknown>;
  const summary = Array.isArray(raw.feedbackSummary) ? raw.feedbackSummary : [];

  const parsedRows = summary
    .map((entry) => {
      if (!isRecord(entry)) return null;

      const label =
        toSafeString(entry.label) ??
        toSafeString(entry.name) ??
        toSafeString(entry.keyword) ??
        toSafeString(entry.feedbackLabel);

      const side =
        normalizeVoteChoice(entry.voteChoice) ??
        normalizeVoteChoice(entry.side) ??
        normalizeVoteChoice(entry.type);

      const count =
        toSafeNumber(entry.count) ??
        toSafeNumber(entry.totalCount) ??
        toSafeNumber(entry.voteCount) ??
        0;

      if (!label || !side || count <= 0) return null;
      return { label, count, side };
    })
    .filter(
      (
        entry,
      ): entry is {
        label: string;
        count: number;
        side: 'LIKE' | 'DISLIKE';
      } => Boolean(entry),
    );

  const likeList = parsedRows.filter((entry) => entry.side === 'LIKE');
  const dislikeList = parsedRows.filter((entry) => entry.side === 'DISLIKE');
  const likeTotal = likeList.reduce((sum, entry) => sum + entry.count, 0);
  const dislikeTotal = dislikeList.reduce((sum, entry) => sum + entry.count, 0);

  return {
    likeRows: likeList.slice(0, 5).map((entry) => ({
      ...entry,
      percent: likeTotal > 0 ? Math.round((entry.count / likeTotal) * 100) : 0,
    })),
    dislikeRows: dislikeList.slice(0, 5).map((entry) => ({
      ...entry,
      percent: dislikeTotal > 0 ? Math.round((entry.count / dislikeTotal) * 100) : 0,
    })),
  };
}

function buildPersonalizedSheetData(item: PersonalizedItem | null) {
  if (!item) return null;

  const raw = item as unknown as Record<string, unknown>;
  const voteSummary = isRecord(raw.voteSummary) ? raw.voteSummary : null;

  const likeCount = toSafeNumber(raw.likeCount) ?? toSafeNumber(voteSummary?.likeCount) ?? 0;
  const dislikeCount =
    toSafeNumber(raw.dislikeCount) ?? toSafeNumber(voteSummary?.dislikeCount) ?? 0;
  const totalCount = likeCount + dislikeCount;
  const likePercent = totalCount > 0 ? Math.round((likeCount / totalCount) * 100) : 0;
  const dislikePercent = totalCount > 0 ? 100 - likePercent : 0;

  const author = isRecord(raw.author) ? raw.author : null;
  const authorUserId =
    toSafeNumber(author?.userId) ??
    toSafeNumber(author?.id) ??
    toSafeNumber(raw.authorUserId) ??
    toSafeNumber(raw.userId) ??
    null;

  const authorNickname =
    toSafeString(author?.nickname) ??
    toSafeString(author?.name) ??
    toSafeString(raw.authorNickname) ??
    toSafeString(raw.nickname) ??
    '닉네임';

  const contentText =
    toSafeString(raw.content) ??
    toSafeString(raw.description) ??
    toSafeString(raw.caption) ??
    '개인화 추천 게시글입니다.';

  return {
    postId: item.postId,
    authorUserId,
    authorNickname,
    contentText,
    keywordChips: extractKeywordLabels(item),
    likeCount,
    dislikeCount,
    totalCount,
    likePercent,
    dislikePercent,
    structuredFeedback: extractStructuredFeedback(item),
    outfitItems: [] as [],
  };
}

type Props = {
  item: PersonalizedItem | null;
  hideFeedLink?: boolean;
};

export default function PersonalizedDetail({ item, hideFeedLink = false }: Props) {
  const navigate = useNavigate();
  const [isBookmarked, setIsBookmarked] = useState(false);
  const [bookmarkLoading, setBookmarkLoading] = useState(false);

  const activePostId = item?.postId ?? null;
  const sheetData = useMemo(() => buildPersonalizedSheetData(item), [item]);

  useEffect(() => {
    let cancelled = false;

    const loadBookmarks = async () => {
      if (!activePostId) {
        setIsBookmarked(false);
        return;
      }

      try {
        const bookmarkMap = await fetchMyBookmarkMap();
        if (cancelled) return;
        setIsBookmarked(Boolean(bookmarkMap[activePostId]));
      } catch (err) {
        const message = err instanceof Error ? err.message : '북마크 정보를 불러오지 못했습니다.';
        if (isAuthError(message)) {
          clearAuthTokens();
          navigate('/login', { replace: true });
        }
      }
    };

    void loadBookmarks();
    return () => {
      cancelled = true;
    };
  }, [activePostId, navigate]);

  useEffect(() => {
    if (!activePostId) return;

    const unsubscribe = subscribeBookmarkUpdated((detail) => {
      if (!detail || detail.postId !== activePostId) return;
      setIsBookmarked(detail.bookmarked);
    });

    return unsubscribe;
  }, [activePostId]);

  const handleToggleBookmark = async (e: React.MouseEvent<HTMLButtonElement>) => {
    e.stopPropagation();
    if (!activePostId || bookmarkLoading) return;

    const previous = isBookmarked;
    setBookmarkLoading(true);
    setIsBookmarked(!previous);

    try {
      const nextValue = await togglePostBookmark(activePostId, previous);
      setIsBookmarked(nextValue);
    } catch (err) {
      const message = err instanceof Error ? err.message : '북마크 처리에 실패했습니다.';
      setIsBookmarked(previous);

      if (isAuthError(message)) {
        clearAuthTokens();
        navigate('/login', { replace: true });
        return;
      }

      window.alert(message);
    } finally {
      setBookmarkLoading(false);
    }
  };

  const handleGoToUserFeed = () => {
    const authorUserId = sheetData?.authorUserId;
    if (!authorUserId) {
      window.alert('유저 정보를 찾을 수 없습니다.');
      return;
    }
    navigate(`/user/${authorUserId}/feed`);
  };

  if (!item) {
    return (
      <div className={styles.root}>
        <div className={styles.emptyShell}>
          <div className={styles.emptyCard}>개인화 상세 데이터를 불러올 수 없습니다.</div>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.root}>
      <PostDetailBottomSheetContent
        data={sheetData}
        loading={false}
        hideFeedLink={hideFeedLink || !sheetData?.authorUserId}
        isBookmarked={isBookmarked}
        bookmarkLoading={bookmarkLoading}
        onToggleBookmark={handleToggleBookmark}
        onGoToUserFeed={handleGoToUserFeed}
      />
    </div>
  );
}
