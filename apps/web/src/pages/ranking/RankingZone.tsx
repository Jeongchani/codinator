import React, { useCallback, useEffect, useMemo, useState } from "react";
import { Bookmark, Search, ThumbsDown, ThumbsUp } from "lucide-react";
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
import type { GetRankingsResponse, RankingItem } from "@codinator/contracts";
import Header from "../../components/Header";
import Footer from "../../components/Footer";

type RankingCardItem = {
  id: number;
  title: string;
  likeCount: number;
  dislikeCount: number;
  bookmarked?: boolean;
  imageUrl?: string;
  postId?: number;
  period?: "WEEKLY" | "MONTHLY";
};

type RankingSectionData = {
  id: string;
  title: string;
  items: RankingCardItem[];
};

type RankingCardProps = {
  item: RankingCardItem;
  onCardClick: (item: RankingCardItem) => void;
  onToggleBookmark: (
    e: React.MouseEvent<HTMLButtonElement>,
    postId: number
  ) => void;
  isBookmarkLoading: boolean;
};

function RankingCard({
  item,
  onCardClick,
  onToggleBookmark,
  isBookmarkLoading,
}: RankingCardProps) {
  return (
    <article className={styles.card} onClick={() => onCardClick(item)}>
      <div className={styles.thumbnail}>
        {item.imageUrl ? (
          <img
            src={item.imageUrl}
            alt={`ranking-${item.id}`}
            className={styles.cardImage}
          />
        ) : (
          <div className={styles.cardImageFallback}>이미지 없음</div>
        )}

        <div className={styles.thumbnailGradient} />

        <button
          type="button"
          className={styles.bookmarkButton}
          aria-label={item.bookmarked ? "북마크 해제" : "북마크 추가"}
          onClick={(e) => onToggleBookmark(e, item.postId ?? item.id)}
          disabled={isBookmarkLoading}
        >
          <Bookmark
            size={12}
            strokeWidth={2.2}
            className={
              item.bookmarked ? styles.bookmarkFilled : styles.bookmarkDefault
            }
            fill={item.bookmarked ? "currentColor" : "none"}
          />
        </button>
      </div>

      <p className={styles.cardTitle}>
        {item.title.split("\n").map((line, index, arr) => (
          <React.Fragment key={`${item.id}-${index}`}>
            {line}
            {index < arr.length - 1 && <br />}
          </React.Fragment>
        ))}
      </p>

      <div className={styles.statsRow}>
        <div className={styles.statItem}>
          <ThumbsUp size={13} strokeWidth={2} className={styles.statIcon} />
          <span className={styles.statText}>
            {String(item.likeCount).padStart(3, "0")}
          </span>
        </div>

        <div className={styles.statItem}>
          <ThumbsDown size={13} strokeWidth={2} className={styles.statIcon} />
          <span className={styles.statText}>
            {String(item.dislikeCount).padStart(3, "0")}
          </span>
        </div>
      </div>
    </article>
  );
}

type RankingSectionProps = {
  title: string;
  items: RankingCardItem[];
  bookmarkLoadingIds: number[];
  onCardClick: (item: RankingCardItem) => void;
  onToggleBookmark: (
    e: React.MouseEvent<HTMLButtonElement>,
    postId: number
  ) => void;
};

function RankingSection({
  title,
  items,
  bookmarkLoadingIds,
  onCardClick,
  onToggleBookmark,
}: RankingSectionProps) {
  return (
    <section className={styles.section}>
      <h2 className={styles.sectionTitle}>{title}</h2>

      <div className={styles.horizontalScroll}>
        {items.map((item) => (
          <RankingCard
            key={item.id}
            item={item}
            onCardClick={onCardClick}
            onToggleBookmark={onToggleBookmark}
            isBookmarkLoading={bookmarkLoadingIds.includes(item.postId ?? item.id)}
          />
        ))}
      </div>
    </section>
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

  const moveToLogin = useCallback(() => {
    clearAuthTokens();
    navigate("/login", { replace: true });
  }, [navigate]);

  const loadBookmarks = useCallback(async () => {
    try {
      const nextMap = await fetchMyBookmarkMap();
      setBookmarks(nextMap);
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "북마크 정보를 불러오지 못했습니다.";

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

    const loadRankings = async () => {
      try {
        setLoading(true);
        setError("");

        const [weeklyData, monthlyData] = await Promise.all([
          fetcher<GetRankingsResponse>("/rankings?period=WEEKLY", {
            headers: getAuthHeaders(),
          }),
          fetcher<GetRankingsResponse>("/rankings?period=MONTHLY", {
            headers: getAuthHeaders(),
          }),
        ]);

        if (cancelled) return;

        setWeeklyRankings(weeklyData.items ?? []);
        setMonthlyRankings(monthlyData.items ?? []);
      } catch (err) {
        const message =
          err instanceof Error
            ? err.message
            : "랭킹 데이터를 불러오지 못했습니다.";

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
        if (!cancelled) {
          setLoading(false);
        }
      }
    };

    void loadRankings();

    return () => {
      cancelled = true;
    };
  }, [moveToLogin]);

  const toggleBookmark = async (
    e: React.MouseEvent<HTMLButtonElement>,
    postId: number
  ) => {
    e.preventDefault();
    e.stopPropagation();

    if (bookmarkLoadingIds.includes(postId)) {
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
      const message =
        err instanceof Error ? err.message : "북마크 처리에 실패했습니다.";

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

  const handleCardClick = (item: RankingCardItem) => {
    if (!item.postId || !item.period) return;
    navigate(`/rankingDetail/${item.postId}?period=${item.period}`);
  };

  const convertRankingItem = (
    post: RankingItem,
    period: "WEEKLY" | "MONTHLY"
  ): RankingCardItem => {
    return {
      id: post.postId,
      title: "게시글 컨셉 글\n최대 두줄 혹은 닉네임?",
      likeCount: post.likeCount ?? 0,
      dislikeCount: post.dislikeCount ?? 0,
      bookmarked: Boolean(bookmarks[post.postId]),
      imageUrl: resolveAssetUrl(post.thumbnailUrl),
      postId: post.postId,
      period,
    };
  };

  const sections: RankingSectionData[] = useMemo(
    () => [
      {
        id: "week",
        title: "This Week",
        items: weeklyRankings.map((post) => convertRankingItem(post, "WEEKLY")),
      },
      {
        id: "month",
        title: "This Month",
        items: monthlyRankings.map((post) =>
          convertRankingItem(post, "MONTHLY")
        ),
      },
    ],
    [weeklyRankings, monthlyRankings, bookmarks]
  );

  return (
    <div className={styles.container}>
      <Header />

      <div className={styles.contentArea}>
        <div className={styles.searchBox}>
          <Search size={18} strokeWidth={2} className={styles.searchIcon} />
          <span className={styles.searchText}>검색하기</span>
        </div>

        {loading ? (
          <div className={styles.messageBox}>데이터 불러오는 중...</div>
        ) : error ? (
          <div className={styles.messageBox}>{error}</div>
        ) : (
          <>
            <RankingSection
              title="This Week"
              items={sections[0].items}
              bookmarkLoadingIds={bookmarkLoadingIds}
              onCardClick={handleCardClick}
              onToggleBookmark={toggleBookmark}
            />
            <RankingSection
              title="This Month"
              items={sections[1].items}
              bookmarkLoadingIds={bookmarkLoadingIds}
              onCardClick={handleCardClick}
              onToggleBookmark={toggleBookmark}
            />
          </>
        )}
      </div>

      <div className={styles.footerWrap}>
        <Footer />
      </div>
    </div>
  );
}
