import React, { useCallback, useEffect, useState } from "react";
import { Bookmark, ChevronLeft } from "lucide-react";
import { useNavigate, useParams } from "react-router-dom";
import type { GetMyBookmarksResponse, GetUserFeedResponse } from "@codinator/contracts";
import {
  clearAuthTokens,
  fetcher,
  getAuthHeaders,
  resolveAssetUrl,
} from "../../lib/api";
import styles from "./UserFeeds.module.css";

type FeedListItem = GetUserFeedResponse["items"][number];

type FeedCardItem = {
  postId: number;
  imageUrl: string;
  createdAt: string;
  rankingPeriods: string[];
};

const isAuthError = (message: string) => {
  return (
    message.includes("Unauthorized") ||
    message.includes("로그인이 필요합니다") ||
    message.includes("401")
  );
};

function sortByLatest(items: FeedListItem[]) {
  return [...items].sort((a, b) => {
    const aTime = new Date(a.createdAt).getTime();
    const bTime = new Date(b.createdAt).getTime();
    return bTime - aTime;
  });
}

export default function UserFeed() {
  const navigate = useNavigate();
  const { userId } = useParams();

  const [displayUserName, setDisplayUserName] = useState("닉네임");
  const [items, setItems] = useState<FeedCardItem[]>([]);
  const [bookmarks, setBookmarks] = useState<Record<number, boolean>>({});
  const [loading, setLoading] = useState(true);
  const [bookmarkLoadingIds, setBookmarkLoadingIds] = useState<number[]>([]);
  const [error, setError] = useState("");

  const moveToLogin = useCallback(() => {
    clearAuthTokens();
    navigate("/login", { replace: true });
  }, [navigate]);

  const loadBookmarks = useCallback(async () => {
    try {
      const data = await fetcher<GetMyBookmarksResponse>("/users/me/bookmarks", {
        headers: getAuthHeaders(),
      });

      const nextMap = data.items.reduce<Record<number, boolean>>((acc, item) => {
        acc[item.postId] = true;
        return acc;
      }, {});

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
    let cancelled = false;

    const load = async () => {
      if (!userId) {
        setError("유저 정보가 없습니다.");
        setLoading(false);
        return;
      }

      try {
        setLoading(true);
        setError("");
        setItems([]);

        const feed = await fetcher<GetUserFeedResponse>(`/users/${userId}/feed`, {
          headers: getAuthHeaders(),
        });

        if (cancelled) return;

        setDisplayUserName(feed.user?.nickname ?? "닉네임");

        const latestItems = sortByLatest(feed.items ?? []);
        const mappedItems: FeedCardItem[] = latestItems.map((item) => ({
          postId: item.postId,
          imageUrl: resolveAssetUrl(item.thumbnailUrl),
          createdAt: item.createdAt,
          rankingPeriods: item.rankingPeriods ?? [],
        }));

        setItems(mappedItems);
      } catch (err) {
        const message =
          err instanceof Error ? err.message : "피드를 불러오지 못했습니다.";

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

  const handleBack = () => {
    navigate(-1);
  };

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

    try {
      await fetcher(`/posts/${postId}/bookmarks`, {
        method: isBookmarked ? "DELETE" : "POST",
        headers: getAuthHeaders(),
      });

      setBookmarks((prev) => ({
        ...prev,
        [postId]: !isBookmarked,
      }));
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "북마크 처리에 실패했습니다.";

      if (isAuthError(message)) {
        moveToLogin();
        return;
      }

      window.alert(message);
    } finally {
      setBookmarkLoadingIds((prev) => prev.filter((id) => id !== postId));
    }
  };

  const handleClickCard = (item: FeedCardItem) => {
    navigate(`/user/${userId}/feed/${item.postId}`, {
      state: {
        userId: Number(userId),
        post: {
          postId: item.postId,
          authorId: Number(userId),
          imageUrl: item.imageUrl,
          createdAt: item.createdAt,
          nickname: displayUserName,
        },
      },
    });
  };

  return (
    <div className={styles.container}>
      <header className={styles.header}>
        <div className={styles.headerInner}>
          <button
            type="button"
            className={styles.headerIconButton}
            onClick={handleBack}
            aria-label="뒤로가기"
          >
            <ChevronLeft size={24} strokeWidth={2.2} />
          </button>

          <h1 className={styles.title}>{displayUserName}</h1>

          <div className={styles.rightPlaceholder} />
        </div>
      </header>

      <main className={styles.contentArea}>
        {loading && items.length === 0 ? (
          <div className={styles.messageBox}>불러오는 중...</div>
        ) : null}

        {!loading && error ? (
          <div className={styles.messageBox}>{error}</div>
        ) : null}

        {!loading && !error && items.length === 0 ? (
          <div className={styles.messageBox}>공개된 피드 게시글이 없습니다.</div>
        ) : null}

        {!error && items.length > 0 ? (
          <div className={styles.feedGrid}>
            {items.map((item) => {
              const isBookmarked = Boolean(bookmarks[item.postId]);
              const isBookmarkLoading = bookmarkLoadingIds.includes(item.postId);

              return (
                <article
                  key={item.postId}
                  className={styles.feedCard}
                  onClick={() => handleClickCard(item)}
                  role="button"
                  tabIndex={0}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      handleClickCard(item);
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
                      aria-label={isBookmarked ? "북마크 해제" : "북마크 추가"}
                      onClick={(e) => toggleBookmark(e, item.postId)}
                      disabled={isBookmarkLoading}
                    >
                      <Bookmark
                        size={12}
                        strokeWidth={2.2}
                        className={
                          isBookmarked
                            ? styles.bookmarkFilled
                            : styles.bookmarkDefault
                        }
                        fill={isBookmarked ? "currentColor" : "none"}
                      />
                    </button>
                  </div>
                </article>
              );
            })}
          </div>
        ) : null}
      </main>
    </div>
  );
}
