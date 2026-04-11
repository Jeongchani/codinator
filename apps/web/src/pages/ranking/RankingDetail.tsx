import { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import {
  Bookmark,
  ChevronsRight,
  Siren,
  Tag,
  ThumbsDown,
  ThumbsUp,
} from "lucide-react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import type { GetRankingPostDetailResponse, RankingPeriod } from "@codinator/contracts";
import {
  clearAuthTokens,
  fetchMyBookmarkMap,
  fetcher,
  getAuthHeaders,
  isAuthError,
  subscribeBookmarkUpdated,
  togglePostBookmark,
} from "../../lib/api";
import Reports from "../../components/Reports";
import styles from "./RankingDetail.module.css";

type StructuredFeedbackRow = {
  label: string;
  count: number;
  percent: number;
  side: "LIKE" | "DISLIKE";
};

type Props = {
  postId?: number | null;
  period?: RankingPeriod;
  hideFeedLink?: boolean;
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

function normalizeVoteChoice(value: unknown): "LIKE" | "DISLIKE" | undefined {
  const text = String(value ?? "").toUpperCase();
  if (text.includes("LIKE") && !text.includes("DISLIKE") && !text.includes("UNLIKE")) return "LIKE";
  if (text.includes("DISLIKE") || text.includes("NEGATIVE")) return "DISLIKE";
  return undefined;
}

function formatKeywordLabel(keyword: string) {
  return keyword.startsWith("#") ? keyword : `#${keyword}`;
}

function formatCount(value: number) {
  return Math.max(0, value).toLocaleString("ko-KR");
}

function formatCategoryLabel(value: unknown) {
  const raw = toSafeString(value);
  if (!raw) return "의류 종류 미등록";
  const key = raw.trim().toUpperCase();
  const categoryMap: Record<string, string> = {
    TOP: "상의", TOPS: "상의", SHIRT: "상의", TSHIRT: "상의", T_SHIRT: "상의", BLOUSE: "상의", KNIT: "상의", SWEATSHIRT: "상의",
    BOTTOM: "하의", BOTTOMS: "하의", PANTS: "하의", SKIRT: "하의", JEANS: "하의", SHORTS: "하의",
    OUTER: "아우터", JACKET: "아우터", COAT: "아우터", CARDIGAN: "아우터", HOODIE: "아우터",
    DRESS: "원피스", ONEPIECE: "원피스", ONE_PIECE: "원피스",
    SHOES: "신발", SNEAKERS: "신발", BOOTS: "신발",
    BAG: "가방", BAGS: "가방",
    ACC: "액세서리", ACCESSORY: "액세서리", ACCESSORIES: "액세서리", HAT: "모자", CAP: "모자",
  };
  return categoryMap[key] ?? raw;
}

function extractKeywordLabels(data: GetRankingPostDetailResponse | null): string[] {
  if (!data) return [];
  const raw = data as unknown as Record<string, unknown>;
  const candidates = [raw.keywords, raw.keywordLabels, raw.tags, raw.postKeywords];
  const labels: string[] = [];
  candidates.forEach((candidate) => {
    if (!Array.isArray(candidate)) return;
    candidate.forEach((item) => {
      if (typeof item === "string" && item.trim()) {
        labels.push(item.trim());
        return;
      }
      if (isRecord(item)) {
        const label = toSafeString(item.label) ?? toSafeString(item.name) ?? toSafeString(item.keyword) ?? toSafeString(item.keywordLabel);
        if (label) labels.push(label);
      }
    });
  });
  return [...new Set(labels)].slice(0, 5);
}

function extractStructuredFeedback(data: GetRankingPostDetailResponse | null) {
  if (!data) return { likeRows: [] as StructuredFeedbackRow[], dislikeRows: [] as StructuredFeedbackRow[] };
  const raw = data as unknown as Record<string, unknown>;
  const feedbackSummary = Array.isArray(raw.feedbackSummary) ? raw.feedbackSummary : [];
  const parsedRows = feedbackSummary
    .map((item) => {
      if (!isRecord(item)) return null;
      const label = toSafeString(item.label) ?? toSafeString(item.name) ?? toSafeString(item.keyword) ?? toSafeString(item.feedbackLabel);
      const voteChoice = normalizeVoteChoice(item.voteChoice) ?? normalizeVoteChoice(item.side) ?? normalizeVoteChoice(item.type);
      const count = toSafeNumber(item.count) ?? toSafeNumber(item.totalCount) ?? toSafeNumber(item.voteCount) ?? 0;
      if (!label || !voteChoice || count <= 0) return null;
      return { label, count, side: voteChoice };
    })
    .filter((item): item is { label: string; count: number; side: "LIKE" | "DISLIKE" } => Boolean(item));
  const likeList = parsedRows.filter((item) => item.side === "LIKE").sort((a, b) => b.count - a.count);
  const dislikeList = parsedRows.filter((item) => item.side === "DISLIKE").sort((a, b) => b.count - a.count);
  const likeTotal = likeList.reduce((sum, item) => sum + item.count, 0);
  const dislikeTotal = dislikeList.reduce((sum, item) => sum + item.count, 0);
  return {
    likeRows: likeList.slice(0, 5).map((item) => ({ ...item, percent: likeTotal > 0 ? Math.round((item.count / likeTotal) * 100) : 0 })),
    dislikeRows: dislikeList.slice(0, 5).map((item) => ({ ...item, percent: dislikeTotal > 0 ? Math.round((item.count / dislikeTotal) * 100) : 0 })),
  };
}

function FeedbackPanel({ title, side, count, rows }: { title: string; side: "LIKE" | "DISLIKE"; count: number; rows: StructuredFeedbackRow[] }) {
  return (
    <div className={styles.feedbackPanel}>
      <div className={styles.feedbackPanelHeader}>
        <h4 className={styles.feedbackPanelTitle}>{title}</h4>
        <span className={styles.feedbackPanelCount}>{formatCount(count)}표 받음</span>
      </div>
      <div className={styles.feedbackRows}>
        {rows.length > 0 ? rows.map((row) => (
          <div key={`${side}-${row.label}`} className={styles.feedbackRow}>
            <div className={styles.feedbackRowHead}>
              <span className={styles.feedbackRowLabel}>{row.label}</span>
              <span className={styles.feedbackRowPercent}>{row.percent}%</span>
            </div>
            <div className={styles.feedbackRowTrack}>
              <div className={`${styles.feedbackRowFill} ${side === "LIKE" ? styles.feedbackRowFillLike : styles.feedbackRowFillDislike}`} style={{ width: `${Math.max(row.percent, 6)}%` }} />
            </div>
          </div>
        )) : <p className={styles.feedbackEmptyText}>아직 피드백이 없습니다.</p>}
      </div>
    </div>
  );
}

export default function RankingDetail({ postId, period, hideFeedLink = false }: Props) {
  const navigate = useNavigate();
  const { postId: routePostId } = useParams();
  const [searchParams] = useSearchParams();
  const [reportOpen, setReportOpen] = useState(false);
  const [postData, setPostData] = useState<GetRankingPostDetailResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [isBookmarked, setIsBookmarked] = useState(false);
  const [bookmarkLoading, setBookmarkLoading] = useState(false);

  const activePostId = postId ?? (routePostId ? Number(routePostId) : null);
  const periodParam = searchParams.get("period");
  const explicitPeriod: RankingPeriod | null =
    period ??
    (periodParam === "WEEKLY" || periodParam === "MONTHLY"
      ? periodParam
      : null);
  const [, setResolvedPeriod] = useState<RankingPeriod | null>(explicitPeriod);

  useEffect(() => {
    let cancelled = false;

    const loadDetail = async () => {
      if (!activePostId) {
        setLoading(false);
        setPostData(null);
        setResolvedPeriod(explicitPeriod);
        return;
      }

      try {
        setLoading(true);

        const candidatePeriods: RankingPeriod[] = explicitPeriod
          ? [explicitPeriod]
          : ["WEEKLY", "MONTHLY"];

        let matchedData: GetRankingPostDetailResponse | null = null;
        let matchedPeriod: RankingPeriod | null = explicitPeriod;
        let lastMessage = "";

        for (const candidate of candidatePeriods) {
          try {
            const data = await fetcher<GetRankingPostDetailResponse>(
              `/rankings/posts/${activePostId}?period=${candidate}`,
              { headers: getAuthHeaders() },
            );
            matchedData = data;
            matchedPeriod = candidate;
            break;
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

            lastMessage = message;
          }
        }

        const bookmarkMap = await fetchMyBookmarkMap();
        if (cancelled) return;

        setResolvedPeriod(matchedPeriod);
        setPostData(matchedData);
        setIsBookmarked(Boolean(bookmarkMap[activePostId]));

        if (!matchedData && lastMessage) {
          console.warn(lastMessage);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    void loadDetail();

    return () => {
      cancelled = true;
    };
  }, [activePostId, explicitPeriod, navigate]);

  useEffect(() => {
    if (!activePostId) return;
    const unsubscribe = subscribeBookmarkUpdated((detail) => {
      if (!detail || detail.postId !== activePostId) return;
      setIsBookmarked(detail.bookmarked);
    });
    return unsubscribe;
  }, [activePostId]);

  const likeCount = postData?.voteSummary.likeCount ?? 0;
  const dislikeCount = postData?.voteSummary.dislikeCount ?? 0;
  const totalCount = likeCount + dislikeCount;
  const likePercent = useMemo(() => totalCount <= 0 ? 0 : Math.round((likeCount / totalCount) * 100), [likeCount, totalCount]);
  const dislikePercent = useMemo(() => totalCount <= 0 ? 0 : 100 - likePercent, [likePercent, totalCount]);
  const keywordChips = useMemo(() => extractKeywordLabels(postData), [postData]);
  const structuredFeedback = useMemo(() => extractStructuredFeedback(postData), [postData]);
  const outfitItems = useMemo(() => Array.isArray(postData?.outfitItems) ? postData.outfitItems : [], [postData]);

  const handleToggleBookmark = async (e: React.MouseEvent<HTMLButtonElement>) => {
    e.stopPropagation();
    if (!activePostId || bookmarkLoading) return;
    const previous = isBookmarked;
    setBookmarkLoading(true);
    setIsBookmarked(!previous);
    try {
      const nextValue = await togglePostBookmark(activePostId, previous);
      setIsBookmarked(nextValue);
    } catch (err) {
      const message = err instanceof Error ? err.message : "북마크 처리에 실패했습니다.";
      setIsBookmarked(previous);
      if (isAuthError(message)) {
        clearAuthTokens();
        navigate("/login");
        return;
      }
      window.alert(message);
    } finally {
      setBookmarkLoading(false);
    }
  };

  const handleGoToUserFeed = () => {
    const authorUserId = postData?.author?.userId;
    if (!authorUserId) {
      window.alert("유저 정보를 찾을 수 없습니다.");
      return;
    }
    navigate(`/user/${authorUserId}/feed`);
  };

  if (loading) return <div className={styles.sheetContent}>데이터 로드 중...</div>;
  if (!postData) return <div className={styles.sheetContent}>게시글을 불러올 수 없습니다.</div>;

  return (
    <div className={styles.sheetContent}>
      <div className={styles.sheetHeader}>
        <div className={styles.sheetHeaderCopy}>
          <div className={styles.authorMetaRow}>
            <p className={styles.authorName}>{postData.author?.nickname ?? "닉네임"}</p>
          </div>
          <p className={styles.contentText}>{postData.content || "코디 설명이 없습니다."}</p>
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
            <Bookmark size={11} strokeWidth={2.1} className={isBookmarked ? styles.bookmarkFilled : styles.bookmarkDefault} fill={isBookmarked ? "currentColor" : "none"} />
          </motion.button>

          <button type="button" className={`${styles.miniActionButton} ${styles.reportActionButton}`} aria-label="신고" onClick={() => setReportOpen(true)}>
            <Siren size={11} strokeWidth={2.1} />
          </button>
        </div>
      </div>

      <div className={styles.keywordLaneSection}>
        <div className={styles.keywordLaneRow}>
          {keywordChips.length > 0 ? (
            <div className={styles.keywordLane}>
              {keywordChips.map((keyword) => (
                <span key={keyword} className={styles.keywordChip}>{formatKeywordLabel(keyword)}</span>
              ))}
            </div>
          ) : (
            <div className={styles.keywordLane} />
          )}

          {!hideFeedLink ? (
            <button type="button" className={styles.feedLinkButton} onClick={handleGoToUserFeed}>
              <span className={styles.feedLinkButtonText}>피드 보러가기</span>
              <ChevronsRight size={14} strokeWidth={2.5} className={styles.feedLinkButtonIcon} />
            </button>
          ) : null}
        </div>
      </div>

      <div className={styles.sectionDivider} />
      <div className={styles.sectionHeaderRow}>
        <h3 className={styles.sectionTitle}>평가</h3>
        <span className={styles.sectionMetaText}>{formatCount(totalCount)}명 참여</span>
      </div>

      <div className={styles.evaluationSummaryRow}>
        <div className={`${styles.evaluationSummaryItem} ${styles.evaluationSummaryLike}`}>
          <ThumbsUp size={13} strokeWidth={2.2} />
          <span>{likePercent}%</span>
        </div>
        <div className={`${styles.evaluationSummaryItem} ${styles.evaluationSummaryDislike}`}>
          <ThumbsDown size={13} strokeWidth={2.2} />
          <span>{dislikePercent}%</span>
        </div>
      </div>

      <div className={styles.evaluationTrack}>
        <div className={styles.evaluationLikeFill} style={{ width: `${likePercent}%` }} />
        <div className={styles.evaluationDislikeFill} style={{ width: `${dislikePercent}%` }} />
      </div>

      <div className={styles.sectionDivider} />
      <div className={styles.sectionHeaderRow}>
        <h3 className={styles.sectionTitle}>피드백</h3>
      </div>

      <div className={styles.feedbackGrid}>
        <FeedbackPanel title="좋아요" side="LIKE" count={likeCount} rows={structuredFeedback.likeRows} />
        <FeedbackPanel title="싫어요" side="DISLIKE" count={dislikeCount} rows={structuredFeedback.dislikeRows} />
      </div>

      <div className={styles.sectionDivider} />
      <div className={styles.outfitHeaderRow}>
        <h3 className={styles.outfitTitle}>착용 아이템</h3>
      </div>

      <div className={styles.itemScroll}>
        {outfitItems.length > 0 ? outfitItems.map((item, index) => (
          <div key={item.id ?? index} className={styles.outfitCard}>
            <div className={`${styles.outfitField} ${styles.outfitCategoryField}`}>
              <div className={styles.outfitCategoryInner}>
                <Tag size={13} strokeWidth={2} className={styles.outfitCategoryIcon} />
                <span className={styles.outfitFieldValue}>{formatCategoryLabel(item.category)}</span>
              </div>
            </div>
            <div className={styles.outfitField}><span className={styles.outfitFieldValue}>{item.brand || "브랜드 미등록"}</span></div>
            <div className={styles.outfitField}><span className={styles.outfitFieldValue}>{item.itemName || "상품 이름 미등록"}</span></div>
          </div>
        )) : <div className={styles.emptyText}>등록된 아이템이 없습니다.</div>}
      </div>

      <Reports
        isOpen={reportOpen}
        onClose={() => setReportOpen(false)}
        defaultTab="post"
        postTarget={{ id: postData.postId, displayText: toSafeString(postData.content) }}
        userTarget={{ id: postData.author.userId, displayText: postData.author.nickname }}
        onSubmitted={(_response: unknown, payload: unknown) => {
          console.log("신고 완료:", payload);
        }}
      />
    </div>
  );
}
