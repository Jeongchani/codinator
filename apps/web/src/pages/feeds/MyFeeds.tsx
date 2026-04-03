import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  ChevronLeft,
  Check,
  Eye,
  EyeOff,
  MoreVertical,
  Trash2,
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import type { GetMyFeedResponse } from "@codinator/contracts";
import {
  clearAuthTokens,
  fetcher,
  getAuthHeaders,
  resolveAssetUrl,
} from "../../lib/api";
import styles from "./MyFeeds.module.css";

type TabType = "all" | "ongoing" | "done";
type ActionMode = "delete" | "hide" | null;
type SlideDirection = "left" | "right";
type TouchDragMode = "select" | "deselect";

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

type MyFeedItem = GetMyFeedResponse["items"][number];

const TAB_ORDER: TabType[] = ["all", "ongoing", "done"];

const isAuthError = (message: string) => {
  return (
    message.includes("Unauthorized") ||
    message.includes("로그인이 필요합니다") ||
    message.includes("401")
  );
};

const getItemsByTab = (items: MyFeedItem[], tab: TabType) => {
  if (tab === "all") {
    return items;
  }

  if (tab === "ongoing") {
    return items.filter((item) => item.evaluation?.status === "OPEN");
  }

  return items.filter((item) => {
    const evaluationStatus = item.evaluation?.status;
    return evaluationStatus === "ENDED" || evaluationStatus === "CLOSED";
  });
};

async function loadAllMyFeedItems(): Promise<MyFeedItem[]> {
  const headers = getAuthHeaders();
  const allItems: MyFeedItem[] = [];
  let cursor: number | null = null;
  let hasMore = true;

  while (hasMore) {
    const query = cursor ? `?cursor=${cursor}` : "";
    const endpoint = `/users/me/feed${query}`;

    const data: GetMyFeedResponse = await fetcher(endpoint, {
      headers,
    });

    allItems.push(...(data.items ?? []));
    cursor = data.nextCursor ?? null;
    hasMore = Boolean(data.hasMore && cursor);
  }

  return allItems;
}

export default function MyFeeds() {
  const navigate = useNavigate();

  const [items, setItems] = useState<MyFeedItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [activeTab, setActiveTab] = useState<TabType>("all");
  const [displayTab, setDisplayTab] = useState<TabType>("all");
  const [prevTab, setPrevTab] = useState<TabType>("all");
  const [incomingTab, setIncomingTab] = useState<TabType | null>(null);
  const [isAnimating, setIsAnimating] = useState(false);
  const [slideDirection, setSlideDirection] = useState<SlideDirection>("right");

  const [actionMode, setActionMode] = useState<ActionMode>(null);
  const [selectedIds, setSelectedIds] = useState<number[]>([]);
  const [showActionConfirm, setShowActionConfirm] = useState(false);
  const [showOptionMenu, setShowOptionMenu] = useState(false);
  const [actionSubmitting, setActionSubmitting] = useState(false);

  const [isTouchDragging, setIsTouchDragging] = useState(false);
  const [touchDragMode, setTouchDragMode] = useState<TouchDragMode>("select");

  const containerRef = useRef<HTMLDivElement | null>(null);
  const tabRowRef = useRef<HTMLDivElement | null>(null);
  const optionMenuRef = useRef<HTMLDivElement | null>(null);
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

  const [indicatorStyle, setIndicatorStyle] = useState<IndicatorStyle>({
    left: 0,
    width: 0,
  });

  const isSelectionMode = actionMode !== null;
  const isDeleteMode = actionMode === "delete";
  const isHideMode = actionMode === "hide";

  const displayedItems = useMemo(() => {
    return getItemsByTab(items, displayTab);
  }, [displayTab, items]);

  const previousItems = useMemo(() => {
    return getItemsByTab(items, prevTab);
  }, [items, prevTab]);

  const activeItemsForSelection = useMemo(() => {
    return getItemsByTab(items, activeTab);
  }, [activeTab, items]);

  const selectedItems = useMemo(() => {
    return items.filter((item) => selectedIds.includes(item.postId));
  }, [items, selectedIds]);

  const allSelectedAreHidden = useMemo(() => {
    return (
      selectedItems.length > 0 &&
      selectedItems.every((item) => item.postStatus === "HIDDEN")
    );
  }, [selectedItems]);

  const moveToLogin = useCallback(() => {
    clearAuthTokens();
    navigate("/login", { replace: true });
  }, [navigate]);

  const refreshFeed = useCallback(async () => {
    try {
      setLoading(true);
      setError("");

      const loadedItems = await loadAllMyFeedItems();
      setItems(loadedItems);
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "나의 피드를 불러오지 못했습니다.";

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
  }, [incomingTab, isAnimating]);

  useEffect(() => {
    if (!showOptionMenu) return;

    const handleClickOutside = (e: MouseEvent) => {
      if (!optionMenuRef.current) return;
      if (!optionMenuRef.current.contains(e.target as Node)) {
        setShowOptionMenu(false);
      }
    };

    window.addEventListener("mousedown", handleClickOutside);
    return () => window.removeEventListener("mousedown", handleClickOutside);
  }, [showOptionMenu]);

  useEffect(() => {
    const visibleIds = new Set(
      activeItemsForSelection.map((item) => item.postId)
    );
    setSelectedIds((prev) => prev.filter((id) => visibleIds.has(id)));
  }, [activeItemsForSelection]);

  const toggleSelectedId = useCallback((postId: number) => {
    setSelectedIds((prev) =>
      prev.includes(postId)
        ? prev.filter((itemId) => itemId !== postId)
        : [...prev, postId]
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

  const getSelectionRect = useCallback(
    (start: Point, current: Point): SelectionRect => {
      return {
        left: Math.min(start.x, current.x),
        top: Math.min(start.y, current.y),
        right: Math.max(start.x, current.x),
        bottom: Math.max(start.y, current.y),
      };
    },
    []
  );

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
    touchDraggedRef.current = false;
  }, []);

  const enterMode = (mode: Exclude<ActionMode, null>) => {
    setActionMode(mode);
    setSelectedIds([]);
    setShowActionConfirm(false);
    setShowOptionMenu(false);
    resetTouchDragging();
  };

  const exitSelectionMode = () => {
    setActionMode(null);
    setSelectedIds([]);
    setShowActionConfirm(false);
    setShowOptionMenu(false);
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
    setShowActionConfirm(false);
    resetTouchDragging();
  };

  const handleActionConfirmOpen = () => {
    if (selectedIds.length === 0 || actionSubmitting) return;
    setShowActionConfirm(true);
  };

  const handleActionConfirmClose = () => {
    if (actionSubmitting) return;
    setShowActionConfirm(false);
  };

  const handleApplyAction = async () => {
    if (selectedIds.length === 0 || actionSubmitting) return;

    if (isHideMode && allSelectedAreHidden) {
      window.alert(
        "현재 백엔드에는 숨김 취소 API가 아직 없습니다. 프론트에서는 hidden 표시와 선택까지는 가능하지만 실제 취소는 백엔드 추가가 필요합니다."
      );
      return;
    }

    setActionSubmitting(true);

    try {
      const headers = getAuthHeaders();
      const results = await Promise.allSettled(
        selectedIds.map((postId) => {
          if (isDeleteMode) {
            return fetcher(`/posts/${postId}`, {
              method: "DELETE",
              headers,
            });
          }

          return fetcher(`/posts/${postId}/hide`, {
            method: "PATCH",
            headers,
          });
        })
      );

      const failed = results.find(
        (result): result is PromiseRejectedResult => result.status === "rejected"
      );

      if (failed) {
        const message =
          failed.reason instanceof Error
            ? failed.reason.message
            : isDeleteMode
            ? "게시글 삭제에 실패했습니다."
            : "게시글 숨기기에 실패했습니다.";

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

  const startTouchDrag = (
    clientX: number,
    clientY: number,
    startItemId?: number
  ) => {
    if (!isSelectionMode) return;

    const startPoint = getPointInContainer(clientX, clientY);

    touchStartRef.current = startPoint;
    touchCurrentRef.current = startPoint;
    initialSelectedIdsRef.current = [...selectedIds];
    touchDraggedRef.current = false;
    ignoreNextClickRef.current = false;

    const nextMode: TouchDragMode =
      startItemId && selectedIds.includes(startItemId) ? "deselect" : "select";

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

  const handleContentTouchStart = (e: React.TouchEvent<HTMLElement>) => {
    if (!isSelectionMode) return;

    const target = e.target as HTMLElement;
    if (target.closest("button")) return;

    const touch = e.touches[0];
    if (!touch) return;

    startTouchDrag(touch.clientX, touch.clientY);
  };

  const handleContentTouchMove = (e: React.TouchEvent<HTMLElement>) => {
    if (!isSelectionMode || !isTouchDragging) return;
    const touch = e.touches[0];
    if (!touch) return;

    e.preventDefault();
    moveTouchDrag(touch.clientX, touch.clientY);
  };

  const handleContentTouchEnd = () => {
    if (!isSelectionMode) return;
    endTouchDrag();
  };

  const handleCardTouchStart = (
    e: React.TouchEvent<HTMLButtonElement>,
    itemId: number
  ) => {
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

    e.preventDefault();
    e.stopPropagation();
    moveTouchDrag(touch.clientX, touch.clientY);
  };

  const handleCardTouchEnd = (
    e: React.TouchEvent<HTMLButtonElement>,
    itemId: number
  ) => {
    if (!isSelectionMode) return;
    e.stopPropagation();
    endTouchDrag(itemId);
  };

  const handleCardClick = (item: MyFeedItem) => {
    if (isSelectionMode) {
      if (ignoreNextClickRef.current) {
        ignoreNextClickRef.current = false;
        return;
      }

      toggleSelectedId(item.postId);
      return;
    }

    navigate(`/myFeedDetail/${item.postId}`, {
      state: {
        post: {
          id: item.postId,
          postId: item.postId,
          imageUrl: resolveAssetUrl(item.thumbnailUrl),
          createdAt: item.createdAt,
          content: item.content ?? "",
          nickname: "나의 피드",
        },
      },
    });
  };

  const renderGrid = (
    gridItems: MyFeedItem[],
    paneKey: string,
    extraClassName?: string
  ) => {
    return (
      <div className={`${styles.gridPane} ${extraClassName ?? ""}`} key={paneKey}>
        {loading && gridItems.length === 0 ? (
          <div className={styles.emptyState}>불러오는 중...</div>
        ) : error ? (
          <div className={styles.emptyState}>{error}</div>
        ) : gridItems.length === 0 ? (
          <div className={styles.emptyState}>나의 피드가 없습니다.</div>
        ) : (
          <div className={styles.cardGrid}>
            {gridItems.map((item) => {
              const isSelected = selectedIds.includes(item.postId);
              const imageUrl = resolveAssetUrl(item.thumbnailUrl);
              const isHiddenItem = item.postStatus === "HIDDEN";

              return (
                <button
                  key={item.postId}
                  ref={(el) => {
                    cardRefs.current[item.postId] = el;
                  }}
                  type="button"
                  className={`${styles.card} ${
                    isSelectionMode && isSelected ? styles.cardSelected : ""
                  }`}
                  onTouchStart={(e) => handleCardTouchStart(e, item.postId)}
                  onTouchMove={handleCardTouchMove}
                  onTouchEnd={(e) => handleCardTouchEnd(e, item.postId)}
                  onClick={() => handleCardClick(item)}
                  aria-label={item.content ?? `나의 피드 ${item.postId}`}
                >
                  {imageUrl ? (
                    <img
                      src={imageUrl}
                      alt={`my-feed-${item.postId}`}
                      style={{
                        position: "absolute",
                        inset: 0,
                        width: "100%",
                        height: "100%",
                        objectFit: "cover",
                      }}
                    />
                  ) : (
                    <div
                      style={{
                        position: "absolute",
                        inset: 0,
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        color: "#999999",
                        fontSize: "12px",
                        background: "#f3f3f3",
                      }}
                    >
                      이미지 없음
                    </div>
                  )}

                  {isHiddenItem && (
                    <span className={styles.hiddenBadge} aria-label="숨김 처리됨">
                      <EyeOff size={12} strokeWidth={2.2} />
                    </span>
                  )}

                  {isSelectionMode && (
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

  const confirmTitle = isDeleteMode
    ? "선택한 피드를 삭제할까요?"
    : allSelectedAreHidden
    ? "선택한 피드의 숨김을 취소할까요?"
    : "선택한 피드를 숨길까요?";

  const confirmDesc = isDeleteMode
    ? `선택한 ${selectedIds.length}개의 게시글이 삭제됩니다.`
    : allSelectedAreHidden
    ? `선택한 ${selectedIds.length}개의 hidden 게시글을 다시 공개 상태로 되돌리려면 백엔드 API가 필요합니다.`
    : `선택한 ${selectedIds.length}개의 게시글이 숨김 처리됩니다.`;

  const confirmActionLabel = actionSubmitting
    ? isDeleteMode
      ? "삭제 중..."
      : allSelectedAreHidden
      ? "처리 중..."
      : "숨기는 중..."
    : isDeleteMode
    ? "삭제"
    : allSelectedAreHidden
    ? "숨김 취소"
    : "숨기기";

  return (
    <div
      ref={containerRef}
      className={`${styles.container} ${isSelectionMode ? styles.selectionMode : ""}`}
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

          {isDeleteMode ? (
            <button
              type="button"
              className={styles.deleteButtonRed}
              onClick={handleActionConfirmOpen}
              aria-label="선택 삭제"
              disabled={selectedIds.length === 0 || actionSubmitting}
            >
              <Trash2 size={16} strokeWidth={2.3} />
            </button>
          ) : isHideMode ? (
            <button
              type="button"
              className={styles.hideButtonDark}
              onClick={handleActionConfirmOpen}
              aria-label="선택 숨기기"
              disabled={selectedIds.length === 0 || actionSubmitting}
            >
              <EyeOff size={16} strokeWidth={2.3} />
            </button>
          ) : (
            <div ref={optionMenuRef} className={styles.optionMenuWrap}>
              <button
                type="button"
                className={styles.headerIconButtonFilled}
                onClick={() => setShowOptionMenu((prev) => !prev)}
                aria-label="옵션 열기"
              >
                <MoreVertical size={16} strokeWidth={2.3} />
              </button>

              {showOptionMenu && (
                <div className={styles.optionMenu}>
                  <button
                    type="button"
                    className={styles.optionMenuItem}
                    onMouseDown={(e) => {
                      e.preventDefault();
                      enterMode("delete");
                    }}
                    onTouchStart={(e) => {
                      e.preventDefault();
                      enterMode("delete");
                    }}
                    onClick={(e) => {
                      e.preventDefault();
                      enterMode("delete");
                    }}
                  >
                    <span className={styles.optionMenuItemInner}>
                      <Trash2 size={18} strokeWidth={2.1} />
                      <span className={styles.optionMenuLabel}>삭제</span>
                    </span>
                  </button>

                  <button
                    type="button"
                    className={styles.optionMenuItem}
                    onMouseDown={(e) => {
                      e.preventDefault();
                      enterMode("hide");
                    }}
                    onTouchStart={(e) => {
                      e.preventDefault();
                      enterMode("hide");
                    }}
                    onClick={(e) => {
                      e.preventDefault();
                      enterMode("hide");
                    }}
                  >
                    <span className={styles.optionMenuItemInner}>
                      <Eye size={18} strokeWidth={2.1} />
                      <span className={styles.optionMenuLabel}>숨기기 / 취소</span>
                    </span>
                  </button>
                </div>
              )}
            </div>
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
          isSelectionMode ? styles.contentAreaSelectionMode : ""
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

      {showActionConfirm && (
        <div className={styles.modalOverlay} onClick={handleActionConfirmClose}>
          <div
            className={styles.modalCard}
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
            aria-label={isDeleteMode ? "나의 피드 삭제 확인" : "나의 피드 숨기기 확인"}
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
                className={styles.modalActionButton}
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