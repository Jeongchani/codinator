import { useEffect, useMemo, useRef, useState } from 'react';
import { motion, useAnimation } from 'framer-motion';
import { ChevronsRight, Tag, ThumbsDown, ThumbsUp } from 'lucide-react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import type {
  GetFeedPostDetailResponse,
  GetRankingPostDetailResponse,
  RankingPeriod,
} from '@codinator/contracts';
import { clearAuthTokens, fetcher, getAuthHeaders, isAuthError } from '../../lib/api';
import sheetStyles from './PostDetailBottomSheet.module.css';
import detailStyles from '../../pages/ranking/RankingDetail.module.css';

type SheetPosition = 'expanded' | 'collapsed' | 'hidden';

type Props = {
  isOpen: boolean;
  onCloseRequest?: () => void;
  onClosed?: () => void;
  children?: React.ReactNode;
  postId?: number | null;
  authorUserId?: number | null;
  period?: RankingPeriod;
  hideFeedLink?: boolean;
  initialData?: PostDetailSheetData | null;
};

type StructuredFeedbackRow = {
  label: string;
  count: number;
  percent: number;
  side: 'LIKE' | 'DISLIKE';
};

type PostDetailResponse = GetRankingPostDetailResponse | GetFeedPostDetailResponse;

type OutfitItem = PostDetailResponse['outfitItems'][number];

export type PostDetailSheetData = {
  postId: number;
  authorUserId: number | null;
  authorNickname: string;
  contentText: string;
  keywordChips: string[];
  likeCount: number;
  dislikeCount: number;
  totalCount: number;
  likePercent: number;
  dislikePercent: number;
  structuredFeedback: {
    likeRows: StructuredFeedbackRow[];
    dislikeRows: StructuredFeedbackRow[];
  };
  outfitItems: OutfitItem[];
};

const EXPANDED_Y = 0;
const COLLAPSED_Y = 360;
const HIDDEN_Y = 860;
const SPRING = { type: 'spring', stiffness: 340, damping: 34 } as const;

const clamp = (value: number, min: number, max: number) => Math.min(Math.max(value, min), max);

type DragState = {
  pointerId: number;
  startClientY: number;
  startSheetY: number;
  lastClientY: number;
  lastTime: number;
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
  if (text.includes('LIKE') && !text.includes('DISLIKE') && !text.includes('UNLIKE')) {
    return 'LIKE';
  }
  if (text.includes('DISLIKE') || text.includes('NEGATIVE')) return 'DISLIKE';
  return undefined;
}

function formatKeywordLabel(keyword: string) {
  return keyword.startsWith('#') ? keyword : `#${keyword}`;
}

function formatCount(value: number) {
  return Math.max(0, value).toLocaleString('ko-KR');
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

function extractKeywordLabels(data: PostDetailResponse | null): string[] {
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

function extractStructuredFeedback(data: PostDetailResponse | null) {
  if (!data) {
    return { likeRows: [] as StructuredFeedbackRow[], dislikeRows: [] as StructuredFeedbackRow[] };
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
      return { label, count, side: voteChoice };
    })
    .filter((item): item is { label: string; count: number; side: 'LIKE' | 'DISLIKE' } =>
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
  };
}

export function buildPostDetailSheetData(
  postData: PostDetailResponse | null,
): PostDetailSheetData | null {
  if (!postData) return null;

  const likeCount = postData.voteSummary.likeCount ?? 0;
  const dislikeCount = postData.voteSummary.dislikeCount ?? 0;
  const totalCount = likeCount + dislikeCount;
  const likePercent = totalCount <= 0 ? 0 : Math.round((likeCount / totalCount) * 100);
  const dislikePercent = totalCount <= 0 ? 0 : 100 - likePercent;

  return {
    postId: postData.postId,
    authorUserId: postData.author?.userId ?? null,
    authorNickname: postData.author?.nickname ?? '닉네임',
    contentText: postData.content || '코디 설명이 없습니다.',
    keywordChips: extractKeywordLabels(postData),
    likeCount,
    dislikeCount,
    totalCount,
    likePercent,
    dislikePercent,
    structuredFeedback: extractStructuredFeedback(postData),
    outfitItems: Array.isArray(postData.outfitItems) ? postData.outfitItems : [],
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
    <div className={detailStyles.feedbackPanel}>
      <div className={detailStyles.feedbackPanelHeader}>
        <h4 className={detailStyles.feedbackPanelTitle}>{title}</h4>
        <span className={detailStyles.feedbackPanelCount}>{formatCount(count)}표 받음</span>
      </div>
      <div className={detailStyles.feedbackRows}>
        {rows.length > 0 ? (
          rows.map((row) => (
            <div key={`${side}-${row.label}`} className={detailStyles.feedbackRow}>
              <div className={detailStyles.feedbackRowHead}>
                <span className={detailStyles.feedbackRowLabel}>{row.label}</span>
                <span className={detailStyles.feedbackRowPercent}>{row.percent}%</span>
              </div>
              <div className={detailStyles.feedbackRowTrack}>
                <div
                  className={`${detailStyles.feedbackRowFill} ${
                    side === 'LIKE'
                      ? detailStyles.feedbackRowFillLike
                      : detailStyles.feedbackRowFillDislike
                  }`}
                  style={{ width: `${Math.max(row.percent, 6)}%` }}
                />
              </div>
            </div>
          ))
        ) : (
          <p className={detailStyles.feedbackEmptyText}>아직 피드백이 없습니다.</p>
        )}
      </div>
    </div>
  );
}
const OUTFIT_CARD_WIDTH = 168;
const OUTFIT_CARD_GAP = 12;
function OutfitItemsCarousel({ outfitItems }: { outfitItems: OutfitItem[] }) {
  const viewportRef = useRef<HTMLDivElement | null>(null);
  const [activeIndex, setActiveIndex] = useState(0);
  const maxIndex = Math.max(0, outfitItems.length - 1);
  const step = OUTFIT_CARD_WIDTH + OUTFIT_CARD_GAP;

  const getSnapPoints = () => {
    const viewport = viewportRef.current;
    if (!viewport) {
      return outfitItems.map((_, index) => index * step);
    }

    const maxScrollLeft = Math.max(0, viewport.scrollWidth - viewport.clientWidth);
    return outfitItems.map((_, index) => Math.min(index * step, maxScrollLeft));
  };

  const updateActiveIndex = () => {
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
  };

  const goTo = (index: number) => {
    const viewport = viewportRef.current;
    if (!viewport) return;

    const targetIndex = clamp(index, 0, maxIndex);
    const snapPoints = getSnapPoints();
    viewport.scrollTo({
      left: snapPoints[targetIndex] ?? 0,
      behavior: 'smooth',
    });
  };

  if (outfitItems.length === 0) {
    return <div className={sheetStyles.emptyText}>등록된 아이템이 없습니다.</div>;
  }

  return (
    <div className={sheetStyles.outfitCarousel}>
      <div
        ref={viewportRef}
        className={sheetStyles.outfitCarouselViewport}
        onScroll={updateActiveIndex}
      >
        <div className={sheetStyles.outfitCarouselTrack} style={{ gap: `${OUTFIT_CARD_GAP}px` }}>
          {outfitItems.map((item, index) => (
            <div
              key={item.id ?? index}
              className={sheetStyles.outfitCarouselItem}
              style={{ width: `${OUTFIT_CARD_WIDTH}px` }}
            >
              <div className={sheetStyles.outfitCard}>
                <div className={`${sheetStyles.outfitField} ${sheetStyles.outfitCategoryField}`}>
                  <div className={sheetStyles.outfitCategoryInner}>
                    <Tag size={13} strokeWidth={2} className={sheetStyles.outfitCategoryIcon} />
                    <span className={sheetStyles.outfitFieldValue}>
                      {formatCategoryLabel(item.category)}
                    </span>
                  </div>
                </div>
                <div className={sheetStyles.outfitField}>
                  <span className={sheetStyles.outfitFieldValue}>
                    {item.brand || '브랜드 미등록'}
                  </span>
                </div>
                <div className={sheetStyles.outfitField}>
                  <span className={sheetStyles.outfitFieldValue}>
                    {item.itemName || '상품 이름 미등록'}
                  </span>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {outfitItems.length > 1 ? (
        <div className={sheetStyles.outfitCarouselDots}>
          {outfitItems.map((item, index) => {
            const label = item.itemName?.trim() || `${index + 1}번 아이템`;
            return (
              <button
                key={item.id ?? `${label}-${index}`}
                type="button"
                aria-label={`${label} 카드로 이동`}
                onClick={() => goTo(index)}
                className={`${sheetStyles.outfitCarouselDot} ${activeIndex === index ? sheetStyles.outfitCarouselDotActive : ''}`}
              />
            );
          })}
        </div>
      ) : null}
    </div>
  );
}

export function PostDetailBottomSheetContent({
  data,
  loading,
  hideFeedLink = false,
  onGoToUserFeed,
}: {
  data: PostDetailSheetData | null;
  loading: boolean;
  hideFeedLink?: boolean;
  onGoToUserFeed: () => void;
}) {
  if (loading) return <div className={detailStyles.sheetContent}>데이터 로드 중...</div>;
  if (!data) {
    return <div className={detailStyles.sheetContent}>게시글을 불러올 수 없습니다.</div>;
  }

  return (
    <div className={detailStyles.sheetContent}>
      <div className={detailStyles.sheetHeader}>
        <div className={detailStyles.sheetHeaderCopy}>
          <div className={detailStyles.authorMetaRow}>
            <p className={detailStyles.authorName}>{data.authorNickname}</p>
          </div>
          <p className={detailStyles.contentText}>{data.contentText}</p>
        </div>
      </div>

      <div className={detailStyles.keywordLaneSection}>
        <div className={detailStyles.keywordLaneRow}>
          {data.keywordChips.length > 0 ? (
            <div className={detailStyles.keywordLane}>
              {data.keywordChips.map((keyword) => (
                <span key={keyword} className={detailStyles.keywordChip}>
                  {formatKeywordLabel(keyword)}
                </span>
              ))}
            </div>
          ) : (
            <div className={detailStyles.keywordLane} />
          )}

          {!hideFeedLink ? (
            <button type="button" className={detailStyles.feedLinkButton} onClick={onGoToUserFeed}>
              <span className={detailStyles.feedLinkButtonText}>피드 보러가기</span>
              <ChevronsRight
                size={14}
                strokeWidth={2.5}
                className={detailStyles.feedLinkButtonIcon}
              />
            </button>
          ) : null}
        </div>
      </div>

      <div className={detailStyles.sectionDivider} />
      <div className={detailStyles.sectionHeaderRow}>
        <h3 className={detailStyles.sectionTitle}>평가</h3>
        <span className={detailStyles.sectionMetaText}>{formatCount(data.totalCount)}명 참여</span>
      </div>

      <div className={detailStyles.evaluationSummaryRow}>
        <div
          className={`${detailStyles.evaluationSummaryItem} ${detailStyles.evaluationSummaryLike}`}
        >
          <ThumbsUp size={13} strokeWidth={2.2} />
          <span>{data.likePercent}%</span>
        </div>
        <div
          className={`${detailStyles.evaluationSummaryItem} ${detailStyles.evaluationSummaryDislike}`}
        >
          <ThumbsDown size={13} strokeWidth={2.2} />
          <span>{data.dislikePercent}%</span>
        </div>
      </div>

      <div className={detailStyles.evaluationTrack}>
        <div
          className={detailStyles.evaluationLikeFill}
          style={{ width: `${data.likePercent}%` }}
        />
        <div
          className={detailStyles.evaluationDislikeFill}
          style={{ width: `${data.dislikePercent}%` }}
        />
      </div>

      <div className={detailStyles.sectionDivider} />
      <div className={detailStyles.sectionHeaderRow}>
        <h3 className={detailStyles.sectionTitle}>피드백</h3>
      </div>

      <div className={detailStyles.feedbackGrid}>
        <FeedbackPanel
          title="좋아요"
          side="LIKE"
          count={data.likeCount}
          rows={data.structuredFeedback.likeRows}
        />
        <FeedbackPanel
          title="싫어요"
          side="DISLIKE"
          count={data.dislikeCount}
          rows={data.structuredFeedback.dislikeRows}
        />
      </div>

      <div className={detailStyles.sectionDivider} />
      <div className={sheetStyles.outfitHeaderRow}>
        <h3 className={sheetStyles.outfitTitle}>착용 아이템</h3>
      </div>

      <OutfitItemsCarousel outfitItems={data.outfitItems} />
    </div>
  );
}

export function RankingDetailSheetContent({
  postId,
  authorUserId,
  period,
  initialData = null,
  hideFeedLink = false,
}: {
  postId?: number | null;
  authorUserId?: number | null;
  period?: RankingPeriod;
  initialData?: PostDetailSheetData | null;
  hideFeedLink?: boolean;
}) {
  const navigate = useNavigate();
  const { postId: routePostId } = useParams();
  const [searchParams] = useSearchParams();
  const [postData, setPostData] = useState<PostDetailResponse | null>(null);
  const [loading, setLoading] = useState(true);

  const activePostId = postId ?? (routePostId ? Number(routePostId) : null);
  const periodParam = searchParams.get('period');
  const explicitPeriod: RankingPeriod | null =
    period ?? (periodParam === 'WEEKLY' || periodParam === 'MONTHLY' ? periodParam : null);
  const hasInitialFallback = Boolean(initialData && initialData.postId === activePostId);

  useEffect(() => {
    let cancelled = false;

    const loadDetail = async () => {
      if (!activePostId) {
        setLoading(false);
        setPostData(null);
        return;
      }

      try {
        setLoading(true);
        let matchedData: PostDetailResponse | null = null;
        let lastMessage = '';

        if (typeof authorUserId === 'number' && Number.isFinite(authorUserId)) {
          try {
            matchedData = await fetcher<GetFeedPostDetailResponse>(
              `/users/${authorUserId}/feed/${activePostId}`,
              { headers: getAuthHeaders() },
            );
          } catch (err) {
            const message =
              err instanceof Error ? err.message : '상세 데이터를 불러오지 못했습니다.';
            if (isAuthError(message)) {
              clearAuthTokens();
              navigate('/login');
              return;
            }
            lastMessage = message;
          }
        } else if (explicitPeriod) {
          try {
            matchedData = await fetcher<GetRankingPostDetailResponse>(
              `/rankings/posts/${activePostId}?period=${explicitPeriod}`,
              { headers: getAuthHeaders() },
            );
          } catch (err) {
            const message =
              err instanceof Error ? err.message : '상세 데이터를 불러오지 못했습니다.';
            if (isAuthError(message)) {
              clearAuthTokens();
              navigate('/login');
              return;
            }
            lastMessage = message;
          }
        } else if (!hasInitialFallback) {
          const candidatePeriods: RankingPeriod[] = ['WEEKLY', 'MONTHLY'];

          for (const candidate of candidatePeriods) {
            try {
              const data = await fetcher<GetRankingPostDetailResponse>(
                `/rankings/posts/${activePostId}?period=${candidate}`,
                { headers: getAuthHeaders() },
              );
              matchedData = data;
              break;
            } catch (err) {
              const message =
                err instanceof Error ? err.message : '상세 데이터를 불러오지 못했습니다.';
              if (isAuthError(message)) {
                clearAuthTokens();
                navigate('/login');
                return;
              }
              lastMessage = message;
            }
          }
        }

        if (cancelled) return;
        setPostData(matchedData);
        if (!matchedData && lastMessage) console.warn(lastMessage);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    void loadDetail();
    return () => {
      cancelled = true;
    };
  }, [activePostId, authorUserId, explicitPeriod, hasInitialFallback, navigate]);

  const sheetData = useMemo(() => {
    const detailData = buildPostDetailSheetData(postData);
    if (detailData) return detailData;
    return initialData && initialData.postId === activePostId ? initialData : null;
  }, [activePostId, initialData, postData]);

  const handleGoToUserFeed = () => {
    const authorUserId = sheetData?.authorUserId;
    if (!authorUserId) {
      window.alert('유저 정보를 찾을 수 없습니다.');
      return;
    }
    navigate(`/user/${authorUserId}/feed`);
  };

  return (
    <PostDetailBottomSheetContent
      data={sheetData}
      loading={loading}
      hideFeedLink={hideFeedLink}
      onGoToUserFeed={handleGoToUserFeed}
    />
  );
}

export default function PostDetailBottomSheet({
  isOpen,
  onCloseRequest,
  onClosed,
  children,
  postId,
  authorUserId,
  period,
  initialData = null,
  hideFeedLink = false,
}: Props) {
  const controls = useAnimation();
  const positionRef = useRef<SheetPosition>(isOpen ? 'collapsed' : 'hidden');
  const currentYRef = useRef<number>(HIDDEN_Y);
  const closeGenRef = useRef(0);
  const wasOpenRef = useRef(isOpen);
  const dragStateRef = useRef<DragState | null>(null);
  const contentWrapRef = useRef<HTMLDivElement | null>(null);

  const shouldRenderDefaultRankingDetail = !children && typeof postId === 'number';

  function syncContentInset(y: number) {
    contentWrapRef.current?.style.setProperty(
      '--sheet-bottom-inset',
      `${Math.max(0, Math.round(y)) + 24}px`,
    );
  }

  function setSheetYImmediately(y: number) {
    currentYRef.current = y;
    controls.set({ y });
    syncContentInset(y);
  }

  async function animateTo(position: SheetPosition) {
    positionRef.current = position;

    const nextY =
      position === 'expanded' ? EXPANDED_Y : position === 'collapsed' ? COLLAPSED_Y : HIDDEN_Y;

    currentYRef.current = nextY;
    syncContentInset(nextY);
    await controls.start({ y: nextY, transition: SPRING });
  }

  function snapTo(position: SheetPosition) {
    void animateTo(position);

    if (position === 'hidden') {
      onCloseRequest?.();
    }
  }

  function handleDragEnd(offsetY: number, velocityY: number) {
    const currentPosition = positionRef.current;
    const currentY = currentYRef.current;
    const isDraggingUp = offsetY < -50 || velocityY < -500;
    const isDraggingDown = offsetY > 50 || velocityY > 500;
    const isStrongDraggingDown = offsetY > 160 || velocityY > 1000;

    if (isDraggingUp) {
      if (currentPosition === 'hidden' || currentY > COLLAPSED_Y) {
        snapTo('collapsed');
      } else {
        snapTo('expanded');
      }
      return;
    }

    if (isStrongDraggingDown) {
      snapTo('hidden');
      return;
    }

    if (isDraggingDown) {
      if (currentPosition === 'expanded' || currentY < COLLAPSED_Y) {
        snapTo('collapsed');
      } else {
        snapTo('hidden');
      }
      return;
    }

    if (currentY <= (EXPANDED_Y + COLLAPSED_Y) / 2) {
      snapTo('expanded');
      return;
    }

    if (currentY <= (COLLAPSED_Y + HIDDEN_Y) / 2) {
      snapTo('collapsed');
      return;
    }

    snapTo('hidden');
  }

  function handleGlobalPointerMove(event: PointerEvent) {
    const dragState = dragStateRef.current;
    if (!dragState || dragState.pointerId !== event.pointerId) return;

    const nextY = clamp(
      dragState.startSheetY + (event.clientY - dragState.startClientY),
      EXPANDED_Y,
      HIDDEN_Y,
    );

    setSheetYImmediately(nextY);
    dragState.lastClientY = event.clientY;
    dragState.lastTime = event.timeStamp;
  }

  function handleGlobalPointerUp(event: PointerEvent) {
    const dragState = dragStateRef.current;
    if (!dragState || dragState.pointerId !== event.pointerId) return;

    const deltaY = event.clientY - dragState.startClientY;
    const deltaTime = Math.max(event.timeStamp - dragState.lastTime, 1);
    const velocityY = ((event.clientY - dragState.lastClientY) / deltaTime) * 1000;

    dragStateRef.current = null;
    detachGlobalPointerEvents();
    handleDragEnd(deltaY, velocityY);
  }

  function detachGlobalPointerEvents() {
    window.removeEventListener('pointermove', handleGlobalPointerMove);
    window.removeEventListener('pointerup', handleGlobalPointerUp);
    window.removeEventListener('pointercancel', handleGlobalPointerUp);
  }

  function handleHandlerPointerDown(event: React.PointerEvent<HTMLDivElement>) {
    if (event.pointerType === 'mouse' && event.button !== 0) return;

    dragStateRef.current = {
      pointerId: event.pointerId,
      startClientY: event.clientY,
      startSheetY: currentYRef.current,
      lastClientY: event.clientY,
      lastTime: event.timeStamp,
    };

    detachGlobalPointerEvents();
    window.addEventListener('pointermove', handleGlobalPointerMove, { passive: true });
    window.addEventListener('pointerup', handleGlobalPointerUp, { passive: true });
    window.addEventListener('pointercancel', handleGlobalPointerUp, { passive: true });
  }

  function handleBarClick() {
    const currentPosition = positionRef.current;

    if (currentPosition === 'expanded') {
      snapTo('collapsed');
      return;
    }

    if (currentPosition === 'hidden') {
      snapTo('collapsed');
      return;
    }

    snapTo('expanded');
  }

  useEffect(() => {
    setSheetYImmediately(HIDDEN_Y);

    return () => {
      dragStateRef.current = null;
      detachGlobalPointerEvents();
    };
  }, []);

  useEffect(() => {
    const wasOpen = wasOpenRef.current;
    wasOpenRef.current = isOpen;

    if (isOpen) {
      positionRef.current = 'collapsed';
      setSheetYImmediately(HIDDEN_Y);

      const raf = window.requestAnimationFrame(() => {
        void animateTo('collapsed');
      });

      return () => window.cancelAnimationFrame(raf);
    }

    positionRef.current = 'hidden';

    if (!wasOpen) {
      setSheetYImmediately(HIDDEN_Y);
      return;
    }

    const currentGen = ++closeGenRef.current;
    void animateTo('hidden').then(() => {
      if (currentGen !== closeGenRef.current) return;
      onClosed?.();
    });
  }, [isOpen, onClosed]);

  return (
    <motion.div
      className={`${sheetStyles.sheetRoot} ${isOpen ? sheetStyles.open : sheetStyles.closed}`}
      initial={false}
      animate={controls}
      style={{ y: HIDDEN_Y }}
    >
      <div
        className={sheetStyles.handlerArea}
        onPointerDown={handleHandlerPointerDown}
        onClick={handleBarClick}
      >
        <div className={sheetStyles.handlerBar} />
      </div>

      <div className={sheetStyles.sheetScrollArea}>
        <div ref={contentWrapRef} className={sheetStyles.contentWrap}>
          {shouldRenderDefaultRankingDetail ? (
            <RankingDetailSheetContent
              postId={postId}
              authorUserId={authorUserId}
              period={period}
              initialData={initialData}
              hideFeedLink={hideFeedLink}
            />
          ) : (
            children
          )}
        </div>
      </div>
    </motion.div>
  );
}
