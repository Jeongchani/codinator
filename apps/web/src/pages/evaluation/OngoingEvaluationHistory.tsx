import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import type { EvaluationHistoryItem } from '@codinator/contracts';
import { Check, ChevronLeft, ChevronsUp, ThumbsDown, ThumbsUp, Trash2 } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import evaluationHistoryBanner from '../../assets/evaluation/평가기록 배너.png';
import {
  clearAuthTokens,
  fetchAllMyEvaluationHistory,
  isAuthError,
  resolveAssetUrl,
} from '../../lib/api';
import PostDetailBottomSheet from '../../components/postdetail/PostDetailBottomSheet';
import EvaluationDetailFeedback from './EvaluationDetailFeedback';
import styles from './OngoingEvaluationHistory.module.css';

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

type HistoryCardItem = EvaluationHistoryItem & {
  imageUrl: string;
  groupLabel: string;
  sortTimestamp: number;
};

type HistoryGroup = {
  label: string;
  items: HistoryCardItem[];
};

type SelectionActionBarProps = {
  countText: string;
  canDelete: boolean;
  onDelete: () => void;
};

const DAY_IN_MS = 1000 * 60 * 60 * 24;
const WEEKDAY_LABELS = ['일요일', '월요일', '화요일', '수요일', '목요일', '금요일', '토요일'];
const LONG_PRESS_MS = 450;
const LONG_PRESS_MOVE_THRESHOLD = 8;

function SelectionActionBar({ countText, canDelete, onDelete }: SelectionActionBarProps) {
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

function getStartOfDay(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function formatChoiceLabel(choice: EvaluationHistoryItem['myChoice']) {
  return choice === 'LIKE' ? '좋아요' : '싫어요';
}

function formatChoiceClassName(choice: EvaluationHistoryItem['myChoice']) {
  return choice === 'LIKE' ? styles.choiceBadgeLike : styles.choiceBadgeDislike;
}

function getGroupLabel(isoString: string) {
  const votedAt = new Date(isoString);

  if (Number.isNaN(votedAt.getTime())) {
    return '기타';
  }

  const today = getStartOfDay(new Date());
  const targetDay = getStartOfDay(votedAt);
  const diffDays = Math.round((today.getTime() - targetDay.getTime()) / DAY_IN_MS);

  if (diffDays === 0) return '오늘';
  if (diffDays === 1) return '어제';
  if (diffDays >= 2 && diffDays <= 7) return `${diffDays}일 전`;

  return WEEKDAY_LABELS[votedAt.getDay()] ?? '기타';
}

function getFallbackVoteSummary(choice: EvaluationHistoryItem['myChoice']) {
  if (choice === 'LIKE') {
    return { likePercent: 100, dislikePercent: 0 };
  }

  return { likePercent: 0, dislikePercent: 100 };
}

export default function OngoingEvaluationHistory() {
  const navigate = useNavigate();
  const [items, setItems] = useState<EvaluationHistoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [deleteMode, setDeleteMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<number[]>([]);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [isTouchDragging, setIsTouchDragging] = useState(false);
  const [touchDragMode, setTouchDragMode] = useState<TouchDragMode>('select');
  const [pressingCardId, setPressingCardId] = useState<number | null>(null);
  const [isHeaderButtonPressed, setIsHeaderButtonPressed] = useState(false);
  const [focusedPostId, setFocusedPostId] = useState<number | null>(null);
  const [detailSheetOpen, setDetailSheetOpen] = useState(false);

  const containerRef = useRef<HTMLDivElement | null>(null);
  const sheetContentRef = useRef<HTMLDivElement | null>(null);
  const cardRefs = useRef<Record<number, HTMLButtonElement | null>>({});
  const touchStartRef = useRef<Point | null>(null);
  const touchCurrentRef = useRef<Point | null>(null);
  const initialSelectedIdsRef = useRef<number[]>([]);
  const touchDraggedRef = useRef(false);
  const ignoreNextClickRef = useRef(false);
  const longPressTimerRef = useRef<number | null>(null);
  const longPressStartPointRef = useRef<Point | null>(null);
  const longPressTriggeredRef = useRef(false);
  const ignoreNextCardClickRef = useRef(false);
  const ignoreNextSelectionTouchEndRef = useRef<number | null>(null);

  const moveToLogin = useCallback(() => {
    clearAuthTokens();
    navigate('/login', { replace: true });
  }, [navigate]);

  const loadHistory = useCallback(
    async (showInitialLoading = false) => {
      if (showInitialLoading) {
        setLoading(true);
      }

      setError('');

      try {
        const loadedItems = await fetchAllMyEvaluationHistory();
        setItems(loadedItems);
      } catch (err) {
        const message =
          err instanceof Error ? err.message : '진행중인 평가 기록을 불러오지 못했습니다.';

        if (isAuthError(message)) {
          moveToLogin();
          return;
        }

        setError(message);
      } finally {
        if (showInitialLoading) {
          setLoading(false);
        }
      }
    },
    [moveToLogin],
  );

  useEffect(() => {
    void loadHistory(true);
  }, [loadHistory]);

  const groupedItems = useMemo<HistoryGroup[]>(() => {
    const normalizedItems: HistoryCardItem[] = items
      .map((item) => {
        const sortTimestamp = new Date(item.votedAt).getTime();

        return {
          ...item,
          imageUrl: resolveAssetUrl(item.thumbnailUrl),
          groupLabel: getGroupLabel(item.votedAt),
          sortTimestamp: Number.isNaN(sortTimestamp) ? 0 : sortTimestamp,
        };
      })
      .sort((a, b) => b.sortTimestamp - a.sortTimestamp);

    const groups: HistoryGroup[] = [];

    normalizedItems.forEach((item) => {
      const lastGroup = groups[groups.length - 1];

      if (!lastGroup || lastGroup.label !== item.groupLabel) {
        groups.push({ label: item.groupLabel, items: [item] });
        return;
      }

      lastGroup.items.push(item);
    });

    return groups;
  }, [items]);

  const flatItems = useMemo(() => groupedItems.flatMap((group) => group.items), [groupedItems]);
  const focusedItem = useMemo(() => {
    if (focusedPostId === null) return null;
    return flatItems.find((item) => item.postId === focusedPostId) ?? null;
  }, [flatItems, focusedPostId]);
  const selectedIdSet = useMemo(() => new Set(selectedIds), [selectedIds]);

  const allVisibleSelected = useMemo(
    () => flatItems.length > 0 && flatItems.every((item) => selectedIdSet.has(item.postId)),
    [flatItems, selectedIdSet],
  );

  const selectionCountText = `${selectedIds.length.toLocaleString('ko-KR')}개 선택됨`;

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
    const touchedIds = flatItems
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
  }, [flatItems, getSelectionRect, isIntersecting, touchDragMode]);

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

  useEffect(() => {
    if (!detailSheetOpen) return;

    const handleDocumentPointerDown = (event: PointerEvent) => {
      const target = event.target;
      if (!(target instanceof Node)) return;

      const targetElement = target instanceof HTMLElement ? target : null;
      const classText = String(targetElement?.className ?? '');

      if (
        classText.includes('handlerArea') ||
        classText.includes('handlerBar') ||
        classText.includes('bottomSheet') ||
        classText.includes('sheetScrollArea')
      ) {
        return;
      }

      if (sheetContentRef.current?.contains(target)) {
        return;
      }

      setDetailSheetOpen(false);
    };

    document.addEventListener('pointerdown', handleDocumentPointerDown, true);

    return () => {
      document.removeEventListener('pointerdown', handleDocumentPointerDown, true);
    };
  }, [detailSheetOpen]);

  useEffect(() => {
    if (!deleteMode) return;
    setFocusedPostId(null);
    setDetailSheetOpen(false);
  }, [deleteMode]);

  const activateDeleteModeByLongPress = useCallback((postId: number) => {
    longPressTriggeredRef.current = true;
    ignoreNextCardClickRef.current = true;
    setPressingCardId(null);
    ignoreNextSelectionTouchEndRef.current = postId;
    setDeleteMode(true);
    setSelectedIds([postId]);
    setShowDeleteConfirm(false);
  }, []);

  const startCardLongPress = useCallback(
    (clientX: number, clientY: number, postId: number) => {
      if (deleteMode) return;

      clearLongPress();
      longPressTriggeredRef.current = false;
      setPressingCardId(postId);
      longPressStartPointRef.current = getPointInContainer(clientX, clientY);

      longPressTimerRef.current = window.setTimeout(() => {
        activateDeleteModeByLongPress(postId);
        longPressTimerRef.current = null;
      }, LONG_PRESS_MS);
    },
    [activateDeleteModeByLongPress, clearLongPress, deleteMode, getPointInContainer],
  );

  const moveCardLongPress = useCallback(
    (clientX: number, clientY: number) => {
      if (deleteMode || longPressTriggeredRef.current) return;

      const start = longPressStartPointRef.current;
      if (!start || !longPressTimerRef.current) return;

      const current = getPointInContainer(clientX, clientY);
      const dx = Math.abs(current.x - start.x);
      const dy = Math.abs(current.y - start.y);

      if (dx > LONG_PRESS_MOVE_THRESHOLD || dy > LONG_PRESS_MOVE_THRESHOLD) {
        clearLongPress();
      }
    },
    [clearLongPress, deleteMode, getPointInContainer],
  );

  const endCardLongPress = useCallback(() => {
    clearLongPress();
  }, [clearLongPress]);

  const handleEnterDeleteMode = () => {
    ignoreNextSelectionTouchEndRef.current = null;
    setDeleteMode(true);
    setSelectedIds([]);
    setShowDeleteConfirm(false);
    resetTouchDragging();
  };

  const handleCancelDeleteMode = () => {
    ignoreNextSelectionTouchEndRef.current = null;
    setDeleteMode(false);
    setSelectedIds([]);
    setShowDeleteConfirm(false);
    resetTouchDragging();
  };

  const handleToggleSelectAll = () => {
    if (!deleteMode || flatItems.length === 0) return;

    setSelectedIds((prev) => {
      const nextSet = new Set(prev);

      if (allVisibleSelected) {
        flatItems.forEach((item) => nextSet.delete(item.postId));
      } else {
        flatItems.forEach((item) => nextSet.add(item.postId));
      }

      return Array.from(nextSet);
    });
  };

  const handleDeleteConfirmOpen = () => {
    if (selectedIds.length === 0) return;
    setShowDeleteConfirm(true);
  };

  const handleDeleteConfirmClose = () => {
    setShowDeleteConfirm(false);
  };

  const handleDeleteSelected = () => {
    if (selectedIds.length === 0) return;

    setItems((prev) => prev.filter((item) => !selectedIds.includes(item.postId)));
    setSelectedIds([]);
    setDeleteMode(false);
    setShowDeleteConfirm(false);
    resetTouchDragging();
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

  const handleCardTouchStart = (e: React.TouchEvent<HTMLButtonElement>, postId: number) => {
    const touch = e.touches[0];
    if (!touch) return;

    if (deleteMode) {
      e.stopPropagation();
      startTouchDrag(touch.clientX, touch.clientY, postId);
      return;
    }

    startCardLongPress(touch.clientX, touch.clientY, postId);
  };

  const handleCardTouchMove = (e: React.TouchEvent<HTMLButtonElement>) => {
    const touch = e.touches[0];
    if (!touch) return;

    if (deleteMode) {
      if (!isTouchDragging) return;
      e.stopPropagation();
      moveTouchDrag(touch.clientX, touch.clientY);
      return;
    }

    moveCardLongPress(touch.clientX, touch.clientY);
  };

  const handleCardTouchEnd = (e: React.TouchEvent<HTMLButtonElement>, postId: number) => {
    if (deleteMode) {
      e.stopPropagation();

      if (ignoreNextSelectionTouchEndRef.current === postId) {
        ignoreNextSelectionTouchEndRef.current = null;
        return;
      }

      endTouchDrag(postId);
      return;
    }

    endCardLongPress();
  };

  const handleCardClick = (item: HistoryCardItem) => {
    if (ignoreNextCardClickRef.current) {
      ignoreNextCardClickRef.current = false;
      longPressTriggeredRef.current = false;
      return;
    }

    if (!deleteMode) {
      setFocusedPostId(item.postId);
      setDetailSheetOpen(false);
      return;
    }

    if (ignoreNextClickRef.current) {
      ignoreNextClickRef.current = false;
      return;
    }

    toggleSelectedId(item.postId);
  };

  const focusedVoteSummary = useMemo(() => {
    if (!focusedItem) return { likePercent: 0, dislikePercent: 0 };
    return getFallbackVoteSummary(focusedItem.myChoice);
  }, [focusedItem]);

  return (
    <div
      ref={containerRef}
      className={`${styles.container} ${deleteMode ? styles.deleteMode : ''}`}
    >
      <header className={styles.header}>
        <div className={styles.headerInner}>
          <button
            type="button"
            className={styles.headerIconButton}
            onClick={deleteMode ? handleCancelDeleteMode : () => navigate(-1)}
            aria-label="뒤로가기"
          >
            <ChevronLeft size={24} strokeWidth={2.2} />
          </button>

          <h1 className={styles.title}>평가 기록</h1>

          <button
            type="button"
            className={`${styles.headerTextButton} ${
              isHeaderButtonPressed ? styles.headerTextButtonPressed : ''
            }`}
            onClick={deleteMode ? handleToggleSelectAll : handleEnterDeleteMode}
            onTouchStart={() => setIsHeaderButtonPressed(true)}
            onTouchEnd={() => setIsHeaderButtonPressed(false)}
            onTouchCancel={() => setIsHeaderButtonPressed(false)}
            onMouseDown={() => setIsHeaderButtonPressed(true)}
            onMouseUp={() => setIsHeaderButtonPressed(false)}
            onMouseLeave={() => setIsHeaderButtonPressed(false)}
            disabled={loading}
            aria-label={deleteMode ? '전체선택' : '선택'}
          >
            {deleteMode ? '전체선택' : '선택'}
          </button>
        </div>
      </header>

      <section className={styles.banner} aria-label="평가기록 배너">
        <img
          src={evaluationHistoryBanner}
          alt="내가 평가한 게시물 목록 배너"
          className={styles.bannerImage}
          draggable={false}
        />
      </section>

      <main
        className={`${styles.contentArea} ${deleteMode ? styles.contentAreaDeleteMode : ''}`}
        onTouchStart={handleContentTouchStart}
        onTouchMove={handleContentTouchMove}
        onTouchEnd={handleContentTouchEnd}
      >
        {loading ? (
          <div className={styles.stateBox}>
            <p className={styles.stateTitle}>진행중인 평가 기록을 불러오는 중이에요.</p>
          </div>
        ) : error ? (
          <div className={styles.stateBox}>
            <p className={styles.stateTitle}>진행중인 평가 기록을 불러오지 못했어요.</p>
            <p className={styles.stateDescription}>{error}</p>
            <button
              type="button"
              className={styles.retryButton}
              onClick={() => void loadHistory(true)}
            >
              다시 시도
            </button>
          </div>
        ) : groupedItems.length === 0 ? (
          <div className={styles.emptyState}>진행중인 평가 기록이 없습니다.</div>
        ) : (
          <div className={styles.groupList}>
            {groupedItems.map((group) => (
              <section key={group.label} className={styles.groupSection} aria-label={group.label}>
                <h2 className={styles.groupTitle}>{group.label}</h2>

                <div className={styles.cardGrid}>
                  {group.items.map((item) => {
                    const isSelected = selectedIdSet.has(item.postId);
                    const isPressing = pressingCardId === item.postId && !deleteMode;
                    const ChoiceIcon = item.myChoice === 'LIKE' ? ThumbsUp : ThumbsDown;

                    return (
                      <button
                        key={item.myVoteId ?? `${item.postId}-${item.votedAt}`}
                        ref={(el) => {
                          cardRefs.current[item.postId] = el;
                        }}
                        type="button"
                        className={`${styles.card} ${deleteMode && isSelected ? styles.cardSelected : ''}`}
                        style={{
                          transform: isPressing ? 'scale(0.96)' : 'scale(1)',
                          filter: isPressing ? 'brightness(0.9)' : 'brightness(1)',
                          transition:
                            'transform 140ms ease, filter 140ms ease, box-shadow 140ms ease',
                          touchAction: 'pan-y',
                        }}
                        onTouchStart={(e) => handleCardTouchStart(e, item.postId)}
                        onTouchMove={handleCardTouchMove}
                        onTouchEnd={(e) => handleCardTouchEnd(e, item.postId)}
                        onTouchCancel={() => {
                          if (!deleteMode) {
                            endCardLongPress();
                          }
                        }}
                        onMouseDown={(e) => {
                          if (e.button !== 0 || deleteMode) return;
                          startCardLongPress(e.clientX, e.clientY, item.postId);
                        }}
                        onMouseMove={(e) => {
                          if (deleteMode) return;
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
                        onClick={() => handleCardClick(item)}
                        aria-label={`${group.label} ${formatChoiceLabel(item.myChoice)} 평가 상세 보기`}
                      >
                        {item.imageUrl ? (
                          <img
                            src={item.imageUrl}
                            alt="평가 기록 이미지"
                            className={styles.cardImage}
                            draggable={false}
                          />
                        ) : (
                          <div className={styles.cardImageFallback}>이미지 없음</div>
                        )}

                        {!deleteMode ? (
                          <div className={styles.cardTopRow}>
                            <span
                              className={`${styles.choiceBadge} ${formatChoiceClassName(item.myChoice)}`}
                              aria-label={formatChoiceLabel(item.myChoice)}
                              title={formatChoiceLabel(item.myChoice)}
                            >
                              <ChoiceIcon className={styles.choiceBadgeIcon} strokeWidth={2.3} />
                            </span>
                          </div>
                        ) : null}

                        <div className={styles.cardGradient} />

                        {deleteMode ? (
                          <span
                            className={`${styles.selectionDot} ${
                              isSelected ? styles.selectionDotSelected : ''
                            }`}
                          >
                            {isSelected && <Check size={12} strokeWidth={3} />}
                          </span>
                        ) : null}
                      </button>
                    );
                  })}
                </div>
              </section>
            ))}
          </div>
        )}
      </main>

      {deleteMode ? (
        <SelectionActionBar
          countText={selectionCountText}
          canDelete={selectedIds.length > 0}
          onDelete={handleDeleteConfirmOpen}
        />
      ) : null}

      {showDeleteConfirm ? (
        <div className={styles.modalOverlay} onClick={handleDeleteConfirmClose}>
          <div
            className={styles.modalCard}
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
            aria-label="평가기록 삭제 확인"
          >
            <p className={styles.modalTitle}>선택한 기록을 삭제할까요?</p>
            <p className={styles.modalDesc}>
              선택한 {selectedIds.length}개의 평가 기록이 삭제됩니다.
            </p>

            <div className={styles.modalActions}>
              <button
                type="button"
                className={styles.modalCancelButton}
                onClick={handleDeleteConfirmClose}
              >
                취소
              </button>
              <button
                type="button"
                className={styles.modalDeleteButton}
                onClick={handleDeleteSelected}
              >
                삭제
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {focusedItem ? (
        <div className={styles.focusOverlay}>
          <div
            className={styles.focusImageSection}
            style={{
              backgroundImage: focusedItem.imageUrl ? `url(${focusedItem.imageUrl})` : 'none',
            }}
          >
            <div className={styles.focusTopGradient} />
            <div className={styles.focusBottomGradient} />
          </div>

          <div className={styles.focusOverlayLayer}>
            <div className={styles.focusTopBar}>
              <motion.button
                type="button"
                className={styles.focusBackButton}
                onClick={() => {
                  setFocusedPostId(null);
                  setDetailSheetOpen(false);
                }}
                aria-label="포커스 닫기"
                whileTap={{ scale: 0.94 }}
              >
                <ChevronLeft size={18} strokeWidth={2.2} color="white" />
              </motion.button>

              <div className={styles.focusTopBarPlaceholder} aria-hidden="true" />
            </div>

            <motion.div
              className={styles.focusVoteGraphArea}
              aria-hidden="true"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.22, ease: 'easeOut' }}
            >
              <div className={styles.focusProgressTrack}>
                <div
                  className={styles.focusLikeFill}
                  style={{ width: `${focusedVoteSummary.likePercent}%` }}
                />
                <div
                  className={styles.focusDislikeFill}
                  style={{ width: `${focusedVoteSummary.dislikePercent}%` }}
                />

                <div className={styles.focusLeftPercent}>
                  <ThumbsUp size={12} strokeWidth={2.2} />
                  <span>{focusedVoteSummary.likePercent}%</span>
                </div>

                <div className={styles.focusRightPercent}>
                  <span>{focusedVoteSummary.dislikePercent}%</span>
                  <ThumbsDown size={12} strokeWidth={2.2} />
                </div>
              </div>
            </motion.div>

            <motion.div
              className={styles.focusDetailButtonWrap}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.26, ease: 'easeOut' }}
            >
              <button
                type="button"
                className={styles.focusDetailButton}
                onClick={() => setDetailSheetOpen(true)}
              >
                <span>상세보러가기</span>
                <span className={styles.focusDetailIcon}>
                  <ChevronsUp size={20} strokeWidth={2.2} />
                </span>
              </button>
            </motion.div>
          </div>

          {detailSheetOpen ? (
            <PostDetailBottomSheet isOpen onCloseRequest={() => setDetailSheetOpen(false)}>
              <div ref={sheetContentRef}>
                <EvaluationDetailFeedback
                  embedded
                  postIdOverride={focusedItem.postId}
                  voteIdOverride={focusedItem.myVoteId ?? null}
                  voteChoiceOverride={focusedItem.myChoice}
                  allowReadonlyDetail
                  hideFeedbackSectionOverride
                />
              </div>
            </PostDetailBottomSheet>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
