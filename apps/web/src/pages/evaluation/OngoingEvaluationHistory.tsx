import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Check, ChevronLeft, Trash2 } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import evaluationHistoryBanner from '../../assets/evaluation/평가기록 배너.png';
import styles from './OngoingEvaluationHistory.module.css';

type HistoryItem = {
  id: number;
  title: string;
  imageUrl?: string;
};

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

const LONG_PRESS_MS = 450;
const LONG_PRESS_MOVE_THRESHOLD = 8;

const INITIAL_ITEMS: HistoryItem[] = [
  {
    id: 1,
    title: '평가기록 1',
    imageUrl:
      'https://images.unsplash.com/photo-1515886657613-9f3515b0c78f?auto=format&fit=crop&w=800&q=80',
  },
  {
    id: 2,
    title: '평가기록 2',
    imageUrl:
      'https://images.unsplash.com/photo-1521572267360-ee0c2909d518?auto=format&fit=crop&w=800&q=80',
  },
  {
    id: 3,
    title: '평가기록 3',
    imageUrl:
      'https://images.unsplash.com/photo-1483985988355-763728e1935b?auto=format&fit=crop&w=800&q=80',
  },
  {
    id: 4,
    title: '평가기록 4',
    imageUrl:
      'https://images.unsplash.com/photo-1496747611176-843222e1e57c?auto=format&fit=crop&w=800&q=80',
  },
  {
    id: 5,
    title: '평가기록 5',
    imageUrl:
      'https://images.unsplash.com/photo-1509631179647-0177331693ae?auto=format&fit=crop&w=800&q=80',
  },
  {
    id: 6,
    title: '평가기록 6',
    imageUrl:
      'https://images.unsplash.com/photo-1524504388940-b1c1722653e1?auto=format&fit=crop&w=800&q=80',
  },
  {
    id: 7,
    title: '평가기록 7',
    imageUrl:
      'https://images.unsplash.com/photo-1512436991641-6745cdb1723f?auto=format&fit=crop&w=800&q=80',
  },
  {
    id: 8,
    title: '평가기록 8',
    imageUrl:
      'https://images.unsplash.com/photo-1495385794356-15371f348c31?auto=format&fit=crop&w=800&q=80',
  },
  {
    id: 9,
    title: '평가기록 9',
    imageUrl:
      'https://images.unsplash.com/photo-1529139574466-a303027c1d8b?auto=format&fit=crop&w=800&q=80',
  },
];

type SelectionActionBarProps = {
  countText: string;
  canDelete: boolean;
  onDelete: () => void;
};

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

export default function OngoingEvaluationHistory() {
  const navigate = useNavigate();

  const [items, setItems] = useState<HistoryItem[]>(INITIAL_ITEMS);
  const [deleteMode, setDeleteMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<number[]>([]);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  const [isTouchDragging, setIsTouchDragging] = useState(false);
  const [touchDragMode, setTouchDragMode] = useState<TouchDragMode>('select');
  const [pressingCardId, setPressingCardId] = useState<number | null>(null);
  const [isSelectButtonPressed, setIsSelectButtonPressed] = useState(false);

  const containerRef = useRef<HTMLDivElement | null>(null);
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

  const selectedIdSet = useMemo(() => new Set(selectedIds), [selectedIds]);

  const allVisibleSelected = useMemo(
    () => items.length > 0 && items.every((item) => selectedIdSet.has(item.id)),
    [items, selectedIdSet],
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
    const touchedIds = items
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
  }, [getSelectionRect, isIntersecting, items, touchDragMode]);

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
  }, []);

  const startCardLongPress = useCallback(
    (clientX: number, clientY: number, itemId: number) => {
      if (deleteMode) return;

      clearLongPress();
      longPressTriggeredRef.current = false;
      setPressingCardId(itemId);

      longPressStartPointRef.current = getPointInContainer(clientX, clientY);

      longPressTimerRef.current = window.setTimeout(() => {
        activateDeleteModeByLongPress(itemId);
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
    if (items.length === 0) return;

    setSelectedIds((prev) => {
      const nextSet = new Set(prev);

      if (allVisibleSelected) {
        items.forEach((item) => nextSet.delete(item.id));
      } else {
        items.forEach((item) => nextSet.add(item.id));
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

    setItems((prev) => prev.filter((item) => !selectedIds.includes(item.id)));
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

  const handleCardClick = (item: HistoryItem) => {
    if (ignoreNextCardClickRef.current) {
      ignoreNextCardClickRef.current = false;
      longPressTriggeredRef.current = false;
      return;
    }

    if (!deleteMode) {
      return;
    }

    if (ignoreNextClickRef.current) {
      ignoreNextClickRef.current = false;
      return;
    }

    toggleSelectedId(item.id);
  };

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
              isSelectButtonPressed ? styles.headerTextButtonPressed : ''
            }`}
            onClick={() => {
              if (deleteMode) {
                handleToggleSelectAll();
                setIsSelectButtonPressed(false);
                return;
              }

              handleEnterDeleteMode();
            }}
            onTouchStart={() => setIsSelectButtonPressed(true)}
            onTouchEnd={() => setIsSelectButtonPressed(false)}
            onTouchCancel={() => setIsSelectButtonPressed(false)}
            onMouseDown={() => setIsSelectButtonPressed(true)}
            onMouseUp={() => setIsSelectButtonPressed(false)}
            onMouseLeave={() => setIsSelectButtonPressed(false)}
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
        style={{ touchAction: 'pan-y' }}
        onTouchStart={handleContentTouchStart}
        onTouchMove={handleContentTouchMove}
        onTouchEnd={handleContentTouchEnd}
      >
        {items.length === 0 ? (
          <div className={styles.emptyState}>평가기록이 없습니다.</div>
        ) : (
          <div className={styles.cardGrid}>
            {items.map((item) => {
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
                    if (e.button !== 0 || deleteMode) return;
                    startCardLongPress(e.clientX, e.clientY, item.id);
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
                  aria-label={item.title}
                >
                  {item.imageUrl ? (
                    <img
                      src={item.imageUrl}
                      alt={item.title}
                      className={styles.cardImage}
                      draggable={false}
                    />
                  ) : (
                    <div className={styles.cardImageFallback}>이미지 없음</div>
                  )}

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
    </div>
  );
}
