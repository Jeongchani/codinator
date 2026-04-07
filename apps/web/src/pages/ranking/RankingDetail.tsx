import React, { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import { motion, useAnimation, type PanInfo } from "framer-motion";
import {
  Bookmark,
  ChevronsUp,
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

const normalizeFeedbackItems = (
  raw: unknown[],
  side: "LIKE" | "DISLIKE"
): FeedbackItem[] => {
  if (!Array.isArray(raw)) return [];

  return raw
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
        percent: clampPercent(
          row.percent ??
            row.percentage ??
            row.ratio ??
            row.share ??
            row.votePercent
        ),
        count: Number(
          row.count ?? row.voteCount ?? row.total ?? row.totalCount ?? 0
        ),
        side,
      };
    })
    .filter((item) => item.label)
    .sort((a, b) => b.percent - a.percent)
    .slice(0, 5);
};

const fillFeedbackItems = (
  items: FeedbackItem[],
  side: "LIKE" | "DISLIKE"
): FeedbackItem[] => {
  const result = [...items].slice(0, 5);

  while (result.length < 5) {
    result.push({
      label:
        side === "LIKE"
          ? "좋아요 피드백 데이터 없음"
          : "싫어요 피드백 데이터 없음",
      percent: 0,
      count: 0,
      side,
    });
  }

  return result;
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
    unknownData.feedbackTags,
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
  data: GetRankingPostDetailResponse | null,
  likePercent: number,
  dislikePercent: number,
  likeCount: number,
  dislikeCount: number
) => {
  if (!data) {
    return { like: [], dislike: [] };
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

  return {
    like:
      likePercent > 0
        ? [
            {
              label: "좋아요 비율",
              percent: likePercent,
              count: likeCount,
              side: "LIKE" as const,
            },
          ]
        : [],
    dislike:
      dislikePercent > 0
        ? [
            {
              label: "싫어요 비율",
              percent: dislikePercent,
              count: dislikeCount,
              side: "DISLIKE" as const,
            },
          ]
        : [],
  };
};

type FeedbackColumnProps = {
  title: string;
  side: "LIKE" | "DISLIKE";
  items: FeedbackItem[];
};

function FeedbackColumn({ title, side, items }: FeedbackColumnProps) {
  const paddedItems = fillFeedbackItems(items, side);
  const hero = paddedItems[0];
  const rest = paddedItems.slice(1);

  const heroClass =
    side === "LIKE" ? styles.feedbackHeroLike : styles.feedbackHeroDislike;
  const stepClass =
    side === "LIKE" ? styles.feedbackStepLike : styles.feedbackStepDislike;
  const railClass =
    side === "LIKE" ? styles.feedbackRailLike : styles.feedbackRailDislike;

  const stepHeights = [78, 64, 52, 40];

  return (
    <div className={styles.feedbackColumn}>
      <div className={`${styles.feedbackHero} ${heroClass}`}>
        <div className={styles.feedbackHeroCopy}>
          <p className={styles.feedbackHeroTitle}>{title}</p>
          <p className={styles.feedbackHeroLabel}>{hero.label}</p>
        </div>
        <span className={styles.feedbackHeroPercent}>{hero.percent}%</span>
      </div>

      <div className={`${styles.feedbackRail} ${railClass}`}>
        {rest.map((item, index) => (
          <div
            key={`${side}-${item.label}-${index}`}
            className={`${styles.feedbackStep} ${stepClass}`}
            style={{
              width: `${100 - index * 16}%`,
              height: `${stepHeights[index]}px`,
            }}
          >
            <span className={styles.feedbackStepLabel}>{item.label}</span>
            <span className={styles.feedbackStepPercent}>{item.percent}%</span>
          </div>
        ))}
      </div>
    </div>
  );
}

const RankingDetail: React.FC = () => {
  const { postId } = useParams();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const controls = useAnimation();

  const [postData, setPostData] = useState<GetRankingPostDetailResponse | null>(
    null
  );
  const [loading, setLoading] = useState(true);
  const [isBookmarked, setIsBookmarked] = useState(false);
  const [bookmarkLoading, setBookmarkLoading] = useState(false);
  const [sheetPosition, setSheetPosition] = useState<SheetPosition>("hidden");

  const EXPANDED_Y = 88;
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

  const keywordChips = useMemo(() => extractKeywordLabels(postData), [postData]);

  const feedbackBreakdown = useMemo(
    () =>
      extractFeedbackBreakdown(
        postData,
        likePercent,
        dislikePercent,
        likeCount,
        dislikeCount
      ),
    [postData, likePercent, dislikePercent, likeCount, dislikeCount]
  );

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
      transition: { type: "spring", stiffness: 300, damping: 30 },
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

  const donutBackground = `conic-gradient(from 180deg, #ea8a7a 0 ${likePercent}%, #95a0cb ${likePercent}% 100%)`;

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

          {!isAllDislike && (
            <div className={styles.leftPercent}>
              <ThumbsUp size={12} strokeWidth={2} />
              <span>{likePercent}%</span>
            </div>
          )}

          {!isAllLike && (
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
        dragConstraints={{ top: EXPANDED_Y, bottom: HIDDEN_Y }}
        dragElastic={0}
        initial={{ y: HIDDEN_Y }}
        animate={controls}
        onDragEnd={onDragEnd}
      >
        <div
          className={styles.handlerArea}
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

        <div className={`${styles.sheetContent} ${styles.scroll}`}>
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
                className={styles.miniActionButton}
                onClick={handleToggleBookmark}
                aria-label={isBookmarked ? "북마크 해제" : "북마크 추가"}
                disabled={bookmarkLoading}
              >
                <Bookmark
                  size={12}
                  strokeWidth={2.2}
                  className={
                    isBookmarked ? styles.bookmarkFilled : styles.bookmarkDefault
                  }
                  fill={isBookmarked ? "currentColor" : "none"}
                />
              </button>

              <button
                type="button"
                className={`${styles.miniActionButton} ${styles.reportActionButton}`}
                aria-label="신고"
              >
                <Siren size={12} strokeWidth={2.2} />
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
            <button type="button" className={styles.feedbackWriteButton}>
              피드백 작성
            </button>
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

                {!isAllDislike && (
                  <div className={styles.donutLabelLeft}>{likePercent}%</div>
                )}

                {!isAllLike && (
                  <div className={styles.donutLabelRight}>{dislikePercent}%</div>
                )}
              </div>
            </div>

            <div className={styles.feedbackColumns}>
              <FeedbackColumn
                title="제일 많이 받은 긍정 피드백"
                side="LIKE"
                items={feedbackBreakdown.like}
              />

              <FeedbackColumn
                title="제일 많이 받은 부정 피드백"
                side="DISLIKE"
                items={feedbackBreakdown.dislike}
              />
            </div>
          </div>

          <h3 className={styles.outfitTitle}>착용 아이템</h3>
          <div className={styles.sectionDivider} />

          <div className={styles.itemScroll}>
            {postData.outfitItems.length > 0 ? (
              postData.outfitItems.map((item) => (
                <div key={item.id} className={styles.outfitCard}>
                  <div className={styles.outfitFieldRow}>
                    <span className={styles.outfitFieldValue}>
                      {item.category || "의류 종류 선택"}
                    </span>
                  </div>

                  <div className={styles.outfitFieldRow}>
                    <span className={styles.outfitFieldValue}>
                      {item.brand || "상품 브랜드"}
                    </span>
                  </div>

                  <div className={styles.outfitFieldRow}>
                    <span className={styles.outfitFieldValue}>
                      {item.itemName || "상품 이름"}
                    </span>
                  </div>
                </div>
              ))
            ) : (
              <div className={styles.emptyText}>등록된 아이템이 없습니다.</div>
            )}
          </div>
        </div>
      </motion.div>
    </div>
  );
};

export default RankingDetail;