import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import type { GetFeedPostDetailResponse } from "@codinator/contracts";
import {
  clearAuthTokens,
  fetcher,
  getAuthHeaders,
  resolveAssetUrl,
} from "../../lib/api";
import styles from "./UserFeedDetail.module.css";

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

type RouteParams = {
  userId: string;
  postId: string;
};

function ChevronLeftIcon() {
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
        stroke="black"
        strokeWidth="2.25"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function ChevronRightIcon() {
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
        d="M9 5L16 12L9 19"
        stroke="currentColor"
        strokeWidth="2.2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function ThumbsUpIcon() {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
    >
      <path
        d="M7 11V21M11 21H17.2C18.8802 21 19.7202 21 20.362 20.673C20.9265 20.3854 21.3854 19.9265 21.673 19.362C22 18.7202 22 17.8802 22 16.2V14.136C22 13.2999 22 12.8819 21.879 12.4901C21.4853 11.2146 20.3329 10.3361 19 10.3L14 10.3L15 5.5C15.0855 4.74498 14.6908 4.01758 14 3.7C13.3772 3.41367 12.6386 3.56664 12.18 4.08L7 11H5C4.06812 11 3.60218 11 3.23463 11.1522C2.74458 11.3552 2.35523 11.7446 2.15224 12.2346C2 12.6022 2 13.0681 2 14V18C2 18.9319 2 19.3978 2.15224 19.7654C2.35523 20.2554 2.74458 20.6448 3.23463 20.8478C3.60218 21 4.06812 21 5 21H7Z"
        stroke="black"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function ThumbsDownIcon() {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
    >
      <path
        d="M17 13V3M13 3H6.8C5.11984 3 4.27976 3 3.63803 3.32698C3.07354 3.6146 2.6146 4.07354 2.32698 4.63803C2 5.27976 2 6.11984 2 7.8V9.864C2 10.7001 2 11.1181 2.12101 11.5099C2.51472 12.7854 3.66708 13.6639 5 13.7H10L9 18.5C8.91447 19.255 9.30924 19.9824 10 20.3C10.6228 20.5863 11.3614 20.4334 11.82 19.92L17 13H19C19.9319 13 20.3978 13 20.7654 12.8478C21.2554 12.6448 21.6448 12.2554 21.8478 11.7654C22 11.3978 22 10.9319 22 10V6C22 5.06812 22 4.60218 21.8478 4.23463C21.6448 3.74458 21.2554 3.35523 20.7654 3.15224C20.3978 3 19.9319 3 19 3H17Z"
        stroke="black"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function toSafeString(value: unknown): string | undefined {
  if (typeof value !== "string") return undefined;

  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

function toSafeNumber(value: unknown): number | undefined {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }

  if (typeof value === "string") {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) {
      return parsed;
    }
  }

  return undefined;
}

function firstString(...values: unknown[]): string | undefined {
  for (const value of values) {
    const result = toSafeString(value);
    if (result) return result;
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

function normalizeKeywords(input: unknown): string[] {
  if (!Array.isArray(input)) return [];

  return input
    .map((value: unknown) => String(value).trim())
    .filter((value: string) => value.length > 0)
    .map((value: string) => (value.startsWith("#") ? value : `#${value}`));
}

function extractConceptKeywords(post: GetFeedPostDetailResponse): string[] {
  const rawPost = post as unknown;
  if (!isRecord(rawPost)) return [];

  const feedbackSummary = isRecord(rawPost.feedbackSummary)
    ? rawPost.feedbackSummary
    : undefined;

  const conceptKeywords = normalizeKeywords(rawPost.conceptKeywords);
  if (conceptKeywords.length > 0) return conceptKeywords;

  const styleKeywords = normalizeKeywords(rawPost.styleKeywords);
  if (styleKeywords.length > 0) return styleKeywords;

  return normalizeKeywords(feedbackSummary?.conceptKeywords);
}

function extractFeedbackGroups(post: GetFeedPostDetailResponse): FeedbackGroup[] {
  const rawPost = post as unknown;
  if (!isRecord(rawPost)) return [];

  const feedbackSummary = isRecord(rawPost.feedbackSummary)
    ? rawPost.feedbackSummary
    : undefined;

  const likeKeywords = normalizeKeywords(
    feedbackSummary?.likeKeywords ??
      feedbackSummary?.positiveKeywords ??
      feedbackSummary?.likedKeywords ??
      []
  );

  const dislikeKeywords = normalizeKeywords(
    feedbackSummary?.dislikeKeywords ??
      feedbackSummary?.negativeKeywords ??
      feedbackSummary?.dislikedKeywords ??
      []
  );

  const groups: FeedbackGroup[] = [];

  if (likeKeywords.length > 0) {
    groups.push({ type: "like", keywords: likeKeywords });
  }

  if (dislikeKeywords.length > 0) {
    groups.push({ type: "dislike", keywords: dislikeKeywords });
  }

  return groups;
}

function extractWearItems(post: GetFeedPostDetailResponse): WearItem[] {
  const rawItems = Array.isArray(post.outfitItems) ? post.outfitItems : [];

  return rawItems.reduce<WearItem[]>((acc, item, index) => {
    if (!isRecord(item)) {
      return acc;
    }

    const id = toSafeNumber(item.id) ?? index + 1;
    const brand = firstString(item.brand, item.category) ?? "상품 브랜드";
    const name =
      firstString(item.itemName, item.name, item.category) ?? "상품 이름";
    const rawImageUrl = firstString(item.imageUrl, item.thumbnailUrl);

    acc.push({
      id,
      brand,
      name,
      imageUrl: rawImageUrl ? resolveAssetUrl(rawImageUrl) : undefined,
    });

    return acc;
  }, []);
}

export default function UserFeedDetail() {
  const navigate = useNavigate();
  const { userId, postId } = useParams<RouteParams>();

  const [postData, setPostData] = useState<GetFeedPostDetailResponse | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string>("");

  useEffect(() => {
    const load = async () => {
      if (!userId || !postId) {
        setError("게시글 정보가 없습니다.");
        setLoading(false);
        return;
      }

      try {
        setLoading(true);
        setError("");

        const detail = await fetcher<GetFeedPostDetailResponse>(
          `/users/${userId}/feed/${postId}`,
          {
            headers: getAuthHeaders(),
          }
        );

        setPostData(detail);
      } catch (err: unknown) {
        const message =
          err instanceof Error ? err.message : "피드 상세를 불러오지 못했습니다.";

        setError(message);

        if (
          message.includes("Unauthorized") ||
          message.includes("로그인이 필요합니다")
        ) {
          clearAuthTokens();
          navigate("/login");
        }
      } finally {
        setLoading(false);
      }
    };

    void load();
  }, [navigate, postId, userId]);

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

  const heroImageUrl = postData?.image?.imageUrl
    ? resolveAssetUrl(postData.image.imageUrl)
    : undefined;

  const descriptionText = loading
    ? "불러오는 중..."
    : error
    ? error
    : `${formatFullDate(postData?.createdAt)}\n${postData?.content || "설명이 없습니다."}`;

  return (
    <div className={styles.container}>
      <div className={styles.scrollArea}>
        <section className={styles.heroSection}>
          <div className={styles.heroImage}>
            {heroImageUrl ? (
              <img
                src={heroImageUrl}
                alt={postData?.author.nickname ?? "피드 이미지"}
                className={styles.heroImageTag}
              />
            ) : null}

            <button
              type="button"
              className={styles.backButton}
              aria-label="뒤로가기"
              onClick={() => navigate(-1)}
            >
              <ChevronLeftIcon />
            </button>
          </div>
        </section>

        <section className={styles.infoSection}>
          <div className={styles.infoText}>
            <h1 className={styles.title}>
              {postData?.author.nickname ?? "닉네임"}
            </h1>
            <p className={styles.description}>{descriptionText}</p>
          </div>
        </section>

        <section className={styles.keywordSection}>
          <div className={styles.keywordRow}>
            {conceptKeywords.length > 0 ? (
              conceptKeywords.map((keyword: string, index: number) => (
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
              feedbackGroups.map((group: FeedbackGroup, index: number) => (
                <div key={`${group.type}-${index}`} className={styles.feedbackItem}>
                  <div className={styles.feedbackIconWrap}>
                    {group.type === "like" ? <ThumbsUpIcon /> : <ThumbsDownIcon />}
                  </div>

                  <div className={styles.feedbackChips}>
                    {group.keywords.map((keyword: string, keywordIndex: number) => (
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
                  <ThumbsUpIcon />
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
              <ChevronRightIcon />
            </button>
          </div>

          <div className={styles.itemScroller}>
            {wearItems.length > 0 ? (
              wearItems.map((item: WearItem) => (
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