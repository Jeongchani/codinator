import {
  type ReactNode,
  type RefObject,
  useCallback,
  useEffect,
  useRef,
} from 'react';
import { motion } from 'framer-motion';
import { ChevronLeft, ChevronsUp, ThumbsDown, ThumbsUp, X } from 'lucide-react';
import styles from './FocusScreen.module.css';

export type FocusScreenItem = {
  id: string | number;
  imageUrl?: string | null;
  fallbackText?: string;
  content?: ReactNode;
};

type WritableViewportRef = {
  current: HTMLDivElement | null;
};

type FocusScreenProps = {
  isOpen?: boolean;
  items: FocusScreenItem[];
  activeIndex?: number;
  viewportRef?: RefObject<HTMLDivElement | null>;
  ariaLabel?: string;
  closeButtonType?: 'back' | 'x';
  rightAction?: ReactNode;
  showTopBar?: boolean;
  showSwipeIndicator?: boolean;
  sheetOpen?: boolean;
  showVoteGraph?: boolean;
  likePercent?: number;
  dislikePercent?: number;
  showDetailButton?: boolean;
  detailLabel?: string;
  detailDisabled?: boolean;
  overlayChildren?: ReactNode;
  children?: ReactNode;
  className?: string;
  onClose: () => void;
  onActiveIndexChange?: (nextIndex: number) => void;
  onCloseSheet?: () => void;
  onOpenDetail?: () => void;
};

function clampPercent(value: number) {
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.min(Math.round(value), 100));
}

function VerticalSwipeIndicator({ above, below }: { above: number; below: number }) {
  const visibleAbove = Math.min(Math.max(above, 0), 3);
  const visibleBelow = Math.min(Math.max(below, 0), 3);

  return (
    <div className={styles.swipeIndicator} aria-hidden="true">
      <div className={styles.swipeIndicatorStack}>
        {Array.from({ length: visibleAbove }).map((_, index) => (
          <motion.div
            key={`above-${index}`}
            className={styles.swipeIndicatorDot}
            animate={{ opacity: [0.2, 0.44, 0.2], y: [0, -1.5, 0] }}
            transition={{
              duration: 1.7,
              repeat: Infinity,
              ease: 'easeInOut',
              delay: 0.1 * (visibleAbove - index),
            }}
          />
        ))}

        <motion.div
          className={styles.swipeIndicatorActive}
          animate={{ opacity: [1, 0.84, 1], scaleY: [1, 0.94, 1] }}
          transition={{ duration: 1.4, repeat: Infinity, ease: 'easeInOut' }}
        />

        {Array.from({ length: visibleBelow }).map((_, index) => (
          <motion.div
            key={`below-${index}`}
            className={styles.swipeIndicatorDot}
            animate={{ opacity: [0.2, 0.44, 0.2], y: [0, 1.5, 0] }}
            transition={{
              duration: 1.7,
              repeat: Infinity,
              ease: 'easeInOut',
              delay: 0.1 * (index + 1),
            }}
          />
        ))}
      </div>
    </div>
  );
}

function DetailButtonIcon() {
  return <ChevronsUp size={20} strokeWidth={2.2} />;
}

export default function FocusScreen({
  isOpen = true,
  items,
  activeIndex = 0,
  viewportRef,
  ariaLabel = '포커스 화면',
  closeButtonType = 'back',
  rightAction,
  showTopBar = true,
  showSwipeIndicator = true,
  sheetOpen = false,
  showVoteGraph = true,
  likePercent = 0,
  dislikePercent,
  showDetailButton = true,
  detailLabel = '상세보러가기',
  detailDisabled = false,
  overlayChildren,
  children,
  className = '',
  onClose,
  onActiveIndexChange,
  onCloseSheet,
  onOpenDetail,
}: FocusScreenProps) {
  const internalViewportRef = useRef<HTMLDivElement | null>(null);
  const itemCount = items.length;
  const resolvedActiveIndex = Math.max(0, Math.min(activeIndex, Math.max(itemCount - 1, 0)));
  const resolvedLikePercent = clampPercent(likePercent);
  const resolvedDislikePercent = clampPercent(
    typeof dislikePercent === 'number' ? dislikePercent : 100 - resolvedLikePercent,
  );
  const previousSwipeCount = Math.min(Math.max(resolvedActiveIndex, 0), 3);
  const nextSwipeCount = Math.min(Math.max(itemCount - resolvedActiveIndex - 1, 0), 3);

  const setViewportNode = useCallback(
    (node: HTMLDivElement | null) => {
      internalViewportRef.current = node;

      if (viewportRef) {
        (viewportRef as WritableViewportRef).current = node;
      }
    },
    [viewportRef],
  );

  const getViewportNode = useCallback(() => {
    return viewportRef?.current ?? internalViewportRef.current;
  }, [viewportRef]);

  useEffect(() => {
    if (!isOpen) return;

    const container = getViewportNode();
    if (!container) return;

    const raf = window.requestAnimationFrame(() => {
      container.scrollTo({
        top: container.clientHeight * resolvedActiveIndex,
        behavior: 'auto',
      });
    });

    return () => window.cancelAnimationFrame(raf);
  }, [isOpen, itemCount, resolvedActiveIndex, getViewportNode]);

  if (!isOpen || itemCount === 0) {
    return null;
  }

  const handleScroll = () => {
    const container = getViewportNode();
    if (!container) return;

    const pageHeight = container.clientHeight || 1;
    const nextIndex = Math.max(0, Math.min(Math.round(container.scrollTop / pageHeight), itemCount - 1));

    if (nextIndex !== resolvedActiveIndex) {
      onActiveIndexChange?.(nextIndex);
    }
  };

  return (
    <div className={`${styles.focusOverlay} ${className}`} role="dialog" aria-modal="true" aria-label={ariaLabel}>
      <div ref={setViewportNode} className={styles.focusViewport} onScroll={handleScroll}>
        {items.map((item) => (
          <section key={item.id} className={styles.focusSlide}>
            {item.imageUrl ? (
              <div
                className={styles.focusMainImage}
                style={{ backgroundImage: `url(${item.imageUrl})` }}
                aria-hidden="true"
              />
            ) : (
              <div className={styles.focusImageFallback}>{item.fallbackText ?? '이미지 없음'}</div>
            )}

            {item.content ? <div className={styles.focusItemContent}>{item.content}</div> : null}

            <div className={styles.topGradient} />
            <div className={styles.bottomGradient} />
          </section>
        ))}
      </div>

      {sheetOpen && onCloseSheet ? (
        <button
          type="button"
          className={styles.focusSheetBackdrop}
          onClick={onCloseSheet}
          aria-label="상세 닫기"
        />
      ) : null}

      <div className={styles.overlay}>
        {showTopBar ? (
          <div className={styles.topBar}>
            <motion.button
              type="button"
              className={styles.closeButton}
              onClick={onClose}
              aria-label={closeButtonType === 'x' ? '닫기' : '뒤로가기'}
              whileTap={{ scale: 0.94 }}
            >
              {closeButtonType === 'x' ? (
                <X size={18} strokeWidth={2.6} />
              ) : (
                <ChevronLeft size={20} strokeWidth={2.2} />
              )}
            </motion.button>

            {rightAction ? rightAction : <div className={styles.reportPlaceholder} aria-hidden="true" />}
          </div>
        ) : null}

        {!sheetOpen && showSwipeIndicator && itemCount > 1 ? (
          <VerticalSwipeIndicator above={previousSwipeCount} below={nextSwipeCount} />
        ) : null}

        {overlayChildren}

        {showVoteGraph ? (
          <motion.div
            className={styles.voteGraphArea}
            aria-hidden="true"
            key={`vote-bar-${items[resolvedActiveIndex]?.id ?? resolvedActiveIndex}`}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.22, ease: 'easeOut' }}
          >
            <div className={styles.progressTrack}>
              <div className={styles.likeFill} style={{ width: `${resolvedLikePercent}%` }} />
              <div className={styles.dislikeFill} style={{ width: `${resolvedDislikePercent}%` }} />

              <div className={styles.leftPercent}>
                <ThumbsUp size={12} strokeWidth={2.2} />
                <span>{resolvedLikePercent}%</span>
              </div>

              <div className={styles.rightPercent}>
                <span>{resolvedDislikePercent}%</span>
                <ThumbsDown size={12} strokeWidth={2.2} />
              </div>
            </div>
          </motion.div>
        ) : null}

        {showDetailButton ? (
          <motion.div
            className={styles.voteDetailButtonWrap}
            key={`detail-cta-${items[resolvedActiveIndex]?.id ?? resolvedActiveIndex}`}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.26, ease: 'easeOut' }}
          >
            <button
              type="button"
              className={styles.voteDetailButton}
              onClick={onOpenDetail}
              disabled={detailDisabled}
            >
              <span>{detailLabel}</span>
              <span className={styles.voteDetailIcon}>
                <DetailButtonIcon />
              </span>
            </button>
          </motion.div>
        ) : null}
      </div>

      {children}
    </div>
  );
}
