import { X, Bookmark, ThumbsUp, ThumbsDown } from "lucide-react";
import styles from "./RankingFocus.module.css";

type RankingFocusProps = {
  imageUrl: string;
  periodLabel?: string;
  title?: string;
  likePercent?: number;
  dislikePercent?: number;
  isBookmarked?: boolean;
  onClose?: () => void;
  onBookmarkToggle?: () => void;
  onInfoClick?: () => void;
};

export default function RankingFocus({
  imageUrl,
  periodLabel = "This Week",
  title = "코디 컨셉 몇 글자까지?\n일단 최대 두줄",
  likePercent = 60,
  dislikePercent = 40,
  isBookmarked = false,
  onClose,
  onBookmarkToggle,
  onInfoClick,
}: RankingFocusProps) {
  const safeLike = Math.max(0, Math.min(100, likePercent));
  const safeDislike = Math.max(0, Math.min(100, dislikePercent));

  return (
    <div className={styles.container}>
      <div
        className={styles.imageLayer}
        style={{ backgroundImage: `url(${imageUrl})` }}
      />

      <div className={styles.topGradient} />
      <div className={styles.bottomGradient} />

      <div className={styles.headerRow}>
        <div className={styles.periodLabel}>{periodLabel}</div>

        <button
          type="button"
          className={styles.iconButton}
          onClick={onClose}
          aria-label="닫기"
        >
          <X size={18} strokeWidth={2.4} />
        </button>
      </div>

      <button
        type="button"
        className={styles.infoCard}
        onClick={onInfoClick}
        aria-label="피드 상세 보기"
      >
        <div className={styles.infoTop}>
          <p className={styles.title}>
            {title.split("\n").map((line, index) => (
              <span key={`${line}-${index}`}>
                {line}
                {index < title.split("\n").length - 1 && <br />}
              </span>
            ))}
          </p>

          <button
            type="button"
            className={`${styles.bookmarkButton} ${
              isBookmarked ? styles.bookmarkActive : ""
            }`}
            onClick={(e) => {
              e.stopPropagation();
              onBookmarkToggle?.();
            }}
            aria-label="북마크"
          >
            <Bookmark
              size={18}
              strokeWidth={2.2}
              fill={isBookmarked ? "currentColor" : "none"}
            />
          </button>
        </div>

        <div className={styles.ratioArea}>
          <div className={styles.likeBar}>
            <div
              className={styles.likeFill}
              style={{ width: `${safeLike}%` }}
            />
            <div className={styles.ratioContent}>
              <span className={styles.ratioIconWrap}>
                <ThumbsUp size={12} strokeWidth={2.3} />
              </span>
              <span className={styles.ratioText}>{safeLike}%</span>
            </div>
          </div>

          <div className={styles.dislikeBar}>
            <div
              className={styles.dislikeFill}
              style={{ width: `${safeDislike}%` }}
            />
            <div className={styles.ratioContent}>
              <span className={styles.ratioIconWrap}>
                <ThumbsDown size={12} strokeWidth={2.3} />
              </span>
              <span className={styles.ratioText}>{safeDislike}%</span>
            </div>
          </div>
        </div>
      </button>
    </div>
  );
}