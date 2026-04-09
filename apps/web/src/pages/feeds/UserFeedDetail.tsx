import React, { useEffect, useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import {
  Bookmark,
  ChevronLeft,
  Siren,
  Tag,
  ThumbsDown,
  ThumbsUp,
} from 'lucide-react';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import type { GetFeedPostDetailResponse } from '@codinator/contracts';
import {
  clearAuthTokens,
  fetcher,
  fetchMyBookmarkMap,
  getAuthHeaders,
  getPrimaryPostImageUrl,
  isAuthError,
  resolveAssetUrl,
  subscribeBookmarkUpdated,
  togglePostBookmark,
} from '../../lib/api';
import Reports from '../../components/Reports';
import styles from './UserFeedDetail.module.css';

type RouteParams = {
  userId?: string;
  postId?: string;
};

type PreviewPost = {
  id?: number;
  postId?: number;
  userId?: number;
  imageUrl?: string;
  nickname?: string;
  content?: string;
};

type LocationState = {
  post?: PreviewPost;
};

type StructuredFeedbackRow = {
  tagId: number;
  label: string;
  count: number;
  percent: number;
  side: 'LIKE' | 'DISLIKE';
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function toSafeString(value: unknown): string | undefined {
  if (typeof value !== 'string') return undefined;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

function toSafeNumber(value: unknown): number | undefined {
  if (typeof value === 'number' && Number.isFinite(value)) return value;

  if (typeof value === 'string') {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) return parsed;
  }

  return undefined;
}

function normalizeVoteChoice(value: unknown): 'LIKE' | 'DISLIKE' | undefined {
  const text = String(value ?? '').toUpperCase();

  if (
    text.includes('LIKE') &&
    !text.includes('DISLIKE') &&
    !text.includes('UNLIKE')
  ) {
    return 'LIKE';
  }

  if (text.includes('DISLIKE') || text.includes('NEGATIVE')) {
    return 'DISLIKE';
  }

  return undefined;
}

function formatCount(value: number) {
  return Math.max(0, value).toLocaleString('ko-KR');
}

function formatKeywordLabel(keyword: string) {
  return keyword.startsWith('#') ? keyword : `#${keyword}`;
}

function formatDate(value?: string) {
  if (!value) return '';

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';

  return new Intl.DateTimeFormat('ko-KR', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(date);
}

function formatCategoryLabel(value: unknown) {
  const raw = toSafeString(value);
  if (!raw) return '의류 종류 미등록';

  const key = raw.trim().toUpperCase();

  const categoryMap: Record<string, string> = {
    TOP: '상의',
    TOPS: '상의',
    SHIRT: '상의',
    TSHIRT: '상의',
    T_SHIRT: '상의',
    BLOUSE: '상의',
    KNIT: '상의',
    SWEATSHIRT: '상의',

    BOTTOM: '하의',
    BOTTOMS: '하의',
    PANTS: '하의',
    SKIRT: '하의',
    JEANS: '하의',
    SHORTS: '하의',

    OUTER: '아우터',
    JACKET: '아우터',
    COAT: '아우터',
    CARDIGAN: '아우터',
    HOODIE: '아우터',

    DRESS: '원피스',
    ONEPIECE: '원피스',
    ONE_PIECE: '원피스',

    SHOES: '신발',
    SNEAKERS: '신발',
    BOOTS: '신발',

    BAG: '가방',
    BAGS: '가방',

    ACC: '액세서리',
    ACCESSORY: '액세서리',
    ACCESSORIES: '액세서리',
    HAT: '모자',
    CAP: '모자',
  };

  return categoryMap[key] ?? raw;
}

function extractKeywordLabels(data: GetFeedPostDetailResponse | null): string[] {
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
      if (typeof item === 'string' && item.trim()) {
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

function extractStructuredFeedback(data: GetFeedPostDetailResponse | null): {
  likeRows: StructuredFeedbackRow[];
  dislikeRows: StructuredFeedbackRow[];
  likeTotalCount: number;
  dislikeTotalCount: number;
} {
  if (!data) {
    return {
      likeRows: [],
      dislikeRows: [],
      likeTotalCount: 0,
      dislikeTotalCount: 0,
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
        tagId: toSafeNumber(item.tagId) ?? count,
        label,
        count,
        side: voteChoice,
      };
    })
    .filter(
      (
        item,
      ): item is {
        tagId: number;
        label: string;
        count: number;
        side: 'LIKE' | 'DISLIKE';
      } => Boolean(item),
    );

  const likeList = parsedRows
    .filter((item) => item.side === 'LIKE')
    .sort((a, b) => b.count - a.count);

  const dislikeList = parsedRows
    .filter((item) => item.side === 'DISLIKE')
    .sort((a, b) => b.count - a.count);

  const likeTotal = likeList.reduce((sum, item) => sum + item.count, 0);
  const dislikeTotal = dislikeList.reduce((sum, item) => sum + item.count, 0);

  const likeRows: StructuredFeedbackRow[] = likeList.slice(0, 5).map((item) => ({
    ...item,
    percent: likeTotal > 0 ? Math.round((item.count / likeTotal) * 100) : 0,
  }));

  const dislikeRows: StructuredFeedbackRow[] = dislikeList.slice(0, 5).map((item) => ({
    ...item,
    percent: dislikeTotal > 0 ? Math.round((item.count / dislikeTotal) * 100) : 0,
  }));

  return {
    likeRows,
    dislikeRows,
    likeTotalCount: likeTotal,
    dislikeTotalCount: dislikeTotal,
  };
}

type FeedbackPanelProps = {
  title: string;
  side: 'LIKE' | 'DISLIKE';
  count: number;
  rows: StructuredFeedbackRow[];
};

function FeedbackPanel({ title, side, count, rows }: FeedbackPanelProps) {
  return (
    <div className={styles.feedbackPanel}>
      <div className={styles.feedbackPanelHeader}>
        <h4 className={styles.feedbackPanelTitle}>{title}</h4>
        <span className={styles.feedbackPanelCount}>{formatCount(count)}표 받음</span>
      </div>

      <div className={styles.feedbackRows}>
        {rows.length > 0 ? (
          rows.map((row) => (
            <div key={`${side}-${row.tagId}-${row.label}`} className={styles.feedbackRow}>
              <div className={styles.feedbackRowHead}>
                <span className={styles.feedbackRowLabel}>{row.label}</span>
                <span className={styles.feedbackRowPercent}>{row.percent}%</span>
              </div>

              <div className={styles.feedbackRowTrack}>
                <div
                  className={`${styles.feedbackRowFill} ${
                    side === 'LIKE'
                      ? styles.feedbackRowFillLike
                      : styles.feedbackRowFillDislike
                  }`}
                  style={{ width: `${Math.max(row.percent, 6)}%` }}
                />
              </div>
            </div>
          ))
        ) : (
          <p className={styles.feedbackEmptyText}>아직 피드백이 없습니다.</p>
        )}
      </div>
    </div>
  );
}

const UserFeedDetail: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { userId, postId } = useParams<RouteParams>();

  const locationState = location.state as LocationState | undefined;
  const previewPost = locationState?.post;

  const resolvedUserId =
    toSafeNumber(userId) ??
    previewPost?.userId;

  const resolvedPostId =
    toSafeNumber(postId) ??
    previewPost?.id ??
    previewPost?.postId;

  const [data, setData] = useState<GetFeedPostDetailResponse | null>(null);
  const [detailLoading, setDetailLoading] = useState(true);
  const [detailError, setDetailError] = useState('');
  const [reportOpen, setReportOpen] = useState(false);
  const [isBookmarked, setIsBookmarked] = useState(false);
  const [bookmarkLoading, setBookmarkLoading] = useState(false);

  useEffect(() => {
    let cancelled = false;

    const loadDetail = async () => {
      if (!resolvedPostId) {
        setDetailError('게시글 정보가 없습니다.');
        setDetailLoading(false);
        return;
      }

      if (!resolvedUserId) {
        setDetailError('유저 정보가 없습니다.');
        setDetailLoading(false);
        return;
      }

      try {
        setDetailLoading(true);
        setDetailError('');

        const [response, bookmarkMap] = await Promise.all([
          fetcher<GetFeedPostDetailResponse>(
            `/users/${resolvedUserId}/feed/${resolvedPostId}`,
            {
              headers: getAuthHeaders(),
            },
          ),
          fetchMyBookmarkMap(),
        ]);

        if (cancelled) return;

        setData(response);
        setIsBookmarked(Boolean(bookmarkMap[resolvedPostId]));
      } catch (err) {
        if (cancelled) return;

        const message =
          err instanceof Error ? err.message : '피드 상세를 불러오지 못했습니다.';

        if (isAuthError(message)) {
          clearAuthTokens();
          navigate('/login', { replace: true });
          return;
        }

        setData(null);
        setDetailError(message);
      } finally {
        if (!cancelled) {
          setDetailLoading(false);
        }
      }
    };

    void loadDetail();

    return () => {
      cancelled = true;
    };
  }, [navigate, resolvedPostId, resolvedUserId]);

  useEffect(() => {
    if (!resolvedPostId) return;

    const unsubscribe = subscribeBookmarkUpdated((detail) => {
      if (!detail || detail.postId !== resolvedPostId) return;
      setIsBookmarked(detail.bookmarked);
    });

    return unsubscribe;
  }, [resolvedPostId]);

  const likeCount = data?.voteSummary.likeCount ?? 0;
  const dislikeCount = data?.voteSummary.dislikeCount ?? 0;
  const totalVoteCount = likeCount + dislikeCount;

  const likePercent = useMemo(() => {
    if (totalVoteCount <= 0) return 0;
    return Math.round((likeCount / totalVoteCount) * 100);
  }, [likeCount, totalVoteCount]);

  const dislikePercent = useMemo(() => {
    if (totalVoteCount <= 0) return 0;
    return 100 - likePercent;
  }, [likePercent, totalVoteCount]);

  const keywordChips = useMemo(() => extractKeywordLabels(data), [data]);
  const structuredFeedback = useMemo(() => extractStructuredFeedback(data), [data]);

  const dataRecord = data as unknown as Record<string, unknown> | null;
  const authorRecord = dataRecord && isRecord(dataRecord.author) ? dataRecord.author : null;

  const titleText =
    toSafeString(authorRecord?.nickname) ??
    toSafeString(previewPost?.nickname) ??
    '유저 피드';

  const createdAtText = formatDate(toSafeString(dataRecord?.createdAt));
  const postDisplayText =
    data?.content ?? previewPost?.content ?? '코디 설명이 없습니다.';

  const imageUrl = data?.images?.length
    ? getPrimaryPostImageUrl(data)
    : previewPost?.imageUrl
      ? resolveAssetUrl(previewPost.imageUrl)
      : undefined;

  const outfitItems = Array.isArray(data?.outfitItems) ? data.outfitItems : [];
  const authorUserId =
    toSafeNumber(authorRecord?.userId) ??
    resolvedUserId ??
    0;

  const handleToggleBookmark = async (
    e: React.MouseEvent<HTMLButtonElement>,
  ) => {
    e.stopPropagation();
    if (!resolvedPostId || bookmarkLoading) return;

    const previous = isBookmarked;
    setBookmarkLoading(true);
    setIsBookmarked(!previous);

    try {
      const nextValue = await togglePostBookmark(resolvedPostId, previous);
      setIsBookmarked(nextValue);
    } catch (err) {
      const message =
        err instanceof Error ? err.message : '북마크 처리에 실패했습니다.';

      setIsBookmarked(previous);

      if (isAuthError(message)) {
        clearAuthTokens();
        navigate('/login', { replace: true });
        return;
      }

      window.alert(message);
    } finally {
      setBookmarkLoading(false);
    }
  };

  if (detailLoading) {
    return (
      <div className={styles.container}>
        <div className={styles.scrollArea}>
          <div className={styles.loadingBox}>상세 정보를 불러오는 중...</div>
        </div>
      </div>
    );
  }

  if (!data) {
    return (
      <div className={styles.container}>
        <div className={styles.scrollArea}>
          <div className={styles.loadingBox}>
            {detailError || '피드 상세를 불러올 수 없습니다.'}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.container}>
      <div className={styles.scrollArea}>
        <section className={styles.heroSection}>
          <div className={styles.heroMediaFrame}>
            {imageUrl ? (
              <img src={imageUrl} alt="유저 피드 이미지" className={styles.heroImage} />
            ) : (
              <div className={styles.heroPlaceholder}>
                <span className={styles.heroPlaceholderText}>이미지가 없습니다.</span>
              </div>
            )}

            <button
              type="button"
              className={styles.backButton}
              onClick={() => navigate(-1)}
              aria-label="뒤로가기"
            >
              <ChevronLeft size={18} strokeWidth={2.5} />
            </button>
          </div>
        </section>

        <div className={styles.contentPanel}>
          <div className={styles.sheetHeader}>
            <div className={styles.sheetHeaderCopy}>
              <div className={styles.titleRow}>
                <h1 className={styles.mainTitle}>{titleText}</h1>

                <div className={styles.sheetActions}>
                  <motion.button
                    type="button"
                    className={`${styles.miniActionButton} ${styles.bookmarkActionButton}`}
                    onClick={handleToggleBookmark}
                    aria-label={isBookmarked ? '북마크 해제' : '북마크 추가'}
                    disabled={bookmarkLoading}
                    whileTap={{ scale: 0.82, y: 1 }}
                    transition={{ type: 'spring', stiffness: 520, damping: 24 }}
                  >
                    <Bookmark
                      size={11}
                      strokeWidth={2.1}
                      className={
                        isBookmarked
                          ? styles.bookmarkFilled
                          : styles.bookmarkDefault
                      }
                      fill={isBookmarked ? 'currentColor' : 'none'}
                    />
                  </motion.button>

                  <button
                    type="button"
                    className={`${styles.miniActionButton} ${styles.reportActionButton}`}
                    aria-label="신고"
                    onClick={() => setReportOpen(true)}
                  >
                    <Siren size={11} strokeWidth={2.1} />
                  </button>
                </div>
              </div>

              {createdAtText ? (
                <p className={styles.dateText}>{createdAtText}</p>
              ) : null}

              <p className={styles.contentText}>{postDisplayText}</p>
            </div>
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

          <div className={styles.sectionDivider} />

          <section className={styles.sectionBlock}>
            <div className={styles.sectionHeaderRow}>
              <h3 className={styles.sectionTitle}>평가</h3>
              <span className={styles.sectionMetaText}>{formatCount(totalVoteCount)}명 참여</span>
            </div>

            <div className={styles.evaluationSummaryRow}>
              <div className={`${styles.evaluationSummaryItem} ${styles.evaluationSummaryLike}`}>
                <ThumbsUp size={13} strokeWidth={2.2} />
                <span>{likePercent}%</span>
              </div>

              <div
                className={`${styles.evaluationSummaryItem} ${styles.evaluationSummaryDislike}`}
              >
                <ThumbsDown size={13} strokeWidth={2.2} />
                <span>{dislikePercent}%</span>
              </div>
            </div>

            <div className={styles.evaluationTrack}>
              <div className={styles.evaluationLikeFill} style={{ width: `${likePercent}%` }} />
              <div
                className={styles.evaluationDislikeFill}
                style={{ width: `${dislikePercent}%` }}
              />
            </div>
          </section>

          <div className={styles.sectionDivider} />

          <section className={styles.sectionBlock}>
            <div className={styles.sectionHeaderRow}>
              <h3 className={styles.sectionTitle}>피드백</h3>
            </div>

            <div className={styles.feedbackPanelsWrap}>
              <FeedbackPanel
                title="좋아요"
                side="LIKE"
                count={structuredFeedback.likeTotalCount}
                rows={structuredFeedback.likeRows}
              />

              <FeedbackPanel
                title="싫어요"
                side="DISLIKE"
                count={structuredFeedback.dislikeTotalCount}
                rows={structuredFeedback.dislikeRows}
              />
            </div>
          </section>

          <div className={styles.sectionDivider} />

          <section className={styles.sectionBlock}>
            <div className={styles.outfitHeaderRow}>
              <h3 className={styles.outfitTitle}>착용 아이템</h3>
            </div>

            <div className={styles.itemScroll}>
              {outfitItems.length > 0 ? (
                outfitItems.map((item, index) => (
                  <div key={item.id ?? index} className={styles.outfitCard}>
                    <div className={`${styles.outfitField} ${styles.outfitCategoryField}`}>
                      <div className={styles.outfitCategoryInner}>
                        <Tag
                          size={13}
                          strokeWidth={2}
                          className={styles.outfitCategoryIcon}
                        />
                        <span className={styles.outfitFieldValue}>
                          {formatCategoryLabel(item.category)}
                        </span>
                      </div>
                    </div>

                    <div className={styles.outfitField}>
                      <span className={styles.outfitFieldValue}>{item.brand || '브랜드 미등록'}</span>
                    </div>

                    <div className={styles.outfitField}>
                      <span className={styles.outfitFieldValue}>
                        {item.itemName || '상품 이름 미등록'}
                      </span>
                    </div>
                  </div>
                ))
              ) : (
                <div className={styles.emptyText}>등록된 아이템이 없습니다.</div>
              )}
            </div>
          </section>

          {detailError ? <p className={styles.errorText}>{detailError}</p> : null}
        </div>
      </div>

      <Reports
        isOpen={reportOpen}
        onClose={() => setReportOpen(false)}
        defaultTab="post"
        postTarget={{
          id: resolvedPostId ?? 0,
          displayText: postDisplayText,
        }}
        userTarget={{
          id: authorUserId,
          displayText: titleText,
        }}
        onSubmitted={(response, payload) => {
          console.log('신고 완료:', payload, response);
        }}
      />
    </div>
  );
};

export default UserFeedDetail;
