import { useEffect, useRef } from 'react';
import { ChevronsUp, X } from 'lucide-react';
import styles from './FocusScreen.module.css';

type FocusScreenLayout = 'absolute' | 'modal' | 'page';

type DetailButtonConfig = {
  label?: string;
  onClick: () => void;
  disabled?: boolean;
};

type VoteGraphConfig = {
  likePercent: number;
  dislikePercent: number;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
};

type FocusScreenProps<T> = {
  layout?: FocusScreenLayout;
  items: T[];
  currentIndex?: number;
  onIndexChange?: (index: number) => void;
  getItemKey?: (item: T, index: number) => React.Key;
  getImageUrl?: (item: T, index: number) => string | null | undefined;
  renderSlide?: (item: T, index: number) => React.ReactNode;
  emptyImageFallback?: React.ReactNode;
  headerTitle?: React.ReactNode;
  headerRightSlot?: React.ReactNode;
  onClose?: () => void;
  closeButtonAriaLabel?: string;
  closeIcon?: React.ReactNode;
  showSwipeIndicator?: boolean;
  sheetBackdropVisible?: boolean;
  onSheetBackdropClick?: () => void;
  sheetBackdropAriaLabel?: string;
  detailButton?: DetailButtonConfig;
  voteGraph?: VoteGraphConfig;
  bottomOffset?: number;
  overlayChildren?: React.ReactNode;
  bottomSheet?: React.ReactNode;
};

function cn(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(' ');
}

function clampPercent(value: number) {
  if (!Number.isFinite(value)) return 0;
  return Math.min(Math.max(Math.round(value), 0), 100);
}

function VerticalSwipeIndicator({ above, below }: { above: number; below: number }) {
  const visibleAbove = Math.min(Math.max(above, 0), 3);
  const visibleBelow = Math.min(Math.max(below, 0), 3);

  return (
    <div className={styles.swipeIndicator} aria-hidden="true">
      <div className={styles.swipeIndicatorStack}>
        {Array.from({ length: visibleAbove }).map((_, index) => (
          <span
            key={`above-${index}`}
            className={styles.swipeIndicatorDot}
            style={{ animationDelay: `${0.08 * (visibleAbove - index)}s` }}
          />
        ))}

        <span className={styles.swipeIndicatorActive} />

        {Array.from({ length: visibleBelow }).map((_, index) => (
          <span
            key={`below-${index}`}
            className={styles.swipeIndicatorDot}
            style={{ animationDelay: `${0.08 * (index + 1)}s` }}
          />
        ))}
      </div>
    </div>
  );
}

export default function FocusScreen<T>({
  layout = 'absolute',
  items,
  currentIndex = 0,
  onIndexChange,
  getItemKey,
  getImageUrl,
  renderSlide,
  emptyImageFallback,
  headerTitle,
  headerRightSlot,
  onClose,
  closeButtonAriaLabel = '닫기',
  closeIcon,
  showSwipeIndicator = false,
  sheetBackdropVisible = false,
  onSheetBackdropClick,
  sheetBackdropAriaLabel = '상세 닫기',
  detailButton,
  voteGraph,
  bottomOffset = 44,
  overlayChildren,
  bottomSheet,
}: FocusScreenProps<T>) {
  const viewportRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const container = viewportRef.current;
    if (!container || items.length <= 0) return;

    const raf = window.requestAnimationFrame(() => {
      container.scrollTo({
        top: container.clientHeight * currentIndex,
        behavior: 'auto',
      });
    });

    return () => window.cancelAnimationFrame(raf);
  }, [currentIndex, items.length]);

  const handleScroll = () => {
    if (!onIndexChange || items.length <= 0) return;

    const container = viewportRef.current;
    if (!container) return;

    const pageHeight = container.clientHeight;
    const nextIndex = Math.max(
      0,
      Math.min(Math.round(container.scrollTop / pageHeight), items.length - 1),
    );

    if (nextIndex !== currentIndex) {
      onIndexChange(nextIndex);
    }
  };

  const previousSwipeCount = Math.min(Math.max(currentIndex, 0), 3);
  const nextSwipeCount = Math.min(Math.max(items.length - currentIndex - 1, 0), 3);

  const likePercent = clampPercent(voteGraph?.likePercent ?? 0);
  const dislikePercent = clampPercent(voteGraph?.dislikePercent ?? 0);
  const hasBottomStack = Boolean(detailButton || voteGraph);

  const rootClassName = cn(
    layout === 'modal'
      ? styles.modalRoot
      : layout === 'page'
        ? styles.pageRoot
        : styles.absoluteRoot,
  );

  return (
    <div className={rootClassName}>
      <div className={styles.frame}>
        <div ref={viewportRef} className={styles.viewport} onScroll={handleScroll}>
          {items.map((item, index) => {
            const key = getItemKey ? getItemKey(item, index) : index;

            if (renderSlide) {
              return (
                <section key={key} className={styles.slide}>
                  {renderSlide(item, index)}
                </section>
              );
            }

            const imageUrl = getImageUrl ? getImageUrl(item, index) : undefined;

            return (
              <section key={key} className={styles.slide}>
                {imageUrl ? (
                  <div
                    className={styles.mainImage}
                    style={{ backgroundImage: `url(${imageUrl})` }}
                  />
                ) : (
                  <div className={styles.imageFallback}>{emptyImageFallback ?? '이미지 없음'}</div>
                )}
                <div className={styles.topGradient} />
                <div className={styles.bottomGradient} />
              </section>
            );
          })}
        </div>

        {sheetBackdropVisible && onSheetBackdropClick ? (
          <button
            type="button"
            className={styles.sheetBackdrop}
            onClick={onSheetBackdropClick}
            aria-label={sheetBackdropAriaLabel}
          />
        ) : null}

        <div className={styles.overlay}>
          {(headerTitle || headerRightSlot || onClose) && (
            <div className={styles.topBar}>
              <div className={styles.headerTitle}>{headerTitle}</div>
              <div className={styles.topBarActions}>
                {headerRightSlot}
                {onClose ? (
                  <button
                    type="button"
                    onClick={onClose}
                    className={styles.closeButton}
                    aria-label={closeButtonAriaLabel}
                  >
                    {closeIcon ?? <X size={18} strokeWidth={2.6} />}
                  </button>
                ) : null}
              </div>
            </div>
          )}

          {showSwipeIndicator ? (
            <VerticalSwipeIndicator above={previousSwipeCount} below={nextSwipeCount} />
          ) : null}

          {overlayChildren}

          {hasBottomStack ? (
            <div className={styles.bottomStack} style={{ bottom: `${bottomOffset}px` }}>
              {detailButton ? (
                <button
                  type="button"
                  className={styles.detailButton}
                  onClick={detailButton.onClick}
                  disabled={detailButton.disabled}
                >
                  <span className={styles.detailButtonText}>{detailButton.label ?? '상세보기'}</span>
                  <ChevronsUp size={16} strokeWidth={2.4} className={styles.detailButtonIcon} />
                </button>
              ) : null}

              {voteGraph ? (
                <div className={styles.voteGraphArea}>
                  <div className={styles.progressTrack}>
                    <div className={styles.likeFill} style={{ width: `${likePercent}%` }} />
                    <div className={styles.dislikeFill} style={{ width: `${dislikePercent}%` }} />

                    {likePercent > 0 ? (
                      <div className={styles.leftPercent}>
                        {voteGraph.leftIcon}
                        <span>{likePercent}%</span>
                      </div>
                    ) : null}

                    {dislikePercent > 0 ? (
                      <div className={styles.rightPercent}>
                        {voteGraph.rightIcon}
                        <span>{dislikePercent}%</span>
                      </div>
                    ) : null}
                  </div>
                </div>
              ) : null}
            </div>
          ) : null}
        </div>

        {bottomSheet}
      </div>
    </div>
  );
}
