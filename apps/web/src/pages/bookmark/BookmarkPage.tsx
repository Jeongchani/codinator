import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { ChevronLeft, Check, Trash2 } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { clearAuthTokens, 
  resolveAssetUrl,
  fetchAllMyBookmarks,
  isAuthError,
  setPostBookmark,
} from "../../lib/api";
import styles from "./BookmarkPage.module.css";

type TabType = "all" | "ongoing" | "done";

type BookmarkItem = {
  id: number;
  postId: number;
  title: string;
  imageUrl?: string;
  status: Exclude<TabType, "all">;
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

type TouchDragMode = "select" | "deselect";
type SlideDirection = "left" | "right";

const TAB_ORDER: TabType[] = ["all", "ongoing", "done"];

function getItemsByTab(items: BookmarkItem[], tab: TabType) {
  if (tab === "all") return items;
  return items.filter((item) => item.status === tab);
}

function mapBookmarkItems(rawItems: Awaited<ReturnType<typeof fetchAllMyBookmarks>>): BookmarkItem[] {
  return rawItems.map((item) => ({
    id: item.postId,
    postId: item.postId,
    title: item.content?.trim() || `북마크 ${item.postId}`,
    imageUrl: item.thumbnailUrl ? resolveAssetUrl(item.thumbnailUrl) : undefined,
    status: item.evaluationStatus === "OPEN" ? "ongoing" : "done",
  }));
}

export default function BookmarkPage() {
  const navigate = useNavigate();

  const [activeTab, setActiveTab] = useState<TabType>("all");
  const [displayTab, setDisplayTab] = useState<TabType>("all");
  const [prevTab, setPrevTab] = useState<TabType>("all");
  const [incomingTab, setIncomingTab] = useState<TabType | null>(null);
  const [isAnimating, setIsAnimating] = useState(false);
  const [slideDirection, setSlideDirection] = useState<SlideDirection>("right");

  const [items, setItems] = useState<BookmarkItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [deleteMode, setDeleteMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<number[]>([]);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleteLoading, setDeleteLoading] = useState(false);

  const [isTouchDragging, setIsTouchDragging] = useState(false);
  const [touchDragMode, setTouchDragMode] = useState<TouchDragMode>("select");

  const containerRef = useRef<HTMLDivElement | null>(null);
  const tabRowRef = useRef<HTMLDivElement | null>(null);
  const cardRefs = useRef<Record<number, HTMLButtonElement | null>>({});

  const allTextRef = useRef<HTMLSpanElement | null>(null);
  const ongoingTextRef = useRef<HTMLSpanElement | null>(null);
  const doneTextRef = useRef<HTMLSpanElement | null>(null);

  const touchStartRef = useRef<Point | null>(null);
  const touchCurrentRef = useRef<Point | null>(null);
  const initialSelectedIdsRef = useRef<number[]>([]);
  const skipClickRef = useRef(false);
  const animationTimerRef = useRef<number | null>(null);

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

  const loadBookmarks = useCallback(async () => {
    try {
      setLoading(true);
      setError("");

      const data = await fetchAllMyBookmarks();
      setItems(mapBookmarkItems(data));
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "북마크 목록을 불러오지 못했습니다.";

      if (isAuthError(message)) {
        clearAuthTokens();
        navigate("/login", { replace: true });
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
    setSelectedIds((prev) => prev.filter((id) => items.some((item) => item.id === id)));
  }, [items]);

  const getTabTextRef = useCallback((tab: TabType) => {
    if (tab === "all") return allTextRef.current;
    if (tab === "ongoing") return ongoingTextRef.current;
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
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
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

    if (touchDragMode === "select") {
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
  }, []);

  const handleEnterDeleteMode = () => {
    setDeleteMode(true);
    setSelectedIds([]);
    setShowDeleteConfirm(false);
    resetTouchDragging();
  };

  const handleCancelDeleteMode = () => {
    setDeleteMode(false);
    setSelectedIds([]);
    setShowDeleteConfirm(false);
    resetTouchDragging();
  };

  const handleTabChange = (tab: TabType) => {
    if (tab === activeTab) return;

    const currentIndex = TAB_ORDER.indexOf(activeTab);
    const nextIndex = TAB_ORDER.indexOf(tab);
    const direction: SlideDirection = nextIndex > currentIndex ? "right" : "left";

    setSlideDirection(direction);
    setPrevTab(displayTab);
    setIncomingTab(tab);
    setIsAnimating(true);
    setActiveTab(tab);

    setSelectedIds([]);
    setShowDeleteConfirm(false);
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
      selectedIds.map((postId) => setPostBookmark(postId, false))
    );

    const failedMessages = results
      .filter(
        (result): result is PromiseRejectedResult => result.status === "rejected"
      )
      .map((result) =>
        result.reason instanceof Error
          ? result.reason.message
          : "북마크 삭제에 실패했습니다."
      );

    const authFailed = failedMessages.some((message) => isAuthError(message));

    if (authFailed) {
      setDeleteLoading(false);
      clearAuthTokens();
      navigate("/login", { replace: true });
      return;
    }

    const succeededIds = selectedIds.filter((_, index) => results[index]?.status === "fulfilled");

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

  const startTouchDrag = (clientX: number, clientY: number, startItemId?: number) => {
    if (!deleteMode) return;

    const startPoint = getPointInContainer(clientX, clientY);

    touchStartRef.current = startPoint;
    touchCurrentRef.current = startPoint;
    initialSelectedIdsRef.current = [...selectedIds];
    skipClickRef.current = false;

    const nextMode: TouchDragMode =
      startItemId && selectedIds.includes(startItemId) ? "deselect" : "select";

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
      skipClickRef.current = true;
    }

    applyTouchDragSelection();
  };

  const endTouchDrag = () => {
    if (!deleteMode) return;

    resetTouchDragging();

    window.setTimeout(() => {
      skipClickRef.current = false;
    }, 0);
  };

  const handleContentTouchStart = (e: React.TouchEvent<HTMLDivElement>) => {
    if (!deleteMode) return;
    const touch = e.touches[0];
    if (!touch) return;

    startTouchDrag(touch.clientX, touch.clientY);
  };

  const handleContentTouchMove = (e: React.TouchEvent<HTMLDivElement>) => {
    if (!deleteMode || !isTouchDragging) return;
    const touch = e.touches[0];
    if (!touch) return;

    e.preventDefault();
    moveTouchDrag(touch.clientX, touch.clientY);
  };

  const handleContentTouchEnd = () => {
    endTouchDrag();
  };

  const handleCardTouchStart = (
    e: React.TouchEvent<HTMLButtonElement>,
    itemId: number
  ) => {
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

    e.preventDefault();
    e.stopPropagation();
    moveTouchDrag(touch.clientX, touch.clientY);
  };

  const handleCardTouchEnd = (e: React.TouchEvent<HTMLButtonElement>) => {
    if (!deleteMode) return;
    e.stopPropagation();
    endTouchDrag();
  };

  const handleCardClick = (id: number) => {
    if (!deleteMode) return;
    if (skipClickRef.current) return;

    setSelectedIds((prev) =>
      prev.includes(id)
        ? prev.filter((itemId) => itemId !== id)
        : [...prev, id]
    );
  };

  const renderGrid = (paneItems: BookmarkItem[], paneKey: string, extraClassName?: string) => {
    return (
      <div className={`${styles.gridPane} ${extraClassName ?? ""}`} key={paneKey}>
        {loading ? (
          <div className={styles.emptyState}>불러오는 중...</div>
        ) : error ? (
          <div className={styles.emptyState}>{error}</div>
        ) : paneItems.length === 0 ? (
          <div className={styles.emptyState}>북마크한 게시글이 없습니다.</div>
        ) : (
          <div className={styles.cardGrid}>
            {paneItems.map((item) => {
              const isSelected = selectedIds.includes(item.id);

              return (
                <button
                  key={item.id}
                  ref={(el) => {
                    cardRefs.current[item.id] = el;
                  }}
                  type="button"
                  className={`${styles.card} ${
                    deleteMode && isSelected ? styles.cardSelected : ""
                  }`}
                  onTouchStart={(e) => handleCardTouchStart(e, item.id)}
                  onTouchMove={handleCardTouchMove}
                  onTouchEnd={handleCardTouchEnd}
                  onClick={() => handleCardClick(item.id)}
                  aria-label={item.title}
                >
                  {item.imageUrl ? (
                    <img
                      src={item.imageUrl}
                      alt={item.title}
                      style={{
                        position: "absolute",
                        inset: 0,
                        width: "100%",
                        height: "100%",
                        objectFit: "cover",
                      }}
                    />
                  ) : null}

                  {deleteMode && (
                    <span
                      className={`${styles.selectionDot} ${
                        isSelected ? styles.selectionDotSelected : ""
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
    slideDirection === "right" ? styles.enterFromRight : styles.enterFromLeft;

  return (
    <div
      ref={containerRef}
      className={`${styles.container} ${deleteMode ? styles.deleteMode : ""}`}
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

          <h1 className={styles.title}>북마크</h1>

          {deleteMode ? (
            <button
              type="button"
              className={styles.deleteButtonRed}
              onClick={handleDeleteConfirmOpen}
              aria-label="선택 삭제"
              disabled={selectedIds.length === 0 || deleteLoading}
            >
              <Trash2 size={16} strokeWidth={2.3} />
            </button>
          ) : (
            <button
              type="button"
              className={styles.headerIconButtonFilled}
              onClick={handleEnterDeleteMode}
              aria-label="삭제 모드"
              disabled={loading}
            >
              <Trash2 size={16} strokeWidth={2.3} />
            </button>
          )}
        </div>
      </header>

      <div className={styles.tabSection}>
        <div ref={tabRowRef} className={styles.tabRow}>
          <button
            type="button"
            className={styles.tabButton}
            onClick={() => handleTabChange("all")}
          >
            <span
              ref={allTextRef}
              className={`${styles.tabText} ${
                activeTab === "all" ? styles.tabTextActive : ""
              }`}
            >
              전체
            </span>
          </button>

          <button
            type="button"
            className={styles.tabButton}
            onClick={() => handleTabChange("ongoing")}
          >
            <span
              ref={ongoingTextRef}
              className={`${styles.tabText} ${
                activeTab === "ongoing" ? styles.tabTextActive : ""
              }`}
            >
              평가 중
            </span>
          </button>

          <button
            type="button"
            className={styles.tabButton}
            onClick={() => handleTabChange("done")}
          >
            <span
              ref={doneTextRef}
              className={`${styles.tabText} ${
                activeTab === "done" ? styles.tabTextActive : ""
              }`}
            >
              평가 완료
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
          deleteMode ? styles.contentAreaDeleteMode : ""
        }`}
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
                `${styles.animatedPane} ${styles.fadePane}`
              )}
              {renderGrid(
                getItemsByTab(items, incomingTab),
                `next-${incomingTab}`,
                `${styles.animatedPane} ${nextPaneEnterClass}`
              )}
            </>
          ) : (
            renderGrid(displayedItems, `current-${displayTab}`, styles.staticPane)
          )}
        </div>
      </main>

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
}
