import React, { useEffect, useMemo, useRef, useState } from 'react';
import { motion, useMotionValue, animate } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import type {
  CreateVoteResponse,
  EvaluationListItem,
  GetEvaluationsResponse,
  VoteChoice,
} from '@codinator/contracts';
import {
  clearAuthTokens,
  fetcher,
  getAuthHeaders,
  resolveAssetUrl,
} from '../../lib/api';
import styles from './EvaluationZone.module.css';

const THUMB_SIZE = 56;

const EvaluationZone: React.FC = () => {
  const navigate = useNavigate();
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const trackRef = useRef<HTMLDivElement | null>(null);

  const [selectedVote, setSelectedVote] = useState<VoteChoice | null>(null);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [maxDrag, setMaxDrag] = useState(0);
  const [posts, setPosts] = useState<EvaluationListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  const dragX = useMotionValue(0);

  const currentPost = useMemo(() => {
    return posts[currentIndex] ?? null;
  }, [currentIndex, posts]);

  const isLikeSelected = selectedVote === 'LIKE';
  const isDislikeSelected = selectedVote === 'DISLIKE';

  useEffect(() => {
    const loadEvaluations = async () => {
      try {
        setLoading(true);
        setError('');

        const data = await fetcher<GetEvaluationsResponse>('/evaluations?limit=10', {
          headers: getAuthHeaders(),
        });

        setPosts(data.items ?? []);
      } catch (err) {
        const message = err instanceof Error ? err.message : '평가 목록을 불러오지 못했습니다.';
        setError(message);

        if (message.includes('Unauthorized') || message.includes('로그인이 필요합니다')) {
          clearAuthTokens();
          navigate('/login');
        }
      } finally {
        setLoading(false);
      }
    };

    loadEvaluations();
  }, [navigate]);

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
  }, []);

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

  const navigateToDetail = (postId: number) => {
    navigate(`/evaluation-detail/${postId}`);
  };

  const handleVoteSelect = (choice: VoteChoice) => {
    if (!currentPost) {
      return;
    }

    if (currentPost.hasVoted) {
      navigateToDetail(currentPost.postId);
      return;
    }

    setSelectedVote(choice);
    animate(dragX, 0, { duration: 0.2 });
  };

  const submitVote = async (choice: VoteChoice) => {
    if (!currentPost) {
      return;
    }

    try {
      setSubmitting(true);
      setError('');

      const data = await fetcher<CreateVoteResponse>(
        `/evaluations/posts/${currentPost.postId}/votes`,
        {
          method: 'POST',
          headers: getAuthHeaders(),
          body: JSON.stringify({ choice }),
        },
      );

      navigate(
        `/evaluation-feedback/${currentPost.postId}?voteId=${data.voteId}&voteChoice=${choice}`,
      );
    } catch (err) {
      const message = err instanceof Error ? err.message : '투표에 실패했습니다.';
      setError(message);

      if (message.includes('이미 투표한 게시글')) {
        navigateToDetail(currentPost.postId);
        return;
      }

      if (message.includes('Unauthorized') || message.includes('로그인이 필요합니다')) {
        clearAuthTokens();
        navigate('/login');
      }
    } finally {
      setSubmitting(false);
    }
  };

  const handleClose = () => {
    navigate(-1);
  };

  const handleDragEnd = (
    _event: MouseEvent | TouchEvent | PointerEvent,
    info: { offset: { x: number } },
  ) => {
    if (!selectedVote || !currentPost || submitting) return;

    if (selectedVote === 'LIKE') {
      if (info.offset.x > maxDrag * 0.72) {
        animate(dragX, maxDrag, { duration: 0.15 }).then(() => {
          void submitVote('LIKE');
        });
      } else {
        animate(dragX, 0, { duration: 0.2 });
      }
      return;
    }

    if (info.offset.x < -maxDrag * 0.72) {
      animate(dragX, -maxDrag, { duration: 0.15 }).then(() => {
        void submitVote('DISLIKE');
      });
    } else {
      animate(dragX, 0, { duration: 0.2 });
    }
  };

  if (loading) {
    return <div className={styles.container}><div className={styles.title}>평가 목록 불러오는 중...</div></div>;
  }

  if (!posts.length) {
    return (
      <div className={styles.container}>
        <div className={styles.overlay}>
          <button className={styles.closeButton} onClick={handleClose} aria-label="닫기">
            ×
          </button>
          <div className={styles.title}>평가 존</div>
          <div style={{ marginTop: 120, textAlign: 'center', color: '#ffffff' }}>
            {error || '현재 평가할 게시글이 없습니다.'}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.container}>
      <div className={styles.viewport} ref={scrollRef} onScroll={handleScroll}>
        {posts.map((post) => (
          <section key={post.evaluationId} className={styles.slide}>
            <div
              className={styles.imageSection}
              style={{ backgroundImage: `url(${resolveAssetUrl(post.thumbnailUrl)})` }}
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
          {posts.map((_, idx) => (
            <div
              key={idx}
              className={idx === currentIndex ? styles.slideIndicatorActive : styles.slideIndicatorDot}
            />
          ))}
        </div>

        <div style={{ position: 'absolute', left: 24, right: 24, bottom: 190, color: '#fff', fontSize: 14, textAlign: 'center' }}>
          {currentPost?.hasVoted
            ? '이미 평가한 게시글입니다. 버튼을 누르면 상세 화면으로 이동합니다.'
            : error || '좌우 버튼 선택 후 슬라이더를 끝까지 밀면 투표됩니다.'}
        </div>

        <div className={styles.bottomActionArea}>
          {!isLikeSelected && (
            <button
              type="button"
              className={`${styles.circleButton} ${
                selectedVote === null ? styles.circleButtonInactive : styles.circleButtonPassive
              } ${styles.leftButton}`}
              onClick={() => handleVoteSelect('LIKE')}
              aria-label="좋아요"
              disabled={submitting}
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
              onClick={() => handleVoteSelect('DISLIKE')}
              aria-label="싫어요"
              disabled={submitting}
            >
              <svg width="28" height="28" viewBox="0 0 28 28" fill="none">
                <path
                  d="M28 16.583L25.6667 3.5H3.5C2.57174 3.5 1.6815 3.86875 1.02513 4.52513C0.368749 5.1815 0 6.07174 0 7L0 17.5C0 18.4283 0.368749 19.3185 1.02513 19.9749C1.6815 20.6313 2.57174 21 3.5 21H8.99733L11.2303 25.5255C11.6069 26.2865 12.2441 26.887 13.0261 27.2178C13.808 27.5486 14.6828 27.5878 15.4912 27.3281C16.2995 27.0683 16.9878 26.5271 17.4308 25.8027C17.8737 25.0784 18.042 24.2191 17.9048 23.3812L17.5128 21H28V16.583ZM2.33333 17.5V7C2.33333 6.69058 2.45625 6.39383 2.67504 6.17504C2.89383 5.95625 3.19058 5.83333 3.5 5.83333H8.16667V18.6667H3.5C3.19058 18.6667 2.89383 18.5437 2.67504 18.325C2.45625 18.1062 2.33333 17.8094 2.33333 17.5ZM25.6667 18.6667H14.7642L15.603 23.7592C15.6326 23.9325 15.6236 24.1101 15.5766 24.2795C15.5296 24.4489 15.4458 24.6059 15.3312 24.7392C15.1971 24.8842 15.0304 24.9952 14.8449 25.0632C14.6594 25.1312 14.4606 25.1542 14.2645 25.1304C14.0684 25.1066 13.8807 25.0367 13.7169 24.9263C13.5531 24.8159 13.4178 24.6682 13.3222 24.4955L10.5 18.6667V5.83333H23.7183L25.6667 16.583V18.6667Z"
                  fill="white"
                />
              </svg>
            </button>
          )}

          {selectedVote && !currentPost?.hasVoted && (
            <div className={styles.sliderActionWrap} ref={trackRef}>
              <div className={styles.sliderTrack} />
              <motion.div
                className={styles.sliderThumb}
                drag="x"
                dragConstraints={{ left: selectedVote === 'LIKE' ? 0 : -maxDrag, right: selectedVote === 'LIKE' ? maxDrag : 0 }}
                dragElastic={0}
                style={{ x: dragX }}
                onDragEnd={handleDragEnd}
              />
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default EvaluationZone;
