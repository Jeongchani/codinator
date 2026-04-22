import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import { Bookmark, Siren, Tag, ThumbsDown, ThumbsUp } from 'lucide-react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import type {
  CreateFeedbackResponse,
  FeedbackTag,
  GetEvaluationPostDetailResponse,
  GetTagsResponse,
  VoteChoice,
} from '@codinator/contracts';
import {
  clearAuthTokens,
  fetchMyBookmarkMap,
  fetcher,
  getAuthHeaders,
  isAuthError,
  subscribeBookmarkUpdated,
  togglePostBookmark,
} from '../../lib/api';
import Reports from '../../components/Reports';
import PostDetailBottomSheet from '../../components/postdetail/PostDetailBottomSheet';
import styles from './EvaluationDetailFeedback.module.css';

type StructuredFeedbackRow = {
  tagId: number;
  label: string;
  count: number;
  percent: number;
  side: 'LIKE' | 'DISLIKE';
};

type EvaluationDetailFeedbackProps = {
  embedded?: boolean;
  postIdOverride?: number | null;
  voteIdOverride?: number | null;
  voteChoiceOverride?: VoteChoice | null;
  allowReadonlyDetail?: boolean;
};

type OutfitItem = NonNullable<GetEvaluationPostDetailResponse['outfitItems']>[number];

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

  if (text.includes('LIKE') && !text.includes('DISLIKE') && !text.includes('UNLIKE')) {
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

function extractKeywordLabels(data: GetEvaluationPostDetailResponse | null): string[] {
  if (!data) return [];

  const raw = data as unknown as Record<string, unknown>;
  const candidates = [raw.keywords, raw.keywordLabels, raw.tags, raw.postKeywords];
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

function extractStructuredFeedback(data: GetEvaluationPostDetailResponse | null): {
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
  const feedbackSummary = Array.isArray(raw.feedbackSummary) ? raw.feedbackSummary : [];

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
      (item): item is { tagId: number; label: string; count: number; side: 'LIKE' | 'DISLIKE' } =>
        Boolean(item),
    );

  const likeList = parsedRows
    .filter((item) => item.side === 'LIKE')
    .sort((a, b) => b.count - a.count);

  const dislikeList = parsedRows
    .filter((item) => item.side === 'DISLIKE')
    .sort((a, b) => b.count - a.count);

  const likeTotal = likeList.reduce((sum, item) => sum + item.count, 0);
  const dislikeTotal = dislikeList.reduce((sum, item) => sum + item.count, 0);

  return {
    likeRows: likeList.slice(0, 5).map((item) => ({
      ...item,
      percent: likeTotal > 0 ? Math.round((item.count / likeTotal) * 100) : 0,
    })),
    dislikeRows: dislikeList.slice(0, 5).map((item) => ({
      ...item,
      percent: dislikeTotal > 0 ? Math.round((item.count / dislikeTotal) * 100) : 0,
    })),
    likeTotalCount: likeTotal,
    dislikeTotalCount: dislikeTotal,
  };
}

function FeedbackPanel({
  title,
  side,
  count,
  rows,
}: {
  title: string;
  side: 'LIKE' | 'DISLIKE';
  count: number;
  rows: StructuredFeedbackRow[];
}) {
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
                    side === 'LIKE' ? styles.feedbackRowFillLike : styles.feedbackRowFillDislike
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

const clamp = (value: number, min: number, max: number) => Math.min(Math.max(value, min), max);
const OUTFIT_CARD_WIDTH = 168;
const OUTFIT_CARD_GAP = 12;

function OutfitItemsCarousel({ outfitItems }: { outfitItems: OutfitItem[] }) {
  const viewportRef = useRef<HTMLDivElement | null>(null);
  const [activeIndex, setActiveIndex] = useState(0);
  const maxIndex = Math.max(0, outfitItems.length - 1);
  const step = OUTFIT_CARD_WIDTH + OUTFIT_CARD_GAP;

  const getSnapPoints = useCallback(() => {
    const viewport = viewportRef.current;
    if (!viewport) {
      return outfitItems.map((_, index) => index * step);
    }

    const maxScrollLeft = Math.max(0, viewport.scrollWidth - viewport.clientWidth);
    return outfitItems.map((_, index) => Math.min(index * step, maxScrollLeft));
  }, [outfitItems, step]);

  const updateActiveIndex = useCallback(() => {
    const viewport = viewportRef.current;
    if (!viewport) return;

    const currentLeft = viewport.scrollLeft;
    const snapPoints = getSnapPoints();

    let nearestIndex = 0;
    let nearestDistance = Number.POSITIVE_INFINITY;

    snapPoints.forEach((point, index) => {
      const distance = Math.abs(point - currentLeft);
      if (distance < nearestDistance) {
        nearestDistance = distance;
        nearestIndex = index;
      }
    });

    setActiveIndex(nearestIndex);
  }, [getSnapPoints]);

  useEffect(() => {
    const rafId = window.requestAnimationFrame(() => {
      updateActiveIndex();
    });

    return () => {
      window.cancelAnimationFrame(rafId);
    };
  }, [outfitItems.length, updateActiveIndex]);

  const goTo = useCallback(
    (index: number) => {
      const viewport = viewportRef.current;
      if (!viewport) return;

      const targetIndex = clamp(index, 0, maxIndex);
      const snapPoints = getSnapPoints();
      viewport.scrollTo({
        left: snapPoints[targetIndex] ?? 0,
        behavior: 'smooth',
      });
    },
    [getSnapPoints, maxIndex],
  );

  if (outfitItems.length === 0) {
    return <div className={styles.emptyText}>등록된 아이템이 없습니다.</div>;
  }

  return (
    <div className={styles.outfitCarousel}>
      <div ref={viewportRef} className={styles.outfitCarouselViewport} onScroll={updateActiveIndex}>
        <div className={styles.outfitCarouselTrack} style={{ gap: `${OUTFIT_CARD_GAP}px` }}>
          {outfitItems.map((item, index) => (
            <div
              key={item.id ?? index}
              className={styles.outfitCarouselItem}
              style={{ width: `${OUTFIT_CARD_WIDTH}px` }}
            >
              <div className={styles.outfitCard}>
                <div className={`${styles.outfitField} ${styles.outfitCategoryField}`}>
                  <div className={styles.outfitCategoryInner}>
                    <Tag size={13} strokeWidth={2} className={styles.outfitCategoryIcon} />
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
            </div>
          ))}
        </div>
      </div>

      {outfitItems.length > 1 ? (
        <div className={styles.outfitCarouselDots}>
          {outfitItems.map((item, index) => {
            const label = item.itemName?.trim() || `${index + 1}번 아이템`;
            return (
              <button
                key={item.id ?? `${label}-${index}`}
                type="button"
                aria-label={`${label} 카드로 이동`}
                onClick={() => goTo(index)}
                className={`${styles.outfitCarouselDot} ${
                  activeIndex === index ? styles.outfitCarouselDotActive : ''
                }`}
              />
            );
          })}
        </div>
      ) : null}
    </div>
  );
}

const wait = (ms: number) => new Promise((resolve) => window.setTimeout(resolve, ms));

function EvaluationDetailFeedbackContent({
  postId,
  voteId,
  voteChoice,
  allowReadonlyDetail = false,
}: {
  postId: number | null;
  voteId: number | null;
  voteChoice: VoteChoice | null;
  allowReadonlyDetail?: boolean;
}) {
  const navigate = useNavigate();

  const [data, setData] = useState<GetEvaluationPostDetailResponse | null>(null);
  const [keywords, setKeywords] = useState<FeedbackTag[]>([]);
  const [selectedKeywordIds, setSelectedKeywordIds] = useState<Set<number>>(new Set());
  const [savedKeywordIds, setSavedKeywordIds] = useState<number[]>([]);
  const [detailLoading, setDetailLoading] = useState(true);
  const [tagLoading, setTagLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [bookmarkLoading, setBookmarkLoading] = useState(false);
  const [isBookmarked, setIsBookmarked] = useState(false);
  const [reportOpen, setReportOpen] = useState(false);
  const [detailError, setDetailError] = useState('');
  const [tagError, setTagError] = useState('');

  const canWriteFeedback = Boolean(postId && voteId && voteChoice);
  const isReadOnlyDetail = Boolean(postId) && allowReadonlyDetail && !canWriteFeedback;

  const requestDetail = useCallback(async () => {
    if (!postId) throw new Error('게시글 정보가 없습니다.');

    const [response, bookmarkMap] = await Promise.all([
      fetcher<GetEvaluationPostDetailResponse>(`/evaluations/posts/${postId}`, {
        headers: getAuthHeaders(),
      }),
      fetchMyBookmarkMap(),
    ]);

    return { response, bookmarkMap };
  }, [postId]);

  const requestDetailWithRetry = useCallback(async () => {
    const delays = canWriteFeedback ? [0, 250, 450, 700] : [0];
    let lastError: unknown = null;

    for (const delay of delays) {
      if (delay > 0) {
        await wait(delay);
      }

      try {
        return await requestDetail();
      } catch (err) {
        lastError = err;
        const message = err instanceof Error ? err.message : '평가 상세를 불러오지 못했습니다.';

        if (isAuthError(message)) {
          throw err;
        }

        if (!message.includes('403')) {
          throw err;
        }
      }
    }

    throw lastError instanceof Error ? lastError : new Error('평가 상세를 불러오지 못했습니다.');
  }, [canWriteFeedback, requestDetail]);

  const loadDetail = useCallback(async () => {
    if (!postId) {
      setData(null);
      setDetailError('게시글 정보가 없습니다.');
      setDetailLoading(false);
      return;
    }

    if (!canWriteFeedback && !allowReadonlyDetail) {
      setData(null);
      setDetailError('');
      setDetailLoading(false);
      return;
    }

    try {
      setDetailLoading(true);
      setDetailError('');

      const payload = await requestDetailWithRetry();

      setData(payload.response);
      setIsBookmarked(Boolean(payload.bookmarkMap[postId]));
    } catch (err) {
      const message = err instanceof Error ? err.message : '평가 상세를 불러오지 못했습니다.';
      setData(null);
      setDetailError(
        message.includes('403') ? '이 게시글은 아직 평가 상세를 바로 열 수 없습니다.' : message,
      );

      if (isAuthError(message)) {
        clearAuthTokens();
        navigate('/login');
      }
    } finally {
      setDetailLoading(false);
    }
  }, [allowReadonlyDetail, canWriteFeedback, navigate, postId, requestDetailWithRetry]);

  const loadTags = useCallback(async () => {
    if (!voteChoice) {
      setKeywords([]);
      setTagLoading(false);
      return;
    }

    try {
      setTagLoading(true);
      setTagError('');

      const response = await fetcher<GetTagsResponse>(
        `/evaluations/tags?voteChoice=${voteChoice}`,
        {
          headers: getAuthHeaders(),
        },
      );

      setKeywords(response.items ?? []);
    } catch (err) {
      const message = err instanceof Error ? err.message : '피드백 태그를 불러오지 못했습니다.';
      setTagError(message);

      if (isAuthError(message)) {
        clearAuthTokens();
        navigate('/login');
      }
    } finally {
      setTagLoading(false);
    }
  }, [navigate, voteChoice]);

  useEffect(() => {
    void loadDetail();
  }, [loadDetail]);

  useEffect(() => {
    void loadTags();
  }, [loadTags]);

  useEffect(() => {
    setSelectedKeywordIds(new Set());
    setSavedKeywordIds([]);
    setTagError('');
    setDetailError('');
  }, [postId, voteId, voteChoice]);

  useEffect(() => {
    if (!postId) return;

    const unsubscribe = subscribeBookmarkUpdated((detail) => {
      if (!detail || detail.postId !== postId) return;
      setIsBookmarked(detail.bookmarked);
    });

    return unsubscribe;
  }, [postId]);

  const handleToggleBookmark = async (e: React.MouseEvent<HTMLButtonElement>) => {
    e.stopPropagation();
    if (!postId || bookmarkLoading) return;

    const previous = isBookmarked;
    setBookmarkLoading(true);
    setIsBookmarked(!previous);

    try {
      const nextValue = await togglePostBookmark(postId, previous);
      setIsBookmarked(nextValue);
    } catch (err) {
      const message = err instanceof Error ? err.message : '북마크 처리에 실패했습니다.';
      setIsBookmarked(previous);

      if (isAuthError(message)) {
        clearAuthTokens();
        navigate('/login');
        return;
      }

      window.alert(message);
    } finally {
      setBookmarkLoading(false);
    }
  };

  const handleKeywordClick = (id: number) => {
    if (submitting || savedKeywordIds.length > 0) return;

    setSelectedKeywordIds((prev) => {
      const next = new Set(prev);

      if (next.has(id)) {
        next.delete(id);
      } else if (next.size < 3) {
        next.add(id);
      }

      return next;
    });
  };

  const handleSaveFeedback = async () => {
    if (!postId || !voteId || selectedKeywordIds.size === 0 || savedKeywordIds.length > 0) {
      return;
    }

    const tagIds = Array.from(selectedKeywordIds);

    try {
      setSubmitting(true);
      setTagError('');

      await fetcher<CreateFeedbackResponse>(`/evaluations/votes/${voteId}/feedback`, {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify({ tagIds }),
      });

      setSavedKeywordIds(tagIds);
      await loadDetail();
    } catch (err) {
      const message = err instanceof Error ? err.message : '피드백 저장에 실패했습니다.';
      setTagError(message);

      if (isAuthError(message)) {
        clearAuthTokens();
        navigate('/login');
      }
    } finally {
      setSubmitting(false);
    }
  };

  const likeCount = data?.voteSummary.likeCount ?? 0;
  const dislikeCount = data?.voteSummary.dislikeCount ?? 0;
  const totalVoteCount = likeCount + dislikeCount;
  const likePercent = totalVoteCount > 0 ? Math.round((likeCount / totalVoteCount) * 100) : 0;
  const dislikePercent = totalVoteCount > 0 ? 100 - likePercent : 0;
  const keywordChips = useMemo(() => extractKeywordLabels(data), [data]);
  const structuredFeedback = useMemo(() => extractStructuredFeedback(data), [data]);
  const postDisplayText = data?.content || '코디 설명이 없습니다.';
  const saveButtonDisabled =
    selectedKeywordIds.size === 0 || submitting || tagLoading || savedKeywordIds.length > 0;
  const outfitItems = Array.isArray(data?.outfitItems) ? data.outfitItems : [];

  if (detailLoading) {
    return <div className={styles.loadingBox}>상세 정보를 불러오는 중...</div>;
  }

  if (!data) {
    return (
      <div className={styles.loadingBox}>{detailError || '평가 상세를 불러올 수 없습니다.'}</div>
    );
  }

  return (
    <>
      <div className={styles.contentPanel}>
        <div className={styles.sheetHeader}>
          <div className={styles.sheetHeaderCopy}>
            <div className={styles.titleRow}>
              <h1 className={styles.mainTitle}>컨텐츠</h1>
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
                    className={isBookmarked ? styles.bookmarkFilled : styles.bookmarkDefault}
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
            <div className={`${styles.evaluationSummaryItem} ${styles.evaluationSummaryDislike}`}>
              <ThumbsDown size={13} strokeWidth={2.2} />
              <span>{dislikePercent}%</span>
            </div>
          </div>
          <div className={styles.evaluationTrack}>
            <div className={styles.evaluationLikeFill} style={{ width: `${likePercent}%` }} />
            <div className={styles.evaluationDislikeFill} style={{ width: `${dislikePercent}%` }} />
          </div>
        </section>

        <div className={styles.sectionDivider} />
        <section className={styles.sectionBlock}>
          <div className={styles.sectionHeaderRow}>
            <h3 className={styles.sectionTitle}>피드백</h3>
          </div>

          {canWriteFeedback ? (
            <div
              className={`${styles.feedbackComposerCard} ${
                savedKeywordIds.length > 0
                  ? styles.feedbackComposerCardFlat
                  : styles.feedbackComposerCardRaised
              } ${
                voteChoice === 'LIKE'
                  ? styles.feedbackComposerCardLike
                  : voteChoice === 'DISLIKE'
                    ? styles.feedbackComposerCardDislike
                    : ''
              }`}
            >
              {tagLoading ? (
                <div className={styles.feedbackEmptyBox}>피드백 항목을 불러오는 중...</div>
              ) : tagError && keywords.length === 0 ? (
                <div className={styles.feedbackErrorText}>{tagError}</div>
              ) : keywords.length > 0 ? (
                <div className={styles.feedbackSelectGrid}>
                  {keywords.map((keyword) => {
                    const isSelected = selectedKeywordIds.has(keyword.id);
                    const isMaxReached = selectedKeywordIds.size >= 3 && !isSelected;

                    return (
                      <button
                        key={keyword.id}
                        type="button"
                        onClick={() => handleKeywordClick(keyword.id)}
                        disabled={savedKeywordIds.length > 0 || isMaxReached}
                        className={`${styles.selectChip} ${
                          isSelected ? styles.selectChipSelected : ''
                        } ${
                          isSelected && voteChoice === 'LIKE' ? styles.selectChipSelectedLike : ''
                        } ${
                          isSelected && voteChoice === 'DISLIKE'
                            ? styles.selectChipSelectedDislike
                            : ''
                        }`}
                      >
                        {keyword.label}
                      </button>
                    );
                  })}
                </div>
              ) : (
                <div className={styles.feedbackEmptyBox}>선택 가능한 피드백 항목이 없습니다.</div>
              )}

              {savedKeywordIds.length > 0 ? (
                <p className={styles.feedbackSavedText}>피드백이 저장되었습니다.</p>
              ) : (
                <p className={styles.feedbackHintText}>
                  최대 3개까지 선택할 수 있어요. ({selectedKeywordIds.size}/3)
                </p>
              )}

              {tagError && keywords.length > 0 ? (
                <p className={styles.feedbackErrorText}>{tagError}</p>
              ) : null}

              <div className={styles.feedbackCompleteInset}>
                <button
                  type="button"
                  onClick={handleSaveFeedback}
                  disabled={saveButtonDisabled}
                  className={`${styles.feedbackCompleteButton} ${
                    saveButtonDisabled ? styles.feedbackCompleteButtonDisabled : ''
                  }`}
                >
                  {submitting ? '저장 중...' : '피드백 완료'}
                </button>
              </div>
            </div>
          ) : null}

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
          <OutfitItemsCarousel outfitItems={outfitItems} />
        </section>

        {detailError ? <p className={styles.feedbackErrorText}>{detailError}</p> : null}
      </div>

      <Reports
        isOpen={reportOpen}
        onClose={() => setReportOpen(false)}
        defaultTab="post"
        postTarget={{ id: postId ?? 0, displayText: postDisplayText }}
        allowUserReport={false}
      />
    </>
  );
}

const EvaluationDetailFeedback: React.FC<EvaluationDetailFeedbackProps> = ({
  embedded = false,
  postIdOverride,
  voteIdOverride,
  voteChoiceOverride,
  allowReadonlyDetail = false,
}) => {
  const navigate = useNavigate();
  const { postId } = useParams();
  const [searchParams] = useSearchParams();

  const numericPostId = embedded ? (postIdOverride ?? null) : postId ? Number(postId) : null;
  const voteId = embedded
    ? (voteIdOverride ?? null)
    : searchParams.get('voteId')
      ? Number(searchParams.get('voteId'))
      : null;
  const rawVoteChoice = embedded ? voteChoiceOverride : searchParams.get('voteChoice');
  const voteChoice: VoteChoice | null =
    rawVoteChoice === 'LIKE' || rawVoteChoice === 'DISLIKE' ? rawVoteChoice : null;

  if (embedded) {
    return (
      <EvaluationDetailFeedbackContent
        postId={numericPostId}
        voteId={voteId}
        voteChoice={voteChoice}
        allowReadonlyDetail={allowReadonlyDetail}
      />
    );
  }

  return (
    <div className={styles.container}>
      <PostDetailBottomSheet isOpen onCloseRequest={() => navigate(-1)}>
        <EvaluationDetailFeedbackContent
          postId={numericPostId}
          voteId={voteId}
          voteChoice={voteChoice}
          allowReadonlyDetail={allowReadonlyDetail}
        />
      </PostDetailBottomSheet>
    </div>
  );
};

export default EvaluationDetailFeedback;
