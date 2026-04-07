import React, { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import {
  motion,
  useAnimation,
  useDragControls,
  type PanInfo,
} from "framer-motion";
import {
  Bookmark,
  ChevronsUp,
  MoveHorizontal,
  Siren,
  ThumbsDown,
  ThumbsUp,
  X,
} from "lucide-react";
import styles from "./RankingDetail.module.css";
import {
  clearAuthTokens,
  fetcher,
  getAuthHeaders,
  getPrimaryPostImageUrl,
  fetchMyBookmarkMap,
  isAuthError,
  subscribeBookmarkUpdated,
  togglePostBookmark,
} from "../../lib/api";
import type { GetRankingPostDetailResponse } from "@codinator/contracts";

type SheetPosition = "expanded" | "collapsed" | "hidden";

type FeedbackItem = {
  label: string;
  percent: number;
  count: number;
  side: "LIKE" | "DISLIKE";
};

type FeedbackKeywordChip = {
  label: string;
  side: "LIKE" | "DISLIKE";
  count: number;
};

const clampPercent = (value: unknown) => {
  const n = Number(value);
  if (!Number.isFinite(n)) return 0;
  return Math.max(0, Math.min(100, Math.round(n)));
};

const toText = (value: unknown, fallback = "") => {
  if (typeof value === "string" && value.trim()) return value.trim();
  if (typeof value === "number") return String(value);
  return fallback;
};

const pickNumberOrNull = (...values: unknown[]) => {
  for (const value of values) {
    const n = Number(value);
    if (Number.isFinite(n)) return n;
  }
  return null;
};

const normalizeTagText = (value: string) => {
  const cleaned = value.replace(/^#+/, "").trim().replace(/\s+/g, "");
  return cleaned ? `#${cleaned}` : "";
};

const resolveFeedbackSide = (
  row: Record<string, unknown>,
  fallback?: "LIKE" | "DISLIKE"
): "LIKE" | "DISLIKE" | null => {
  const raw = String(
    row.side ?? row.choice ?? row.type ?? row.reaction ?? row.sentiment ?? ""
  ).toUpperCase();

  if (
    raw.includes("DISLIKE") ||
    raw.includes("NEGATIVE") ||
    raw.includes("BAD")
  ) {
    return "DISLIKE";
  }

  if (
    raw.includes("LIKE") ||
    raw.includes("POSITIVE") ||
    raw.includes("GOOD")
  ) {
    return "LIKE";
  }

  return fallback ?? null;
};

const normalizeFeedbackItems = (
  raw: unknown[],
  side: "LIKE" | "DISLIKE"
): FeedbackItem[] => {
  if (!Array.isArray(raw) || raw.length === 0) return [];

  const mapped = raw
    .map((item, index) => {
      const row = item as Record<string, unknown>;

      return {
        label:
          toText(row.label) ||
          toText(row.name) ||
          toText(row.feedback) ||
          toText(row.feedbackLabel) ||
          toText(row.keyword) ||
          toText(row.keywordLabel) ||
          toText(row.tagLabel) ||
          `피드백 ${index + 1}`,
        rawPercent: pickNumberOrNull(
          row.percent,
          row.percentage,
          row.ratio,
          row.share,
          row.votePercent
        ),
        count: Number(
          row.count ?? row.voteCount ?? row.total ?? row.totalCount ?? 0
        ),
      };
    })
    .filter((item) => item.label);

  const totalCount = mapped.reduce((sum, item) => {
    return item.count > 0 ? sum + item.count : sum;
  }, 0);

  return mapped
    .map((item) => ({
      label: item.label,
      percent:
        item.rawPercent !== null
          ? clampPercent(item.rawPercent)
          : totalCount > 0 && item.count > 0
          ? clampPercent((item.count / totalCount) * 100)
          : 0,
      count: item.count,
      side,
    }))
    .filter((item) => item.percent > 0 || item.count > 0)
    .sort((a, b) => {
      if (b.percent !== a.percent) return b.percent - a.percent;
      return b.count - a.count;
    })
    .slice(0, 5);
};

const mergeFeedbackKeywordChips = (chips: FeedbackKeywordChip[]) => {
  const map = new Map<string, FeedbackKeywordChip>();

  chips.forEach((chip) => {
    const normalizedLabel = normalizeTagText(chip.label);
    if (!normalizedLabel) return;

    const key = `${chip.side}-${normalizedLabel}`;
    const prev = map.get(key);

    if (prev) {
      map.set(key, {
        ...prev,
        count: prev.count + (chip.count || 0),
      });
      return;
    }

    map.set(key, {
      label: normalizedLabel,
      side: chip.side,
      count: chip.count || 0,
    });
  });

  return [...map.values()].sort((a, b) => {
    if (b.count !== a.count) return b.count - a.count;
    if (a.side !== b.side) return a.side === "LIKE" ? -1 : 1;
    return a.label.localeCompare(b.label, "ko");
  });
};

const parseFeedbackKeywordSource = (
  source: unknown,
  sideHint?: "LIKE" | "DISLIKE"
): FeedbackKeywordChip[] => {
  if (!source) return [];

  if (typeof source === "string") {
    return sideHint
      ? [
          {
            label: source,
            side: sideHint,
            count: 0,
          },
        ]
      : [];
  }

  if (Array.isArray(source)) {
    return source.flatMap((item) => parseFeedbackKeywordSource(item, sideHint));
  }

  if (typeof source === "object") {
    const row = source as Record<string, unknown>;

    const nestedResults: FeedbackKeywordChip[] = [
      ...parseFeedbackKeywordSource(
        row.likeKeywords ?? row.likeFeedbacks ?? row.likeTags ?? row.like,
        "LIKE"
      ),
      ...parseFeedbackKeywordSource(
        row.positiveKeywords ??
          row.positiveFeedbacks ??
          row.positiveTags ??
          row.positive,
        "LIKE"
      ),
      ...parseFeedbackKeywordSource(
        row.dislikeKeywords ??
          row.dislikeFeedbacks ??
          row.dislikeTags ??
          row.dislike,
        "DISLIKE"
      ),
      ...parseFeedbackKeywordSource(
        row.negativeKeywords ??
          row.negativeFeedbacks ??
          row.negativeTags ??
          row.negative,
        "DISLIKE"
      ),
    ];

    if (nestedResults.length > 0) {
      return nestedResults;
    }

    const label =
      toText(row.label) ||
      toText(row.name) ||
      toText(row.feedback) ||
      toText(row.feedbackLabel) ||
      toText(row.keyword) ||
      toText(row.keywordLabel) ||
      toText(row.tag) ||
      toText(row.tagLabel);

    const side = resolveFeedbackSide(row, sideHint);
    const count = Number(
      row.count ?? row.voteCount ?? row.total ?? row.totalCount ?? 0
    );

    if (label && side) {
      return [{ label, side, count }];
    }

    if (sideHint) {
      const reservedKeys = new Set([
        "side",
        "choice",
        "type",
        "reaction",
        "sentiment",
        "count",
        "voteCount",
        "total",
        "totalCount",
      ]);

      return Object.entries(row)
        .filter(([key]) => !reservedKeys.has(key))
        .flatMap(([key, value]) => {
          if (typeof value === "number" || typeof value === "string") {
            const parsedCount =
              typeof value === "number"
                ? value
                : Number.isFinite(Number(value))
                ? Number(value)
                : 0;

            return [
              {
                label: key,
                side: sideHint,
                count: parsedCount,
              },
            ];
          }

          return [];
        });
    }
  }

  return [];
};

const extractFeedbackKeywordChips = (
  data: GetRankingPostDetailResponse | null
): FeedbackKeywordChip[] => {
  if (!data) return [];

  const unknownData = data as unknown as Record<string, unknown>;
  const voteSummary =
    (unknownData.voteSummary as Record<string, unknown> | undefined) ?? {};
  const feedbackSummary =
    (unknownData.feedbackSummary as Record<string, unknown> | undefined) ?? {};
  const keywordSummary =
    (unknownData.keywordSummary as Record<string, unknown> | undefined) ?? {};
  const feedbackTagSummary =
    (unknownData.feedbackTagSummary as Record<string, unknown> | undefined) ??
    {};

  const rawChips: FeedbackKeywordChip[] = [
    ...parseFeedbackKeywordSource(unknownData.feedbackKeywords),
    ...parseFeedbackKeywordSource(unknownData.feedbackTags),
    ...parseFeedbackKeywordSource(unknownData.receivedFeedbackKeywords),
    ...parseFeedbackKeywordSource(unknownData.receivedFeedbackTags),
    ...parseFeedbackKeywordSource(voteSummary.feedbackKeywords),
    ...parseFeedbackKeywordSource(voteSummary.feedbackTags),
    ...parseFeedbackKeywordSource(voteSummary.receivedFeedbackKeywords),
    ...parseFeedbackKeywordSource(voteSummary.receivedFeedbackTags),
    ...parseFeedbackKeywordSource(feedbackSummary),
    ...parseFeedbackKeywordSource(keywordSummary),
    ...parseFeedbackKeywordSource(feedbackTagSummary),
  ];

  return mergeFeedbackKeywordChips(rawChips).slice(0, 8);
};

const extractKeywordLabels = (
  data: GetRankingPostDetailResponse | null
): string[] => {
  if (!data) return [];

  const unknownData = data as unknown as Record<string, unknown>;
  const sourceCandidates: unknown[] = [
    unknownData.keywords,
    unknownData.keywordLabels,
    unknownData.tags,
    unknownData.postKeywords,
  ];

  const labels: string[] = [];

  sourceCandidates.forEach((candidate) => {
    if (!Array.isArray(candidate)) return;

    candidate.forEach((item) => {
      if (typeof item === "string" && item.trim()) {
        labels.push(item.trim());
        return;
      }

      if (item && typeof item === "object") {
        const row = item as Record<string, unknown>;
        const label =
          toText(row.label) ||
          toText(row.name) ||
          toText(row.keyword) ||
          toText(row.keywordLabel);

        if (label) labels.push(label);
      }
    });
  });

  return [...new Set(labels)].slice(0, 5);
};

const extractFeedbackBreakdown = (
  data: GetRankingPostDetailResponse | null
) => {
  if (!data) {
    return { like: [] as FeedbackItem[], dislike: [] as FeedbackItem[] };
  }

  const unknownData = data as unknown as Record<string, unknown>;
  const voteSummary =
    (unknownData.voteSummary as Record<string, unknown> | undefined) ?? {};

  const summaryCandidates: Array<Record<string, unknown> | undefined> = [
    (unknownData.feedbackSummary as Record<string, unknown> | undefined) ??
      undefined,
    (voteSummary.feedbackSummary as Record<string, unknown> | undefined) ??
      undefined,
    (unknownData.keywordSummary as Record<string, unknown> | undefined) ??
      undefined,
    (voteSummary.keywordSummary as Record<string, unknown> | undefined) ??
      undefined,
    (unknownData.feedbackTagSummary as Record<string, unknown> | undefined) ??
      undefined,
  ];

  for (const summary of summaryCandidates) {
    if (!summary) continue;

    const like = normalizeFeedbackItems(
      (summary.likeFeedbacks as unknown[]) ??
        (summary.positiveFeedbacks as unknown[]) ??
        (summary.likeTags as unknown[]) ??
        (summary.likeKeywords as unknown[]) ??
        (summary.like as unknown[]) ??
        (summary.positive as unknown[]) ??
        [],
      "LIKE"
    );

    const dislike = normalizeFeedbackItems(
      (summary.dislikeFeedbacks as unknown[]) ??
        (summary.negativeFeedbacks as unknown[]) ??
        (summary.dislikeTags as unknown[]) ??
        (summary.dislikeKeywords as unknown[]) ??
        (summary.dislike as unknown[]) ??
        (summary.negative as unknown[]) ??
        [],
      "DISLIKE"
    );

    if (like.length > 0 || dislike.length > 0) {
      return { like, dislike };
    }
  }

  const genericStats =
    (unknownData.feedbackStats as unknown[]) ??
    (unknownData.keywordStats as unknown[]) ??
    (voteSummary.feedbackStats as unknown[]) ??
    (voteSummary.keywordStats as unknown[]) ??
    [];

  if (Array.isArray(genericStats) && genericStats.length > 0) {
    const like = normalizeFeedbackItems(
      genericStats.filter((item) => {
        const row = item as Record<string, unknown>;
        return (
          String(row.side ?? row.choice ?? row.type ?? "").toUpperCase() ===
          "LIKE"
        );
      }),
      "LIKE"
    );

    const dislike = normalizeFeedbackItems(
      genericStats.filter((item) => {
        const row = item as Record<string, unknown>;
        return (
          String(row.side ?? row.choice ?? row.type ?? "").toUpperCase() ===
          "DISLIKE"
        );
      }),
      "DISLIKE"
    );

    if (like.length > 0 || dislike.length > 0) {
      return { like, dislike };
    }
  }

  return { like: [] as FeedbackItem[], dislike: [] as FeedbackItem[] };
};

type FeedbackColumnProps = {
  title: string;
  side: "LIKE" | "DISLIKE";
  items: FeedbackItem[];
};

function FeedbackColumn({ title, side, items }: FeedbackColumnProps) {
  if (items.length === 0) return null;

  const hero = items[0];
  const rest = items.slice(1);

  const heroClass =
    side === "LIKE" ? styles.feedbackHeroLike : styles.feedbackHeroDislike;
  const stepClass =
    side === "LIKE" ? styles.feedbackStepLike : styles.feedbackStepDislike;
  const railClass =
    side === "LIKE" ? styles.feedbackRailLike : styles.feedbackRailDislike;

  const stepHeights = [76, 62, 50, 40];

  return (
    <div className={styles.feedbackColumn}>
      <div className={`${styles.feedbackHero} ${heroClass}`}>
        <div className={styles.feedbackHeroCopy}>
          <p className={styles.feedbackHeroTitle}>{title}</p>
          <p className={styles.feedbackHeroLabel}>{hero.label}</p>
        </div>
        <span className={styles.feedbackHeroPercent}>{hero.percent}%</span>
      </div>

      {rest.length > 0 && (
        <div className={`${styles.feedbackRail} ${railClass}`}>
          {rest.map((item, index) => (
            <div
              key={`${side}-${item.label}-${index}`}
              className={`${styles.feedbackStep} ${stepClass}`}
              style={{
                width: `${100 - index * 16}%`,
                height: `${stepHeights[index] ?? 40}px`,
              }}
            >
              <span className={styles.feedbackStepLabel}>{item.label}</span>
              <span className={styles.feedbackStepPercent}>{item.percent}%</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

const RankingDetail: React.FC = () => {
  const { postId } = useParams();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const controls = useAnimation();
  const dragControls = useDragControls();

  const [postData, setPostData] = useState<GetRankingPostDetailResponse | null>(
    null
  );
  const [loading, setLoading] = useState(true);
  const [isBookmarked, setIsBookmarked] = useState(false);
  const [bookmarkLoading, setBookmarkLoading] = useState(false);
  const [sheetPosition, setSheetPosition] = useState<SheetPosition>("hidden");

  const EXPANDED_Y = 0;
  const COLLAPSED_Y = 360;
  const HIDDEN_Y = 860;

  const period =
    searchParams.get("period") === "MONTHLY" ? "MONTHLY" : "WEEKLY";
  const numericPostId = postId ? Number(postId) : undefined;

  useEffect(() => {
    let cancelled = false;

    const loadDetail = async () => {
      if (!postId || !numericPostId) {
        setLoading(false);
        setPostData(null);
        return;
      }

      try {
        setLoading(true);

        const [data, bookmarkMap] = await Promise.all([
          fetcher<GetRankingPostDetailResponse>(
            `/rankings/posts/${postId}?period=${period}`,
            {
              headers: getAuthHeaders(),
            }
          ),
          fetchMyBookmarkMap(),
        ]);

        if (cancelled) return;

        setPostData(data);
        setIsBookmarked(Boolean(bookmarkMap[numericPostId]));
      } catch (err) {
        const message =
          err instanceof Error
            ? err.message
            : "상세 데이터를 불러오지 못했습니다.";

        if (isAuthError(message)) {
          clearAuthTokens();
          navigate("/login");
          return;
        }

        console.error("랭킹 상세 불러오기 실패:", err);

        if (!cancelled) {
          setPostData(null);
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
          setSheetPosition("hidden");
          controls.start({ y: HIDDEN_Y });
        }
      }
    };

    void loadDetail();

    return () => {
      cancelled = true;
    };
  }, [postId, numericPostId, period, navigate, controls]);

  useEffect(() => {
    if (!numericPostId) return;

    const unsubscribe = subscribeBookmarkUpdated((detail) => {
      if (!detail || detail.postId !== numericPostId) return;
      setIsBookmarked(detail.bookmarked);
    });

    return unsubscribe;
  }, [numericPostId]);

  const likeCount = postData?.voteSummary.likeCount ?? 0;
  const dislikeCount = postData?.voteSummary.dislikeCount ?? 0;
  const totalCount = likeCount + dislikeCount;

  const likePercent = useMemo(() => {
    if (totalCount <= 0) return 0;
    return Math.round((likeCount / totalCount) * 100);
  }, [likeCount, totalCount]);

  const dislikePercent = useMemo(() => {
    if (totalCount <= 0) return 0;
    return 100 - likePercent;
  }, [likePercent, totalCount]);

  const isAllLike = likePercent === 100;
  const isAllDislike = dislikePercent === 100;
  const showLikeLabel = totalCount > 0 && !isAllDislike;
  const showDislikeLabel = totalCount > 0 && !isAllLike;

  const keywordChips = useMemo(() => extractKeywordLabels(postData), [postData]);

  const feedbackBreakdown = useMemo(
    () => extractFeedbackBreakdown(postData),
    [postData]
  );

  const feedbackKeywordChips = useMemo(
    () => extractFeedbackKeywordChips(postData),
    [postData]
  );

  const hasLikeFeedback = feedbackBreakdown.like.length > 0;
  const hasDislikeFeedback = feedbackBreakdown.dislike.length > 0;
  const hasAnyFeedbackGraph = hasLikeFeedback || hasDislikeFeedback;

  const outfitItems = useMemo(() => {
    return Array.isArray(postData?.outfitItems) ? postData.outfitItems : [];
  }, [postData]);

  const donutBackground = useMemo(() => {
    if (totalCount <= 0) {
      return "conic-gradient(from -90deg, #e6e6e6 0%, #e6e6e6 100%)";
    }

    if (dislikePercent === 0) {
      return "conic-gradient(from -90deg, #f7b7ae 0%, #ef7f72 100%)";
    }

    if (likePercent === 0) {
      return "conic-gradient(from -90deg, #aab4d7 0%, #8c95b5 100%)";
    }

    return `conic-gradient(
      from -90deg,
      #f7b7ae 0%,
      #ef7f72 ${likePercent}%,
      #aab4d7 ${likePercent}%,
      #8c95b5 100%
    )`;
  }, [likePercent, dislikePercent, totalCount]);

  const snapTo = (position: SheetPosition) => {
    setSheetPosition(position);

    const nextY =
      position === "expanded"
        ? EXPANDED_Y
        : position === "collapsed"
        ? COLLAPSED_Y
        : HIDDEN_Y;

    controls.start({
      y: nextY,
      transition: { type: "spring", stiffness: 340, damping: 34 },
    });
  };

  const expandSheet = () => {
    snapTo("expanded");
  };

  const collapseSheet = () => {
    snapTo("collapsed");
  };

  const hideSheet = () => {
    snapTo("hidden");
  };

  const onDragEnd = (
    _: MouseEvent | TouchEvent | PointerEvent,
    info: PanInfo
  ) => {
    const isDraggingUp = info.offset.y < -50 || info.velocity.y < -500;
    const isDraggingDown = info.offset.y > 50 || info.velocity.y > 500;
    const isStrongDraggingDown = info.offset.y > 160 || info.velocity.y > 1000;

    if (isDraggingUp) {
      if (sheetPosition === "hidden") {
        collapseSheet();
      } else {
        expandSheet();
      }
      return;
    }

    if (isStrongDraggingDown) {
      hideSheet();
      return;
    }

    if (isDraggingDown) {
      if (sheetPosition === "expanded") {
        collapseSheet();
      } else {
        hideSheet();
      }
      return;
    }

    snapTo(sheetPosition);
  };

  const handleToggleBookmark = async (
    e: React.MouseEvent<HTMLButtonElement>
  ) => {
    e.stopPropagation();
    if (!numericPostId || bookmarkLoading) return;

    const previous = isBookmarked;
    setBookmarkLoading(true);
    setIsBookmarked(!previous);

    try {
      const nextValue = await togglePostBookmark(numericPostId, previous);
      setIsBookmarked(nextValue);
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "북마크 처리에 실패했습니다.";

      setIsBookmarked(previous);

      if (isAuthError(message)) {
        clearAuthTokens();
        navigate("/login");
        return;
      }

      console.error("북마크 처리 실패:", err);
      window.alert(message);
    } finally {
      setBookmarkLoading(false);
    }
  };

  if (loading) {
    return <div className={styles.loading}>데이터 로드 중...</div>;
  }

  if (!postData) {
    return <div className={styles.loading}>게시글을 불러올 수 없습니다.</div>;
  }

  return (
    <div className={styles.container}>
      <div className={styles.imageSection}>
        <div
          className={styles.mainImage}
          style={{
            backgroundImage: `url(${getPrimaryPostImageUrl(postData)})`,
            backgroundSize: "cover",
            backgroundPosition: "center",
            backgroundRepeat: "no-repeat",
          }}
        />
        <div className={styles.topGradient} />
        <div className={styles.bottomGradient} />
      </div>

      <div className={styles.headerTitle}>
        {period === "MONTHLY" ? "This Month" : "This Week"}
      </div>

      <button
        type="button"
        onClick={() => navigate(-1)}
        className={styles.closeBtn}
        aria-label="닫기"
      >
        <X size={18} strokeWidth={2.6} />
      </button>

      <div className={styles.floatingArea}>
        {sheetPosition === "hidden" && (
          <button
            type="button"
            className={styles.detailButton}
            onClick={collapseSheet}
          >
            <span className={styles.detailButtonText}>상세보기</span>
            <ChevronsUp
              size={16}
              strokeWidth={2.4}
              className={styles.detailButtonUpIcon}
            />
          </button>
        )}

        <div className={styles.progressTrack}>
          <div
            className={styles.likeFill}
            style={{ width: `${likePercent}%` }}
          />
          <div
            className={styles.dislikeFill}
            style={{ width: `${dislikePercent}%` }}
          />

          {showLikeLabel && (
            <div className={styles.leftPercent}>
              <ThumbsUp size={12} strokeWidth={2} />
              <span>{likePercent}%</span>
            </div>
          )}

          {showDislikeLabel && (
            <div className={styles.rightPercent}>
              <ThumbsDown size={12} strokeWidth={2} />
              <span>{dislikePercent}%</span>
            </div>
          )}
        </div>
      </div>

      <motion.div
        className={styles.bottomSheet}
        drag="y"
        dragControls={dragControls}
        dragListener={false}
        dragConstraints={{ top: EXPANDED_Y, bottom: HIDDEN_Y }}
        dragElastic={0}
        dragMomentum={false}
        initial={{ y: HIDDEN_Y }}
        animate={controls}
        onDragEnd={onDragEnd}
      >
        <div
          className={styles.handlerArea}
          onPointerDown={(event) => dragControls.start(event)}
          onClick={() => {
            if (sheetPosition === "expanded") {
              collapseSheet();
            } else if (sheetPosition === "hidden") {
              collapseSheet();
            } else {
              expandSheet();
            }
          }}
        >
          <div className={styles.handlerBar} />
        </div>

        <div className={`${styles.sheetScrollArea} ${styles.scroll}`}>
          <div className={styles.sheetContent}>
            <div className={styles.sheetHeader}>
              <div className={styles.sheetHeaderCopy}>
                <p className={styles.authorName}>
                  {postData.author?.nickname ?? "닉네임"}
                </p>
                <p className={styles.contentText}>{postData.content}</p>
              </div>

              <div className={styles.sheetActions}>
                <button
                  type="button"
                  className={`${styles.miniActionButton} ${styles.bookmarkActionButton}`}
                  onClick={handleToggleBookmark}
                  aria-label={isBookmarked ? "북마크 해제" : "북마크 추가"}
                  disabled={bookmarkLoading}
                >
                  <Bookmark
                    size={11}
                    strokeWidth={2.1}
                    className={
                      isBookmarked
                        ? styles.bookmarkFilled
                        : styles.bookmarkDefault
                    }
                    fill={isBookmarked ? "currentColor" : "none"}
                  />
                </button>

                <button
                  type="button"
                  className={`${styles.miniActionButton} ${styles.reportActionButton}`}
                  aria-label="신고"
                >
                  <Siren size={11} strokeWidth={2.1} />
                </button>
              </div>
            </div>

            {keywordChips.length > 0 && (
              <div className={styles.keywordChipRow}>
                {keywordChips.map((keyword) => (
                  <span key={keyword} className={styles.keywordChip}>
                    #{keyword}
                  </span>
                ))}
              </div>
            )}

            <div className={styles.sectionDivider} />

            <div className={styles.feedbackHeader}>
              <h3 className={styles.feedbackTitle}>피드백</h3>
            </div>

            <div className={styles.feedbackPanel}>
              <div className={styles.voteCountRow}>
                <div
                  className={`${styles.voteCountBadge} ${styles.voteCountBadgeLike}`}
                >
                  <ThumbsUp size={12} strokeWidth={2} />
                  <span>{likeCount.toLocaleString("ko-KR")}</span>
                </div>

                <div
                  className={`${styles.voteCountBadge} ${styles.voteCountBadgeDislike}`}
                >
                  <ThumbsDown size={12} strokeWidth={2} />
                  <span>{dislikeCount.toLocaleString("ko-KR")}</span>
                </div>
              </div>

              <div className={styles.donutWrap}>
                <div
                  className={styles.donutChart}
                  style={{ background: donutBackground }}
                >
                  <div className={styles.donutHole} />

                  {showLikeLabel && (
                    <div className={styles.donutLabelLeft}>{likePercent}%</div>
                  )}

                  {showDislikeLabel && (
                    <div className={styles.donutLabelRight}>
                      {dislikePercent}%
                    </div>
                  )}
                </div>
              </div>

              {feedbackKeywordChips.length > 0 && (
                <div className={styles.feedbackKeywordWrap}>
                  {feedbackKeywordChips.map((chip) => (
                    <span
                      key={`${chip.side}-${chip.label}`}
                      className={`${styles.feedbackKeywordChip} ${
                        chip.side === "LIKE"
                          ? styles.feedbackKeywordChipLike
                          : styles.feedbackKeywordChipDislike
                      }`}
                    >
                      {chip.side === "LIKE" ? (
                        <ThumbsUp size={11} strokeWidth={2} />
                      ) : (
                        <ThumbsDown size={11} strokeWidth={2} />
                      )}
                      <span>{chip.label}</span>
                    </span>
                  ))}
                </div>
              )}

              {hasAnyFeedbackGraph && (
                <div
                  className={`${styles.feedbackColumns} ${
                    !hasLikeFeedback || !hasDislikeFeedback
                      ? styles.feedbackColumnsSingle
                      : ""
                  }`}
                >
                  {hasLikeFeedback && (
                    <FeedbackColumn
                      title="제일 많이 받은 긍정 피드백"
                      side="LIKE"
                      items={feedbackBreakdown.like}
                    />
                  )}

                  {hasDislikeFeedback && (
                    <FeedbackColumn
                      title="제일 많이 받은 부정 피드백"
                      side="DISLIKE"
                      items={feedbackBreakdown.dislike}
                    />
                  )}
                </div>
              )}
            </div>

            <div className={styles.outfitHeaderRow}>
              <h3 className={styles.outfitTitle}>착용 아이템</h3>

              {outfitItems.length > 1 && (
                <div className={styles.scrollHint}>
                  <MoveHorizontal size={13} strokeWidth={2} />
                  <span>좌우로 넘겨보세요</span>
                </div>
              )}
            </div>

            <div className={styles.sectionDivider} />

            <div className={styles.itemScroll}>
              {outfitItems.length > 0 ? (
                outfitItems.map((item) => (
                  <div key={item.id} className={styles.outfitCard}>
                    <div className={styles.outfitCardTop}>
                      <span className={styles.outfitCategoryBadge}>
                        {item.category || "ITEM"}
                      </span>
                    </div>

                    <div
                      className={`${styles.outfitFieldRow} ${styles.outfitNameRow}`}
                    >
                      <span className={styles.outfitFieldLabel}>상품명</span>
                      <span
                        className={`${styles.outfitFieldValue} ${styles.outfitNameValue}`}
                      >
                        {item.itemName || "상품 이름 미등록"}
                      </span>
                    </div>

                    <div className={styles.outfitFieldRow}>
                      <span className={styles.outfitFieldLabel}>브랜드</span>
                      <span className={styles.outfitFieldValue}>
                        {item.brand || "브랜드 미등록"}
                      </span>
                    </div>
                  </div>
                ))
              ) : (
                <div className={styles.emptyText}>등록된 아이템이 없습니다.</div>
              )}
            </div>
          </div>
        </div>
      </motion.div>
    </div>
  );
};

export default RankingDetail;