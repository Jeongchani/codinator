import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { motion } from "framer-motion";
import { Bookmark, ChevronsUp, ThumbsDown, ThumbsUp, X } from "lucide-react";
import { useNavigate } from "react-router-dom";
import styles from "./RankingZone.module.css";
import {
  clearAuthTokens,
  fetcher,
  getAuthHeaders,
  resolveAssetUrl,
  fetchMyBookmarkMap,
  isAuthError,
  subscribeBookmarkUpdated,
  togglePostBookmark,
} from "../../lib/api";
import type { GetRankingsResponse, RankingItem, RankingPeriod } from "@codinator/contracts";
import Header from "../../components/Header";
import Footer from "../../components/Footer";
import PostDetailBottomSheet from "../../components/postdetail/PostDetailBottomSheet";
import RankingDetail from "./RankingDetail";

type RankingCardItem = {
  id: number;
  title: string;
  likeCount: number;
  dislikeCount: number;
  bookmarked?: boolean;
  imageUrl?: string;
  postId: number;
  period: RankingPeriod;
  rank: number;
  likeRate: number;
};

function RankingCard({
  item,
  onCardClick,
  onToggleBookmark,
  isBookmarkLoading,
  isBookmarkPressed,
}: {
  item: RankingCardItem;
  onCardClick: (item: RankingCardItem) => void;
  onToggleBookmark: (e: React.MouseEvent<HTMLButtonElement>, postId: number) => void;
  isBookmarkLoading: boolean;
  isBookmarkPressed: boolean;
}) {
  return (
    <article className={`${styles.card} ${isBookmarkPressed ? styles.cardPressed : ""}`} onClick={() => onCardClick(item)}>
      <div className={`${styles.thumbnail} ${isBookmarkPressed ? styles.thumbnailPressed : ""}`}>
        {item.imageUrl ? <img src={item.imageUrl} alt={`ranking-${item.id}`} className={styles.cardImage} /> : <div className={styles.cardImageFallback}>이미지 없음</div>}
        <div className={styles.thumbnailGradient} />
        <button
          type="button"
          className={`${styles.bookmarkButton} ${isBookmarkPressed ? styles.bookmarkButtonPressed : ""}`}
          aria-label={item.bookmarked ? "북마크 해제" : "북마크 추가"}
          onClick={(e) => onToggleBookmark(e, item.postId)}
          disabled={isBookmarkLoading}
        >
          <Bookmark size={12} strokeWidth={2.2} className={item.bookmarked ? styles.bookmarkFilled : styles.bookmarkDefault} fill={item.bookmarked ? "currentColor" : "none"} />
        </button>
      </div>
      <p className={styles.cardTitle}>랭킹 게시글 {item.rank}</p>
      <div className={styles.statsRow}>
        <div className={styles.statItem}><ThumbsUp size={13} strokeWidth={2} className={styles.statIcon} /><span className={styles.statText}>{String(item.likeCount).padStart(3, "0")}</span></div>
        <div className={styles.statItem}><ThumbsDown size={13} strokeWidth={2} className={styles.statIcon} /><span className={styles.statText}>{String(item.dislikeCount).padStart(3, "0")}</span></div>
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
}: {
  title: string;
  items: RankingCardItem[];
  bookmarkLoadingIds: number[];
  bookmarkPressedIds: number[];
  onCardClick: (item: RankingCardItem, list: RankingCardItem[]) => void;
  onToggleBookmark: (e: React.MouseEvent<HTMLButtonElement>, postId: number) => void;
}) {
  return (
    <section className={styles.section}>
      <h2 className={styles.sectionTitle}>{title}</h2>
      <div className={styles.horizontalScroll}>
        {items.map((item) => (
          <RankingCard
            key={`${item.period}-${item.postId}`}
            item={item}
            onCardClick={(clicked) => onCardClick(clicked, items)}
            onToggleBookmark={onToggleBookmark}
            isBookmarkLoading={bookmarkLoadingIds.includes(item.postId)}
            isBookmarkPressed={bookmarkPressedIds.includes(item.postId)}
          />
        ))}
      </div>
    </section>
  );
}

function VerticalSwipeIndicator({ above, below }: { above: number; below: number }) {
  const visibleAbove = Math.min(Math.max(above, 0), 3);
  const visibleBelow = Math.min(Math.max(below, 0), 3);

  return (
    <div className={styles.swipeIndicator} aria-hidden="true">
      <div className={styles.swipeIndicatorStack}>
        {Array.from({ length: visibleAbove }).map((_, index) => (
          <motion.div
            key={`above-${index}`}
            className={styles.swipeIndicatorDot}
            animate={{ opacity: [0.2, 0.44, 0.2], y: [0, -1.5, 0] }}
            transition={{
              duration: 1.7,
              repeat: Infinity,
              ease: "easeInOut",
              delay: 0.1 * (visibleAbove - index),
            }}
          />
        ))}

        <motion.div
          className={styles.swipeIndicatorActive}
          animate={{ opacity: [1, 0.84, 1], scaleY: [1, 0.94, 1] }}
          transition={{ duration: 1.4, repeat: Infinity, ease: "easeInOut" }}
        />

        {Array.from({ length: visibleBelow }).map((_, index) => (
          <motion.div
            key={`below-${index}`}
            className={styles.swipeIndicatorDot}
            animate={{ opacity: [0.2, 0.44, 0.2], y: [0, 1.5, 0] }}
            transition={{
              duration: 1.7,
              repeat: Infinity,
              ease: "easeInOut",
              delay: 0.1 * (index + 1),
            }}
          />
        ))}
      </div>
    </div>
  );
}

export default function RankingZone() {
  const navigate = useNavigate();
  const [weeklyRankings, setWeeklyRankings] = useState<RankingItem[]>([]);
  const [monthlyRankings, setMonthlyRankings] = useState<RankingItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [bookmarks, setBookmarks] = useState<Record<number, boolean>>({});
  const [bookmarkLoadingIds, setBookmarkLoadingIds] = useState<number[]>([]);
  const [bookmarkPressedIds, setBookmarkPressedIds] = useState<number[]>([]);
  const [focusOpen, setFocusOpen] = useState(false);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [focusIndex, setFocusIndex] = useState(0);
  const [focusItems, setFocusItems] = useState<RankingCardItem[]>([]);
  const bookmarkAnimTimeoutMap = useRef<Record<number, number>>({});
  const focusScrollRef = useRef<HTMLDivElement | null>(null);

  const moveToLogin = useCallback(() => {
    clearAuthTokens();
    navigate("/login", { replace: true });
  }, [navigate]);

  const loadBookmarks = useCallback(async () => {
    try {
      const nextMap = await fetchMyBookmarkMap();
      setBookmarks(nextMap);
    } catch (err) {
      const message = err instanceof Error ? err.message : "북마크 정보를 불러오지 못했습니다.";
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
        setError("");
        const [weeklyData, monthlyData] = await Promise.all([
          fetcher<GetRankingsResponse>("/rankings?period=WEEKLY", { headers: getAuthHeaders() }),
          fetcher<GetRankingsResponse>("/rankings?period=MONTHLY", { headers: getAuthHeaders() }),
        ]);
        if (cancelled) return;
        setWeeklyRankings(weeklyData.items ?? []);
        setMonthlyRankings(monthlyData.items ?? []);
      } catch (err) {
        const message = err instanceof Error ? err.message : "랭킹 데이터를 불러오지 못했습니다.";
        if (isAuthError(message)) {
          moveToLogin();
          return;
        }
        if (!cancelled) {
          setError(message);
          setWeeklyRankings([]);
          setMonthlyRankings([]);
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
      Object.values(bookmarkAnimTimeoutMap.current).forEach((timeoutId) => window.clearTimeout(timeoutId));
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
      const message = err instanceof Error ? err.message : "북마크 처리에 실패했습니다.";
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

  const convertRankingItem = (post: RankingItem, period: RankingPeriod): RankingCardItem => ({
    id: post.postId,
    title: `랭킹 게시글 ${post.rank}`,
    likeCount: post.likeCount ?? 0,
    dislikeCount: post.dislikeCount ?? 0,
    bookmarked: Boolean(bookmarks[post.postId]),
    imageUrl: resolveAssetUrl(post.thumbnailUrl),
    postId: post.postId,
    period,
    rank: post.rank,
    likeRate: post.likeRate ?? 0,
  });

  const weeklyItems = useMemo(() => weeklyRankings.map((post) => convertRankingItem(post, "WEEKLY")), [weeklyRankings, bookmarks]);
  const monthlyItems = useMemo(() => monthlyRankings.map((post) => convertRankingItem(post, "MONTHLY")), [monthlyRankings, bookmarks]);
  const focusedItem = focusItems[focusIndex] ?? null;

  const handleCardClick = (item: RankingCardItem, list: RankingCardItem[]) => {
    const nextIndex = list.findIndex((candidate) => candidate.postId === item.postId);
    setFocusItems(list);
    setFocusIndex(nextIndex >= 0 ? nextIndex : 0);
    setSheetOpen(false);
    setFocusOpen(true);
  };

  const handleFocusScroll = () => {
    const container = focusScrollRef.current;
    if (!container) return;

    const pageHeight = container.clientHeight;
    const nextIndex = Math.max(
      0,
      Math.min(Math.round(container.scrollTop / pageHeight), focusItems.length - 1),
    );

    if (nextIndex !== focusIndex) {
      setFocusIndex(nextIndex);
      setSheetOpen(false);
    }
  };

  useEffect(() => {
    if (!focusOpen) return;

    const container = focusScrollRef.current;
    if (!container) return;

    const raf = window.requestAnimationFrame(() => {
      container.scrollTo({
        top: container.clientHeight * focusIndex,
        behavior: "auto",
      });
    });

    return () => window.cancelAnimationFrame(raf);
  }, [focusOpen]);

  const previousSwipeCount = Math.min(Math.max(focusIndex, 0), 3);
  const nextSwipeCount = Math.min(Math.max(focusItems.length - focusIndex - 1, 0), 3);

  const totalCount = (focusedItem?.likeCount ?? 0) + (focusedItem?.dislikeCount ?? 0);
  const likePercent = totalCount > 0 ? Math.round(((focusedItem?.likeCount ?? 0) / totalCount) * 100) : 0;
  const dislikePercent = totalCount > 0 ? 100 - likePercent : 0;

  return (
    <div className={styles.container}>
      <Header />
      <div className={styles.contentArea}>
        {loading ? (
          <div className={styles.messageBox}>데이터 불러오는 중...</div>
        ) : error ? (
          <div className={styles.messageBox}>{error}</div>
        ) : (
          <>
            <RankingSection title="This Week" items={weeklyItems} bookmarkLoadingIds={bookmarkLoadingIds} bookmarkPressedIds={bookmarkPressedIds} onCardClick={handleCardClick} onToggleBookmark={handleToggleBookmark} />
            <RankingSection title="This Month" items={monthlyItems} bookmarkLoadingIds={bookmarkLoadingIds} bookmarkPressedIds={bookmarkPressedIds} onCardClick={handleCardClick} onToggleBookmark={handleToggleBookmark} />
          </>
        )}
      </div>

      <div className={styles.footerWrap}><Footer /></div>

      {focusOpen && focusedItem && (
        <div className={styles.focusOverlay}>
          <div ref={focusScrollRef} className={styles.focusViewport} onScroll={handleFocusScroll}>
            {focusItems.map((item) => (
              <section key={`${item.period}-${item.postId}`} className={styles.focusSlide}>
                <div className={styles.focusMainImage} style={{ backgroundImage: item.imageUrl ? `url(${item.imageUrl})` : undefined }} />
                <div className={styles.topGradient} />
                <div className={styles.bottomGradient} />
              </section>
            ))}
          </div>

          {sheetOpen ? (
            <button
              type="button"
              className={styles.focusSheetBackdrop}
              onClick={() => setSheetOpen(false)}
              aria-label="상세 닫기"
            />
          ) : null}

          <div className={styles.headerTitle}>{focusedItem.period === "MONTHLY" ? "This Month" : "This Week"}</div>

          <button type="button" onClick={() => { setSheetOpen(false); setFocusOpen(false); }} className={styles.closeBtn} aria-label="닫기">
            <X size={18} strokeWidth={2.6} />
          </button>

          {!sheetOpen ? <VerticalSwipeIndicator above={previousSwipeCount} below={nextSwipeCount} /> : null}

          <div className={styles.focusFloatingArea}>
            <button type="button" className={styles.detailButton} onClick={() => setSheetOpen(true)}>
              <span className={styles.detailButtonText}>상세보기</span>
              <ChevronsUp size={16} strokeWidth={2.4} className={styles.detailButtonUpIcon} />
            </button>

            <div className={styles.progressTrack}>
              <div className={styles.likeFill} style={{ width: `${likePercent}%` }} />
              <div className={styles.dislikeFill} style={{ width: `${dislikePercent}%` }} />
              {totalCount > 0 && likePercent > 0 && (
                <div className={styles.leftPercent}><ThumbsUp size={12} strokeWidth={2} /><span>{likePercent}%</span></div>
              )}
              {totalCount > 0 && dislikePercent > 0 && (
                <div className={styles.rightPercent}><ThumbsDown size={12} strokeWidth={2} /><span>{dislikePercent}%</span></div>
              )}
            </div>
          </div>

          <PostDetailBottomSheet isOpen={sheetOpen} onCloseRequest={() => setSheetOpen(false)}>
            <RankingDetail postId={focusedItem.postId} period={focusedItem.period} />
          </PostDetailBottomSheet>
        </div>
      )}
    </div>
  );
}
