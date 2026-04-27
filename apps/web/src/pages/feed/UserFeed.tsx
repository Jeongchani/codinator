import { useCallback, useEffect, useMemo, useState } from 'react';
import { Bookmark } from 'lucide-react';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import type { GetUserFeedResponse, RankingPeriod } from '@codinator/contracts';
import {
  clearAuthTokens,
  fetcher,
  getAuthHeaders,
  resolveAssetUrl,
  fetchMyBookmarkMap,
  isAuthError,
  subscribeBookmarkUpdated,
  togglePostBookmark,
} from '../../lib/api';
import Header from '../../components/Header';
import PostDetailBottomSheet from '../../components/postdetail/PostDetailBottomSheet';
import FocusScreen from '../../components/focus/FocusScreen';
import RankingDetail from '../ranking/RankingDetail';
import styles from './UserFeed.module.css';

type FeedListItem = GetUserFeedResponse['items'][number];

type FeedCardItem = {
  postId: number;
  imageUrl: string;
  createdAt: string;
  rankingPeriods: RankingPeriod[];
};

type UserFeedLocationState = {
  from?: string;
  userId?: number;
  selectedPostId?: number;
  openDetailSheet?: boolean;
};

function sortByLatest(items: FeedListItem[]) {
  return [...items].sort((a, b) => {
    const aTime = new Date(a.createdAt).getTime();
    const bTime = new Date(b.createdAt).getTime();
    return bTime - aTime;
  });
}

function normalizeRankingPeriods(periods: unknown): RankingPeriod[] {
  if (!Array.isArray(periods)) return [];

  return periods
    .map((period) => String(period).toUpperCase())
    .filter((period): period is RankingPeriod => {
      return period === 'WEEKLY' || period === 'MONTHLY';
    });
}

function getDefaultPeriod(periods: RankingPeriod[]): RankingPeriod | null {
  if (periods.includes('WEEKLY')) return 'WEEKLY';
  if (periods.includes('MONTHLY')) return 'MONTHLY';
  return null;
}

function formatPeriodLabel(period: RankingPeriod) {
  return period === 'MONTHLY' ? 'This Month' : 'This Week';
}

export default function UserFeed() {
  const navigate = useNavigate();
  const location = useLocation();
  const { userId, postId } = useParams();

  const locationState = (location.state as UserFeedLocationState | null) ?? null;
  const selectedPostIdFromState = locationState?.selectedPostId;
  const shouldOpenDetailSheetFromState = locationState?.openDetailSheet !== false;
  const selectedPostIdFromParam =
    typeof postId === 'string' && postId.trim() && !Number.isNaN(Number(postId))
      ? Number(postId)
      : null;
  const targetPostId = selectedPostIdFromParam ?? selectedPostIdFromState ?? null;
  const isDirectFocusRoute = selectedPostIdFromParam !== null;

  const [displayUserName, setDisplayUserName] = useState('닉네임');
  const [items, setItems] = useState<FeedCardItem[]>([]);
  const [bookmarks, setBookmarks] = useState<Record<number, boolean>>({});
  const [loading, setLoading] = useState(true);
  const [bookmarkLoadingIds, setBookmarkLoadingIds] = useState<number[]>([]);
  const [error, setError] = useState('');
  const [focusTargetNotFound, setFocusTargetNotFound] = useState(false);

  const [focusOpen, setFocusOpen] = useState(false);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [focusIndex, setFocusIndex] = useState(0);
  const [focusItems, setFocusItems] = useState<FeedCardItem[]>([]);

  const bookmarkLoadingIdSet = useMemo(() => new Set(bookmarkLoadingIds), [bookmarkLoadingIds]);

  const focusedItem = focusItems[focusIndex] ?? null;
  const focusedPeriod = useMemo(
    () => (focusedItem ? getDefaultPeriod(focusedItem.rankingPeriods) : null),
    [focusedItem],
  );

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

      if (isAuthError(message)) {
        moveToLogin();
      }
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

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      if (!userId) {
        setError('유저 정보가 없습니다.');
        setLoading(false);
        return;
      }

      try {
        setLoading(true);
        setError('');
        setFocusTargetNotFound(false);
        setItems([]);

        const feed = await fetcher<GetUserFeedResponse>(`/users/${userId}/feed`, {
          headers: getAuthHeaders(),
        });

        if (cancelled) return;

        setDisplayUserName(feed.user?.nickname ?? '닉네임');

        const latestItems = sortByLatest(feed.items ?? []);
        const mappedItems: FeedCardItem[] = latestItems.map((item) => ({
          postId: item.postId,
          imageUrl: resolveAssetUrl(item.thumbnailUrl),
          createdAt: item.createdAt,
          rankingPeriods: normalizeRankingPeriods(item.rankingPeriods),
        }));

        setItems(mappedItems);
      } catch (err) {
        const message = err instanceof Error ? err.message : '피드를 불러오지 못했습니다.';

        if (isAuthError(message)) {
          moveToLogin();
          return;
        }

        if (!cancelled) {
          setError(message);
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    };

    void load();

    return () => {
      cancelled = true;
    };
  }, [moveToLogin, userId]);

  useEffect(() => {
    if (!targetPostId || items.length === 0) return;

    const nextIndex = items.findIndex((item) => item.postId === targetPostId);

    if (nextIndex < 0) {
      setFocusTargetNotFound(true);
      return;
    }

    setFocusTargetNotFound(false);
    setFocusItems(items);
    setFocusIndex(nextIndex);
    setFocusOpen(true);
    setSheetOpen(shouldOpenDetailSheetFromState);
  }, [items, targetPostId, shouldOpenDetailSheetFromState]);

  const handleBack = () => {
    if (sheetOpen) {
      setSheetOpen(false);
      return;
    }

    if (focusOpen) {
      if (isDirectFocusRoute) {
        navigate(-1);
        return;
      }

      setFocusOpen(false);
      return;
    }

    navigate(-1);
  };

  const toggleBookmark = async (e: React.MouseEvent<HTMLButtonElement>, postId: number) => {
    e.preventDefault();
    e.stopPropagation();

    if (bookmarkLoadingIdSet.has(postId)) {
      return;
    }

    const isBookmarked = Boolean(bookmarks[postId]);

    setBookmarkLoadingIds((prev) => [...prev, postId]);
    setBookmarks((prev) => ({
      ...prev,
      [postId]: !isBookmarked,
    }));

    try {
      const nextValue = await togglePostBookmark(postId, isBookmarked);
      setBookmarks((prev) => ({
        ...prev,
        [postId]: nextValue,
      }));
    } catch (err) {
      const message = err instanceof Error ? err.message : '북마크 처리에 실패했습니다.';

      setBookmarks((prev) => ({
        ...prev,
        [postId]: isBookmarked,
      }));

      if (isAuthError(message)) {
        moveToLogin();
        return;
      }

      window.alert(message);
    } finally {
      setBookmarkLoadingIds((prev) => prev.filter((id) => id !== postId));
    }
  };

  const handleCardClick = (clickedItem: FeedCardItem) => {
    const nextIndex = items.findIndex((item) => item.postId === clickedItem.postId);

    setFocusItems(items);
    setFocusIndex(nextIndex >= 0 ? nextIndex : 0);
    setSheetOpen(true);
    setFocusOpen(true);
  };

  const shouldHideFeedGrid = isDirectFocusRoute && !focusOpen;

  const handleOpenDetailSheet = () => {
    if (!focusedItem) return;

    if (!focusedPeriod) {
      window.alert('랭킹 상세가 없는 게시글입니다.');
      return;
    }

    setSheetOpen(true);
  };

  return (
    <div className={styles.container}>
      <Header title={displayUserName} leftAction="back" onBack={handleBack} rightAction="none" />

      <main className={styles.contentArea}>
        {loading && items.length === 0 ? (
          <div className={styles.messageBox}>불러오는 중...</div>
        ) : null}

        {!loading && error ? <div className={styles.messageBox}>{error}</div> : null}

        {!loading && !error && focusTargetNotFound ? (
          <div className={styles.messageBox}>선택한 게시글을 찾을 수 없습니다.</div>
        ) : null}

        {!loading && !error && items.length === 0 && !focusTargetNotFound ? (
          <div className={styles.messageBox}>공개된 피드 게시글이 없습니다.</div>
        ) : null}

        {!error && items.length > 0 && !shouldHideFeedGrid ? (
          <div className={styles.feedGrid}>
            {items.map((item) => {
              const isBookmarked = Boolean(bookmarks[item.postId]);
              const isBookmarkLoading = bookmarkLoadingIdSet.has(item.postId);

              return (
                <article
                  key={item.postId}
                  className={styles.feedCard}
                  onClick={() => handleCardClick(item)}
                  role="button"
                  tabIndex={0}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      handleCardClick(item);
                    }
                  }}
                >
                  <div className={styles.thumbnail}>
                    {item.imageUrl ? (
                      <img
                        src={item.imageUrl}
                        alt={`feed-${item.postId}`}
                        className={styles.cardImage}
                      />
                    ) : (
                      <div className={styles.cardImageFallback}>이미지 없음</div>
                    )}

                    <div className={styles.thumbnailGradient} />

                    <button
                      type="button"
                      className={styles.bookmarkButton}
                      aria-label={isBookmarked ? '북마크 해제' : '북마크 추가'}
                      onClick={(e) => toggleBookmark(e, item.postId)}
                      disabled={isBookmarkLoading}
                    >
                      <Bookmark
                        size={12}
                        strokeWidth={2.2}
                        className={isBookmarked ? styles.bookmarkFilled : styles.bookmarkDefault}
                        fill={isBookmarked ? 'currentColor' : 'none'}
                      />
                    </button>
                  </div>
                </article>
              );
            })}
          </div>
        ) : null}
      </main>

      {focusOpen && focusedItem ? (
        <FocusScreen
          isOpen={focusOpen}
          items={focusItems.map((item) => ({
            id: item.postId,
            imageUrl: item.imageUrl,
          }))}
          activeIndex={focusIndex}
          onActiveIndexChange={(nextIndex) => {
            setFocusIndex(nextIndex);
            setSheetOpen(false);
          }}
          closeButtonType="x"
          onClose={() => {
            if (isDirectFocusRoute) {
              navigate(-1);
              return;
            }

            setSheetOpen(false);
            setFocusOpen(false);
          }}
          sheetOpen={sheetOpen}
          onCloseSheet={() => setSheetOpen(false)}
          showVoteGraph={false}
          showDetailButton
          detailLabel="상세보기"
          detailDisabled={!focusedPeriod}
          onOpenDetail={handleOpenDetailSheet}
        >
          <PostDetailBottomSheet isOpen={sheetOpen} onCloseRequest={() => setSheetOpen(false)}>
            {focusedPeriod ? (
              <RankingDetail postId={focusedItem.postId} period={focusedPeriod} hideFeedLink />
            ) : (
              <div className={styles.sheetFallback}>랭킹 상세가 없는 게시글입니다.</div>
            )}
          </PostDetailBottomSheet>
        </FocusScreen>
      ) : null}
    </div>
  );
}
