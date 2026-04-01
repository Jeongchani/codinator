import React, { useEffect, useMemo, useState } from "react";
import { Bookmark, Search, ThumbsDown, ThumbsUp } from "lucide-react";
import { useNavigate } from "react-router-dom";
import styles from "./RankingZone.module.css";
import { fetcher, getAuthHeaders, resolveAssetUrl } from "../../lib/api";
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
    postId: string
  ) => void;
};

function RankingCard({
  item,
  onCardClick,
  onToggleBookmark,
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
          aria-label="북마크"
          onClick={(e) => onToggleBookmark(e, String(item.postId ?? item.id))}
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
  onCardClick: (item: RankingCardItem) => void;
  onToggleBookmark: (
    e: React.MouseEvent<HTMLButtonElement>,
    postId: string
  ) => void;
};

function RankingSection({
  title,
  items,
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

  const [bookmarks, setBookmarks] = useState<Record<string, boolean>>(() => {
    const saved = localStorage.getItem("codinator_bookmarks");
    return saved ? (JSON.parse(saved) as Record<string, boolean>) : {};
  });

  // 추가된 부분: 사이드메뉴 열림 상태
  const [isSideMenuOpen, setIsSideMenuOpen] = useState(false);

  useEffect(() => {
    const syncBookmarks = () => {
      const saved = localStorage.getItem("codinator_bookmarks");
      setBookmarks(saved ? (JSON.parse(saved) as Record<string, boolean>) : {});
    };

    window.addEventListener("storage", syncBookmarks);
    return () => {
      window.removeEventListener("storage", syncBookmarks);
    };
  }, []);

  useEffect(() => {
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

        setWeeklyRankings(weeklyData.items ?? []);
        setMonthlyRankings(monthlyData.items ?? []);
      } catch (err) {
        console.error("랭킹 불러오기 실패:", err);

        const message =
          err instanceof Error
            ? err.message
            : "랭킹 데이터를 불러오지 못했습니다.";

        setError(message);
        setWeeklyRankings([]);
        setMonthlyRankings([]);
      } finally {
        setLoading(false);
      }
    };

    void loadRankings();
  }, []);

  const toggleBookmark = (
    e: React.MouseEvent<HTMLButtonElement>,
    postId: string
  ) => {
    e.preventDefault();
    e.stopPropagation();

    setBookmarks((prev) => {
      const next = { ...prev, [postId]: !prev[postId] };
      localStorage.setItem("codinator_bookmarks", JSON.stringify(next));
      return next;
    });
  };

  const handleCardClick = (item: RankingCardItem) => {
    if (!item.postId || !item.period) return;
    navigate(`/rankingDetail/${item.postId}?period=${item.period}`);
  };

  // 추가된 부분: 헤더 햄버거 버튼 클릭 시 나중에 SideMenu.tsx 연결할 함수
  const handleMenuClick = () => {
    setIsSideMenuOpen((prev) => !prev);
  };

  const convertRankingItem = (
    post: RankingItem,
    period: "WEEKLY" | "MONTHLY"
  ): RankingCardItem => {
    const postId = String(post.postId);

    return {
      id: post.postId,
      title: "게시글 컨셉 글\n최대 두줄 혹은 닉네임?",
      likeCount: post.likeCount ?? 0,
      dislikeCount: post.dislikeCount ?? 0,
      bookmarked: !!bookmarks[postId],
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
      {/* 추가된 부분: 기존 topBarArea 제거하고 실제 Header 연결 */}
      <Header onMenuClick={handleMenuClick} />

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
              onCardClick={handleCardClick}
              onToggleBookmark={toggleBookmark}
            />
            <RankingSection
              title="This Month"
              items={sections[1].items}
              onCardClick={handleCardClick}
              onToggleBookmark={toggleBookmark}
            />
          </>
        )}
      </div>

      {/* 추가된 부분: 나중에 SideMenu.tsx 자리 */}
      {isSideMenuOpen && (
        <div className={styles.sideMenuOverlay} onClick={handleMenuClick}>
          <div
            className={styles.sideMenuDummy}
            onClick={(e) => e.stopPropagation()}
          >
            <div className={styles.sideMenuTitle}>SideMenu 연결 예정</div>
            <button
              type="button"
              className={styles.sideMenuCloseButton}
              onClick={handleMenuClick}
            >
              닫기
            </button>
          </div>
        </div>
      )}
      <div className={styles.footerWrap}>
        <Footer />
      </div>
    </div>
  );
}