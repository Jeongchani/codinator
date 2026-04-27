import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { Check, Trash2 } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import type { BookmarkListItem, RankingPeriod, VoteChoice } from '@codinator/contracts';
import {
  clearAuthTokens,
  fetchAllMyBookmarks,
  isAuthError,
  resolveAssetUrl,
  setPostBookmark,
} from '../../lib/api';
import Header from '../../components/Header';
import PostDetailBottomSheet from '../../components/postdetail/PostDetailBottomSheet';
import FocusScreen from '../../components/focus/FocusScreen';
import EvaluationDetailFeedback from '../evaluation/EvaluationDetailFeedback';
import styles from './Bookmark.module.css';

type TabType = 'all' | 'ongoing' | 'done';
type TouchDragMode = 'select' | 'deselect';
type SlideDirection = 'left' | 'right';

type BookmarkItem = {
  id: number;
  postId: number;
  title: string;
  imageUrl?: string;
  status: Exclude<TabType, 'all'>;
  rankingPeriods: RankingPeriod[];
  voteId: number | null;
  voteChoice: VoteChoice | null;
};

type IndicatorStyle = {
  left: number;
  width: number;
};

type Point = {
  x: number;
  y: number;
};

type SelectionRect = {
  left: number;
  top: number;
  right: number;
  bottom: number;
};

const TAB_ORDER: TabType[] = ['all', 'ongoing', 'done'];
const LONG_PRESS_MS = 450;
const LONG_PRESS_MOVE_THRESHOLD = 8;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function toSafeNumber(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) return value;

  if (typeof value === 'string') {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) return parsed;
  }

  return null;
}

function normalizeVoteChoice(value: unknown): VoteChoice | null {
  const text = String(value ?? '').toUpperCase();

  if (text === 'LIKE') return 'LIKE';
  if (text === 'DISLIKE') return 'DISLIKE';

  return null;
}

function normalizeRankingPeriods(periods: unknown): RankingPeriod[] {
  if (!Array.isArray(periods)) return [];

  return periods
    .map((period) => String(period).toUpperCase())
    .filter((period): period is RankingPeriod => {
      return period === 'WEEKLY' || period === 'MONTHLY';
    });
}

function extractRankingPeriods(raw: Record<string, unknown>): RankingPeriod[] {
  const candidates = [raw.rankingPeriods, raw.periods, raw.rankingPeriod, raw.period];

  for (const candidate of candidates) {
    if (Array.isArray(candidate)) {
      const normalized = normalizeRankingPeriods(candidate);
      if (normalized.length > 0) return normalized;
    }

    if (typeof candidate === 'string') {
      const normalized = normalizeRankingPeriods([candidate]);
      if (normalized.length > 0) return normalized;
    }
  }

  return [];
}

function extractVoteId(raw: Record<string, unknown>): number | null {
  const directCandidates = [raw.voteId, raw.myVoteId, raw.latestVoteId, raw.selectedVoteId];

  for (const candidate of directCandidates) {
    const parsed = toSafeNumber(candidate);
    if (parsed !== null) return parsed;
  }

  const nestedCandidates = [raw.vote, raw.myVote, raw.latestVote];

  for (const candidate of nestedCandidates) {
    if (!isRecord(candidate)) continue;

    const parsed = toSafeNumber(candidate.id);
    if (parsed !== null) return parsed;
  }

  return null;
}

function extractVoteChoice(raw: Record<string, unknown>): VoteChoice | null {
  const directCandidates = [raw.voteChoice, raw.myVoteChoice, raw.selectedVoteChoice];

  for (const candidate of directCandidates) {
    const normalized = normalizeVoteChoice(candidate);
    if (normalized) return normalized;
  }

  const nestedCandidates = [raw.vote, raw.myVote, raw.latestVote];

  for (const candidate of nestedCandidates) {
    if (!isRecord(candidate)) continue;

    const normalized =
      normalizeVoteChoice(candidate.voteChoice) ?? normalizeVoteChoice(candidate.choice);

    if (normalized) return normalized;
  }

  return null;
}

function getItemsByTab(items: BookmarkItem[], tab: TabType) {
  if (tab === 'all') return items;
  return items.filter((item) => item.status === tab);
}

function getDefaultPeriod(periods: RankingPeriod[]): RankingPeriod | null {
  if (periods.includes('WEEKLY')) return 'WEEKLY';
  if (periods.includes('MONTHLY')) return 'MONTHLY';
  return null;
}

function formatPeriodLabel(period: RankingPeriod) {
  return period === 'MONTHLY' ? 'This Month' : 'This Week';
}

function mapBookmarkItems(rawItems: BookmarkListItem[]): BookmarkItem[] {
  return rawItems
    .map((item): BookmarkItem | null => {
      const postId = item.postId;
      if (postId == null) return null;

      const content = item.content ?? null;
      const thumbnailUrl = item.thumbnailUrl ?? null;
      const evaluationStatus = item.evaluationStatus ?? null;
      const raw = item as BookmarkListItem & Record<string, unknown>;

      const status: BookmarkItem['status'] = evaluationStatus === 'OPEN' ? 'ongoing' : 'done';

      return {
        id: postId,
        postId,
        title: content?.trim() || `북마크 ${postId}`,
        imageUrl: resolveAssetUrl(thumbnailUrl) || undefined,
        status,
        rankingPeriods: extractRankingPeriods(raw),
        voteId: extractVoteId(raw),
        voteChoice: extractVoteChoice(raw),
      };
    })
    .filter((item): item is BookmarkItem => item !== null);
}

type BookmarkSelectionActionBarProps = {
  countText: string;
  canDelete: boolean;
  onDelete: () => void;
};

function BookmarkSelectionActionBar({
  countText,
  canDelete,
  onDelete,
}: BookmarkSelectionActionBarProps) {
  return (
    <div className={styles.selectionActionBar}>
      <div className={styles.selectionActionBarLayer}>
        <div className={styles.selectionActionSurface}>
          <div className={styles.selectionActionRow}>
            <p className={styles.selectionCountText}>{countText}</p>

            <div className={styles.selectionActionButtons}>
              <button
                type="button"
                className={`${styles.selectionGlassButton} ${
                  !canDelete ? styles.selectionGlassButtonDisabled : ''
                }`}
                onClick={onDelete}
                disabled={!canDelete}
                aria-label="삭제"
              >
                <span className={styles.selectionGlassButtonInner} />
                <span className={styles.selectionGlassButtonIcon}>
                  <Trash2 className={styles.selectionActionIconSvg} strokeWidth={2.2} />
                </span>
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function Bookmark() {
  const navigate = useNavigate();

  const [activeTab, setActiveTab] = useState<TabType>('all');
  const [displayTab, setDisplayTab] = useState<TabType>('all');
  const [prevTab, setPrevTab] = useState<TabType>('all');
  const [incomingTab, setIncomingTab] = useState<TabType | null>(null);
  const [isAnimating, setIsAnimating] = useState(false);
  const [slideDirection, setSlideDirection] = useState<SlideDirection>('right');

  const [items, setItems] = useState<BookmarkItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const [deleteMode, setDeleteMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<number[]>([]);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleteLoading, setDeleteLoading] = useState(false);

  const [isTouchDragging, setIsTouchDragging] = useState(false);
  const [touchDragMode, setTouchDragMode] = useState<TouchDragMode>('select');
  const [pressingCardId, setPressingCardId] = useState<number | null>(null);
  const [isSelectButtonPressed, setIsSelectButtonPressed] = useState(false);

  const [focusOpen, setFocusOpen] = useState(false);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [focusIndex, setFocusIndex] = useState(0);
  const [focusItems, setFocusItems] = useState<BookmarkItem[]>([]);

  const containerRef = useRef<HTMLDivElement | null>(null);
  const tabRowRef = useRef<HTMLDivElement | null>(null);
  const cardRefs = useRef<Record<number, HTMLButtonElement | null>>({});

  const allTextRef = useRef<HTMLSpanElement | null>(null);
  const ongoingTextRef = useRef<HTMLSpanElement | null>(null);
  const doneTextRef = useRef<HTMLSpanElement | null>(null);

  const touchStartRef = useRef<Point | null>(null);
  const touchCurrentRef = useRef<Point | null>(null);
  const initialSelectedIdsRef = useRef<number[]>([]);
  const animationTimerRef = useRef<number | null>(null);
  const touchDraggedRef = useRef(false);
  const ignoreNextClickRef = useRef(false);

  const longPressTimerRef = useRef<number | null>(null);
  const longPressStartPointRef = useRef<Point | null>(null);
  const longPressTriggeredRef = useRef(false);
  const ignoreNextCardClickRef = useRef(false);
  const ignoreNextSelectionTouchEndRef = useRef<number | null>(null);

  const [indicatorStyle, setIndicatorStyle] = useState<IndicatorStyle>({
    left: 0,
    width: 0,
  });

  const displayedItems = useMemo(() => {
    return getItemsByTab(items, displayTab);
  }, [items, displayTab]);

  const previousItems = useMemo(() => {
    return getItemsByTab(items, prevTab);
  }, [items, prevTab]);

  const activeItemsForSelection = useMemo(() => {
    return getItemsByTab(items, activeTab);
  }, [items, activeTab]);

  const incomingItems = useMemo(
    () => (incomingTab ? getItemsByTab(items, incomingTab) : []),
    [incomingTab, items],
  );

  const selectedIdSet = useMemo(() => new Set(selectedIds), [selectedIds]);
  const activeItemIdSet = useMemo(
    () => new Set(activeItemsForSelection.map((item) => item.id)),
    [activeItemsForSelection],
  );
  const allVisibleSelected = useMemo(
    () =>
      activeItemsForSelection.length > 0 &&
      activeItemsForSelection.every((item) => selectedIdSet.has(item.id)),
    [activeItemsForSelection, selectedIdSet],
  );
  const selectionCountText = `${selectedIds.length.toLocaleString('ko-KR')}개 선택됨`;

  const focusedItem = focusItems[focusIndex] ?? null;
  const focusedPeriod = useMemo(
    () => (focusedItem ? getDefaultPeriod(focusedItem.rankingPeriods) : null),
    [focusedItem],
  );

  const loadBookmarks = useCallback(async () => {
    try {
      setLoading(true);
      setError('');

      const data = await fetchAllMyBookmarks();
      setItems(mapBookmarkItems(data));
    } catch (err) {
      const message = err instanceof Error ? err.message : '북마크 목록을 불러오지 못했습니다.';

      if (isAuthError(message)) {
        clearAuthTokens();
        navigate('/login', { replace: true });
        return;
      }

      setError(message);
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, [navigate]);

  useEffect(() => {
    void loadBookmarks();
  }, [loadBookmarks]);

  useEffect(() => {
    setSelectedIds((prev) => prev.filter((id) => activeItemIdSet.has(id)));
  }, [activeItemIdSet]);

  useEffect(() => {
    const footerElements = Array.from(
      document.querySelectorAll<HTMLElement>('[class*="footerWrap"], .footerWrap'),
    );

    footerElements.forEach((element) => {
      if (deleteMode) {
        if (!element.dataset.prevDisplay) {
          element.dataset.prevDisplay = element.style.display || '';
        }
        element.style.display = 'none';
      } else if (element.dataset.prevDisplay !== undefined) {
        element.style.display = element.dataset.prevDisplay;
        delete element.dataset.prevDisplay;
      }
    });

    return () => {
      footerElements.forEach((element) => {
        if (element.dataset.prevDisplay !== undefined) {
          element.style.display = element.dataset.prevDisplay;
          delete element.dataset.prevDisplay;
        }
      });
    };
  }, [deleteMode]);

  const getTabTextRef = useCallback((tab: TabType) => {
    if (tab === 'all') return allTextRef.current;
    if (tab === 'ongoing') return ongoingTextRef.current;
    return doneTextRef.current;
  }, []);

  const updateIndicator = useCallback(() => {
    const rowEl = tabRowRef.current;
    const targetEl = getTabTextRef(activeTab);

    if (!rowEl || !targetEl) return;

    const rowRect = rowEl.getBoundingClientRect();
    const targetRect = targetEl.getBoundingClientRect();

    setIndicatorStyle({
      left: targetRect.left - rowRect.left,
      width: targetRect.width,
    });
  }, [activeTab, getTabTextRef]);

  useLayoutEffect(() => {
    updateIndicator();
  }, [updateIndicator]);

  useEffect(() => {
    const handleResize = () => updateIndicator();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [updateIndicator]);

  useEffect(() => {
    if (!isAnimating || !incomingTab) return;

    if (animationTimerRef.current) {
      window.clearTimeout(animationTimerRef.current);
    }

    animationTimerRef.current = window.setTimeout(() => {
      setDisplayTab(incomingTab);
      setIncomingTab(null);
      setIsAnimating(false);
    }, 320);

    return () => {
      if (animationTimerRef.current) {
        window.clearTimeout(animationTimerRef.current);
      }
    };
  }, [isAnimating, incomingTab]);

  const getPointInContainer = useCallback((clientX: number, clientY: number) => {
    const container = containerRef.current;
    if (!container) return { x: clientX, y: clientY };

    const rect = container.getBoundingClientRect();
    return {
      x: clientX - rect.left,
      y: clientY - rect.top,
    };
  }, []);

  const getSelectionRect = useCallback((start: Point, current: Point): SelectionRect => {
    return {
      left: Math.min(start.x, current.x),
      top: Math.min(start.y, current.y),
      right: Math.max(start.x, current.x),
      bottom: Math.max(start.y, current.y),
    };
  }, []);

  const isIntersecting = useCallback((selection: SelectionRect, card: DOMRect) => {
    const container = containerRef.current;
    if (!container) return false;

    const containerRect = container.getBoundingClientRect();

    const left = card.left - containerRect.left;
    const top = card.top - containerRect.top;
    const right = left + card.width;
    const bottom = top + card.height;

    return !(
      selection.right < left ||
      selection.left > right ||
      selection.bottom < top ||
      selection.top > bottom
    );
  }, []);

  const applyTouchDragSelection = useCallback(() => {
    const start = touchStartRef.current;
    const current = touchCurrentRef.current;
    if (!start || !current) return;

    const rect = getSelectionRect(start, current);
    const touchedIds = activeItemsForSelection
      .filter((item) => {
        const el = cardRefs.current[item.id];
        if (!el) return false;
        return isIntersecting(rect, el.getBoundingClientRect());
      })
      .map((item) => item.id);

    const baseSet = new Set(initialSelectedIdsRef.current);

    if (touchDragMode === 'select') {
      touchedIds.forEach((id) => baseSet.add(id));
    } else {
      touchedIds.forEach((id) => baseSet.delete(id));
    }

    setSelectedIds(Array.from(baseSet));
  }, [activeItemsForSelection, getSelectionRect, isIntersecting, touchDragMode]);

  const resetTouchDragging = useCallback(() => {
    setIsTouchDragging(false);
    touchStartRef.current = null;
    touchCurrentRef.current = null;
    touchDraggedRef.current = false;
  }, []);

  const clearLongPress = useCallback(() => {
    if (longPressTimerRef.current) {
      window.clearTimeout(longPressTimerRef.current);
      longPressTimerRef.current = null;
    }
    longPressStartPointRef.current = null;
    setPressingCardId(null);
  }, []);

  useEffect(() => {
    return () => {
      clearLongPress();
    };
  }, [clearLongPress]);

  const activateDeleteModeByLongPress = useCallback((itemId: number) => {
    longPressTriggeredRef.current = true;
    ignoreNextCardClickRef.current = true;
    setPressingCardId(null);
    ignoreNextSelectionTouchEndRef.current = itemId;
    setDeleteMode(true);
    setSelectedIds([itemId]);
    setShowDeleteConfirm(false);
    setSheetOpen(false);
    setFocusOpen(false);
  }, []);

  const startCardLongPress = useCallback(
    (clientX: number, clientY: number, itemId: number) => {
      if (deleteMode || focusOpen) return;

      clearLongPress();
      longPressTriggeredRef.current = false;
      setPressingCardId(itemId);

      longPressStartPointRef.current = getPointInContainer(clientX, clientY);

      longPressTimerRef.current = window.setTimeout(() => {
        activateDeleteModeByLongPress(itemId);
        longPressTimerRef.current = null;
      }, LONG_PRESS_MS);
    },
    [activateDeleteModeByLongPress, clearLongPress, deleteMode, focusOpen, getPointInContainer],
  );

  const moveCardLongPress = useCallback(
    (clientX: number, clientY: number) => {
      if (deleteMode || focusOpen || longPressTriggeredRef.current) return;

      const start = longPressStartPointRef.current;
      if (!start || !longPressTimerRef.current) return;

      const current = getPointInContainer(clientX, clientY);
      const dx = Math.abs(current.x - start.x);
      const dy = Math.abs(current.y - start.y);

      if (dx > LONG_PRESS_MOVE_THRESHOLD || dy > LONG_PRESS_MOVE_THRESHOLD) {
        clearLongPress();
      }
    },
    [clearLongPress, deleteMode, focusOpen, getPointInContainer],
  );

  const endCardLongPress = useCallback(() => {
    clearLongPress();
  }, [clearLongPress]);

  const handleEnterDeleteMode = () => {
    ignoreNextSelectionTouchEndRef.current = null;
    setDeleteMode(true);
    setSelectedIds([]);
    setShowDeleteConfirm(false);
    setSheetOpen(false);
    setFocusOpen(false);
    setIsSelectButtonPressed(false);
    resetTouchDragging();
  };

  const handleCancelDeleteMode = () => {
    ignoreNextSelectionTouchEndRef.current = null;
    setDeleteMode(false);
    setSelectedIds([]);
    setShowDeleteConfirm(false);
    setIsSelectButtonPressed(false);
    resetTouchDragging();
  };

  const handleToggleSelectAll = () => {
    if (!deleteMode) return;
    if (activeItemsForSelection.length === 0) return;

    setSelectedIds((prev) => {
      const nextSet = new Set(prev);

      if (allVisibleSelected) {
        activeItemsForSelection.forEach((item) => nextSet.delete(item.id));
      } else {
        activeItemsForSelection.forEach((item) => nextSet.add(item.id));
      }

      return Array.from(nextSet);
    });
  };

  const handleTabChange = (tab: TabType) => {
    if (tab === activeTab) return;

    const currentIndex = TAB_ORDER.indexOf(activeTab);
    const nextIndex = TAB_ORDER.indexOf(tab);
    const direction: SlideDirection = nextIndex > currentIndex ? 'right' : 'left';

    setSlideDirection(direction);
    ignoreNextSelectionTouchEndRef.current = null;
    setPrevTab(displayTab);
    setIncomingTab(tab);
    setIsAnimating(true);
    setActiveTab(tab);

    setSelectedIds([]);
    setShowDeleteConfirm(false);
    setDeleteMode(false);
    setSheetOpen(false);
    setFocusOpen(false);
    resetTouchDragging();
  };

  const handleDeleteConfirmOpen = () => {
    if (selectedIds.length === 0 || deleteLoading) return;
    setShowDeleteConfirm(true);
  };

  const handleDeleteConfirmClose = () => {
    if (deleteLoading) return;
    setShowDeleteConfirm(false);
  };

  const handleDeleteSelected = async () => {
    if (selectedIds.length === 0 || deleteLoading) return;

    setDeleteLoading(true);

    const results = await Promise.allSettled(
      selectedIds.map((postId) => setPostBookmark(postId, false)),
    );

    const failedMessages = results
      .filter((result): result is PromiseRejectedResult => result.status === 'rejected')
      .map((result) =>
        result.reason instanceof Error ? result.reason.message : '북마크 삭제에 실패했습니다.',
      );

    const authFailed = failedMessages.some((message) => isAuthError(message));

    if (authFailed) {
      setDeleteLoading(false);
      clearAuthTokens();
      navigate('/login', { replace: true });
      return;
    }

    const succeededIds = selectedIds.filter((_, index) => results[index]?.status === 'fulfilled');

    if (succeededIds.length > 0) {
      setItems((prev) => prev.filter((item) => !succeededIds.includes(item.postId)));
    }

    if (failedMessages.length > 0) {
      window.alert(failedMessages[0]);
    }

    setSelectedIds([]);
    setShowDeleteConfirm(false);
    setDeleteMode(false);
    resetTouchDragging();
    setDeleteLoading(false);
  };

  const toggleSelectedId = useCallback((id: number) => {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((itemId) => itemId !== id) : [...prev, id],
    );
  }, []);

  const startTouchDrag = (clientX: number, clientY: number, startItemId?: number) => {
    if (!deleteMode) return;

    const startPoint = getPointInContainer(clientX, clientY);

    touchStartRef.current = startPoint;
    touchCurrentRef.current = startPoint;
    initialSelectedIdsRef.current = [...selectedIds];
    touchDraggedRef.current = false;
    ignoreNextClickRef.current = false;

    const nextMode: TouchDragMode =
      startItemId && selectedIdSet.has(startItemId) ? 'deselect' : 'select';

    setTouchDragMode(nextMode);
    setIsTouchDragging(true);
  };

  const moveTouchDrag = (clientX: number, clientY: number) => {
    if (!deleteMode || !isTouchDragging) return;

    const currentPoint = getPointInContainer(clientX, clientY);
    touchCurrentRef.current = currentPoint;

    const start = touchStartRef.current;
    if (!start) return;

    const dx = Math.abs(currentPoint.x - start.x);
    const dy = Math.abs(currentPoint.y - start.y);

    if (dx > 4 || dy > 4) {
      touchDraggedRef.current = true;
    }

    applyTouchDragSelection();
  };

  const endTouchDrag = (tappedItemId?: number) => {
    if (!deleteMode) return;

    if (touchDraggedRef.current) {
      applyTouchDragSelection();
      ignoreNextClickRef.current = true;
    } else if (tappedItemId !== undefined) {
      toggleSelectedId(tappedItemId);
      ignoreNextClickRef.current = true;
    }

    resetTouchDragging();
  };

  const handleContentTouchStart = (e: React.TouchEvent<HTMLDivElement>) => {
    if (!deleteMode) return;

    const target = e.target as HTMLElement;
    if (target.closest('button')) return;

    const touch = e.touches[0];
    if (!touch) return;

    startTouchDrag(touch.clientX, touch.clientY);
  };

  const handleContentTouchMove = (e: React.TouchEvent<HTMLDivElement>) => {
    if (!deleteMode || !isTouchDragging) return;
    const touch = e.touches[0];
    if (!touch) return;

    moveTouchDrag(touch.clientX, touch.clientY);
  };

  const handleContentTouchEnd = () => {
    if (!deleteMode) return;
    endTouchDrag();
  };

  const handleCardTouchStart = (e: React.TouchEvent<HTMLButtonElement>, itemId: number) => {
    if (!deleteMode) return;
    const touch = e.touches[0];
    if (!touch) return;

    e.stopPropagation();
    startTouchDrag(touch.clientX, touch.clientY, itemId);
  };

  const handleCardTouchMove = (e: React.TouchEvent<HTMLButtonElement>) => {
    if (!deleteMode || !isTouchDragging) return;
    const touch = e.touches[0];
    if (!touch) return;

    e.stopPropagation();
    moveTouchDrag(touch.clientX, touch.clientY);
  };

  const handleCardTouchEnd = (e: React.TouchEvent<HTMLButtonElement>, itemId: number) => {
    if (!deleteMode) return;
    e.stopPropagation();

    if (ignoreNextSelectionTouchEndRef.current === itemId) {
      ignoreNextSelectionTouchEndRef.current = null;
      return;
    }

    endTouchDrag(itemId);
  };

  const handleCardClick = (item: BookmarkItem, sourceItems: BookmarkItem[]) => {
    if (ignoreNextCardClickRef.current) {
      ignoreNextCardClickRef.current = false;
      longPressTriggeredRef.current = false;
      return;
    }

    if (!deleteMode) {
      const nextIndex = sourceItems.findIndex((sourceItem) => sourceItem.id === item.id);

      setFocusItems(sourceItems);
      setFocusIndex(nextIndex >= 0 ? nextIndex : 0);
      setSheetOpen(true);
      setFocusOpen(true);
      return;
    }

    if (ignoreNextClickRef.current) {
      ignoreNextClickRef.current = false;
      return;
    }

    toggleSelectedId(item.id);
  };

  const renderOngoingFocusedSheetContent = () => {
    if (!focusedItem || focusedItem.status !== 'ongoing') return null;

    return (
      <EvaluationDetailFeedback
        embedded
        postIdOverride={focusedItem.postId}
        voteIdOverride={focusedItem.voteId}
        voteChoiceOverride={focusedItem.voteChoice}
        allowReadonlyDetail
      />
    );
  };

  const handleOpenDetailSheet = () => {
    if (!focusedItem) return;
    setSheetOpen(true);
  };

  return (
    <div
      ref={containerRef}
      className={`${styles.container} ${deleteMode ? styles.deleteMode : ''}`}
    >
      <Header
        title="북마크"
        leftAction="back"
        onBack={deleteMode ? handleCancelDeleteMode : () => navigate(-1)}
        rightAction="text"
        rightText={deleteMode ? '전체선택' : '선택'}
        onRightTextClick={() => {
          if (deleteMode) {
            handleToggleSelectAll();
            setIsSelectButtonPressed(false);
            return;
          }

          handleEnterDeleteMode();
        }}
        rightPressed={isSelectButtonPressed}
        onRightPressStart={() => setIsSelectButtonPressed(true)}
        onRightPressEnd={() => setIsSelectButtonPressed(false)}
        rightAriaLabel={deleteMode ? '전체선택' : '선택'}
        rightDisabled={loading}
      />

      <div className={styles.tabSection}>
        <div ref={tabRowRef} className={styles.tabRow}>
          <button type="button" className={styles.tabButton} onClick={() => handleTabChange('all')}>
            <span
              ref={allTextRef}
              className={`${styles.tabText} ${activeTab === 'all' ? styles.tabTextActive : ''}`}
            >
              전체
            </span>
          </button>

          <button
            type="button"
            className={styles.tabButton}
            onClick={() => handleTabChange('done')}
          >
            <span
              ref={doneTextRef}
              className={`${styles.tabText} ${activeTab === 'done' ? styles.tabTextActive : ''}`}
            >
              평가 완료
            </span>
          </button>

          <button
            type="button"
            className={styles.tabButton}
            onClick={() => handleTabChange('ongoing')}
          >
            <span
              ref={ongoingTextRef}
              className={`${styles.tabText} ${activeTab === 'ongoing' ? styles.tabTextActive : ''}`}
            >
              평가 중
            </span>
          </button>

          <span
            className={styles.tabIndicator}
            style={{
              width: `${indicatorStyle.width}px`,
              transform: `translateX(${indicatorStyle.left}px)`,
            }}
          />
        </div>
      </div>

      <main
        className={`${styles.contentArea} ${deleteMode ? styles.contentAreaDeleteMode : ''}`}
        style={{ touchAction: 'pan-y' }}
        onTouchStart={handleContentTouchStart}
        onTouchMove={handleContentTouchMove}
        onTouchEnd={handleContentTouchEnd}
      >
        <div className={styles.slideViewport}>
          {isAnimating && incomingTab ? (
            <>
              {renderGrid(
                previousItems,
                `prev-${prevTab}`,
                `${styles.animatedPane} ${styles.fadePane}`,
              )}
              {renderGrid(
                incomingItems,
                `next-${incomingTab}`,
                `${styles.animatedPane} ${nextPaneEnterClass()}`,
              )}
            </>
          ) : (
            renderGrid(displayedItems, `current-${displayTab}`, styles.staticPane)
          )}
        </div>
      </main>

      {deleteMode ? (
        <BookmarkSelectionActionBar
          countText={selectionCountText}
          canDelete={selectedIds.length > 0 && !deleteLoading}
          onDelete={handleDeleteConfirmOpen}
        />
      ) : null}

      {focusOpen && focusedItem ? (
        <FocusScreen
          isOpen={focusOpen}
          items={focusItems.map((item) => ({
            id: item.postId,
            imageUrl: item.imageUrl,
          }))}
          activeIndex={focusIndex}
          onActiveIndexChange={(nextIndex) => {
            setFocusIndex(nextIndex);
            setSheetOpen(false);
          }}
          closeButtonType="x"
          onClose={() => {
            setSheetOpen(false);
            setFocusOpen(false);
          }}
          sheetOpen={sheetOpen}
          onCloseSheet={() => setSheetOpen(false)}
          showVoteGraph={false}
          showDetailButton
          detailLabel="상세보기"
          onOpenDetail={handleOpenDetailSheet}
        >
          {focusedItem.status === 'ongoing' ? (
            <PostDetailBottomSheet isOpen={sheetOpen} onCloseRequest={() => setSheetOpen(false)}>
              {renderOngoingFocusedSheetContent()}
            </PostDetailBottomSheet>
          ) : (
            <PostDetailBottomSheet
              isOpen={sheetOpen}
              onCloseRequest={() => setSheetOpen(false)}
              postId={focusedItem.postId}
              period={focusedPeriod ?? undefined}
            />
          )}
        </FocusScreen>
      ) : null}

      {showDeleteConfirm && (
        <div className={styles.modalOverlay} onClick={handleDeleteConfirmClose}>
          <div
            className={styles.modalCard}
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
            aria-label="북마크 삭제 확인"
          >
            <p className={styles.modalTitle}>북마크에서 삭제할까요?</p>
            <p className={styles.modalDesc}>
              선택한 {selectedIds.length}개의 게시글이 북마크에서 삭제됩니다.
            </p>

            <div className={styles.modalActions}>
              <button
                type="button"
                className={styles.modalCancelButton}
                onClick={handleDeleteConfirmClose}
                disabled={deleteLoading}
              >
                취소
              </button>
              <button
                type="button"
                className={styles.modalDeleteButton}
                onClick={() => {
                  void handleDeleteSelected();
                }}
                disabled={deleteLoading}
              >
                삭제
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );

  function renderGrid(paneItems: BookmarkItem[], paneKey: string, extraClassName?: string) {
    return (
      <div className={`${styles.gridPane} ${extraClassName ?? ''}`} key={paneKey}>
        {loading ? (
          <div className={styles.emptyState}>불러오는 중...</div>
        ) : error ? (
          <div className={styles.emptyState}>{error}</div>
        ) : paneItems.length === 0 ? (
          <div className={styles.emptyState}>북마크한 게시글이 없습니다.</div>
        ) : (
          <div className={styles.cardGrid}>
            {paneItems.map((item) => {
              const isSelected = selectedIdSet.has(item.id);
              const isPressing = pressingCardId === item.id && !deleteMode;

              return (
                <button
                  key={item.id}
                  ref={(el) => {
                    cardRefs.current[item.id] = el;
                  }}
                  type="button"
                  className={`${styles.card} ${
                    deleteMode && isSelected ? styles.cardSelected : ''
                  }`}
                  style={{
                    transform: isPressing ? 'scale(0.96)' : 'scale(1)',
                    filter: isPressing ? 'brightness(0.9)' : 'brightness(1)',
                    transition: 'transform 140ms ease, filter 140ms ease, box-shadow 140ms ease',
                    touchAction: deleteMode ? 'pan-y' : 'manipulation',
                  }}
                  onTouchStart={(e) => {
                    if (deleteMode) {
                      handleCardTouchStart(e, item.id);
                      return;
                    }

                    const touch = e.touches[0];
                    if (!touch) return;

                    startCardLongPress(touch.clientX, touch.clientY, item.id);
                  }}
                  onTouchMove={(e) => {
                    if (deleteMode) {
                      handleCardTouchMove(e);
                      return;
                    }

                    const touch = e.touches[0];
                    if (!touch) return;

                    moveCardLongPress(touch.clientX, touch.clientY);
                  }}
                  onTouchEnd={(e) => {
                    if (deleteMode) {
                      handleCardTouchEnd(e, item.id);
                      return;
                    }

                    endCardLongPress();
                  }}
                  onTouchCancel={() => {
                    if (!deleteMode) {
                      endCardLongPress();
                    }
                  }}
                  onMouseDown={(e) => {
                    if (e.button !== 0 || deleteMode || focusOpen) return;
                    startCardLongPress(e.clientX, e.clientY, item.id);
                  }}
                  onMouseMove={(e) => {
                    if (deleteMode || focusOpen) return;
                    moveCardLongPress(e.clientX, e.clientY);
                  }}
                  onMouseUp={() => {
                    if (!deleteMode) {
                      endCardLongPress();
                    }
                  }}
                  onMouseLeave={() => {
                    if (!deleteMode) {
                      endCardLongPress();
                    }
                  }}
                  onContextMenu={(e) => {
                    e.preventDefault();
                  }}
                  onClick={() => handleCardClick(item, paneItems)}
                  aria-label={item.title}
                >
                  {item.imageUrl ? (
                    <img
                      src={item.imageUrl}
                      alt={item.title}
                      style={{
                        position: 'absolute',
                        inset: 0,
                        width: '100%',
                        height: '100%',
                        objectFit: 'cover',
                      }}
                    />
                  ) : (
                    <div className={styles.cardImageFallback}>이미지 없음</div>
                  )}

                  {deleteMode && (
                    <span
                      className={`${styles.selectionDot} ${
                        isSelected ? styles.selectionDotSelected : ''
                      }`}
                    >
                      {isSelected && <Check size={12} strokeWidth={3} />}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        )}
      </div>
    );
  }

  function getTabTitle() {
    return focusedItem?.status === 'ongoing'
      ? '평가 상세'
      : focusedPeriod
        ? formatPeriodLabel(focusedPeriod)
        : '북마크';
  }

  function nextPaneEnterClass() {
    return slideDirection === 'right' ? styles.enterFromRight : styles.enterFromLeft;
  }
}
