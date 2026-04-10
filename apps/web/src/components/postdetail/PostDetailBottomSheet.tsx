import { useEffect, useRef } from "react";
import { motion, useAnimation } from "framer-motion";
import styles from "./PostDetailBottomSheet.module.css";

type SheetPosition = "expanded" | "collapsed" | "hidden";

type Props = {
  isOpen: boolean;
  onCloseRequest?: () => void;
  onClosed?: () => void;
  children: React.ReactNode;
};

const EXPANDED_Y = 0;
const COLLAPSED_Y = 360;
const HIDDEN_Y = 860;
const SPRING = { type: "spring", stiffness: 340, damping: 34 } as const;

const clamp = (value: number, min: number, max: number) =>
  Math.min(Math.max(value, min), max);

type DragState = {
  pointerId: number;
  startClientY: number;
  startSheetY: number;
  lastClientY: number;
  lastTime: number;
};

export default function PostDetailBottomSheet({
  isOpen,
  onCloseRequest,
  onClosed,
  children,
}: Props) {
  const controls = useAnimation();
  const positionRef = useRef<SheetPosition>(isOpen ? "collapsed" : "hidden");
  const currentYRef = useRef<number>(HIDDEN_Y);
  const closeGenRef = useRef(0);
  const wasOpenRef = useRef(isOpen);
  const dragStateRef = useRef<DragState | null>(null);
  const contentWrapRef = useRef<HTMLDivElement | null>(null);

  function syncContentInset(y: number) {
    contentWrapRef.current?.style.setProperty(
      "--sheet-bottom-inset",
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
      position === "expanded"
        ? EXPANDED_Y
        : position === "collapsed"
          ? COLLAPSED_Y
          : HIDDEN_Y;

    currentYRef.current = nextY;
    syncContentInset(nextY);
    await controls.start({ y: nextY, transition: SPRING });
  }

  function snapTo(position: SheetPosition) {
    void animateTo(position);

    if (position === "hidden") {
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
      if (currentPosition === "hidden" || currentY > COLLAPSED_Y) {
        snapTo("collapsed");
      } else {
        snapTo("expanded");
      }
      return;
    }

    if (isStrongDraggingDown) {
      snapTo("hidden");
      return;
    }

    if (isDraggingDown) {
      if (currentPosition === "expanded" || currentY < COLLAPSED_Y) {
        snapTo("collapsed");
      } else {
        snapTo("hidden");
      }
      return;
    }

    if (currentY <= (EXPANDED_Y + COLLAPSED_Y) / 2) {
      snapTo("expanded");
      return;
    }

    if (currentY <= (COLLAPSED_Y + HIDDEN_Y) / 2) {
      snapTo("collapsed");
      return;
    }

    snapTo("hidden");
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
    window.removeEventListener("pointermove", handleGlobalPointerMove);
    window.removeEventListener("pointerup", handleGlobalPointerUp);
    window.removeEventListener("pointercancel", handleGlobalPointerUp);
  }

  function handleHandlerPointerDown(event: React.PointerEvent<HTMLDivElement>) {
    if (event.pointerType === "mouse" && event.button !== 0) return;

    dragStateRef.current = {
      pointerId: event.pointerId,
      startClientY: event.clientY,
      startSheetY: currentYRef.current,
      lastClientY: event.clientY,
      lastTime: event.timeStamp,
    };

    detachGlobalPointerEvents();
    window.addEventListener("pointermove", handleGlobalPointerMove, { passive: true });
    window.addEventListener("pointerup", handleGlobalPointerUp, { passive: true });
    window.addEventListener("pointercancel", handleGlobalPointerUp, { passive: true });
  }

  function handleBarClick() {
    const currentPosition = positionRef.current;

    if (currentPosition === "expanded") {
      snapTo("collapsed");
      return;
    }

    if (currentPosition === "hidden") {
      snapTo("collapsed");
      return;
    }

    snapTo("expanded");
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
      positionRef.current = "collapsed";
      setSheetYImmediately(HIDDEN_Y);

      const raf = window.requestAnimationFrame(() => {
        void animateTo("collapsed");
      });

      return () => window.cancelAnimationFrame(raf);
    }

    positionRef.current = "hidden";

    if (!wasOpen) {
      setSheetYImmediately(HIDDEN_Y);
      return;
    }

    const currentGen = ++closeGenRef.current;
    void animateTo("hidden").then(() => {
      if (currentGen !== closeGenRef.current) return;
      onClosed?.();
    });
  }, [isOpen, onClosed]);

  return (
    <motion.div
      className={`${styles.sheetRoot} ${isOpen ? styles.open : styles.closed}`}
      initial={false}
      animate={controls}
      style={{ y: HIDDEN_Y }}
    >
      <div
        className={styles.handlerArea}
        onPointerDown={handleHandlerPointerDown}
        onClick={handleBarClick}
      >
        <div className={styles.handlerBar} />
      </div>

      <div className={styles.sheetScrollArea}>
        <div ref={contentWrapRef} className={styles.contentWrap}>
          {children}
        </div>
      </div>
    </motion.div>
  );
}
