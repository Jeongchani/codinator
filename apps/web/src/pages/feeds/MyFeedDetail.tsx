import { useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import type { GetFeedPostDetailResponse } from "@codinator/contracts";
import { ChevronLeft, ChevronRight, ThumbsDown, ThumbsUp } from "lucide-react";
import {
  clearAuthTokens,
  fetcher,
  getAuthHeaders,
  getPrimaryPostImageUrl,
  resolveAssetUrl,
} from "../../lib/api";
import styles from "./MyFeedDetail.module.css";

type RouteParams = {
  postId?: string;
};

type PreviewPost = {
  id?: number;
  postId?: number;
  imageUrl?: string;
  nickname?: string;
};

type LocationState = {
  post?: PreviewPost;
};

type FeedbackGroup = {
  type: "like" | "dislike";
  keywords: string[];
};

type WearItem = {
  id: number;
  brand: string;
  name: string;
  imageUrl?: string;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function toSafeString(value: unknown): string | undefined {
  if (typeof value !== "string") return undefined;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

function toSafeNumber(value: unknown): number | undefined {
  if (typeof value === "number" && Number.isFinite(value)) return value;

  if (typeof value === "string") {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) return parsed;
  }

  return undefined;
}

function formatFullDate(value?: string) {
  if (!value) return "-";

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";

  return new Intl.DateTimeFormat("ko-KR", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}

function toHashTag(value: string): string {
  const trimmed = value.trim();
  if (!trimmed) return "";
  return trimmed.startsWith("#") ? trimmed : `#${trimmed}`;
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

function getStoredAccessToken(): string | undefined {
  if (typeof window === "undefined") return undefined;

  return (
    window.localStorage.getItem("accessToken") ??
    window.localStorage.getItem("token") ??
    undefined
  );
}

function getCurrentUserId(): number | undefined {
  if (typeof window === "undefined") return undefined;

  const rawCandidates = [
    window.localStorage.getItem("userId"),
    window.localStorage.getItem("id"),
    window.localStorage.getItem("memberId"),
  ];

  for (const raw of rawCandidates) {
    const parsed = toSafeNumber(raw);
    if (parsed !== undefined) return parsed;
  }

  const token = getStoredAccessToken();
  if (!token) return undefined;

  const payload = decodeJwtPayload(token);
  if (!payload) return undefined;

  return (
    toSafeNumber(payload.userId) ??
    toSafeNumber(payload.memberId) ??
    toSafeNumber(payload.id) ??
    toSafeNumber(payload.sub)
  );
}

function extractConceptKeywords(post: GetFeedPostDetailResponse): string[] {
  const list = Array.isArray(post.feedbackSummary) ? post.feedbackSummary : [];

  return [...list]
    .sort((a, b) => b.count - a.count)
    .map((item) => toHashTag(item.label))
    .filter((value) => value.length > 0)
    .slice(0, 5);
}

function extractFeedbackGroups(post: GetFeedPostDetailResponse): FeedbackGroup[] {
  const list = Array.isArray(post.feedbackSummary) ? post.feedbackSummary : [];

  const likeKeywords = [...list]
    .filter((item) => item.voteChoice === "LIKE")
    .sort((a, b) => b.count - a.count)
    .map((item) => toHashTag(item.label))
    .filter((value) => value.length > 0);

  const dislikeKeywords = [...list]
    .filter((item) => item.voteChoice === "DISLIKE")
    .sort((a, b) => b.count - a.count)
    .map((item) => toHashTag(item.label))
    .filter((value) => value.length > 0);

  const groups: FeedbackGroup[] = [];

  if (likeKeywords.length > 0) {
    groups.push({
      type: "like",
      keywords: likeKeywords,
    });
  }

  if (dislikeKeywords.length > 0) {
    groups.push({
      type: "dislike",
      keywords: dislikeKeywords,
    });
  }

  return groups;
}

function extractWearItems(post: GetFeedPostDetailResponse): WearItem[] {
  const rawItems = Array.isArray(post.outfitItems) ? post.outfitItems : [];

  return rawItems.map((item, index) => {
    const record = item as unknown;

    if (!isRecord(record)) {
      return {
        id: index + 1,
        brand: "상품 브랜드",
        name: "상품 이름",
      };
    }

    return {
      id: toSafeNumber(record.id) ?? index + 1,
      brand:
        toSafeString(record.brand) ??
        toSafeString(record.category) ??
        "상품 브랜드",
      name:
        toSafeString(record.itemName) ??
        toSafeString(record.name) ??
        toSafeString(record.category) ??
        "상품 이름",
      imageUrl: undefined,
    };
  });
}

export default function MyFeedDetail() {
  const navigate = useNavigate();
  const location = useLocation();
  const { postId } = useParams<RouteParams>();

  const locationState = location.state as LocationState | undefined;
  const previewPost = locationState?.post;

  const resolvedPostId =
    toSafeNumber(postId) ??
    previewPost?.id ??
    previewPost?.postId;

  const currentUserId = useMemo(() => getCurrentUserId(), []);

  const [postData, setPostData] = useState<GetFeedPostDetailResponse | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string>("");

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      if (!resolvedPostId) {
        setError("게시글 정보가 없습니다.");
        setLoading(false);
        return;
      }

      try {
        setLoading(true);
        setError("");

        const endpointCandidates = [
          `/users/me/feed/${resolvedPostId}`,
          currentUserId ? `/users/${currentUserId}/feed/${resolvedPostId}` : null,
        ].filter((value): value is string => Boolean(value));

        let loaded = false;
        let lastMessage = "피드 상세를 불러오지 못했습니다.";

        for (const endpoint of endpointCandidates) {
          try {
            const detail = await fetcher<GetFeedPostDetailResponse>(endpoint, {
              headers: getAuthHeaders(),
            });

            if (cancelled) return;

            setPostData(detail);
            loaded = true;
            break;
          } catch (err: unknown) {
            const message =
              err instanceof Error ? err.message : "피드 상세를 불러오지 못했습니다.";

            lastMessage = message;

            if (
              message.includes("Unauthorized") ||
              message.includes("로그인이 필요합니다") ||
              message.includes("401")
            ) {
              clearAuthTokens();
              navigate("/login", { replace: true });
              return;
            }

            const isNotFound =
              message.includes("404") ||
              message.includes("Not Found") ||
              message.includes("찾을 수 없습니다");

            if (!isNotFound) {
              break;
            }
          }
        }

        if (!cancelled && !loaded) {
          setError(lastMessage);
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
  }, [currentUserId, navigate, resolvedPostId]);

  const likeCount = postData?.voteSummary.likeCount ?? 0;
  const dislikeCount = postData?.voteSummary.dislikeCount ?? 0;
  const totalVoteCount = likeCount + dislikeCount;

  const likePercent =
    totalVoteCount > 0 ? Math.round((likeCount / totalVoteCount) * 100) : 0;

  const dislikePercent =
    totalVoteCount > 0 ? Math.round((dislikeCount / totalVoteCount) * 100) : 0;

  const conceptKeywords = useMemo(
    () => (postData ? extractConceptKeywords(postData) : []),
    [postData]
  );

  const feedbackGroups = useMemo(
    () => (postData ? extractFeedbackGroups(postData) : []),
    [postData]
  );

  const wearItems = useMemo(
    () => (postData ? extractWearItems(postData) : []),
    [postData]
  );

  const heroImageUrl = postData?.images?.length
    ? getPrimaryPostImageUrl(postData)
    : previewPost?.imageUrl
    ? resolveAssetUrl(previewPost.imageUrl)
    : undefined;

  const titleText =
    postData?.author.nickname ??
    previewPost?.nickname ??
    "내 피드";

  const descriptionText = loading
    ? "불러오는 중..."
    : error
    ? error
    : `${formatFullDate(postData?.createdAt)}\n${postData?.content || "설명이 없습니다."}`;

  const handleMoveEdit = () => {
    navigate("/myFeedEdit", {
      state: {
        post: {
          id: postData?.postId ?? resolvedPostId,
          imageUrl: heroImageUrl,
          nickname: titleText,
          content: postData?.content ?? "",
          outfitItems: wearItems,
        },
      },
    });
  };

  return (
    <div className={styles.container}>
      <div className={styles.scrollArea}>
        <section className={styles.heroSection}>
          <div className={styles.heroImage}>
            {heroImageUrl ? (
              <img
                src={heroImageUrl}
                alt={titleText}
                className={styles.heroImageTag}
              />
            ) : null}

            <button
              type="button"
              className={styles.backButton}
              aria-label="뒤로가기"
              onClick={() => navigate(-1)}
            >
              <ChevronLeft size={18} strokeWidth={2.25} />
            </button>
          </div>
        </section>

        <section className={styles.infoSection}>
          <div className={styles.infoText}>
            <h1 className={styles.title}>{titleText}</h1>
            <p className={styles.description}>{descriptionText}</p>
          </div>

          <button
            type="button"
            className={styles.editButton}
            onClick={handleMoveEdit}
          >
            수정하기
          </button>
        </section>

        <section className={styles.keywordSection}>
          <div className={styles.keywordRow}>
            {conceptKeywords.length > 0 ? (
              conceptKeywords.map((keyword, index) => (
                <span key={`${keyword}-${index}`} className={styles.conceptChip}>
                  {keyword}
                </span>
              ))
            ) : (
              <span className={styles.conceptChip}>#키워드없음</span>
            )}
          </div>
        </section>

        <div className={styles.divider} />

        <section className={styles.feedbackScoreSection}>
          <h2 className={styles.sectionTitle}>내가 받은 피드백 수치</h2>

          <div className={styles.scoreBlock}>
            <div className={styles.likeRow}>
              <div className={styles.likeBarTrack}>
                <div
                  className={styles.likeBarFill}
                  style={{ width: `${likePercent}%` }}
                />
              </div>

              <div className={styles.likePercent}>
                <span className={styles.likePercentNumber}>{likePercent}</span>
                <span className={styles.likePercentUnit}>%</span>
              </div>
            </div>

            <div className={styles.dislikeRow}>
              <div className={styles.dislikeBarTrack}>
                <div
                  className={styles.dislikeBarFill}
                  style={{ width: `${dislikePercent}%` }}
                />
              </div>
              <span className={styles.dislikePercent}>{dislikePercent}%</span>
            </div>
          </div>
        </section>

        <section className={styles.feedbackKeywordSection}>
          <h2 className={styles.sectionTitle}>내가 받은 피드백 키워드</h2>

          <div className={styles.feedbackList}>
            {feedbackGroups.length > 0 ? (
              feedbackGroups.map((group, index) => (
                <div key={`${group.type}-${index}`} className={styles.feedbackItem}>
                  <div className={styles.feedbackIconWrap}>
                    {group.type === "like" ? (
                      <ThumbsUp size={14} strokeWidth={2.2} />
                    ) : (
                      <ThumbsDown size={14} strokeWidth={2.2} />
                    )}
                  </div>

                  <div className={styles.feedbackChips}>
                    {group.keywords.map((keyword, keywordIndex) => (
                      <span
                        key={`${group.type}-${keyword}-${keywordIndex}`}
                        className={styles.feedbackChip}
                      >
                        {keyword}
                      </span>
                    ))}
                  </div>
                </div>
              ))
            ) : (
              <div className={styles.feedbackItem}>
                <div className={styles.feedbackIconWrap}>
                  <ThumbsUp size={14} strokeWidth={2.2} />
                </div>
                <div className={styles.feedbackChips}>
                  <span className={styles.feedbackChip}>아직 키워드가 없어요</span>
                </div>
              </div>
            )}
          </div>
        </section>

        <div className={styles.divider} />

        <section className={styles.itemSection}>
          <div className={styles.itemHeader}>
            <h2 className={styles.sectionTitle}>착용 아이템</h2>

            <button type="button" className={styles.moreButton}>
              <span>더보기</span>
              <ChevronRight size={13} strokeWidth={2.2} />
            </button>
          </div>

          <div className={styles.itemScroller}>
            {wearItems.length > 0 ? (
              wearItems.map((item) => (
                <article key={item.id} className={styles.itemCard}>
                  <div className={styles.itemImage}>
                    {item.imageUrl ? (
                      <img
                        src={item.imageUrl}
                        alt={item.name}
                        className={styles.itemImageTag}
                      />
                    ) : null}
                  </div>

                  <div className={styles.itemInfo}>
                    <p className={styles.itemBrand}>{item.brand}</p>
                    <p className={styles.itemName}>{item.name}</p>
                  </div>
                </article>
              ))
            ) : (
              <article className={styles.itemCard}>
                <div className={styles.itemImage} />
                <div className={styles.itemInfo}>
                  <p className={styles.itemBrand}>등록된 아이템 없음</p>
                  <p className={styles.itemName}>-</p>
                </div>
              </article>
            )}
          </div>
        </section>
      </div>
    </div>
  );
}