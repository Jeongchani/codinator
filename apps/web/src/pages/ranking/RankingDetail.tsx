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
  Siren,
  Tag,
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

type StructuredFeedbackRow = {
  label: string;
  count: number;
  percent: number;
  side: "LIKE" | "DISLIKE";
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

function normalizeVoteChoice(
  value: unknown
): "LIKE" | "DISLIKE" | undefined {
  const text = String(value ?? "").toUpperCase();

  if (
    text.includes("LIKE") &&
    !text.includes("DISLIKE") &&
    !text.includes("UNLIKE")
  ) {
    return "LIKE";
  }

  if (text.includes("DISLIKE") || text.includes("NEGATIVE")) {
    return "DISLIKE";
  }

  return undefined;
}

function formatKeywordLabel(keyword: string) {
  return keyword.startsWith("#") ? keyword : `#${keyword}`;
}

function formatCategoryLabel(value: unknown) {
  const text = toSafeString(value);
  if (!text) return "ITEM";
  return text.toUpperCase();
}

function extractKeywordLabels(
  data: GetRankingPostDetailResponse | null
): string[] {
  if (!data) return [];

  const raw = data as unknown as Record<string, unknown>;
  const candidates = [
    raw.keywords,
    raw.keywordLabels,
    raw.tags,
    raw.postKeywords,
  ];

  const labels: string[] = [];

  candidates.forEach((candidate) => {
    if (!Array.isArray(candidate)) return;

    candidate.forEach((item) => {
      if (typeof item === "string" && item.trim()) {
        labels.push(item.trim());
        return;
      }

      if (isRecord(item)) {
        const label =
          toSafeString(item.label) ??
          toSafeString(item.name) ??
          toSafeString(item.keyword) ??
          toSafeString(item.keywordLabel);

        if (label) labels.push(label);
      }
    });
  });

  return [...new Set(labels)].slice(0, 5);
}

function extractStructuredFeedback(
  data: GetRankingPostDetailResponse | null
): {
  likeRows: StructuredFeedbackRow[];
  dislikeRows: StructuredFeedbackRow[];
} {
  if (!data) {
    return {
      likeRows: [],
      dislikeRows: [],
    };
  }

  const raw = data as unknown as Record<string, unknown>;
  const feedbackSummary = Array.isArray(raw.feedbackSummary)
    ? raw.feedbackSummary
    : [];

  const parsedRows = feedbackSummary
    .map((item) => {
      if (!isRecord(item)) return null;

      const label =
        toSafeString(item.label) ??
        toSafeString(item.name) ??
        toSafeString(item.keyword) ??
        toSafeString(item.feedbackLabel);

      const voteChoice =
        normalizeVoteChoice(item.voteChoice) ??
        normalizeVoteChoice(item.side) ??
        normalizeVoteChoice(item.type);

      const count =
        toSafeNumber(item.count) ??
        toSafeNumber(item.totalCount) ??
        toSafeNumber(item.voteCount) ??
        0;

      if (!label || !voteChoice || count <= 0) return null;

      return {
        label,
        count,
        side: voteChoice,
      };
    })
    .filter(
      (item): item is { label: string; count: number; side: "LIKE" | "DISLIKE" } =>
        Boolean(item)
    );

  const likeList = parsedRows
    .filter((item) => item.side === "LIKE")
    .sort((a, b) => b.count - a.count);

  const dislikeList = parsedRows
    .filter((item) => item.side === "DISLIKE")
    .sort((a, b) => b.count - a.count);

  const likeTotal = likeList.reduce((sum, item) => sum + item.count, 0);
  const dislikeTotal = dislikeList.reduce((sum, item) => sum + item.count, 0);

  const likeRows: StructuredFeedbackRow[] = likeList
    .slice(0, 5)
    .map((item) => ({
      ...item,
      percent: likeTotal > 0 ? Math.round((item.count / likeTotal) * 100) : 0,
    }));

  const dislikeRows: StructuredFeedbackRow[] = dislikeList
    .slice(0, 5)
    .map((item) => ({
      ...item,
      percent:
        dislikeTotal > 0 ? Math.round((item.count / dislikeTotal) * 100) : 0,
    }));

  return {
    likeRows,
    dislikeRows,
  };
}

type StructuredFeedbackColumnProps = {
  title: string;
  side: "LIKE" | "DISLIKE";
  rows: StructuredFeedbackRow[];
};

function StructuredFeedbackColumn({
  title,
  side,
  rows,
}: StructuredFeedbackColumnProps) {
  if (rows.length === 0) return null;

  return (
    <div className={styles.structuredFeedbackColumn}>
      <div className={styles.structuredFeedbackHeader}>
        <h4 className={styles.structuredFeedbackTitle}>{title}</h4>
      </div>

      <div className={styles.structuredFeedbackRows}>
        {rows.map((row) => (
          <div
            key={`${side}-${row.label}`}
            className={styles.structuredFeedbackRow}
          >
            <div className={styles.structuredFeedbackLabelRow}>
              <span className={styles.structuredFeedbackLabel}>{row.label}</span>
              <span className={styles.structuredFeedbackPercent}>
                {row.percent}%
              </span>
            </div>

            <div className={styles.structuredFeedbackTrack}>
              <div
                className={`${styles.structuredFeedbackFill} ${
                  side === "LIKE"
                    ? styles.structuredFeedbackFillLike
                    : styles.structuredFeedbackFillDislike
                }`}
                style={{ width: `${Math.max(row.percent, 6)}%` }}
              />
            </div>
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

  const SHEET_TOTAL_HEIGHT = 812;
  const HANDLE_HEIGHT = 34;
  const EXPANDED_SCROLL_HEIGHT = SHEET_TOTAL_HEIGHT - HANDLE_HEIGHT;
  const COLLAPSED_SCROLL_HEIGHT =
    SHEET_TOTAL_HEIGHT - COLLAPSED_Y - HANDLE_HEIGHT;

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

  const keywordChips = useMemo(() => extractKeywordLabels(postData), [postData]);

  const structuredFeedback = useMemo(
    () => extractStructuredFeedback(postData),
    [postData]
  );

  const hasStructuredFeedback =
    structuredFeedback.likeRows.length > 0 ||
    structuredFeedback.dislikeRows.length > 0;

  const outfitItems = useMemo(() => {
    return Array.isArray(postData?.outfitItems) ? postData.outfitItems : [];
  }, [postData]);

  const currentScrollAreaHeight =
    sheetPosition === "expanded"
      ? EXPANDED_SCROLL_HEIGHT
      : sheetPosition === "collapsed"
      ? COLLAPSED_SCROLL_HEIGHT
      : 0;

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

          {totalCount > 0 && likePercent > 0 && (
            <div className={styles.leftPercent}>
              <ThumbsUp size={12} strokeWidth={2} />
              <span>{likePercent}%</span>
            </div>
          )}

          {totalCount > 0 && dislikePercent > 0 && (
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

        <div
          className={`${styles.sheetScrollArea} ${styles.scroll}`}
          style={{ height: currentScrollAreaHeight }}
        >
          <div className={styles.sheetContent}>
            <div className={styles.sheetHeader}>
              <div className={styles.sheetHeaderCopy}>
                <p className={styles.authorName}>
                  {postData.author?.nickname ?? "닉네임"}
                </p>
                <p className={styles.contentText}>{postData.content}</p>
              </div>

              <div className={styles.sheetActions}>
                <motion.button
                  type="button"
                  className={`${styles.miniActionButton} ${styles.bookmarkActionButton}`}
                  onClick={handleToggleBookmark}
                  aria-label={isBookmarked ? "북마크 해제" : "북마크 추가"}
                  disabled={bookmarkLoading}
                  whileTap={{ scale: 0.82, y: 1 }}
                  transition={{ type: "spring", stiffness: 520, damping: 24 }}
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
                </motion.button>

                <button
                  type="button"
                  className={`${styles.miniActionButton} ${styles.reportActionButton}`}
                  aria-label="신고"
                >
                  <Siren size={11} strokeWidth={2.1} />
                </button>
              </div>
            </div>

            <div className={styles.sectionDivider} />

            <div className={styles.feedbackHeader}>
              <h3 className={styles.feedbackTitle}>피드백</h3>
            </div>

            <div className={styles.feedbackPanel}>
              <div className={styles.feedbackSummaryRow}>
                <span className={styles.totalVoteCount}>총 {totalCount}표</span>
              </div>

              <div className={styles.feedbackProgressTrack}>
                <div
                  className={styles.feedbackLikeFill}
                  style={{ width: `${likePercent}%` }}
                />
                <div
                  className={styles.feedbackDislikeFill}
                  style={{ width: `${dislikePercent}%` }}
                />

                {totalCount > 0 && likePercent > 0 && (
                  <div className={styles.feedbackLeftPercent}>
                    <ThumbsUp size={12} strokeWidth={2} />
                    <span>{likePercent}%</span>
                  </div>
                )}

                {totalCount > 0 && dislikePercent > 0 && (
                  <div className={styles.feedbackRightPercent}>
                    <ThumbsDown size={12} strokeWidth={2} />
                    <span>{dislikePercent}%</span>
                  </div>
                )}
              </div>

              {hasStructuredFeedback && (
                <div
                  className={`${styles.structuredFeedbackGrid} ${
                    structuredFeedback.likeRows.length === 0 ||
                    structuredFeedback.dislikeRows.length === 0
                      ? styles.structuredFeedbackGridSingle
                      : ""
                  }`}
                >
                  {structuredFeedback.likeRows.length > 0 && (
                    <StructuredFeedbackColumn
                      title="좋아요 피드백"
                      side="LIKE"
                      rows={structuredFeedback.likeRows}
                    />
                  )}

                  {structuredFeedback.dislikeRows.length > 0 && (
                    <StructuredFeedbackColumn
                      title="싫어요 피드백"
                      side="DISLIKE"
                      rows={structuredFeedback.dislikeRows}
                    />
                  )}
                </div>
              )}
            </div>

            {keywordChips.length > 0 && (
              <div className={styles.keywordLaneSection}>
                <div className={styles.keywordLane}>
                  {keywordChips.map((keyword) => (
                    <span key={keyword} className={styles.keywordChip}>
                      {formatKeywordLabel(keyword)}
                    </span>
                  ))}
                </div>
              </div>
            )}

            <div className={styles.outfitHeaderRow}>
              <h3 className={styles.outfitTitle}>착용 아이템</h3>
            </div>

            <div className={styles.sectionDivider} />

            <div className={styles.itemScroll}>
              {outfitItems.length > 0 ? (
                outfitItems.map((item, index) => (
                  <div key={item.id ?? index} className={styles.outfitCard}>
                    <div className={styles.outfitCardBox}>
                      <div className={styles.outfitCategoryBox}>
                        <Tag
                          size={13}
                          strokeWidth={2}
                          className={styles.outfitCategoryIcon}
                        />
                        <span className={styles.outfitCategoryText}>
                          {formatCategoryLabel(item.category)}
                        </span>
                      </div>

                      <div className={styles.outfitInfoRow}>
                        <span className={styles.outfitInfoLabel}>상품명</span>
                        <span className={styles.outfitInfoValue}>
                          {item.itemName || "상품 이름 미등록"}
                        </span>
                      </div>

                      <div className={styles.outfitInfoDivider} />

                      <div className={styles.outfitInfoRow}>
                        <span className={styles.outfitInfoLabel}>브랜드</span>
                        <span className={styles.outfitInfoValue}>
                          {item.brand || "브랜드 미등록"}
                        </span>
                      </div>
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