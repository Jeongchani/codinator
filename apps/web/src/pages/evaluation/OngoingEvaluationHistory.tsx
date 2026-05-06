import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { EvaluationHistoryItem } from '@codinator/contracts';
import { ThumbsDown, ThumbsUp } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

import evaluationHistoryBanner from '../../assets/evaluation/evaluation-history-banner.png';
import {
  clearAuthTokens,
  fetchAllMyEvaluationHistory,
  fetchMyBookmarkMap,
  isAuthError,
  resolveAssetUrl,
  subscribeBookmarkUpdated,
  togglePostBookmark,
} from '../../lib/api';
import Header from '../../components/Header';
import FocusScreen, { type FocusScreenItem } from '../../components/focus/FocusScreen';
import PostDetailBottomSheet from '../../components/postdetail/PostDetailBottomSheet';
import EvaluationDetailFeedback from './EvaluationDetailFeedback';
import styles from './OngoingEvaluationHistory.module.css';

type HistoryCardItem = EvaluationHistoryItem & {
  imageUrl: string;
  groupLabel: string;
  sortTimestamp: number;
  authorUserId?: number | string | null;
  authorDisplayText?: string | null;
};

type HistoryGroup = {
  label: string;
  items: HistoryCardItem[];
};

type ReportAuthorTarget = {
  userId: number | string;
  displayText: string;
};

const DAY_IN_MS = 1000 * 60 * 60 * 24;
const WEEKDAY_LABELS = ['일요일', '월요일', '화요일', '수요일', '목요일', '금요일', '토요일'];

function getStartOfDay(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function formatChoiceLabel(choice: EvaluationHistoryItem['myChoice']) {
  return choice === 'LIKE' ? '좋아요' : '싫어요';
}

function formatChoiceClassName(choice: EvaluationHistoryItem['myChoice']) {
  return choice === 'LIKE' ? styles.choiceBadgeLike : styles.choiceBadgeDislike;
}

function getGroupLabel(isoString: string) {
  const votedAt = new Date(isoString);

  if (Number.isNaN(votedAt.getTime())) {
    return '기타';
  }

  const today = getStartOfDay(new Date());
  const targetDay = getStartOfDay(votedAt);
  const diffDays = Math.round((today.getTime() - targetDay.getTime()) / DAY_IN_MS);

  if (diffDays === 0) return '오늘';
  if (diffDays === 1) return '어제';
  if (diffDays >= 2 && diffDays <= 7) return `${diffDays}일 전`;

  return WEEKDAY_LABELS[votedAt.getDay()] ?? '기타';
}

function getFallbackVoteSummary(choice: EvaluationHistoryItem['myChoice']) {
  if (choice === 'LIKE') {
    return { likePercent: 100, dislikePercent: 0 };
  }

  return { likePercent: 0, dislikePercent: 100 };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function toReportTargetId(value: unknown): number | string | null {
  if (typeof value === 'number' && Number.isFinite(value)) return value;

  if (typeof value === 'string') {
    const trimmed = value.trim();
    return trimmed.length > 0 ? trimmed : null;
  }

  return null;
}

function getStringValue(value: unknown): string | null {
  if (typeof value !== 'string') return null;

  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function extractReportAuthorTarget(value: unknown): ReportAuthorTarget | null {
  const records: Record<string, unknown>[] = [];

  if (isRecord(value)) {
    records.push(value);

    const nestedCandidates = [
      value.author,
      value.user,
      value.writer,
      value.owner,
      value.creator,
      value.createdBy,
      value.authorInfo,
    ];

    nestedCandidates.forEach((candidate) => {
      if (isRecord(candidate)) records.push(candidate);
    });
  }

  for (const record of records) {
    const userId =
      toReportTargetId(record.userId) ??
      toReportTargetId(record.authorUserId) ??
      toReportTargetId(record.authorId) ??
      toReportTargetId(record.id) ??
      toReportTargetId(record.writerId) ??
      toReportTargetId(record.ownerId) ??
      toReportTargetId(record.createdById);

    if (userId === null) continue;

    const displayText =
      getStringValue(record.nickname) ??
      getStringValue(record.name) ??
      getStringValue(record.displayName) ??
      getStringValue(record.username) ??
      getStringValue(record.email) ??
      '사용자';

    return { userId, displayText };
  }

  return null;
}

export default function OngoingEvaluationHistory() {
  const navigate = useNavigate();
  const [items, setItems] = useState<EvaluationHistoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [focusedPostId, setFocusedPostId] = useState<number | null>(null);
  const [detailSheetOpen, setDetailSheetOpen] = useState(false);
  const [bookmarks, setBookmarks] = useState<Record<number, boolean>>({});
  const [bookmarkLoadingIds, setBookmarkLoadingIds] = useState<number[]>([]);

  const sheetContentRef = useRef<HTMLDivElement | null>(null);

  const moveToLogin = useCallback(() => {
    clearAuthTokens();
    navigate('/login', { replace: true });
  }, [navigate]);

  const loadBookmarks = useCallback(async () => {
    try {
      const nextMap = await fetchMyBookmarkMap();
      setBookmarks(nextMap);
    } catch (err) {
      const message = err instanceof Error ? err.message : '북마크 정보를 불러오지 못했습니다.';
      if (isAuthError(message)) moveToLogin();
    }
  }, [moveToLogin]);

  useEffect(() => {
    void loadBookmarks();
  }, [loadBookmarks]);

  useEffect(() => {
    const unsubscribe = subscribeBookmarkUpdated((detail) => {
      if (!detail) {
        void loadBookmarks();
        return;
      }

      setBookmarks((prev) => ({
        ...prev,
        [detail.postId]: detail.bookmarked,
      }));
    });

    return unsubscribe;
  }, [loadBookmarks]);

  const toggleBookmarkByPostId = async (postId: number) => {
    if (bookmarkLoadingIds.includes(postId)) return;

    const isBookmarked = Boolean(bookmarks[postId]);
    setBookmarkLoadingIds((prev) => [...prev, postId]);
    setBookmarks((prev) => ({ ...prev, [postId]: !isBookmarked }));

    try {
      const nextValue = await togglePostBookmark(postId, isBookmarked);
      setBookmarks((prev) => ({ ...prev, [postId]: nextValue }));
    } catch (err) {
      const message = err instanceof Error ? err.message : '북마크 처리에 실패했습니다.';
      setBookmarks((prev) => ({ ...prev, [postId]: isBookmarked }));

      if (isAuthError(message)) {
        moveToLogin();
        return;
      }

      window.alert(message);
    } finally {
      setBookmarkLoadingIds((prev) => prev.filter((id) => id !== postId));
    }
  };

  const loadHistory = useCallback(
    async (showInitialLoading = false) => {
      if (showInitialLoading) {
        setLoading(true);
      }

      setError('');

      try {
        const loadedItems = await fetchAllMyEvaluationHistory();
        setItems(loadedItems);
      } catch (err) {
        const message =
          err instanceof Error ? err.message : '진행중인 평가 기록을 불러오지 못했습니다.';

        if (isAuthError(message)) {
          moveToLogin();
          return;
        }

        setError(message);
      } finally {
        if (showInitialLoading) {
          setLoading(false);
        }
      }
    },
    [moveToLogin],
  );

  useEffect(() => {
    void loadHistory(true);
  }, [loadHistory]);

  const groupedItems = useMemo<HistoryGroup[]>(() => {
    const normalizedItems: HistoryCardItem[] = items
      .map((item) => {
        const sortTimestamp = new Date(item.votedAt).getTime();
        const authorTarget = extractReportAuthorTarget(item as unknown);

        return {
          ...item,
          imageUrl: resolveAssetUrl(item.thumbnailUrl),
          groupLabel: getGroupLabel(item.votedAt),
          sortTimestamp: Number.isNaN(sortTimestamp) ? 0 : sortTimestamp,
          authorUserId: authorTarget?.userId ?? null,
          authorDisplayText: authorTarget?.displayText ?? null,
        };
      })
      .sort((a, b) => b.sortTimestamp - a.sortTimestamp);

    const groups: HistoryGroup[] = [];

    normalizedItems.forEach((item) => {
      const lastGroup = groups[groups.length - 1];

      if (!lastGroup || lastGroup.label !== item.groupLabel) {
        groups.push({ label: item.groupLabel, items: [item] });
        return;
      }

      lastGroup.items.push(item);
    });

    return groups;
  }, [items]);

  const flatItems = useMemo(() => groupedItems.flatMap((group) => group.items), [groupedItems]);

  const focusItems = useMemo<FocusScreenItem[]>(
    () =>
      flatItems.map((item) => ({
        id: item.postId,
        imageUrl: item.imageUrl,
        fallbackText: '이미지 없음',
        contentText: item.contentPreview,
      })),
    [flatItems],
  );

  const focusedItemIndex = useMemo(() => {
    if (focusedPostId === null) return -1;
    return flatItems.findIndex((item) => item.postId === focusedPostId);
  }, [flatItems, focusedPostId]);

  const focusedItem = focusedItemIndex >= 0 ? (flatItems[focusedItemIndex] ?? null) : null;

  const handleFocusActiveIndexChange = useCallback(
    (nextIndex: number) => {
      const nextItem = flatItems[nextIndex];
      if (!nextItem) return;

      setFocusedPostId(nextItem.postId);
      setDetailSheetOpen(false);
    },
    [flatItems],
  );

  const focusedReportAuthor =
    focusedItem && focusedItem.authorUserId !== null && focusedItem.authorUserId !== undefined
      ? {
          userId: focusedItem.authorUserId,
          displayText: focusedItem.authorDisplayText?.trim() || '사용자',
        }
      : null;

  useEffect(() => {
    if (!detailSheetOpen) return;

    const handleDocumentPointerDown = (event: PointerEvent) => {
      const target = event.target;
      if (!(target instanceof Node)) return;

      const targetElement = target instanceof HTMLElement ? target : null;
      const classText = String(targetElement?.className ?? '');

      if (
        classText.includes('handlerArea') ||
        classText.includes('handlerBar') ||
        classText.includes('bottomSheet') ||
        classText.includes('sheetScrollArea')
      ) {
        return;
      }

      if (sheetContentRef.current?.contains(target)) {
        return;
      }

      setDetailSheetOpen(false);
    };

    document.addEventListener('pointerdown', handleDocumentPointerDown, true);

    return () => {
      document.removeEventListener('pointerdown', handleDocumentPointerDown, true);
    };
  }, [detailSheetOpen]);

  const handleCardClick = (item: HistoryCardItem) => {
    setFocusedPostId(item.postId);
    setDetailSheetOpen(false);
  };

  const focusedVoteSummary = useMemo(() => {
    if (!focusedItem) return { likePercent: 0, dislikePercent: 0 };
    return getFallbackVoteSummary(focusedItem.myChoice);
  }, [focusedItem]);

  return (
    <div className={styles.container}>
      <Header title="평가 기록" leftAction="back" onBack={() => navigate(-1)} />

      <section className={styles.banner} aria-label="평가기록 배너">
        <img
          src={evaluationHistoryBanner}
          alt="내가 평가한 게시물 목록 배너"
          className={styles.bannerImage}
          draggable={false}
        />
      </section>

      <main className={styles.contentArea}>
        {loading ? (
          <div className={styles.stateBox}>
            <p className={styles.stateTitle}>진행중인 평가 기록을 불러오는 중이에요.</p>
          </div>
        ) : error ? (
          <div className={styles.stateBox}>
            <p className={styles.stateTitle}>진행중인 평가 기록을 불러오지 못했어요.</p>
            <p className={styles.stateDescription}>{error}</p>
            <button
              type="button"
              className={styles.retryButton}
              onClick={() => void loadHistory(true)}
            >
              다시 시도
            </button>
          </div>
        ) : groupedItems.length === 0 ? (
          <div className={styles.emptyState}>진행중인 평가 기록이 없습니다.</div>
        ) : (
          <div className={styles.groupList}>
            {groupedItems.map((group) => (
              <section key={group.label} className={styles.groupSection} aria-label={group.label}>
                <h2 className={styles.groupTitle}>{group.label}</h2>

                <div className={styles.cardGrid}>
                  {group.items.map((item) => {
                    const ChoiceIcon = item.myChoice === 'LIKE' ? ThumbsUp : ThumbsDown;

                    return (
                      <button
                        key={item.myVoteId ?? `${item.postId}-${item.votedAt}`}
                        type="button"
                        className={styles.card}
                        onClick={() => handleCardClick(item)}
                        aria-label={`${group.label} ${formatChoiceLabel(item.myChoice)} 평가 상세 보기`}
                      >
                        {item.imageUrl ? (
                          <img
                            src={item.imageUrl}
                            alt="평가 기록 이미지"
                            className={styles.cardImage}
                            draggable={false}
                          />
                        ) : (
                          <div className={styles.cardImageFallback}>이미지 없음</div>
                        )}

                        <div className={styles.cardTopRow}>
                          <span
                            className={`${styles.choiceBadge} ${formatChoiceClassName(item.myChoice)}`}
                            aria-label={formatChoiceLabel(item.myChoice)}
                            title={formatChoiceLabel(item.myChoice)}
                          >
                            <ChoiceIcon className={styles.choiceBadgeIcon} strokeWidth={2.3} />
                          </span>
                        </div>

                        <div className={styles.cardGradient} />
                      </button>
                    );
                  })}
                </div>
              </section>
            ))}
          </div>
        )}
      </main>

      {focusedItem ? (
        <FocusScreen
          isOpen={Boolean(focusedItem)}
          items={focusItems}
          activeIndex={Math.max(focusedItemIndex, 0)}
          onActiveIndexChange={handleFocusActiveIndexChange}
          closeButtonType="back"
          onClose={() => {
            setFocusedPostId(null);
            setDetailSheetOpen(false);
          }}
          sheetOpen={detailSheetOpen}
          onCloseSheet={() => setDetailSheetOpen(false)}
          showSwipeIndicator={focusItems.length > 1}
          showVoteGraph
          likePercent={focusedVoteSummary.likePercent}
          dislikePercent={focusedVoteSummary.dislikePercent}
          showDetailButton
          detailLabel="상세보기"
          showActionCounts
          likeCount={focusedItem.myChoice === 'LIKE' ? 1 : 0}
          dislikeCount={focusedItem.myChoice === 'DISLIKE' ? 1 : 0}
          showBookmarkButton
          isBookmarked={Boolean(bookmarks[focusedItem.postId])}
          bookmarkDisabled={bookmarkLoadingIds.includes(focusedItem.postId)}
          onBookmarkClick={() => void toggleBookmarkByPostId(focusedItem.postId)}
          reportPostId={focusedItem.postId}
          reportDisplayText={focusedItem.contentPreview}
          reportAuthorUserId={focusedReportAuthor?.userId ?? null}
          reportAuthorDisplayText={focusedReportAuthor?.displayText ?? null}
          selectedVote={focusedItem.myChoice}
          contentText={focusedItem.contentPreview}
          onOpenDetail={() => setDetailSheetOpen(true)}
          ariaLabel="평가 기록 포커스 화면"
        >
          {detailSheetOpen ? (
            <PostDetailBottomSheet
              isOpen={detailSheetOpen}
              onCloseRequest={() => setDetailSheetOpen(false)}
            >
              <div ref={sheetContentRef}>
                <EvaluationDetailFeedback
                  embedded
                  postIdOverride={focusedItem.postId}
                  voteIdOverride={focusedItem.myVoteId ?? null}
                  voteChoiceOverride={focusedItem.myChoice}
                  allowReadonlyDetail
                  hideFeedbackComposerOverride
                />
              </div>
            </PostDetailBottomSheet>
          ) : null}
        </FocusScreen>
      ) : null}
    </div>
  );
}
