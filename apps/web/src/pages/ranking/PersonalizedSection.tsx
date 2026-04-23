import { Bookmark, ThumbsDown, ThumbsUp } from 'lucide-react';
import type { GetPersonalizedRankingsResponse } from '@codinator/contracts';
import styles from './PersonalizedSection.module.css';

export type PersonalizedFocusItem = {
  kind: 'personalized';
  likeCount: number;
  dislikeCount: number;
  bookmarked?: boolean;
  imageUrl?: string;
  postId: number;
  sectionTitle: 'For You';
  raw: GetPersonalizedRankingsResponse['items'][number];
};

function PersonalizedCard({
  item,
  onCardClick,
  onToggleBookmark,
  isBookmarkLoading,
  isBookmarkPressed,
}: {
  item: PersonalizedFocusItem;
  onCardClick: (item: PersonalizedFocusItem) => void;
  onToggleBookmark: (e: React.MouseEvent<HTMLButtonElement>, postId: number) => void;
  isBookmarkLoading: boolean;
  isBookmarkPressed: boolean;
}) {
  return (
    <article
      className={`${styles.card} ${isBookmarkPressed ? styles.cardPressed : ''}`}
      onClick={() => onCardClick(item)}
    >
      <div className={`${styles.thumbnail} ${isBookmarkPressed ? styles.thumbnailPressed : ''}`}>
        {item.imageUrl ? (
          <img
            src={item.imageUrl}
            alt={`personalized-${item.postId}`}
            className={styles.cardImage}
          />
        ) : (
          <div className={styles.cardImageFallback}>이미지 없음</div>
        )}
        <div className={styles.thumbnailGradient} />
        <button
          type="button"
          className={`${styles.bookmarkButton} ${isBookmarkPressed ? styles.bookmarkButtonPressed : ''}`}
          aria-label={item.bookmarked ? '북마크 해제' : '북마크 추가'}
          onClick={(e) => onToggleBookmark(e, item.postId)}
          disabled={isBookmarkLoading}
        >
          <Bookmark
            size={12}
            strokeWidth={2.2}
            className={item.bookmarked ? styles.bookmarkFilled : styles.bookmarkDefault}
            fill={item.bookmarked ? 'currentColor' : 'none'}
          />
        </button>
      </div>

      <div className={styles.statsRow}>
        <div className={styles.statItem}>
          <ThumbsUp size={13} strokeWidth={2.2} className={styles.statIcon} />
          <span className={styles.statText}>{String(item.likeCount).padStart(3, '0')}</span>
        </div>
        <div className={styles.statItem}>
          <ThumbsDown size={13} strokeWidth={2.2} className={styles.statIcon} />
          <span className={styles.statText}>{String(item.dislikeCount).padStart(3, '0')}</span>
        </div>
      </div>
    </article>
  );
}

type Props = {
  title: string;
  items: PersonalizedFocusItem[];
  bookmarkLoadingIds: number[];
  bookmarkPressedIds: number[];
  onCardClick: (item: PersonalizedFocusItem, list: PersonalizedFocusItem[]) => void;
  onToggleBookmark: (e: React.MouseEvent<HTMLButtonElement>, postId: number) => void;
  emptyMessage?: string;
};

export default function PersonalizedSection({
  title,
  items,
  bookmarkLoadingIds,
  bookmarkPressedIds,
  onCardClick,
  onToggleBookmark,
  emptyMessage = '추천 게시글이 아직 없어요.',
}: Props) {
  return (
    <section className={styles.section}>
      <h2 className={styles.sectionTitle}>{title}</h2>

      {items.length > 0 ? (
        <div className={styles.horizontalScroll}>
          {items.map((item) => (
            <PersonalizedCard
              key={`PERSONALIZED-${item.postId}`}
              item={item}
              onCardClick={(clicked) => onCardClick(clicked, items)}
              onToggleBookmark={onToggleBookmark}
              isBookmarkLoading={bookmarkLoadingIds.includes(item.postId)}
              isBookmarkPressed={bookmarkPressedIds.includes(item.postId)}
            />
          ))}
        </div>
      ) : (
        <div className={styles.sectionEmpty}>{emptyMessage}</div>
      )}
    </section>
  );
}
