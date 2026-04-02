import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { ArrowLeft, Check, Trash2 } from "lucide-react";
import { useNavigate } from "react-router-dom";
import styles from "./BookmarkPage.module.css";

type TabType = "ongoing" | "done";

type BookmarkItem = {
  id: number;
  title: string;
  imageUrl?: string;
  status: TabType;
};

const MOCK_ITEMS: BookmarkItem[] = [
  { id: 1, title: "북마크 1", status: "ongoing" },
  { id: 2, title: "북마크 2", status: "ongoing" },
  { id: 3, title: "북마크 3", status: "ongoing" },
  { id: 4, title: "북마크 4", status: "ongoing" },
  { id: 5, title: "북마크 5", status: "ongoing" },
  { id: 6, title: "북마크 6", status: "ongoing" },
  { id: 7, title: "북마크 7", status: "done" },
  { id: 8, title: "북마크 8", status: "done" },
  { id: 9, title: "북마크 9", status: "done" },
];

type IndicatorStyle = {
  left: number;
  width: number;
};

export default function BookmarkPage() {
  const navigate = useNavigate();

  const [activeTab, setActiveTab] = useState<TabType>("ongoing");
  const [deleteMode, setDeleteMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<number[]>([]);
  const [isDragSelecting, setIsDragSelecting] = useState(false);

  const pointerIdRef = useRef<number | null>(null);
  const lastTouchedIdRef = useRef<number | null>(null);

  const tabRowRef = useRef<HTMLDivElement | null>(null);
  const ongoingTextRef = useRef<HTMLSpanElement | null>(null);
  const doneTextRef = useRef<HTMLSpanElement | null>(null);

  const [indicatorStyle, setIndicatorStyle] = useState<IndicatorStyle>({
    left: 0,
    width: 0,
  });

  const filteredItems = useMemo(() => {
    return MOCK_ITEMS.filter((item) => item.status === activeTab);
  }, [activeTab]);

  const isAllSelected =
    filteredItems.length > 0 &&
    filteredItems.every((item) => selectedIds.includes(item.id));

  const updateIndicator = useCallback(() => {
    const rowEl = tabRowRef.current;
    const targetEl =
      activeTab === "ongoing" ? ongoingTextRef.current : doneTextRef.current;

    if (!rowEl || !targetEl) return;

    const rowRect = rowEl.getBoundingClientRect();
    const targetRect = targetEl.getBoundingClientRect();

    setIndicatorStyle({
      left: targetRect.left - rowRect.left,
      width: targetRect.width,
    });
  }, [activeTab]);

  useLayoutEffect(() => {
    updateIndicator();
  }, [updateIndicator]);

  useEffect(() => {
    const handleResize = () => updateIndicator();
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, [updateIndicator]);

  const resetDragState = () => {
    setIsDragSelecting(false);
    pointerIdRef.current = null;
    lastTouchedIdRef.current = null;
  };

  const handleEnterDeleteMode = () => {
    setDeleteMode(true);
    setSelectedIds([]);
  };

  const handleCancelDeleteMode = () => {
    setDeleteMode(false);
    setSelectedIds([]);
    resetDragState();
  };

  const handleTabChange = (tab: TabType) => {
    setActiveTab(tab);
    setSelectedIds([]);
    resetDragState();
  };

  const toggleItem = useCallback((id: number) => {
    setSelectedIds((prev) =>
      prev.includes(id)
        ? prev.filter((itemId) => itemId !== id)
        : [...prev, id]
    );
  }, []);

  const handleToggleSelectAll = () => {
    if (!deleteMode) return;

    if (isAllSelected) {
      setSelectedIds([]);
      return;
    }

    setSelectedIds(filteredItems.map((item) => item.id));
  };

  const handleDeleteSelected = () => {
    if (selectedIds.length === 0) return;

    console.log("삭제할 북마크 id:", selectedIds);

    setSelectedIds([]);
    setDeleteMode(false);
    resetDragState();
  };

  const beginDragSelection = (
    e: React.PointerEvent<HTMLButtonElement>,
    id: number
  ) => {
    if (!deleteMode) return;

    pointerIdRef.current = e.pointerId;
    lastTouchedIdRef.current = id;
    setIsDragSelecting(true);

    try {
      e.currentTarget.setPointerCapture(e.pointerId);
    } catch {
      // noop
    }

    toggleItem(id);
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!deleteMode || !isDragSelecting) return;
    if (pointerIdRef.current !== null && e.pointerId !== pointerIdRef.current) {
      return;
    }

    const hit = document.elementFromPoint(e.clientX, e.clientY);
    const cardButton = hit?.closest?.("[data-bookmark-id]");

    if (!cardButton) return;

    const idAttr = cardButton.getAttribute("data-bookmark-id");
    if (!idAttr) return;

    const nextId = Number(idAttr);
    if (Number.isNaN(nextId)) return;

    if (lastTouchedIdRef.current === nextId) return;

    lastTouchedIdRef.current = nextId;
    toggleItem(nextId);
  };

  const endDragSelection = () => {
    if (!deleteMode) return;
    resetDragState();
  };

  return (
    <div
      className={`${styles.container} ${deleteMode ? styles.deleteMode : ""}`}
      onPointerMove={handlePointerMove}
      onPointerUp={endDragSelection}
      onPointerCancel={endDragSelection}
      onPointerLeave={endDragSelection}
    >
      <header className={styles.header}>
        <div className={styles.headerInner}>
          {deleteMode ? (
            <div className={styles.headerLeftGroup}>
              <button
                type="button"
                className={styles.selectAllWrap}
                onClick={handleToggleSelectAll}
                aria-label="전체 선택"
              >
                <span
                  className={`${styles.selectCircle} ${
                    isAllSelected ? styles.selectCircleActive : ""
                  }`}
                >
                  {isAllSelected && <Check size={13} strokeWidth={3} />}
                </span>
                <span className={styles.selectAllText}>전체</span>
              </button>

              <button
                type="button"
                className={styles.deleteButtonRed}
                onClick={handleDeleteSelected}
                aria-label="선택 삭제"
                disabled={selectedIds.length === 0}
              >
                <Trash2 size={18} strokeWidth={2.2} />
              </button>
            </div>
          ) : (
            <button
              type="button"
              className={styles.headerIconButton}
              onClick={() => navigate(-1)}
              aria-label="뒤로가기"
            >
              <ArrowLeft size={20} strokeWidth={2.2} />
            </button>
          )}

          <h1 className={styles.title}>북마크</h1>

          {deleteMode ? (
            <button
              type="button"
              className={styles.cancelButton}
              onClick={handleCancelDeleteMode}
            >
              취소
            </button>
          ) : (
            <button
              type="button"
              className={styles.headerIconButtonFilled}
              onClick={handleEnterDeleteMode}
              aria-label="삭제 모드"
            >
              <Trash2 size={18} strokeWidth={2.2} />
            </button>
          )}
        </div>
      </header>

      <div className={styles.tabSection}>
        <div ref={tabRowRef} className={styles.tabRow}>
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

      <main className={styles.contentArea}>
        {filteredItems.length === 0 ? (
          <div className={styles.emptyState}>북마크한 게시글이 없습니다.</div>
        ) : (
          <div className={styles.cardGrid}>
            {filteredItems.map((item) => {
              const isSelected = selectedIds.includes(item.id);

              return (
                <button
                  key={item.id}
                  type="button"
                  data-bookmark-id={item.id}
                  className={`${styles.card} ${
                    deleteMode && isSelected ? styles.cardSelected : ""
                  }`}
                  onPointerDown={(e) => beginDragSelection(e, item.id)}
                  onClick={(e) => {
                    if (!deleteMode) return;
                    e.preventDefault();
                  }}
                  aria-label={item.title}
                >
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
      </main>
    </div>
  );
}