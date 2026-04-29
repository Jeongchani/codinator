import { type ReactNode, type RefObject, useCallback, useEffect, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import { Bookmark, ChevronLeft, List, ThumbsDown, ThumbsUp } from 'lucide-react';
import Reports from '../Reports';
import styles from './FocusScreen.module.css';

export type FocusScreenItem = {
  id: string | number;
  imageUrl?: string | null;
  fallbackText?: string;
  content?: ReactNode;
  contentText?: string | null;
};

type WritableViewportRef = {
  current: HTMLDivElement | null;
};

type FocusVoteChoice = 'LIKE' | 'DISLIKE';

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
  contentText?: string | null;
  contentLimit?: number;
  contentFirstLineLimit?: number;
  showContentPreview?: boolean;
  showVoteActions?: boolean;
  showActionCounts?: boolean;
  likeCount?: number | null;
  dislikeCount?: number | null;
  selectedVote?: FocusVoteChoice | null;
  voteActionDisabled?: boolean;
  showBookmarkButton?: boolean;
  isBookmarked?: boolean;
  bookmarkDisabled?: boolean;
  onBookmarkClick?: () => void;
  reportPostId?: number | string | null;
  reportDisplayText?: string | null;
  reportAuthorUserId?: number | null;
  reportAuthorDisplayText?: string | null;
  allowUserReport?: boolean;
  onReportClick?: () => void;
  onLikeClick?: () => void;
  onDislikeClick?: () => void;
  onClose: () => void;
  onActiveIndexChange?: (nextIndex: number) => void;
  onCloseSheet?: () => void;
  onOpenDetail?: () => void;
};

function clampPercent(value: number) {
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.min(Math.round(value), 100));
}

function formatCount(value: number | null | undefined) {
  if (typeof value !== 'number' || !Number.isFinite(value)) return '0';
  return Math.max(0, Math.trunc(value)).toLocaleString('ko-KR');
}

type ContentPreviewLines = {
  firstLine: string;
  secondLine: string;
};

function getContentPreviewLines(
  value: string | null | undefined,
  totalLimit: number,
  firstLineLimit: number,
): ContentPreviewLines {
  const text = value?.replace(/\s+/g, ' ').trim() ?? '';
  if (!text) return { firstLine: '', secondLine: '' };

  const chars = Array.from(text);
  const safeTotalLimit = Math.max(1, totalLimit);
  const safeFirstLineLimit = Math.max(1, Math.min(firstLineLimit, safeTotalLimit - 1));
  const shouldTruncate = chars.length > safeTotalLimit;
  const limitedChars = shouldTruncate ? chars.slice(0, safeTotalLimit) : chars;
  const firstLine = limitedChars
    .slice(0, safeFirstLineLimit)
    .join('')
    .replace(/\.{2,}|…/g, '')
    .trimEnd();
  const secondLine = limitedChars.slice(safeFirstLineLimit).join('').trimStart();

  return {
    firstLine,
    secondLine: shouldTruncate ? `${secondLine.replace(/\.{2,}|…/g, '').trimEnd()}...` : secondLine,
  };
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

export default function FocusScreen({
  isOpen = true,
  items,
  activeIndex = 0,
  viewportRef,
  ariaLabel = '포커스 화면',
  rightAction,
  showTopBar = true,
  showSwipeIndicator = true,
  sheetOpen = false,
  showVoteGraph = true,
  likePercent = 0,
  dislikePercent,
  showDetailButton = true,
  detailLabel = '상세보기',
  detailDisabled = false,
  overlayChildren,
  children,
  className = '',
  contentText,
  contentLimit = 40,
  contentFirstLineLimit = 20,
  showContentPreview = true,
  showVoteActions = true,
  showActionCounts = false,
  likeCount = 0,
  dislikeCount = 0,
  selectedVote = null,
  voteActionDisabled = false,
  showBookmarkButton = false,
  isBookmarked = false,
  bookmarkDisabled = false,
  onBookmarkClick,
  reportPostId = null,
  reportDisplayText = null,
  reportAuthorUserId = null,
  reportAuthorDisplayText = null,
  allowUserReport = true,
  onReportClick,
  onLikeClick,
  onDislikeClick,
  onClose,
  onActiveIndexChange,
  onCloseSheet,
  onOpenDetail,
}: FocusScreenProps) {
  const [internalReportOpen, setInternalReportOpen] = useState(false);
  const internalViewportRef = useRef<HTMLDivElement | null>(null);
  const itemCount = items.length;
  const resolvedActiveIndex = Math.max(0, Math.min(activeIndex, Math.max(itemCount - 1, 0)));
  const currentItem = items[resolvedActiveIndex] ?? null;
  const resolvedLikePercent = clampPercent(likePercent);
  const resolvedDislikePercent = clampPercent(
    typeof dislikePercent === 'number' ? dislikePercent : 100 - resolvedLikePercent,
  );
  const previousSwipeCount = Math.min(Math.max(resolvedActiveIndex, 0), 3);
  const nextSwipeCount = Math.min(Math.max(itemCount - resolvedActiveIndex - 1, 0), 3);
  const previewLines = getContentPreviewLines(
    currentItem?.contentText ?? contentText,
    contentLimit,
    contentFirstLineLimit,
  );
  const canShowPreview =
    showContentPreview &&
    (previewLines.firstLine.length > 0 || previewLines.secondLine.length > 0) &&
    !sheetOpen;
  const canShowActionRail =
    !sheetOpen && (showVoteActions || showBookmarkButton || showDetailButton);
  const hasReportTarget = reportPostId !== null && reportPostId !== undefined;

  const openReport = () => {
    if (onReportClick) {
      onReportClick();
      return;
    }

    if (hasReportTarget) {
      setInternalReportOpen(true);
    }
  };

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
    const nextIndex = Math.max(
      0,
      Math.min(Math.round(container.scrollTop / pageHeight), itemCount - 1),
    );

    if (nextIndex !== resolvedActiveIndex) {
      onActiveIndexChange?.(nextIndex);
    }
  };

  return (
    <div
      className={`${styles.focusOverlay} ${sheetOpen ? styles.focusOverlaySheetOpen : ''} ${className}`.trim()}
      role="dialog"
      aria-modal="true"
      aria-label={ariaLabel}
    >
      <div ref={setViewportNode} className={styles.focusViewport} onScroll={handleScroll}>
        {items.map((item) => (
          <section key={item.id} className={styles.focusSlide}>
            {item.imageUrl ? (
              <>
                <div
                  className={styles.focusBlurBackground}
                  style={{ backgroundImage: `url(${item.imageUrl})` }}
                  aria-hidden="true"
                />
                <div className={styles.focusImageFrame}>
                  <img
                    src={item.imageUrl}
                    alt=""
                    className={styles.focusMainImage}
                    draggable={false}
                  />
                </div>
              </>
            ) : (
              <div className={styles.focusImageFallback}>{item.fallbackText ?? '이미지 없음'}</div>
            )}

            {item.content ? <div className={styles.focusItemContent}>{item.content}</div> : null}

            <div className={styles.topGradient} />
            <div className={styles.bottomGradient} />
            <div className={styles.leftGradient} />
            <div className={styles.rightGradient} />
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
            <button
              type="button"
              className={styles.closeButton}
              onClick={onClose}
              aria-label="뒤로가기"
            >
              <ChevronLeft size={20} strokeWidth={2.25} />
            </button>

            {rightAction ? (
              <div className={styles.reportSlot}>{rightAction}</div>
            ) : (
              <button
                type="button"
                className={styles.reportTextButton}
                aria-label="게시글 신고"
                onClick={openReport}
                disabled={!onReportClick && !hasReportTarget}
              >
                신고
              </button>
            )}
          </div>
        ) : null}

        {!sheetOpen && showSwipeIndicator && itemCount > 1 ? (
          <VerticalSwipeIndicator above={previousSwipeCount} below={nextSwipeCount} />
        ) : null}

        {canShowActionRail ? (
          <div
            className={`${styles.actionRail} ${!showVoteGraph && !showDetailButton ? styles.actionRailWithoutGraph : ''}`.trim()}
          >
            {showVoteActions ? (
              <>
                <motion.button
                  type="button"
                  className={`${styles.railButton} ${selectedVote === 'LIKE' ? styles.railButtonSelected : ''}`}
                  onClick={onLikeClick}
                  disabled={!onLikeClick || voteActionDisabled}
                  aria-label="좋아요"
                  whileTap={onLikeClick && !voteActionDisabled ? { scale: 0.94 } : undefined}
                >
                  <ThumbsUp className={styles.railIcon} size={18} strokeWidth={2.15} />
                  {showActionCounts ? (
                    <span className={styles.railCount}>{formatCount(likeCount)}</span>
                  ) : (
                    <span className={styles.railLabel}>좋아요</span>
                  )}
                </motion.button>

                <motion.button
                  type="button"
                  className={`${styles.railButton} ${selectedVote === 'DISLIKE' ? styles.railButtonSelected : ''}`}
                  onClick={onDislikeClick}
                  disabled={!onDislikeClick || voteActionDisabled}
                  aria-label="싫어요"
                  whileTap={onDislikeClick && !voteActionDisabled ? { scale: 0.94 } : undefined}
                >
                  <ThumbsDown className={styles.railIcon} size={18} strokeWidth={2.15} />
                  {showActionCounts ? (
                    <span className={styles.railCount}>{formatCount(dislikeCount)}</span>
                  ) : (
                    <span className={styles.railLabel}>싫어요</span>
                  )}
                </motion.button>
              </>
            ) : null}

            {showBookmarkButton ? (
              <motion.button
                type="button"
                className={`${styles.railButton} ${isBookmarked ? styles.railButtonSelected : ''}`}
                onClick={onBookmarkClick}
                disabled={!onBookmarkClick || bookmarkDisabled}
                aria-label={isBookmarked ? '북마크 해제' : '북마크 추가'}
                whileTap={onBookmarkClick && !bookmarkDisabled ? { scale: 0.94 } : undefined}
              >
                <Bookmark className={styles.railIcon} size={18} strokeWidth={2.1} />
                <span className={styles.railLabel}>북마크</span>
              </motion.button>
            ) : null}

            {showDetailButton ? (
              <motion.button
                type="button"
                className={styles.railButton}
                onClick={onOpenDetail}
                disabled={detailDisabled || !onOpenDetail}
                aria-label={detailLabel}
                whileTap={onOpenDetail && !detailDisabled ? { scale: 0.94 } : undefined}
              >
                <List className={styles.railIcon} size={18} strokeWidth={2.05} />
                <span className={styles.railLabel}>{detailLabel}</span>
              </motion.button>
            ) : null}
          </div>
        ) : null}

        {canShowPreview ? (
          <div
            className={`${styles.contentCaption} ${!showVoteGraph ? styles.contentCaptionWithoutGraph : ''}`}
          >
            <p className={styles.contentCaptionFirstLine}>{previewLines.firstLine}</p>
            {previewLines.secondLine ? (
              <p className={styles.contentCaptionSecondLine}>{previewLines.secondLine}</p>
            ) : null}
          </div>
        ) : null}

        {overlayChildren}

        {showVoteGraph ? (
          <motion.div
            className={styles.voteGraphArea}
            aria-hidden="true"
            key={`vote-bar-${currentItem?.id ?? resolvedActiveIndex}`}
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
      </div>

      {hasReportTarget ? (
        <Reports
          isOpen={internalReportOpen}
          onClose={() => setInternalReportOpen(false)}
          defaultTab="post"
          allowUserReport={allowUserReport}
          postTarget={{ id: reportPostId, displayText: reportDisplayText?.trim() || '게시글' }}
          userTarget={
            allowUserReport && typeof reportAuthorUserId === 'number'
              ? { id: reportAuthorUserId, displayText: reportAuthorDisplayText?.trim() || '사용자' }
              : undefined
          }
        />
      ) : null}

      {children}
    </div>
  );
}
