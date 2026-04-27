import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Bookmark, ThumbsDown, ThumbsUp } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import styles from './RankingZone.module.css';
import rankingHeroBanner from '../../assets/ranking/랭킹존 배너.png';
import algorithmBanner from '../../assets/ranking/알고리즘 배너.png';
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
import type {
  GetPersonalizedRankingsResponse,
  GetRankingsResponse,
  RankingItem,
  RankingPeriod,
} from '@codinator/contracts';
import Header from '../../components/Header';
import PostDetailBottomSheet from '../../components/postdetail/PostDetailBottomSheet';
import FocusScreen from '../../components/focus/FocusScreen';
import RankingDetail from './RankingDetail';
import PersonalizedSection, { type PersonalizedFocusItem } from './PersonalizedSection';
import PersonalizedDetail from './PersonalizedDetail';

type RankingFocusItem = {
  kind: 'ranking';
  likeCount: number;
  dislikeCount: number;
  bookmarked?: boolean;
  imageUrl?: string;
  postId: number;
  period: RankingPeriod;
  sectionTitle: 'This Week' | 'This Month';
};

type FocusItem = RankingFocusItem | PersonalizedFocusItem;

function HeroBanner() {
  return (
    <section className={`${styles.bannerBlock} ${styles.heroBanner}`} aria-label="랭킹존 배너">
      <img src={rankingHeroBanner} alt="Ranking Zone banner" className={styles.bannerImage} />
    </section>
  );
}

function RecommendationBanner() {
  return (
    <section className={`${styles.bannerBlock} ${styles.recommendBanner}`} aria-label="추천 배너">
      <img src={algorithmBanner} alt="추천 알고리즘 banner" className={styles.bannerImage} />
    </section>
  );
}

function RankingCard({
  item,
  onCardClick,
  onToggleBookmark,
  isBookmarkLoading,
  isBookmarkPressed,
}: {
  item: RankingFocusItem;
  onCardClick: (item: RankingFocusItem) => void;
  onToggleBookmark: (e: React.MouseEvent<HTMLButtonElement>, postId: number) => void;
  isBookmarkLoading: boolean;
  isBookmarkPressed: boolean;
}) {
  return (
    <article
      className={`${styles.card} ${isBookmarkPressed ? styles.cardPressed : ''}`}
      onClick={() => onCardClick(item)}
    >
      <div className={`${styles.thumbnail} ${isBookmarkPressed ? styles.thumbnailPressed : ''}`}>
        {item.imageUrl ? (
          <img src={item.imageUrl} alt={`ranking-${item.postId}`} className={styles.cardImage} />
        ) : (
          <div className={styles.cardImageFallback}>이미지 없음</div>
        )}
        <div className={styles.thumbnailGradient} />
        <button
          type="button"
          className={`${styles.bookmarkButton} ${isBookmarkPressed ? styles.bookmarkButtonPressed : ''}`}
          aria-label={item.bookmarked ? '북마크 해제' : '북마크 추가'}
          onClick={(e) => onToggleBookmark(e, item.postId)}
          disabled={isBookmarkLoading}
        >
          <Bookmark
            size={12}
            strokeWidth={2.2}
            className={item.bookmarked ? styles.bookmarkFilled : styles.bookmarkDefault}
            fill={item.bookmarked ? 'currentColor' : 'none'}
          />
        </button>
      </div>

      <div className={styles.statsRow}>
        <div className={styles.statItem}>
          <ThumbsUp size={13} strokeWidth={2.2} className={styles.statIcon} />
          <span className={styles.statText}>{String(item.likeCount).padStart(3, '0')}</span>
        </div>
        <div className={styles.statItem}>
          <ThumbsDown size={13} strokeWidth={2.2} className={styles.statIcon} />
          <span className={styles.statText}>{String(item.dislikeCount).padStart(3, '0')}</span>
        </div>
      </div>
    </article>
  );
}

function RankingSection({
  title,
  items,
  bookmarkLoadingIds,
  bookmarkPressedIds,
  onCardClick,
  onToggleBookmark,
  emptyMessage = '게시글이 없습니다.',
}: {
  title: string;
  items: RankingFocusItem[];
  bookmarkLoadingIds: number[];
  bookmarkPressedIds: number[];
  onCardClick: (item: RankingFocusItem, list: RankingFocusItem[]) => void;
  onToggleBookmark: (e: React.MouseEvent<HTMLButtonElement>, postId: number) => void;
  emptyMessage?: string;
}) {
  return (
    <section className={styles.section}>
      <h2 className={styles.sectionTitle}>{title}</h2>

      {items.length > 0 ? (
        <div className={styles.horizontalScroll}>
          {items.map((item) => (
            <RankingCard
              key={`${item.kind}-${item.sectionTitle}-${item.period}-${item.postId}`}
              item={item}
              onCardClick={(clicked) => onCardClick(clicked, items)}
              onToggleBookmark={onToggleBookmark}
              isBookmarkLoading={bookmarkLoadingIds.includes(item.postId)}
              isBookmarkPressed={bookmarkPressedIds.includes(item.postId)}
            />
          ))}
        </div>
      ) : (
        <div className={styles.sectionEmpty}>{emptyMessage}</div>
      )}
    </section>
  );
}

export default function RankingZone() {
  const navigate = useNavigate();
  const [weeklyRankings, setWeeklyRankings] = useState<RankingItem[]>([]);
  const [monthlyRankings, setMonthlyRankings] = useState<RankingItem[]>([]);
  const [personalizedRankings, setPersonalizedRankings] = useState<
    GetPersonalizedRankingsResponse['items']
  >([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [bookmarks, setBookmarks] = useState<Record<number, boolean>>({});
  const [bookmarkLoadingIds, setBookmarkLoadingIds] = useState<number[]>([]);
  const [bookmarkPressedIds, setBookmarkPressedIds] = useState<number[]>([]);
  const [focusOpen, setFocusOpen] = useState(false);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [focusIndex, setFocusIndex] = useState(0);
  const [focusItems, setFocusItems] = useState<FocusItem[]>([]);
  const bookmarkAnimTimeoutMap = useRef<Record<number, number>>({});

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
      setBookmarks((prev) => ({ ...prev, [detail.postId]: detail.bookmarked }));
    });
    return unsubscribe;
  }, [loadBookmarks]);

  useEffect(() => {
    let cancelled = false;

    const loadRankings = async () => {
      try {
        setLoading(true);
        setError('');

        const personalizedPromise = fetcher<GetPersonalizedRankingsResponse>(
          '/rankings/personalized?limit=20',
          { headers: getAuthHeaders() },
        ).catch((err) => {
          const message =
            err instanceof Error ? err.message : '개인화 추천 데이터를 불러오지 못했습니다.';
          console.warn(message);
          return {
            items: [],
            nextCursor: null,
            hasMore: false,
          } satisfies GetPersonalizedRankingsResponse;
        });

        const [weeklyData, monthlyData, personalizedData] = await Promise.all([
          fetcher<GetRankingsResponse>('/rankings?period=WEEKLY', { headers: getAuthHeaders() }),
          fetcher<GetRankingsResponse>('/rankings?period=MONTHLY', { headers: getAuthHeaders() }),
          personalizedPromise,
        ]);

        if (cancelled) return;

        setWeeklyRankings(weeklyData.items ?? []);
        setMonthlyRankings(monthlyData.items ?? []);
        setPersonalizedRankings(personalizedData.items ?? []);
      } catch (err) {
        const message = err instanceof Error ? err.message : '랭킹 데이터를 불러오지 못했습니다.';
        if (isAuthError(message)) {
          moveToLogin();
          return;
        }
        if (!cancelled) {
          setError(message);
          setWeeklyRankings([]);
          setMonthlyRankings([]);
          setPersonalizedRankings([]);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    void loadRankings();
    return () => {
      cancelled = true;
    };
  }, [moveToLogin]);

  useEffect(() => {
    return () => {
      Object.values(bookmarkAnimTimeoutMap.current).forEach((timeoutId) =>
        window.clearTimeout(timeoutId),
      );
    };
  }, []);

  const triggerBookmarkPress = (postId: number) => {
    const prevTimeout = bookmarkAnimTimeoutMap.current[postId];
    if (prevTimeout) window.clearTimeout(prevTimeout);
    setBookmarkPressedIds((prev) => (prev.includes(postId) ? prev : [...prev, postId]));
    bookmarkAnimTimeoutMap.current[postId] = window.setTimeout(() => {
      setBookmarkPressedIds((prev) => prev.filter((id) => id !== postId));
      delete bookmarkAnimTimeoutMap.current[postId];
    }, 240);
  };

  const handleToggleBookmark = async (e: React.MouseEvent<HTMLButtonElement>, postId: number) => {
    e.preventDefault();
    e.stopPropagation();
    if (bookmarkLoadingIds.includes(postId)) return;

    triggerBookmarkPress(postId);

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

  const convertRankingItem = (
    post: RankingItem,
    period: RankingPeriod,
    sectionTitle: 'This Week' | 'This Month',
  ): RankingFocusItem => ({
    kind: 'ranking',
    likeCount: post.likeCount ?? 0,
    dislikeCount: post.dislikeCount ?? 0,
    bookmarked: Boolean(bookmarks[post.postId]),
    imageUrl: resolveAssetUrl(post.thumbnailUrl),
    postId: post.postId,
    period,
    sectionTitle,
  });

  const convertPersonalizedItem = (
    post: GetPersonalizedRankingsResponse['items'][number],
  ): PersonalizedFocusItem => ({
    kind: 'personalized',
    likeCount: post.likeCount ?? 0,
    dislikeCount: post.dislikeCount ?? 0,
    bookmarked: Boolean(bookmarks[post.postId]),
    imageUrl: resolveAssetUrl(post.thumbnailUrl),
    postId: post.postId,
    sectionTitle: 'For You',
    raw: post,
  });

  const weeklyItems = useMemo(
    () => weeklyRankings.map((post) => convertRankingItem(post, 'WEEKLY', 'This Week')),
    [weeklyRankings, bookmarks],
  );

  const monthlyItems = useMemo(
    () => monthlyRankings.map((post) => convertRankingItem(post, 'MONTHLY', 'This Month')),
    [monthlyRankings, bookmarks],
  );

  const personalizedItems = useMemo(
    () => personalizedRankings.map(convertPersonalizedItem),
    [personalizedRankings, bookmarks],
  );

  const focusedItem = focusItems[focusIndex] ?? null;

  const handleCardClick = (item: FocusItem, list: FocusItem[]) => {
    const nextIndex = list.findIndex((candidate) => candidate.postId === item.postId);
    setFocusItems(list);
    setFocusIndex(nextIndex >= 0 ? nextIndex : 0);
    setSheetOpen(false);
    setFocusOpen(true);
  };

  const totalCount = (focusedItem?.likeCount ?? 0) + (focusedItem?.dislikeCount ?? 0);
  const likePercent =
    totalCount > 0 ? Math.round(((focusedItem?.likeCount ?? 0) / totalCount) * 100) : 0;
  const dislikePercent = totalCount > 0 ? 100 - likePercent : 0;

  return (
    <div className={styles.container}>
      <Header />
      <div className={styles.contentArea}>
        <HeroBanner />

        {loading ? (
          <div className={styles.messageBox}>데이터 불러오는 중...</div>
        ) : error ? (
          <div className={styles.messageBox}>{error}</div>
        ) : (
          <>
            <RankingSection
              title="This Week"
              items={weeklyItems}
              bookmarkLoadingIds={bookmarkLoadingIds}
              bookmarkPressedIds={bookmarkPressedIds}
              onCardClick={handleCardClick}
              onToggleBookmark={handleToggleBookmark}
            />
            <RankingSection
              title="This Month"
              items={monthlyItems}
              bookmarkLoadingIds={bookmarkLoadingIds}
              bookmarkPressedIds={bookmarkPressedIds}
              onCardClick={handleCardClick}
              onToggleBookmark={handleToggleBookmark}
            />
            <RecommendationBanner />
            <PersonalizedSection
              title="For You"
              items={personalizedItems}
              bookmarkLoadingIds={bookmarkLoadingIds}
              bookmarkPressedIds={bookmarkPressedIds}
              onCardClick={handleCardClick}
              onToggleBookmark={handleToggleBookmark}
              emptyMessage="추천 게시글이 아직 없어요."
            />
          </>
        )}
      </div>

      {focusOpen && focusedItem ? (
        <FocusScreen
          isOpen={focusOpen}
          items={focusItems.map((item) => ({
            id: `${item.kind}-${item.sectionTitle}-${item.postId}`,
            imageUrl: item.imageUrl,
          }))}
          activeIndex={focusIndex}
          onActiveIndexChange={(nextIndex) => {
            setFocusIndex(nextIndex);
            setSheetOpen(false);
          }}
          onClose={() => {
            setSheetOpen(false);
            setFocusOpen(false);
          }}
          sheetOpen={sheetOpen}
          onCloseSheet={() => setSheetOpen(false)}
          showVoteGraph
          likePercent={likePercent}
          dislikePercent={dislikePercent}
          showDetailButton
          onOpenDetail={() => setSheetOpen(true)}
        >
          {sheetOpen ? (
            <PostDetailBottomSheet isOpen={sheetOpen} onCloseRequest={() => setSheetOpen(false)}>
              {focusedItem.kind === 'personalized' ? (
                <PersonalizedDetail item={focusedItem.raw} />
              ) : (
                <RankingDetail postId={focusedItem.postId} period={focusedItem.period} />
              )}
            </PostDetailBottomSheet>
          ) : null}
        </FocusScreen>
      ) : null}
    </div>
  );
}
