import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import type {
  GetFeedPostDetailResponse,
  GetUserFeedResponse,
} from "@codinator/contracts";
import { Heart, Plus } from "lucide-react";
import {
  clearAuthTokens,
  fetcher,
  getAuthHeaders,
  resolveAssetUrl,
} from "../../lib/api";
import styles from "./MyFeeds.module.css";

type FeedListItem = GetUserFeedResponse["items"][number];

type FeedCardItem = {
  postId: number;
  authorId: number;
  imageUrl?: string;
  createdAt: string;
  content: string;
  likeCount: number;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function toNumber(value: unknown): number | undefined {
  if (typeof value === "number" && Number.isFinite(value)) return value;

  if (typeof value === "string") {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) return parsed;
  }

  return undefined;
}

function getStoredAccessToken(): string | undefined {
  if (typeof window === "undefined") return undefined;

  return (
    window.localStorage.getItem("accessToken") ??
    window.localStorage.getItem("token") ??
    undefined
  );
}

function decodeJwtPayload(token: string): Record<string, unknown> | undefined {
  try {
    const parts = token.split(".");
    if (parts.length < 2) return undefined;

    const base64 = parts[1].replace(/-/g, "+").replace(/_/g, "/");
    const padded = base64.padEnd(
      base64.length + ((4 - (base64.length % 4)) % 4),
      "="
    );

    const decoded = atob(padded);
    const json = decodeURIComponent(
      Array.from(decoded)
        .map(
          (char) => `%${char.charCodeAt(0).toString(16).padStart(2, "0")}`
        )
        .join("")
    );

    const parsed: unknown = JSON.parse(json);
    return isRecord(parsed) ? parsed : undefined;
  } catch {
    return undefined;
  }
}

function getStoredUserId(): number | undefined {
  if (typeof window === "undefined") return undefined;

  const candidateKeys = ["id", "userId", "memberId"];

  for (const key of candidateKeys) {
    const raw = window.localStorage.getItem(key);
    if (!raw) continue;

    const direct = toNumber(raw);
    if (direct !== undefined) return direct;

    try {
      const parsed: unknown = JSON.parse(raw);
      const parsedNumber = toNumber(parsed);
      if (parsedNumber !== undefined) return parsedNumber;

      if (isRecord(parsed)) {
        const nested =
          toNumber(parsed.id) ??
          toNumber(parsed.userId) ??
          toNumber(parsed.memberId);

        if (nested !== undefined) return nested;
      }
    } catch {
      continue;
    }
  }

  return undefined;
}

function getCurrentUserId(): number | undefined {
  const fromStorage = getStoredUserId();
  if (fromStorage !== undefined) return fromStorage;

  const token = getStoredAccessToken();
  if (!token) return undefined;

  const payload = decodeJwtPayload(token);
  if (!payload) return undefined;

  return (
    toNumber(payload.userId) ??
    toNumber(payload.memberId) ??
    toNumber(payload.id) ??
    toNumber(payload.sub)
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

function HeartCountIcon() {
  return (
    <svg
      width="13"
      height="13"
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
    >
      <path
        d="M12.001 20.727L10.552 19.409C5.4 14.737 2 11.654 2 7.875C2 4.792 4.42 2.375 7.5 2.375C9.24 2.375 10.91 3.184 12.001 4.454C13.092 3.184 14.762 2.375 16.502 2.375C19.582 2.375 22.002 4.792 22.002 7.875C22.002 11.654 18.602 14.737 13.45 19.418L12.001 20.727Z"
        stroke="currentColor"
        strokeWidth="1.9"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function BookmarkHeart({ active }: { active: boolean }) {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
    >
      <path
        d="M12 21.35L10.55 20.03C5.4 15.36 2 12.28 2 8.5C2 5.42 4.42 3 7.5 3C9.24 3 10.91 3.81 12 5.09C13.09 3.81 14.76 3 16.5 3C19.58 3 22 5.42 22 8.5C22 12.28 18.6 15.36 13.45 20.03L12 21.35Z"
        fill={active ? "#FF3B30" : "rgba(255,255,255,0.88)"}
      />
    </svg>
  );
}

export default function MyFeeds() {
  const navigate = useNavigate();

  const [displayUserName, setDisplayUserName] = useState("내");
  const [items, setItems] = useState<FeedCardItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [bookmarks, setBookmarks] = useState<Record<string, boolean>>(() => {
    const saved = localStorage.getItem("codinator_bookmarks");
    return saved ? (JSON.parse(saved) as Record<string, boolean>) : {};
  });

  const currentUserId = useMemo(() => getCurrentUserId(), []);

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
      if (!currentUserId) {
        setError("로그인 사용자 정보를 찾을 수 없습니다.");
        setLoading(false);
        return;
      }

      try {
        setLoading(true);
        setError("");
        setItems([]);

        const headers = getAuthHeaders();

        let feed: GetUserFeedResponse | null = null;
        const feedCandidates = [
          "/users/me/feed",
          `/users/${currentUserId}/feed`,
        ];

        for (const endpoint of feedCandidates) {
          try {
            feed = await fetcher<GetUserFeedResponse>(endpoint, { headers });
            break;
          } catch (err: unknown) {
            const message =
              err instanceof Error ? err.message : "피드를 불러오지 못했습니다.";

            if (
              message.includes("Unauthorized") ||
              message.includes("로그인이 필요합니다") ||
              message.includes("인증")
            ) {
              clearAuthTokens();
              navigate("/login", { replace: true });
              return;
            }
          }
        }

        if (!feed) {
          throw new Error("내 피드를 불러오지 못했습니다.");
        }

        if (cancelled) return;

        setDisplayUserName(feed.user.nickname ?? "내");

        const latestItems = sortByLatest(feed.items ?? []);
        const filledItems: FeedCardItem[] = [];

        for (const item of latestItems) {
          let content = "";
          let likeCount = 0;

          const detailCandidates = [
            `/users/${feed.user.userId}/feed/${item.postId}`,
            `/users/${currentUserId}/feed/${item.postId}`,
          ];

          for (const endpoint of detailCandidates) {
            try {
              const detail = await fetcher<GetFeedPostDetailResponse>(endpoint, {
                headers,
              });

              content = detail.content?.trim() ?? "";
              likeCount = detail.voteSummary.likeCount ?? 0;
              break;
            } catch (detailErr: unknown) {
              const detailMessage =
                detailErr instanceof Error
                  ? detailErr.message
                  : "게시글 상세를 불러오지 못했습니다.";

              if (
                detailMessage.includes("Unauthorized") ||
                detailMessage.includes("로그인이 필요합니다") ||
                detailMessage.includes("인증")
              ) {
                clearAuthTokens();
                navigate("/login", { replace: true });
                return;
              }
            }
          }

          filledItems.push({
            postId: item.postId,
            authorId: feed.user.userId,
            imageUrl: resolveAssetUrl(item.thumbnailUrl),
            createdAt: item.createdAt,
            content,
            likeCount,
          });

          if (!cancelled) {
            setItems([...filledItems]);
          }
        }
      } catch (err: unknown) {
        const message =
          err instanceof Error ? err.message : "피드를 불러오지 못했습니다.";

        if (!cancelled) {
          setError(message);
        }

        if (
          message.includes("Unauthorized") ||
          message.includes("로그인이 필요합니다") ||
          message.includes("인증")
        ) {
          clearAuthTokens();
          navigate("/login", { replace: true });
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
  }, [currentUserId, navigate]);

  const toggleBookmark = (e: React.MouseEvent, postId: string) => {
    e.stopPropagation();

    setBookmarks((prev) => {
      const next = { ...prev, [postId]: !prev[postId] };
      localStorage.setItem("codinator_bookmarks", JSON.stringify(next));
      return next;
    });
  };

  const handleOpenDetail = (item: FeedCardItem) => {
    navigate(`/my-feed-detail/${item.postId}`, {
      state: {
        post: {
          id: item.postId,
          postId: item.postId,
          authorId: item.authorId,
          imageUrl: item.imageUrl,
          nickname: displayUserName,
        },
      },
    });
  };

  if (loading && items.length === 0) {
    return (
      <div className={styles.container}>
        <div className={styles.scrollArea}>
          <div className={styles.topBar}>
            <div className={styles.titlePill}>
              <h1 className={styles.pageTitle}>불러오는 중...</h1>
            </div>

            <button
              type="button"
              className={styles.uploadButton}
              aria-label="게시글 업로드"
              onClick={() => navigate("/post-upload")}
            >
              <Plus size={18} strokeWidth={2.4} />
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.container}>
      <div className={styles.scrollArea}>
        <div className={styles.topBar}>
          <div className={styles.titlePill}>
            <h1 className={styles.pageTitle}>내 피드 페이지</h1>
          </div>

          <button
            type="button"
            className={styles.uploadButton}
            aria-label="게시글 업로드"
            onClick={() => navigate("/post-upload")}
          >
            <Plus size={18} strokeWidth={2.4} />
          </button>
        </div>

        <div className={styles.content}>
          <section className={styles.summarySection}>
            <p className={styles.summaryTitle}>내가 올린 피드</p>
            <p className={styles.summaryCount}>총 {items.length}개</p>
          </section>

          {error ? <div className={styles.emptyText}>{error}</div> : null}

          {!error && items.length > 0 ? (
            <div className={styles.feedGrid}>
              {items.map((item) => {
                const postId = String(item.postId);

                return (
                  <article
                    key={item.postId}
                    className={styles.feedCard}
                    onClick={() => handleOpenDetail(item)}
                    role="button"
                    tabIndex={0}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault();
                        handleOpenDetail(item);
                      }
                    }}
                  >
                    <div className={styles.imageWrap}>
                      {item.imageUrl ? (
                        <img
                          src={item.imageUrl}
                          alt={`my-feed-${item.postId}`}
                          className={styles.feedImage}
                        />
                      ) : (
                        <div className={styles.placeholder} />
                      )}

                      <button
                        type="button"
                        className={styles.heartButton}
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
                        {item.content || "설명이 없습니다."}
                      </p>

                      <div className={styles.cardBottomRow}>
                        <span className={styles.likeCount}>
                          <HeartCountIcon />
                          {item.likeCount}
                        </span>
                      </div>
                    </div>
                  </article>
                );
              })}
            </div>
          ) : null}

          {!error && !loading && items.length === 0 ? (
            <div className={styles.emptyText}>공개된 피드 게시글이 없습니다.</div>
          ) : null}
        </div>
      </div>
    </div>
  );
}