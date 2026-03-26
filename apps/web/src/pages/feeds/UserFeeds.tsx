import React, { useEffect, useState } from "react";
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

function BackIcon() {
  return (
    <svg
      width="22"
      height="22"
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      <path
        d="M15.5 5L8.5 12L15.5 19"
        stroke="black"
        strokeWidth="2.2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function BookmarkHeart({ active }: { active: boolean }) {
  return (
    <svg
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      <path
        d="M12 21.35L10.55 20.03C5.4 15.36 2 12.28 2 8.5C2 5.42 4.42 3 7.5 3C9.24 3 10.91 3.81 12 5.09C13.09 3.81 14.76 3 16.5 3C19.58 3 22 5.42 22 8.5C22 12.28 18.6 15.36 13.45 20.03L12 21.35Z"
        fill={active ? "#FF3B30" : "rgba(255,255,255,0.75)"}
      />
    </svg>
  );
}

function formatShortDate(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";

  const year = String(date.getFullYear()).slice(2);
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");

  return `${year}.${month}.${day}`;
}

function sortByLatest(items: FeedListItem[]) {
  return [...items].sort((a, b) => {
    const aTime = new Date(a.createdAt).getTime();
    const bTime = new Date(b.createdAt).getTime();
    return bTime - aTime;
  });
}

export default function UserFeeds() {
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

        setDisplayUserName(feed.user.nickname ?? "닉네임");

        const latestItems = sortByLatest(feed.items ?? []);
        const filledItems: FeedCardItem[] = [];

        for (const item of latestItems) {
          let content = "";

          try {
            const detail = await fetcher<GetFeedPostDetailResponse>(
              `/users/${userId}/feed/${item.postId}`,
              {
                headers,
              }
            );

            content = detail.content?.trim() ?? "";
          } catch (detailErr) {
            const detailMessage =
              detailErr instanceof Error
                ? detailErr.message
                : "게시글 상세를 불러오지 못했습니다.";

            if (
              detailMessage.includes("Unauthorized") ||
              detailMessage.includes("로그인이 필요합니다")
            ) {
              clearAuthTokens();
              navigate("/login");
              return;
            }

            content = "";
          }

          filledItems.push({
            postId: item.postId,
            imageUrl: resolveAssetUrl(item.thumbnailUrl),
            createdAt: item.createdAt,
            content,
          });

          if (!cancelled) {
            setItems([...filledItems]);
          }
        }
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

  const toggleBookmark = (e: React.MouseEvent, postId: string) => {
    e.stopPropagation();

    setBookmarks((prev) => {
      const next = { ...prev, [postId]: !prev[postId] };
      localStorage.setItem("codinator_bookmarks", JSON.stringify(next));
      return next;
    });
  };

  const handleClickCard = (postId: number) => {
    navigate(`/user/${userId}/feed/${postId}`);
  };

  if (loading && items.length === 0) {
    return (
      <div className={styles.container}>
        <div className={styles.scrollArea}>
          <div className={styles.topBackground}>
            <div className={styles.header}>
              <h1 className={styles.pageTitle}>불러오는 중...</h1>

              <button
                type="button"
                className={styles.backButton}
                onClick={handleBack}
                aria-label="뒤로가기"
              >
                <BackIcon />
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.container}>
      <div className={styles.scrollArea}>
        <div className={styles.topBackground}>
          <div className={styles.header}>
            <h1 className={styles.pageTitle}>{displayUserName}님의 피드 페이지</h1>

            <button
              type="button"
              className={styles.backButton}
              onClick={handleBack}
              aria-label="뒤로가기"
            >
              <BackIcon />
            </button>
          </div>
        </div>

        <div className={styles.content}>
          {error ? <div className={styles.emptyText}>{error}</div> : null}

          {!error && items.length > 0 ? (
            <div className={styles.feedGrid}>
              {items.map((item) => {
                const postId = String(item.postId);

                return (
                  <article
                    key={item.postId}
                    className={styles.feedCard}
                    onClick={() => handleClickCard(item.postId)}
                    role="button"
                    tabIndex={0}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault();
                        handleClickCard(item.postId);
                      }
                    }}
                  >
                    <div className={styles.imageWrap}>
                      {item.imageUrl ? (
                        <img
                          src={item.imageUrl}
                          alt={`feed-${item.postId}`}
                          className={styles.feedImage}
                        />
                      ) : (
                        <div className={styles.placeholder} />
                      )}

                      <button
                        type="button"
                        className={styles.heartIcon}
                        onClick={(e) => toggleBookmark(e, postId)}
                        aria-label="북마크"
                      >
                        <BookmarkHeart active={!!bookmarks[postId]} />
                      </button>
                    </div>

                    <div className={styles.cardInfo}>
                      <p className={styles.cardDate}>
                        {formatShortDate(item.createdAt)}
                      </p>
                      <p className={styles.cardDescription}>
                        {item.content || " "}
                      </p>
                    </div>
                  </article>
                );
              })}
            </div>
          ) : null}

          {!error && !loading && items.length === 0 ? (
            <div className={styles.emptyText}>
              공개된 피드 게시글이 없습니다.
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}