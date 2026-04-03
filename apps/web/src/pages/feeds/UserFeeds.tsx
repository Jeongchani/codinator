import React, { useEffect, useState } from "react";
import { Bookmark, ChevronLeft } from "lucide-react";
import { useNavigate, useParams } from "react-router-dom";
import type {
  GetFeedPostDetailResponse,
  GetUserFeedResponse,
} from "@codinator/contracts";
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
  imageUrl?: string;
  createdAt: string;
  content: string;
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
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [bookmarks, setBookmarks] = useState<Record<string, boolean>>(() => {
    const saved = localStorage.getItem("codinator_bookmarks");
    return saved ? (JSON.parse(saved) as Record<string, boolean>) : {};
  });

  useEffect(() => {
    const syncBookmarks = () => {
      const saved = localStorage.getItem("codinator_bookmarks");
      setBookmarks(saved ? (JSON.parse(saved) as Record<string, boolean>) : {});
    };

    syncBookmarks();
    window.addEventListener("storage", syncBookmarks);

    return () => {
      window.removeEventListener("storage", syncBookmarks);
    };
  }, []);

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

        const headers = getAuthHeaders();

        const feed = await fetcher<GetUserFeedResponse>(`/users/${userId}/feed`, {
          headers,
        });

        if (cancelled) return;

        setDisplayUserName(feed.user?.nickname ?? "닉네임");

        const latestItems = sortByLatest(feed.items ?? []);

        const detailResults = await Promise.all(
          latestItems.map(async (item) => {
            try {
              const detail = await fetcher<GetFeedPostDetailResponse>(
                `/users/${userId}/feed/${item.postId}`,
                { headers }
              );

              return {
                postId: item.postId,
                imageUrl: resolveAssetUrl(item.thumbnailUrl),
                createdAt: item.createdAt,
                content: detail.content?.trim() ?? "",
              } satisfies FeedCardItem;
            } catch (detailErr) {
              const detailMessage =
                detailErr instanceof Error
                  ? detailErr.message
                  : "게시글 상세를 불러오지 못했습니다.";

              if (
                detailMessage.includes("Unauthorized") ||
                detailMessage.includes("로그인이 필요합니다")
              ) {
                throw detailErr;
              }

              return {
                postId: item.postId,
                imageUrl: resolveAssetUrl(item.thumbnailUrl),
                createdAt: item.createdAt,
                content: "",
              } satisfies FeedCardItem;
            }
          })
        );

        if (cancelled) return;
        setItems(detailResults);
      } catch (err) {
        const message =
          err instanceof Error ? err.message : "피드를 불러오지 못했습니다.";
        setError(message);

        if (
          message.includes("Unauthorized") ||
          message.includes("로그인이 필요합니다")
        ) {
          clearAuthTokens();
          navigate("/login");
          return;
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
  }, [navigate, userId]);

  const handleBack = () => {
    navigate(-1);
  };

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

  const handleClickCard = (item: FeedCardItem) => {
    navigate(`/user/${userId}/feed/${item.postId}`, {
      state: {
        post: {
          postId: item.postId,
          authorId: Number(userId),
          imageUrl: item.imageUrl,
          createdAt: item.createdAt,
          content: item.content,
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
              const postId = String(item.postId);

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
                      aria-label="북마크"
                      onClick={(e) => toggleBookmark(e, postId)}
                    >
                      <Bookmark
                        size={12}
                        strokeWidth={2.2}
                        className={
                          bookmarks[postId]
                            ? styles.bookmarkFilled
                            : styles.bookmarkDefault
                        }
                        fill={bookmarks[postId] ? "currentColor" : "none"}
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