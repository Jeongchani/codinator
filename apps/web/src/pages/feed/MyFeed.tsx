import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { ChevronLeft, Check, Eye, EyeOff, Trash2 } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import type { GetMyFeedResponse } from '@codinator/contracts';
import {
  clearAuthTokens,
  fetcher,
  getAuthHeaders,
  isAuthError,
  resolveAssetUrl,
} from '../../lib/api';
import styles from './MyFeed.module.css';

type TabType = 'all' | 'ongoing' | 'done' | 'hidden';
type ActionType = 'delete' | 'hide' | 'unhide';
type SlideDirection = 'left' | 'right';
type TouchDragMode = 'select' | 'deselect';

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

type IndicatorStyle = {
  left: number;
  width: number;
};

type MyFeedItem = GetMyFeedResponse['items'][number];

const TAB_ORDER: TabType[] = ['all', 'ongoing', 'done', 'hidden'];
const LONG_PRESS_MS = 450;
const LONG_PRESS_MOVE_THRESHOLD = 8;

const isHiddenPost = (item: MyFeedItem) => item.postStatus === 'HIDDEN';

const getItemsByTab = (items: MyFeedItem[], tab: TabType) => {
  if (tab === 'hidden') {
    return items.filter(isHiddenPost);
  }

  const visibleItems = items.filter((item) => !isHiddenPost(item));

  if (tab === 'all') {
    return visibleItems;
  }

  if (tab === 'ongoing') {
    return visibleItems.filter((item) => item.evaluation?.status === 'OPEN');
  }

  return visibleItems.filter((item) => {
    const evaluationStatus = item.evaluation?.status;
    return evaluationStatus === 'ENDED' || evaluationStatus === 'CLOSED';
  });
};

const getEmptyMessageByTab = (tab: TabType) => {
  if (tab === 'hidden') {
    return '숨김된 피드가 없습니다.';
  }

  return '나의 피드가 없습니다.';
};

async function loadAllMyFeedItems(): Promise<MyFeedItem[]> {
  const headers = getAuthHeaders();
  const allItems: MyFeedItem[] = [];
  let cursor: number | null = null;
  let hasMore = true;
  let guard = 0;

  while (hasMore && guard < 30) {
    const query = cursor ? `?cursor=${cursor}` : '';
    const endpoint = `/users/me/feed${query}`;

    const data: GetMyFeedResponse = await fetcher(endpoint, {
      headers,
    });

    allItems.push(...(data.items ?? []));
    cursor = data.nextCursor ?? null;
    hasMore = Boolean(data.hasMore && cursor);
    guard += 1;
  }

  return allItems;
}

type SelectionGlassButtonProps = {
  icon: React.ReactNode;
  label: string;
  disabled?: boolean;
  onClick?: () => void;
};

function SelectionGlassButton({
  icon,
  label,
  disabled = false,
  onClick,
}: SelectionGlassButtonProps) {
  return (
    <button
      type="button"
      className={`${styles.selectionGlassButton} ${
        disabled ? styles.selectionGlassButtonDisabled : ''
      }`}
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
    >
      <span className={styles.selectionGlassButtonInner} />
      <span className={styles.selectionGlassButtonIcon}>{icon}</span>
    </button>
  );
}

function SelectionActionBar({
  countText,
  canHide,
  canUnhide,
  canDelete,
  onHide,
  onUnhide,
  onDelete,
}: {
  countText: string;
  canHide: boolean;
  canUnhide: boolean;
  canDelete: boolean;
  onHide: () => void;
  onUnhide: () => void;
  onDelete: () => void;
}) {
  return (
    <div className={styles.selectionActionBar}>
      <div className={styles.selectionActionBarLayer}>
        <div className={styles.selectionActionSurface}>
          <div className={styles.selectionActionRow}>
            <p className={styles.selectionCountText}>{countText}</p>

            <div className={styles.selectionActionButtons}>
              <SelectionGlassButton
                label="숨기기"
                disabled={!canHide}
                onClick={onHide}
                icon={<EyeOff className={styles.selectionActionIconSvg} strokeWidth={2.2} />}
              />
              <SelectionGlassButton
                label="숨기기 취소"
                disabled={!canUnhide}
                onClick={onUnhide}
                icon={<Eye className={styles.selectionActionIconSvg} strokeWidth={2.2} />}
              />
              <SelectionGlassButton
                label="삭제"
                disabled={!canDelete}
                onClick={onDelete}
                icon={<Trash2 className={styles.selectionActionIconSvg} strokeWidth={2.2} />}
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function MyFeed() {
  const navigate = useNavigate();

  const [items, setItems] = useState<MyFeedItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const [activeTab, setActiveTab] = useState<TabType>('all');
  const [displayTab, setDisplayTab] = useState<TabType>('all');
  const [prevTab, setPrevTab] = useState<TabType>('all');
  const [incomingTab, setIncomingTab] = useState<TabType | null>(null);
  const [isAnimating, setIsAnimating] = useState(false);
  const [slideDirection, setSlideDirection] = useState<SlideDirection>('right');

  const [isSelectionMode, setIsSelectionMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<number[]>([]);
  const [showActionConfirm, setShowActionConfirm] = useState(false);
  const [pendingAction, setPendingAction] = useState<ActionType | null>(null);
  const [actionSubmitting, setActionSubmitting] = useState(false);

  const [isTouchDragging, setIsTouchDragging] = useState(false);
  const [touchDragMode, setTouchDragMode] = useState<TouchDragMode>('select');
  const [pressingCardId, setPressingCardId] = useState<number | null>(null);
  const [isSelectButtonPressed, setIsSelectButtonPressed] = useState(false);

  const containerRef = useRef<HTMLDivElement | null>(null);
  const tabRowRef = useRef<HTMLDivElement | null>(null);
  const cardRefs = useRef<Record<number, HTMLButtonElement | null>>({});

  const allTextRef = useRef<HTMLSpanElement | null>(null);
  const ongoingTextRef = useRef<HTMLSpanElement | null>(null);
  const doneTextRef = useRef<HTMLSpanElement | null>(null);
  const hiddenTextRef = useRef<HTMLSpanElement | null>(null);

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
  }, [displayTab, items]);

  const previousItems = useMemo(() => {
    return getItemsByTab(items, prevTab);
  }, [items, prevTab]);

  const activeItemsForSelection = useMemo(() => {
    return getItemsByTab(items, activeTab);
  }, [activeTab, items]);

  const selectedIdSet = useMemo(() => new Set(selectedIds), [selectedIds]);
  const activeItemIdSet = useMemo(
    () => new Set(activeItemsForSelection.map((item) => item.postId)),
    [activeItemsForSelection],
  );
  const allVisibleSelected = useMemo(
    () =>
      activeItemsForSelection.length > 0 &&
      activeItemsForSelection.every((item) => selectedIdSet.has(item.postId)),
    [activeItemsForSelection, selectedIdSet],
  );
  const incomingItems = useMemo(
    () => (incomingTab ? getItemsByTab(items, incomingTab) : []),
    [incomingTab, items],
  );

  const canDelete = selectedIds.length > 0 && !actionSubmitting;
  const canHide = selectedIds.length > 0 && activeTab !== 'hidden' && !actionSubmitting;
  const canUnhide = selectedIds.length > 0 && activeTab === 'hidden' && !actionSubmitting;
  const selectionCountText = `${selectedIds.length.toLocaleString('ko-KR')}개 선택됨`;

  const moveToLogin = useCallback(() => {
    clearAuthTokens();
    navigate('/login', { replace: true });
  }, [navigate]);

  const refreshFeed = useCallback(async () => {
    try {
      setLoading(true);
      setError('');

      const loadedItems = await loadAllMyFeedItems();
      setItems(loadedItems);
    } catch (err) {
      const message = err instanceof Error ? err.message : '나의 피드를 불러오지 못했습니다.';

      if (isAuthError(message)) {
        moveToLogin();
        return;
      }

      setError(message);
    } finally {
      setLoading(false);
    }
  }, [moveToLogin]);

  useEffect(() => {
    void refreshFeed();
  }, [refreshFeed]);

  useEffect(() => {
    const footerElements = Array.from(
      document.querySelectorAll<HTMLElement>('[class*="footerWrap"], .footerWrap'),
    );

    footerElements.forEach((element) => {
      if (isSelectionMode) {
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
  }, [isSelectionMode]);

  const getTabTextRef = useCallback((tab: TabType) => {
    if (tab === 'all') return allTextRef.current;
    if (tab === 'ongoing') return ongoingTextRef.current;
    if (tab === 'done') return doneTextRef.current;
    return hiddenTextRef.current;
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
  }, [incomingTab, isAnimating]);

  useEffect(() => {
    setSelectedIds((prev) => prev.filter((id) => activeItemIdSet.has(id)));
  }, [activeItemIdSet]);

  const toggleSelectedId = useCallback((postId: number) => {
    setSelectedIds((prev) =>
      prev.includes(postId) ? prev.filter((itemId) => itemId !== postId) : [...prev, postId],
    );
  }, []);

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
        const el = cardRefs.current[item.postId];
        if (!el) return false;
        return isIntersecting(rect, el.getBoundingClientRect());
      })
      .map((item) => item.postId);

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

  const activateSelectionModeByLongPress = useCallback((postId: number) => {
    longPressTriggeredRef.current = true;
    ignoreNextCardClickRef.current = true;
    setPressingCardId(null);
    ignoreNextSelectionTouchEndRef.current = postId;
    setIsSelectionMode(true);
    setSelectedIds([postId]);
    setShowActionConfirm(false);
    setPendingAction(null);
  }, []);

  const startCardLongPress = useCallback(
    (clientX: number, clientY: number, postId: number) => {
      if (isSelectionMode) return;

      clearLongPress();
      longPressTriggeredRef.current = false;
      setPressingCardId(postId);

      longPressStartPointRef.current = getPointInContainer(clientX, clientY);

      longPressTimerRef.current = window.setTimeout(() => {
        activateSelectionModeByLongPress(postId);
        longPressTimerRef.current = null;
      }, LONG_PRESS_MS);
    },
    [activateSelectionModeByLongPress, clearLongPress, getPointInContainer, isSelectionMode],
  );

  const moveCardLongPress = useCallback(
    (clientX: number, clientY: number) => {
      if (isSelectionMode || longPressTriggeredRef.current) return;

      const start = longPressStartPointRef.current;
      if (!start || !longPressTimerRef.current) return;

      const current = getPointInContainer(clientX, clientY);
      const dx = Math.abs(current.x - start.x);
      const dy = Math.abs(current.y - start.y);

      if (dx > LONG_PRESS_MOVE_THRESHOLD || dy > LONG_PRESS_MOVE_THRESHOLD) {
        clearLongPress();
      }
    },
    [clearLongPress, getPointInContainer, isSelectionMode],
  );

  const endCardLongPress = useCallback(() => {
    clearLongPress();
  }, [clearLongPress]);

  const exitSelectionMode = () => {
    ignoreNextSelectionTouchEndRef.current = null;
    setIsSelectionMode(false);
    setSelectedIds([]);
    setShowActionConfirm(false);
    setPendingAction(null);
    resetTouchDragging();
  };

  const handleToggleSelectAll = () => {
    if (!isSelectionMode) return;
    if (activeItemsForSelection.length === 0) return;

    setSelectedIds((prev) => {
      const nextSet = new Set(prev);

      if (allVisibleSelected) {
        activeItemsForSelection.forEach((item) => nextSet.delete(item.postId));
      } else {
        activeItemsForSelection.forEach((item) => nextSet.add(item.postId));
      }

      return Array.from(nextSet);
    });
  };

  const changeTab = useCallback(
    (tab: TabType) => {
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
      setShowActionConfirm(false);
      setPendingAction(null);
      resetTouchDragging();
    },
    [activeTab, displayTab, resetTouchDragging],
  );

  const handleTabChange = (tab: TabType) => {
    changeTab(tab);
  };

  const handleActionConfirmOpen = (action: ActionType) => {
    if (selectedIds.length === 0 || actionSubmitting) return;
    setPendingAction(action);
    setShowActionConfirm(true);
  };

  const handleActionConfirmClose = () => {
    if (actionSubmitting) return;
    setShowActionConfirm(false);
    setPendingAction(null);
  };

  const handleApplyAction = async () => {
    if (selectedIds.length === 0 || actionSubmitting || !pendingAction) return;

    setActionSubmitting(true);

    try {
      const headers = getAuthHeaders();
      const results = await Promise.allSettled(
        selectedIds.map((postId) => {
          if (pendingAction === 'delete') {
            return fetcher(`/posts/${postId}`, {
              method: 'DELETE',
              headers,
            });
          }

          if (pendingAction === 'hide') {
            return fetcher(`/posts/${postId}/hide`, {
              method: 'PATCH',
              headers,
            });
          }

          return fetcher(`/posts/${postId}/unhide`, {
            method: 'PATCH',
            headers,
          });
        }),
      );

      const failed = results.find(
        (result): result is PromiseRejectedResult => result.status === 'rejected',
      );

      if (failed) {
        const message =
          failed.reason instanceof Error
            ? failed.reason.message
            : pendingAction === 'delete'
              ? '게시글 삭제에 실패했습니다.'
              : pendingAction === 'hide'
                ? '게시글 숨기기에 실패했습니다.'
                : '게시글 숨기기 취소에 실패했습니다.';

        if (isAuthError(message)) {
          moveToLogin();
          return;
        }

        window.alert(message);
      }

      await refreshFeed();
      exitSelectionMode();
    } finally {
      setActionSubmitting(false);
    }
  };

  const startTouchDrag = (clientX: number, clientY: number, startItemId?: number) => {
    if (!isSelectionMode) return;

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
    if (!isSelectionMode || !isTouchDragging) return;

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
    if (!isSelectionMode) return;

    if (touchDraggedRef.current) {
      applyTouchDragSelection();
      ignoreNextClickRef.current = true;
    } else if (tappedItemId !== undefined) {
      toggleSelectedId(tappedItemId);
      ignoreNextClickRef.current = true;
    }

    resetTouchDragging();
  };

  const handleContentTouchStart = () => {
    return;
  };

  const handleContentTouchMove = () => {
    return;
  };

  const handleContentTouchEnd = () => {
    return;
  };

  const handleCardTouchStart = (e: React.TouchEvent<HTMLButtonElement>, itemId: number) => {
    if (!isSelectionMode) return;
    const touch = e.touches[0];
    if (!touch) return;

    e.stopPropagation();
    startTouchDrag(touch.clientX, touch.clientY, itemId);
  };

  const handleCardTouchMove = (e: React.TouchEvent<HTMLButtonElement>) => {
    if (!isSelectionMode || !isTouchDragging) return;
    const touch = e.touches[0];
    if (!touch) return;

    e.stopPropagation();
    moveTouchDrag(touch.clientX, touch.clientY);
  };

  const handleCardTouchEnd = (e: React.TouchEvent<HTMLButtonElement>, itemId: number) => {
    if (!isSelectionMode) return;
    e.stopPropagation();

    if (ignoreNextSelectionTouchEndRef.current === itemId) {
      ignoreNextSelectionTouchEndRef.current = null;
      return;
    }

    endTouchDrag(itemId);
  };

  const handleCardClick = (item: MyFeedItem) => {
    if (ignoreNextCardClickRef.current) {
      ignoreNextCardClickRef.current = false;
      longPressTriggeredRef.current = false;
      return;
    }

    if (isSelectionMode) {
      if (ignoreNextClickRef.current) {
        ignoreNextClickRef.current = false;
        return;
      }

      toggleSelectedId(item.postId);
      return;
    }

    navigate(`/myPostDetailEdit/${item.postId}`, {
      state: {
        post: {
          id: item.postId,
          postId: item.postId,
          imageUrl: resolveAssetUrl(item.thumbnailUrl),
          createdAt: item.createdAt,
          content: item.content ?? '',
          nickname: '나의 피드',
        },
      },
    });
  };

  const renderGrid = (
    gridItems: MyFeedItem[],
    paneKey: string,
    tab: TabType,
    extraClassName?: string,
  ) => {
    return (
      <div className={`${styles.gridPane} ${extraClassName ?? ''}`} key={paneKey}>
        {loading && gridItems.length === 0 ? (
          <div className={styles.emptyState}>불러오는 중...</div>
        ) : error ? (
          <div className={styles.emptyState}>{error}</div>
        ) : gridItems.length === 0 ? (
          <div className={styles.emptyState}>{getEmptyMessageByTab(tab)}</div>
        ) : (
          <div className={styles.cardGrid}>
            {gridItems.map((item) => {
              const isSelected = selectedIdSet.has(item.postId);
              const imageUrl = resolveAssetUrl(item.thumbnailUrl);
              const isPressing = pressingCardId === item.postId && !isSelectionMode;

              return (
                <button
                  key={item.postId}
                  ref={(el) => {
                    cardRefs.current[item.postId] = el;
                  }}
                  type="button"
                  className={`${styles.card} ${
                    isSelectionMode && isSelected ? styles.cardSelected : ''
                  }`}
                  style={{
                    transform: isPressing ? 'scale(0.96)' : 'scale(1)',
                    filter: isPressing ? 'brightness(0.9)' : 'brightness(1)',
                    transition: 'transform 140ms ease, filter 140ms ease, box-shadow 140ms ease',
                    touchAction: isSelectionMode ? 'pan-y' : 'manipulation',
                  }}
                  onTouchStart={(e) => {
                    if (isSelectionMode) {
                      return;
                    }

                    const touch = e.touches[0];
                    if (!touch) return;

                    startCardLongPress(touch.clientX, touch.clientY, item.postId);
                  }}
                  onTouchMove={(e) => {
                    if (isSelectionMode) {
                      return;
                    }

                    const touch = e.touches[0];
                    if (!touch) return;

                    moveCardLongPress(touch.clientX, touch.clientY);
                  }}
                  onTouchEnd={() => {
                    if (isSelectionMode) {
                      return;
                    }

                    endCardLongPress();
                  }}
                  onTouchCancel={() => {
                    if (!isSelectionMode) {
                      endCardLongPress();
                    }
                  }}
                  onMouseDown={(e) => {
                    if (e.button !== 0 || isSelectionMode) return;
                    startCardLongPress(e.clientX, e.clientY, item.postId);
                  }}
                  onMouseMove={(e) => {
                    if (isSelectionMode) return;
                    moveCardLongPress(e.clientX, e.clientY);
                  }}
                  onMouseUp={() => {
                    if (!isSelectionMode) {
                      endCardLongPress();
                    }
                  }}
                  onMouseLeave={() => {
                    if (!isSelectionMode) {
                      endCardLongPress();
                    }
                  }}
                  onContextMenu={(e) => {
                    e.preventDefault();
                  }}
                  onClick={() => handleCardClick(item)}
                  aria-label={item.content ?? `나의 피드 ${item.postId}`}
                >
                  {imageUrl ? (
                    <img
                      src={imageUrl}
                      alt={`my-feed-${item.postId}`}
                      style={{
                        position: 'absolute',
                        inset: 0,
                        width: '100%',
                        height: '100%',
                        objectFit: 'cover',
                      }}
                    />
                  ) : (
                    <div
                      style={{
                        position: 'absolute',
                        inset: 0,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        color: '#999999',
                        fontSize: '12px',
                        background: '#f3f3f3',
                      }}
                    >
                      이미지 없음
                    </div>
                  )}

                  {isSelectionMode && (
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
  };

  const nextPaneEnterClass =
    slideDirection === 'right' ? styles.enterFromRight : styles.enterFromLeft;

  const confirmTitle =
    pendingAction === 'delete'
      ? '선택한 피드를 삭제할까요?'
      : pendingAction === 'hide'
        ? '선택한 피드를 숨길까요?'
        : '선택한 피드의 숨김을 취소할까요?';

  const confirmDesc =
    pendingAction === 'delete'
      ? `선택한 ${selectedIds.length}개의 게시글이 삭제됩니다.`
      : pendingAction === 'hide'
        ? `선택한 ${selectedIds.length}개의 게시글이 숨김 처리됩니다.`
        : `선택한 ${selectedIds.length}개의 게시글이 다시 보이게 됩니다.`;

  const confirmActionLabel = actionSubmitting
    ? pendingAction === 'delete'
      ? '삭제 중...'
      : pendingAction === 'hide'
        ? '숨기는 중...'
        : '취소 중...'
    : pendingAction === 'delete'
      ? '삭제'
      : pendingAction === 'hide'
        ? '숨기기'
        : '숨기기 취소';

  return (
    <div
      ref={containerRef}
      className={`${styles.container} ${isSelectionMode ? styles.selectionMode : ''}`}
    >
      <header className={styles.header}>
        <div className={styles.headerInner}>
          <button
            type="button"
            className={styles.headerIconButton}
            onClick={isSelectionMode ? exitSelectionMode : () => navigate(-1)}
            aria-label="뒤로가기"
          >
            <ChevronLeft size={24} strokeWidth={2.2} />
          </button>

          <h1 className={styles.title}>나의 피드</h1>

          <button
            type="button"
            className={`${styles.headerTextButton} ${
              isSelectButtonPressed ? styles.headerTextButtonPressed : ''
            }`}
            onClick={() => {
              if (isSelectionMode) {
                handleToggleSelectAll();
                setIsSelectButtonPressed(false);
                return;
              }

              ignoreNextSelectionTouchEndRef.current = null;
              setIsSelectionMode(true);
              setSelectedIds([]);
              setShowActionConfirm(false);
              setPendingAction(null);
              setIsSelectButtonPressed(false);
            }}
            onTouchStart={() => setIsSelectButtonPressed(true)}
            onTouchEnd={() => setIsSelectButtonPressed(false)}
            onTouchCancel={() => setIsSelectButtonPressed(false)}
            onMouseDown={() => setIsSelectButtonPressed(true)}
            onMouseUp={() => setIsSelectButtonPressed(false)}
            onMouseLeave={() => setIsSelectButtonPressed(false)}
            aria-label={isSelectionMode ? '전체선택' : '선택'}
          >
            {isSelectionMode ? '전체선택' : '선택'}
          </button>
        </div>
      </header>

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

          <button
            type="button"
            className={styles.tabButton}
            onClick={() => handleTabChange('hidden')}
          >
            <span
              ref={hiddenTextRef}
              className={`${styles.tabText} ${activeTab === 'hidden' ? styles.tabTextActive : ''}`}
            >
              숨김
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
        className={`${styles.contentArea} ${
          isSelectionMode ? styles.contentAreaSelectionMode : ''
        }`}
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
                prevTab,
                `${styles.animatedPane} ${styles.fadePane}`,
              )}
              {renderGrid(
                incomingItems,
                `next-${incomingTab}`,
                incomingTab,
                `${styles.animatedPane} ${nextPaneEnterClass}`,
              )}
            </>
          ) : (
            renderGrid(displayedItems, `current-${displayTab}`, displayTab, styles.staticPane)
          )}
        </div>
      </main>

      {isSelectionMode ? (
        <SelectionActionBar
          countText={selectionCountText}
          canHide={canHide}
          canUnhide={canUnhide}
          canDelete={canDelete}
          onHide={() => handleActionConfirmOpen('hide')}
          onUnhide={() => handleActionConfirmOpen('unhide')}
          onDelete={() => handleActionConfirmOpen('delete')}
        />
      ) : null}

      {showActionConfirm && pendingAction && (
        <div className={styles.modalOverlay} onClick={handleActionConfirmClose}>
          <div
            className={styles.modalCard}
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
            aria-label={
              pendingAction === 'delete'
                ? '나의 피드 삭제 확인'
                : pendingAction === 'hide'
                  ? '나의 피드 숨기기 확인'
                  : '나의 피드 숨기기 취소 확인'
            }
          >
            <p className={styles.modalTitle}>{confirmTitle}</p>
            <p className={styles.modalDesc}>{confirmDesc}</p>

            <div className={styles.modalActions}>
              <button
                type="button"
                className={styles.modalCancelButton}
                onClick={handleActionConfirmClose}
                disabled={actionSubmitting}
              >
                취소
              </button>
              <button
                type="button"
                className={`${styles.modalActionButton} ${
                  pendingAction === 'delete' ? styles.modalDeleteButton : ''
                }`}
                onClick={handleApplyAction}
                disabled={actionSubmitting}
              >
                {confirmActionLabel}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
