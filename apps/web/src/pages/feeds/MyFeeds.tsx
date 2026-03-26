import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  clearAuthTokens,
  fetcher,
  getAuthHeaders,
  resolveAssetUrl,
} from "../../lib/api";
import styles from "./MyFeeds.module.css";

type FeedStatus = "evaluating" | "completed";

type FeedCardItem = {
  id: number;
  authorId?: number;
  imageUrl?: string;
  content: string;
  createdAt?: string;
  likeCount: number;
  dislikeCount: number;
  status: FeedStatus;
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

function toStringValue(value: unknown): string | undefined {
  if (typeof value !== "string") return undefined;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
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
    const padded = base64.padEnd(base64.length + ((4 - (base64.length % 4)) % 4), "=");
    const decoded = atob(padded);
    const json = decodeURIComponent(
      Array.from(decoded)
        .map((char) => `%${char.charCodeAt(0).toString(16).padStart(2, "0")}`)
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

function findFirstArray(value: unknown): unknown[] {
  if (Array.isArray(value)) return value;
  if (!isRecord(value)) return [];

  const preferredKeys = [
    "items",
    "feeds",
    "posts",
    "data",
    "results",
    "content",
    "list",
  ];

  for (const key of preferredKeys) {
    const nested = findFirstArray(value[key]);
    if (nested.length > 0) return nested;
  }

  for (const nestedValue of Object.values(value)) {
    const nested = findFirstArray(nestedValue);
    if (nested.length > 0) return nested;
  }

  return [];
}

function extractImageUrl(item: Record<string, unknown>): string | undefined {
  const direct =
    toStringValue(item.imageUrl) ??
    toStringValue(item.thumbnailUrl) ??
    toStringValue(item.thumbnail) ??
    toStringValue(item.image);

  if (direct) return resolveAssetUrl(direct);

  const image = item.imageObject;
  if (isRecord(image)) {
    const nested =
      toStringValue(image.imageUrl) ??
      toStringValue(image.thumbnailUrl) ??
      toStringValue(image.url);

    if (nested) return resolveAssetUrl(nested);
  }

  const imageRecord = item.image;
  if (isRecord(imageRecord)) {
    const nested =
      toStringValue(imageRecord.imageUrl) ??
      toStringValue(imageRecord.thumbnailUrl) ??
      toStringValue(imageRecord.url);

    if (nested) return resolveAssetUrl(nested);
  }

  const images = item.images;
  if (Array.isArray(images) && images.length > 0) {
    const firstImage = images[0];
    if (isRecord(firstImage)) {
      const nested =
        toStringValue(firstImage.imageUrl) ??
        toStringValue(firstImage.thumbnailUrl) ??
        toStringValue(firstImage.url);

      if (nested) return resolveAssetUrl(nested);
    }
  }

  return undefined;
}

function extractAuthorId(
  wrapper: Record<string, unknown>,
  postLike: Record<string, unknown>,
  fallbackUserId?: number
): number | undefined {
  const author = postLike.author;
  if (isRecord(author)) {
    const authorId = toNumber(author.id);
    if (authorId !== undefined) return authorId;
  }

  const user = postLike.user;
  if (isRecord(user)) {
    const userId = toNumber(user.id);
    if (userId !== undefined) return userId;
  }

  return (
    toNumber(postLike.authorId) ??
    toNumber(postLike.userId) ??
    toNumber(postLike.memberId) ??
    toNumber(wrapper.authorId) ??
    toNumber(wrapper.userId) ??
    toNumber(wrapper.memberId) ??
    fallbackUserId
  );
}

function extractCounts(item: Record<string, unknown>): {
  likeCount: number;
  dislikeCount: number;
} {
  const voteSummary = item.voteSummary;

  if (isRecord(voteSummary)) {
    return {
      likeCount: toNumber(voteSummary.likeCount) ?? 0,
      dislikeCount: toNumber(voteSummary.dislikeCount) ?? 0,
    };
  }

  return {
    likeCount:
      toNumber(item.likeCount) ??
      toNumber(item.likes) ??
      toNumber(item.heartCount) ??
      0,
    dislikeCount:
      toNumber(item.dislikeCount) ??
      toNumber(item.dislikes) ??
      0,
  };
}

function normalizeStatusText(value?: string): string {
  return (value ?? "").trim().toUpperCase().replace(/[\s-]/g, "_");
}

function extractStatus(
  wrapper: Record<string, unknown>,
  postLike: Record<string, unknown>,
  evaluationLike?: Record<string, unknown>
): FeedStatus {
  const rawCandidates = [
    evaluationLike ? toStringValue(evaluationLike.status) : undefined,
    toStringValue(wrapper.evaluationStatus),
    toStringValue(postLike.evaluationStatus),
    toStringValue(wrapper.postStatus),
    toStringValue(postLike.postStatus),
    toStringValue(wrapper.status),
    toStringValue(postLike.status),
  ];

  const evaluatingSet = new Set([
    "OPEN",
    "EVALUATING",
    "IN_PROGRESS",
    "ONGOING",
    "PENDING",
    "ACTIVE",
    "READY_FOR_EVALUATION",
    "UNDER_REVIEW",
  ]);

  const completedSet = new Set([
    "ENDED",
    "COMPLETED",
    "FINISHED",
    "CLOSED",
    "DONE",
    "PUBLISHED",
    "APPROVED",
  ]);

  for (const raw of rawCandidates) {
    const normalized = normalizeStatusText(raw);
    if (!normalized) continue;

    if (evaluatingSet.has(normalized)) return "evaluating";
    if (completedSet.has(normalized)) return "completed";
  }

  return "completed";
}

function normalizeFeedItems(
  payload: unknown,
  fallbackUserId?: number
): FeedCardItem[] {
  const list = findFirstArray(payload);

  return list.reduce<FeedCardItem[]>((acc, current) => {
    if (!isRecord(current)) return acc;

    const postLike = isRecord(current.post) ? current.post : current;
    const evaluationLike = isRecord(current.evaluation) ? current.evaluation : undefined;

    const id =
      toNumber(postLike.id) ??
      toNumber(current.postId) ??
      toNumber(current.id);

    if (id === undefined) return acc;

    const counts = extractCounts(postLike);

    const content =
      toStringValue(postLike.content) ??
      toStringValue(postLike.description) ??
      toStringValue(postLike.caption) ??
      toStringValue(current.content) ??
      "피드 설명이 없습니다.";

    const createdAt =
      toStringValue(postLike.createdAt) ??
      toStringValue(postLike.updatedAt) ??
      toStringValue(current.createdAt) ??
      toStringValue(current.updatedAt);

    acc.push({
      id,
      authorId: extractAuthorId(current, postLike, fallbackUserId),
      imageUrl: extractImageUrl(postLike) ?? extractImageUrl(current),
      content,
      createdAt,
      likeCount: counts.likeCount,
      dislikeCount: counts.dislikeCount,
      status: extractStatus(current, postLike, evaluationLike),
    });

    return acc;
  }, []);
}

function formatDate(value?: string): string {
  if (!value) return "";

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";

  return new Intl.DateTimeFormat("ko-KR", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}

function getErrorMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  return "내 피드를 불러오지 못했습니다.";
}

function sortFeeds(items: FeedCardItem[]): FeedCardItem[] {
  return [...items].sort((a, b) => {
    const aTime = a.createdAt ? new Date(a.createdAt).getTime() : 0;
    const bTime = b.createdAt ? new Date(b.createdAt).getTime() : 0;

    if (aTime !== bTime) return bTime - aTime;
    return b.id - a.id;
  });
}

function BackIcon() {
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
        d="M15.5 5L8.5 12L15.5 19"
        stroke="currentColor"
        strokeWidth="2.2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function HeartIcon() {
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

type FeedSectionProps = {
  title: string;
  count: number;
  items: FeedCardItem[];
  onOpenDetail: (item: FeedCardItem) => void;
};

function FeedSection({
  title,
  count,
  items,
  onOpenDetail,
}: FeedSectionProps) {
  return (
    <section className={styles.feedSection}>
      <div className={styles.feedSectionHeader}>
        <h2 className={styles.feedSectionTitle}>{title}</h2>
        <span className={styles.feedSectionCount}>{count}개</span>
      </div>

      {items.length === 0 ? (
        <div className={styles.emptySectionBox}>
          <p className={styles.emptySectionText}>
            {title === "평가중"
              ? "평가중인 피드가 없어요."
              : "평가가 끝난 피드가 없어요."}
          </p>
        </div>
      ) : (
        <div className={styles.feedGrid}>
          {items.map((item) => (
            <button
              key={item.id}
              type="button"
              className={styles.card}
              onClick={() => onOpenDetail(item)}
            >
              <div className={styles.cardImageWrap}>
                {item.imageUrl ? (
                  <img
                    src={item.imageUrl}
                    alt={item.content}
                    className={styles.cardImage}
                  />
                ) : (
                  <div className={styles.cardImageFallback} />
                )}
              </div>

              <div className={styles.cardBody}>
                <p className={styles.cardContent}>{item.content}</p>

                <div className={styles.cardMetaRow}>
                  <span className={styles.cardDate}>
                    {formatDate(item.createdAt)}
                  </span>

                  <span className={styles.cardLikeWrap}>
                    <HeartIcon />
                    {item.likeCount}
                  </span>
                </div>
              </div>
            </button>
          ))}
        </div>
      )}
    </section>
  );
}

export default function MyFeeds() {
  const navigate = useNavigate();
  const [feeds, setFeeds] = useState<FeedCardItem[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string>("");

  const currentUserId = useMemo(() => getCurrentUserId(), []);

  useEffect(() => {
    let isMounted = true;

    const loadMyFeeds = async () => {
      setLoading(true);
      setError("");

      const endpointCandidates = [
        "/users/me/feeds",
        "/users/me/feed",
        "/posts/me",
        "/posts/my",
        currentUserId ? `/users/${currentUserId}/feeds` : null,
        currentUserId ? `/users/${currentUserId}/feed` : null,
        "/posts",
      ].filter((value): value is string => Boolean(value));

      let lastErrorMessage = "내 피드를 불러오지 못했습니다.";
      let lastEmptyFeeds: FeedCardItem[] = [];

      for (let index = 0; index < endpointCandidates.length; index += 1) {
        const endpoint = endpointCandidates[index];

        try {
          const response = await fetcher<unknown>(endpoint, {
            headers: getAuthHeaders(),
          });

          const normalized = normalizeFeedItems(response, currentUserId);

          const myFeedsOnly =
            currentUserId !== undefined
              ? normalized.filter((item) => {
                  if (item.authorId === undefined) return true;
                  return item.authorId === currentUserId;
                })
              : normalized;

          const sorted = sortFeeds(myFeedsOnly);

          if (sorted.length > 0) {
            if (!isMounted) return;
            setFeeds(sorted);
            setLoading(false);
            return;
          }

          lastEmptyFeeds = sorted;

          const isLastCandidate = index === endpointCandidates.length - 1;
          if (isLastCandidate) {
            if (!isMounted) return;
            setFeeds(lastEmptyFeeds);
            setLoading(false);
            return;
          }
        } catch (error: unknown) {
          const message = getErrorMessage(error);
          lastErrorMessage = message;

          if (
            message.includes("Unauthorized") ||
            message.includes("로그인이 필요합니다")
          ) {
            clearAuthTokens();
            navigate("/login");
            return;
          }
        }
      }

      if (!isMounted) return;
      setError(lastErrorMessage);
      setLoading(false);
    };

    void loadMyFeeds();

    return () => {
      isMounted = false;
    };
  }, [currentUserId, navigate]);

  const evaluatingFeeds = useMemo(
    () => feeds.filter((item) => item.status === "evaluating"),
    [feeds]
  );

  const completedFeeds = useMemo(
    () => feeds.filter((item) => item.status === "completed"),
    [feeds]
  );

  const handleOpenDetail = (item: FeedCardItem): void => {
    const resolvedAuthorId = item.authorId ?? currentUserId;
    if (!resolvedAuthorId) return;

    navigate(`/users/${resolvedAuthorId}/feed/${item.id}`);
  };

  return (
    <div className={styles.container}>
      <div className={styles.scrollArea}>
        <header className={styles.header}>
          <button
            type="button"
            className={styles.backButton}
            onClick={() => navigate(-1)}
            aria-label="뒤로가기"
          >
            <BackIcon />
          </button>

          <h1 className={styles.title}>내 피드</h1>
          <div className={styles.headerRightSpace} />
        </header>

        <section className={styles.summarySection}>
          <p className={styles.summaryTitle}>내가 올린 코디</p>
          <p className={styles.summaryCount}>
            총 <span>{feeds.length}</span>개
          </p>
        </section>

        {loading ? (
          <section className={styles.feedGrid}>
            {Array.from({ length: 6 }).map((_, index) => (
              <article key={index} className={styles.cardSkeleton}>
                <div className={styles.cardImageSkeleton} />
                <div className={styles.cardTextSkeleton} />
                <div className={styles.cardSubTextSkeleton} />
              </article>
            ))}
          </section>
        ) : error ? (
          <section className={styles.stateSection}>
            <p className={styles.stateTitle}>불러오기에 실패했어요</p>
            <p className={styles.stateDescription}>{error}</p>
          </section>
        ) : feeds.length === 0 ? (
          <section className={styles.stateSection}>
            <p className={styles.stateTitle}>아직 올린 피드가 없어요</p>
            <p className={styles.stateDescription}>
              첫 코디를 올리면 여기에 내 피드가 보여요.
            </p>
          </section>
        ) : (
          <>
            <FeedSection
              title="평가중"
              count={evaluatingFeeds.length}
              items={evaluatingFeeds}
              onOpenDetail={handleOpenDetail}
            />
            <FeedSection
              title="평가완료"
              count={completedFeeds.length}
              items={completedFeeds}
              onOpenDetail={handleOpenDetail}
            />
          </>
        )}
      </div>
    </div>
  );
}