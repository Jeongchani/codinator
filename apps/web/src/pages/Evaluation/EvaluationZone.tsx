import React, { useEffect, useMemo, useRef, useState } from 'react';
import { motion, useMotionValue, animate } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import styles from './EvaluationZone.module.css';

type VoteType = 'like' | 'dislike' | null;

type EvaluationPost = {
  id: number;
  imageUrl: string;
  title: string;
};

const mockPosts: EvaluationPost[] = [
  {
    id: 1,
    imageUrl:
      'https://images.unsplash.com/photo-1515886657613-9f3515b0c78f?auto=format&fit=crop&w=900&q=80',
    title: '평가 존 1',
  },
  {
    id: 2,
    imageUrl:
      'https://images.unsplash.com/photo-1529139574466-a303027c1d8b?auto=format&fit=crop&w=900&q=80',
    title: '평가 존 2',
  },
  {
    id: 3,
    imageUrl:
      'https://images.unsplash.com/photo-1483985988355-763728e1935b?auto=format&fit=crop&w=900&q=80',
    title: '평가 존 3',
  },
  {
    id: 4,
    imageUrl:
      'https://images.unsplash.com/photo-1509631179647-0177331693ae?auto=format&fit=crop&w=900&q=80',
    title: '평가 존 4',
  },
];

const THUMB_SIZE = 56;
const ACTION_HEIGHT = 64;

const EvaluationZone: React.FC = () => {
  const navigate = useNavigate();
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const trackRef = useRef<HTMLDivElement | null>(null);

  const [selectedVote, setSelectedVote] = useState<VoteType>(null);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [maxDrag, setMaxDrag] = useState(0);

  const dragX = useMotionValue(0);

  const currentPost = useMemo(() => {
    return mockPosts[currentIndex] ?? mockPosts[0];
  }, [currentIndex]);

  const isLikeSelected = selectedVote === 'like';
  const isDislikeSelected = selectedVote === 'dislike';
  const isActionActive = selectedVote !== null;

  useEffect(() => {
    const updateMaxDrag = () => {
      if (!trackRef.current) return;
      const trackWidth = trackRef.current.clientWidth;
      const nextMax = Math.max(trackWidth - THUMB_SIZE - 8, 0);
      setMaxDrag(nextMax);
    };

    updateMaxDrag();
    window.addEventListener('resize', updateMaxDrag);

    return () => {
      window.removeEventListener('resize', updateMaxDrag);
    };
  }, [selectedVote]);

  useEffect(() => {
    animate(dragX, 0, { duration: 0.2 });
  }, [selectedVote, currentIndex, dragX]);

  const handleScroll = () => {
    const container = scrollRef.current;
    if (!container) return;

    const pageHeight = container.clientHeight;
    const nextIndex = Math.round(container.scrollTop / pageHeight);

    if (nextIndex !== currentIndex) {
      setCurrentIndex(nextIndex);
      setSelectedVote(null);
    }
  };

  const handleLikeClick = () => {
    setSelectedVote('like');
    animate(dragX, 0, { duration: 0.2 });
  };

  const handleDislikeClick = () => {
    setSelectedVote('dislike');
    animate(dragX, 0, { duration: 0.2 });
  };

  const handleClose = () => {
    navigate(-1);
  };

  const goToEvaluationDetail = () => {
    if (!selectedVote) return;

    navigate('/evaluation-detail1', {
      state: {
        voteType: selectedVote,
        postId: currentPost.id,
        imageUrl: currentPost.imageUrl,
      },
    });
  };

  const handleDragEnd = (
    _event: MouseEvent | TouchEvent | PointerEvent,
    info: { offset: { x: number } },
  ) => {
    if (!selectedVote) return;

    if (selectedVote === 'like') {
      if (info.offset.x > maxDrag * 0.72) {
        animate(dragX, maxDrag, { duration: 0.15 }).then(() => {
          goToEvaluationDetail();
        });
      } else {
        animate(dragX, 0, { duration: 0.2 });
      }
      return;
    }

    if (selectedVote === 'dislike') {
      if (info.offset.x < -maxDrag * 0.72) {
        animate(dragX, -maxDrag, { duration: 0.15 }).then(() => {
          goToEvaluationDetail();
        });
      } else {
        animate(dragX, 0, { duration: 0.2 });
      }
    }
  };

  return (
    <div className={styles.container}>
      <div className={styles.viewport} ref={scrollRef} onScroll={handleScroll}>
        {mockPosts.map((post) => (
          <section key={post.id} className={styles.slide}>
            <div
              className={styles.imageSection}
              style={{ backgroundImage: `url(${post.imageUrl})` }}
            >
              <div className={styles.topGradient} />
              <div className={styles.bottomGradient} />
            </div>
          </section>
        ))}
      </div>

      <div className={styles.overlay}>
        <button className={styles.closeButton} onClick={handleClose} aria-label="닫기">
          <svg width="36" height="36" viewBox="0 0 36 36" fill="none">
            <path
              d="M28.0602 10.0602L25.9392 7.93921L17.9997 15.8787L10.0602 7.93921L7.93921 10.0602L15.8787 17.9997L7.93921 25.9392L10.0602 28.0602L17.9997 20.1207L25.9392 28.0602L28.0602 25.9392L20.1207 17.9997L28.0602 10.0602Z"
              fill="white"
            />
          </svg>
        </button>

        <div className={styles.title}>평가 존</div>

        <div className={styles.slideIndicator}>
          {mockPosts.map((_, idx) => (
            <div
              key={idx}
              className={
                idx === currentIndex ? styles.slideIndicatorActive : styles.slideIndicatorDot
              }
            />
          ))}
        </div>

        <div className={styles.bottomActionArea}>
          {!isLikeSelected && (
            <button
              type="button"
              className={`${styles.circleButton} ${
                selectedVote === null ? styles.circleButtonInactive : styles.circleButtonPassive
              } ${styles.leftButton}`}
              onClick={handleLikeClick}
              aria-label="좋아요"
            >
              <svg width="28" height="28" viewBox="0 0 28 28" fill="none">
                <path
                  d="M17.5245 8.16619L17.9165 5.78503C18.0193 5.15641 17.9511 4.51172 17.7191 3.9185C17.4871 3.32529 17.0998 2.80539 16.5979 2.41328C16.0959 2.02117 15.4977 1.77129 14.866 1.68982C14.2342 1.60834 13.5922 1.69828 13.0072 1.95019C12.1986 2.31304 11.5491 2.95677 11.179 3.76203L9.00317 8.16619H3.5C2.57174 8.16619 1.6815 8.53494 1.02513 9.19132C0.368749 9.8477 0 10.7379 0 11.6662L0 22.1662C0 23.0945 0.368749 23.9847 1.02513 24.6411C1.6815 25.2974 2.57174 25.6662 3.5 25.6662H25.6877L28 12.7897L28.0187 8.16619H17.5245ZM2.33333 22.1662V11.6662C2.33333 11.3568 2.45625 11.06 2.67504 10.8412C2.89383 10.6224 3.19058 10.4995 3.5 10.4995H8.16667V23.3329H3.5C3.19058 23.3329 2.89383 23.2099 2.67504 22.9912C2.45625 22.7724 2.33333 22.4756 2.33333 22.1662ZM25.6667 12.4829L23.7183 23.3329H10.5V10.3934L13.3222 4.67669C13.4177 4.50378 13.553 4.35602 13.7168 4.24556C13.8805 4.13509 14.0682 4.06508 14.2643 4.04128C14.4605 4.01747 14.6594 4.04056 14.8449 4.10863C15.0304 4.17671 15.197 4.28783 15.3312 4.43286C15.4458 4.56615 15.5296 4.72309 15.5766 4.89249C15.6236 5.06189 15.6326 5.23957 15.603 5.41286L14.7642 10.4995H25.6667V12.4829Z"
                  fill="white"
                />
              </svg>
            </button>
          )}

          {!isDislikeSelected && (
            <button
              type="button"
              className={`${styles.circleButton} ${
                selectedVote === null ? styles.circleButtonInactive : styles.circleButtonPassive
              } ${styles.rightButton}`}
              onClick={handleDislikeClick}
              aria-label="싫어요"
            >
              <svg width="28" height="28" viewBox="0 0 28 28" fill="none">
                <path
                  d="M28 16.583L25.6667 3.5H3.5C2.57174 3.5 1.6815 3.86875 1.02513 4.52513C0.368749 5.1815 0 6.07174 0 7L0 17.5C0 18.4283 0.368749 19.3185 1.02513 19.9749C1.6815 20.6313 2.57174 21 3.5 21H8.99733L11.2303 25.5255C11.6069 26.2865 12.2441 26.887 13.0261 27.2178C13.808 27.5486 14.6828 27.5878 15.4912 27.3281C16.2995 27.0683 16.9878 26.5271 17.4308 25.8027C17.8737 25.0784 18.042 24.2191 17.9048 23.3812L17.5128 21H28V16.583ZM2.33333 17.5V7C2.33333 6.69058 2.45625 6.39383 2.67504 6.17504C2.89383 5.95625 3.19058 5.83333 3.5 5.83333H8.16667V18.6667H3.5C3.19058 18.6667 2.89383 18.5437 2.67504 18.325C2.45625 18.1062 2.33333 17.8094 2.33333 17.5ZM25.6667 18.6667H14.7642L15.603 23.7592C15.6326 23.9325 15.6236 24.1101 15.5766 24.2795C15.5296 24.4489 15.4458 24.6059 15.3312 24.7392C15.1966 24.8838 15.0297 24.9945 14.8442 25.0622C14.6586 25.1298 14.4596 25.1525 14.2635 25.1284C14.0675 25.1042 13.8799 25.034 13.7163 24.9233C13.5527 24.8127 13.4176 24.6648 13.3222 24.4918L10.5 18.7728V5.83333H23.7183L25.6667 16.6833V18.6667Z"
                  fill="white"
                />
              </svg>
            </button>
          )}

          {isActionActive && (
            <div
              ref={trackRef}
              className={`${styles.dragTrack} ${
                isLikeSelected ? styles.dragTrackFromLeft : styles.dragTrackFromRight
              }`}
            >
              <div className={styles.trackText}>
                {isLikeSelected && '평가하러가기'}
                {isDislikeSelected && '평가하러가기'}
              </div>

              {isLikeSelected && (
                <div className={styles.trackHintRight}>
                  <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
                    <path
                      d="M8.59 16.59L13.17 12L8.59 7.41L10 6L16 12L10 18L8.59 16.59Z"
                      fill="white"
                    />
                  </svg>
                  <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
                    <path
                      d="M8.59 16.59L13.17 12L8.59 7.41L10 6L16 12L10 18L8.59 16.59Z"
                      fill="white"
                    />
                  </svg>
                </div>
              )}

              {isDislikeSelected && (
                <div className={styles.trackHintLeft}>
                  <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
                    <path
                      d="M15.41 16.59L10.83 12L15.41 7.41L14 6L8 12L14 18L15.41 16.59Z"
                      fill="white"
                    />
                  </svg>
                  <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
                    <path
                      d="M15.41 16.59L10.83 12L15.41 7.41L14 6L8 12L14 18L15.41 16.59Z"
                      fill="white"
                    />
                  </svg>
                </div>
              )}

              <motion.div
                className={styles.dragThumb}
                drag="x"
                dragMomentum={false}
                dragElastic={0}
                dragConstraints={
                  isLikeSelected
                    ? { left: 0, right: maxDrag }
                    : { left: -maxDrag, right: 0 }
                }
                style={{
                  x: dragX,
                  left: isLikeSelected ? 4 : 'auto',
                  right: isDislikeSelected ? 4 : 'auto',
                  width: `${THUMB_SIZE}px`,
                  height: `${THUMB_SIZE}px`,
                }}
                onDragEnd={handleDragEnd}
              >
                {isLikeSelected ? (
                  <svg width="28" height="28" viewBox="0 0 28 28" fill="none">
                    <path
                      d="M17.5245 8.16619L17.9165 5.78503C18.0193 5.15641 17.9511 4.51172 17.7191 3.9185C17.4871 3.32529 17.0998 2.80539 16.5979 2.41328C16.0959 2.02117 15.4977 1.77129 14.866 1.68982C14.2342 1.60834 13.5922 1.69828 13.0072 1.95019C12.1986 2.31304 11.5491 2.95677 11.179 3.76203L9.00317 8.16619H3.5C2.57174 8.16619 1.6815 8.53494 1.02513 9.19132C0.368749 9.8477 0 10.7379 0 11.6662L0 22.1662C0 23.0945 0.368749 23.9847 1.02513 24.6411C1.6815 25.2974 2.57174 25.6662 3.5 25.6662H25.6877L28 12.7897L28.0187 8.16619H17.5245ZM2.33333 22.1662V11.6662C2.33333 11.3568 2.45625 11.06 2.67504 10.8412C2.89383 10.6224 3.19058 10.4995 3.5 10.4995H8.16667V23.3329H3.5C3.19058 23.3329 2.89383 23.2099 2.67504 22.9912C2.45625 22.7724 2.33333 22.4756 2.33333 22.1662ZM25.6667 12.4829L23.7183 23.3329H10.5V10.3934L13.3222 4.67669C13.4177 4.50378 13.553 4.35602 13.7168 4.24556C13.8805 4.13509 14.0682 4.06508 14.2643 4.04128C14.4605 4.01747 14.6594 4.04056 14.8449 4.10863C15.0304 4.17671 15.197 4.28783 15.3312 4.43286C15.4458 4.56615 15.5296 4.72309 15.5766 4.89249C15.6236 5.06189 15.6326 5.23957 15.603 5.41286L14.7642 10.4995H25.6667V12.4829Z"
                      fill="black"
                    />
                  </svg>
                ) : (
                  <svg width="28" height="28" viewBox="0 0 28 28" fill="none">
                    <path
                      d="M28 16.583L25.6667 3.5H3.5C2.57174 3.5 1.6815 3.86875 1.02513 4.52513C0.368749 5.1815 0 6.07174 0 7L0 17.5C0 18.4283 0.368749 19.3185 1.02513 19.9749C1.6815 20.6313 2.57174 21 3.5 21H8.99733L11.2303 25.5255C11.6069 26.2865 12.2441 26.887 13.0261 27.2178C13.808 27.5486 14.6828 27.5878 15.4912 27.3281C16.2995 27.0683 16.9878 26.5271 17.4308 25.8027C17.8737 25.0784 18.042 24.2191 17.9048 23.3812L17.5128 21H28V16.583ZM2.33333 17.5V7C2.33333 6.69058 2.45625 6.39383 2.67504 6.17504C2.89383 5.95625 3.19058 5.83333 3.5 5.83333H8.16667V18.6667H3.5C3.19058 18.6667 2.89383 18.5437 2.67504 18.325C2.45625 18.1062 2.33333 17.8094 2.33333 17.5ZM25.6667 18.6667H14.7642L15.603 23.7592C15.6326 23.9325 15.6236 24.1101 15.5766 24.2795C15.5296 24.4489 15.4458 24.6059 15.3312 24.7392C15.1966 24.8838 15.0297 24.9945 14.8442 25.0622C14.6586 25.1298 14.4596 25.1525 14.2635 25.1284C14.0675 25.1042 13.8799 25.034 13.7163 24.9233C13.5527 24.8127 13.4176 24.6648 13.3222 24.4918L10.5 18.7728V5.83333H23.7183L25.6667 16.6833V18.6667Z"
                      fill="black"
                    />
                  </svg>
                )}
              </motion.div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default EvaluationZone;