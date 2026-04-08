import React, { useEffect, useMemo, useRef, useState } from 'react';
import { motion, useMotionValue, animate } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import type {
  CreateVoteResponse,
  EvaluationListItem,
  GetEvaluationPostDetailResponse,
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

const THUMB_SIZE = 50;

type VoteSummaryState = {
  likeCount: number;
  dislikeCount: number;
  totalCount: number;
};

type DisplayPage =
  | { type: 'post'; post: EvaluationListItem }
  | { type: 'empty' };

const CloseIcon = () => (
  <svg width="36" height="36" viewBox="0 0 36 36" fill="none" aria-hidden="true">
    <path
      d="M24 12L12 24"
      stroke="white"
      strokeWidth="2.4"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
    <path
      d="M12 12L24 24"
      stroke="white"
      strokeWidth="2.4"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
);

const ChevronRightDouble = () => (
  <svg width="34" height="18" viewBox="0 0 34 18" fill="none" aria-hidden="true">
    <path
      d="M10 3L16 9L10 15"
      stroke="white"
      strokeWidth="2.2"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
    <path
      d="M18 3L24 9L18 15"
      stroke="white"
      strokeWidth="2.2"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
);

const ChevronLeftDouble = () => (
  <svg width="34" height="18" viewBox="0 0 34 18" fill="none" aria-hidden="true">
    <path
      d="M24 3L18 9L24 15"
      stroke="white"
      strokeWidth="2.2"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
    <path
      d="M16 3L10 9L16 15"
      stroke="white"
      strokeWidth="2.2"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
);

const ThumbUpIcon = ({ dark = false }: { dark?: boolean }) => (
  <svg width="28" height="28" viewBox="0 0 28 28" fill="none" aria-hidden="true">
    <path
      d="M17.5245 8.16619L17.9165 5.78503C18.0193 5.15641 17.9511 4.51172 17.7191 3.9185C17.4871 3.32529 17.0998 2.80539 16.5979 2.41328C16.0959 2.02117 15.4977 1.77129 14.866 1.68982C14.2342 1.60834 13.5922 1.69828 13.0072 1.95019C12.1986 2.31304 11.5491 2.95677 11.179 3.76203L9.00317 8.16619H3.5C2.57174 8.16619 1.6815 8.53494 1.02513 9.19132C0.368749 9.8477 0 10.7379 0 11.6662L0 22.1662C0 23.0945 0.368749 23.9847 1.02513 24.6411C1.6815 25.2974 2.57174 25.6662 3.5 25.6662H25.6877L28 12.7897L28.0187 8.16619H17.5245ZM2.33333 22.1662V11.6662C2.33333 11.3568 2.45625 11.06 2.67504 10.8412C2.89383 10.6224 3.19058 10.4995 3.5 10.4995H8.16667V23.3329H3.5C3.19058 23.3329 2.89383 23.2099 2.67504 22.9912C2.45625 22.7724 2.33333 22.4756 2.33333 22.1662ZM25.6667 12.4829L23.7183 23.3329H10.5V10.3934L13.3222 4.67669C13.4177 4.50378 13.553 4.35602 13.7168 4.24556C13.8805 4.13509 14.0682 4.06508 14.2643 4.04128C14.4605 4.01747 14.6594 4.04056 14.8449 4.10863C15.0304 4.17671 15.197 4.28783 15.3312 4.43286C15.4458 4.56615 15.5296 4.72309 15.5766 4.89249C15.6236 5.06189 15.6326 5.23957 15.603 5.41286L14.7642 10.4995H25.6667V12.4829Z"
      fill={dark ? 'black' : 'white'}
    />
  </svg>
);

const ThumbDownIcon = ({ dark = false }: { dark?: boolean }) => (
  <svg width="28" height="28" viewBox="0 0 28 28" fill="none" aria-hidden="true">
    <path
      d="M28 16.583L25.6667 3.5H3.5C2.57174 3.5 1.6815 3.86875 1.02513 4.52513C0.368749 5.1815 0 6.07174 0 7L0 17.5C0 18.4283 0.368749 19.3185 1.02513 19.9749C1.6815 20.6313 2.57174 21 3.5 21H8.99733L11.2303 25.5255C11.6069 26.2865 12.2441 26.887 13.0261 27.2178C13.808 27.5486 14.6828 27.5878 15.4912 27.3281C16.2995 27.0683 16.9878 26.5271 17.4308 25.8027C17.8737 25.0784 18.042 24.2191 17.9048 23.3812L17.5128 21H28V16.583ZM2.33333 17.5V7C2.33333 6.69058 2.45625 6.39383 2.67504 6.17504C2.89383 5.95625 3.19058 5.83333 3.5 5.83333H8.16667V18.6667H3.5C3.19058 18.6667 2.89383 18.5437 2.67504 18.325C2.45625 18.1062 2.33333 17.8094 2.33333 17.5ZM25.6667 18.6667H14.7642L15.603 23.7592C15.6326 23.9325 15.6236 24.1101 15.5766 24.2795C15.5296 24.4489 15.4458 24.6059 15.3312 24.7392C15.1966 24.8838 15.0297 24.9945 14.8442 25.0622C14.6586 25.1298 14.4596 25.1525 14.2635 25.1284C14.0675 25.1042 13.8799 25.034 13.7163 24.9233C13.5527 24.8127 13.4176 24.6648 13.3222 24.4918L10.5 18.7728V5.83333H23.7183L25.6667 16.6833V18.6667Z"
      fill={dark ? 'black' : 'white'}
    />
  </svg>
);

const getFallbackVoteSummary = (choice: VoteChoice | null): VoteSummaryState => {
  if (choice === 'LIKE') {
    return {
      likeCount: 1,
      dislikeCount: 0,
      totalCount: 1,
    };
  }

  if (choice === 'DISLIKE') {
    return {
      likeCount: 0,
      dislikeCount: 1,
      totalCount: 1,
    };
  }

  return {
    likeCount: 0,
    dislikeCount: 0,
    totalCount: 0,
  };
};

const normalizeVoteSummary = (
  detail: GetEvaluationPostDetailResponse | null,
  fallbackChoice: VoteChoice | null,
): VoteSummaryState => {
  if (!detail?.voteSummary) {
    return getFallbackVoteSummary(fallbackChoice);
  }

  const likeCount = detail.voteSummary.likeCount ?? 0;
  const dislikeCount = detail.voteSummary.dislikeCount ?? 0;
  const totalCount = Math.max(detail.voteSummary.totalCount ?? 0, likeCount + dislikeCount);

  if (totalCount === 0) {
    return getFallbackVoteSummary(fallbackChoice);
  }

  return {
    likeCount,
    dislikeCount,
    totalCount,
  };
};

const EvaluationZone: React.FC = () => {
  const navigate = useNavigate();
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const trackRef = useRef<HTMLDivElement | null>(null);

  const [selectedVote, setSelectedVote] = useState<VoteChoice | null>(null);
  const [createdVoteId, setCreatedVoteId] = useState<number | null>(null);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [maxDrag, setMaxDrag] = useState(0);
  const [posts, setPosts] = useState<EvaluationListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [voteSummaryMap, setVoteSummaryMap] = useState<Record<number, VoteSummaryState>>({});

  const dragX = useMotionValue(0);

  const pages = useMemo<DisplayPage[]>(() => {
    return [
      ...posts.map((post) => ({ type: 'post', post }) as DisplayPage),
      { type: 'empty' } as DisplayPage,
    ];
  }, [posts]);

  const currentPage = useMemo(() => pages[currentIndex] ?? pages[0] ?? { type: 'empty' }, [pages, currentIndex]);

  const currentPost = useMemo(() => {
    return currentPage.type === 'post' ? currentPage.post : null;
  }, [currentPage]);

  const isLikeSelected = selectedVote === 'LIKE';
  const isDislikeSelected = selectedVote === 'DISLIKE';
  const isActionActive = selectedVote !== null;
  const hasCurrentVoteSaved = createdVoteId !== null;
  const isEmptyLastPage = currentPage.type === 'empty';

  const currentVoteSummary = useMemo(() => {
    if (!currentPost) {
      return getFallbackVoteSummary(null);
    }

    return voteSummaryMap[currentPost.postId] ?? getFallbackVoteSummary(selectedVote);
  }, [currentPost, selectedVote, voteSummaryMap]);

  const likePercent = useMemo(() => {
    if (currentVoteSummary.totalCount <= 0) return 0;
    return Math.round((currentVoteSummary.likeCount / currentVoteSummary.totalCount) * 100);
  }, [currentVoteSummary]);

  const dislikePercent = useMemo(() => {
    if (currentVoteSummary.totalCount <= 0) return 0;
    return 100 - likePercent;
  }, [currentVoteSummary, likePercent]);

  useEffect(() => {
    const loadEvaluations = async () => {
      try {
        setLoading(true);
        setError('');

        const data = await fetcher<GetEvaluationsResponse>('/evaluations?limit=10', {
          headers: getAuthHeaders(),
        });

        const filteredItems = (data.items ?? []).filter((item) => !item.hasVoted);
        setPosts(filteredItems);
        setCurrentIndex(0);
      } catch (err) {
        const message =
          err instanceof Error ? err.message : '평가 목록을 불러오지 못했습니다.';
        setError(message);

        if (
          message.includes('Unauthorized') ||
          message.includes('로그인이 필요합니다') ||
          message.includes('유효하지 않거나 만료된 토큰')
        ) {
          clearAuthTokens();
          navigate('/login');
        }
      } finally {
        setLoading(false);
      }
    };

    void loadEvaluations();
  }, [navigate]);

  useEffect(() => {
    const updateMaxDrag = () => {
      if (!trackRef.current) {
        setMaxDrag(0);
        return;
      }

      const trackWidth = trackRef.current.clientWidth;
      const nextMax = Math.max(trackWidth - THUMB_SIZE - 8, 0);
      setMaxDrag(nextMax);
    };

    updateMaxDrag();

    const timer = window.setTimeout(updateMaxDrag, 0);
    window.addEventListener('resize', updateMaxDrag);

    return () => {
      window.clearTimeout(timer);
      window.removeEventListener('resize', updateMaxDrag);
    };
  }, [selectedVote, currentIndex, posts.length]);

  useEffect(() => {
    animate(dragX, 0, { duration: 0.2 });
  }, [selectedVote, currentIndex, dragX]);

  const handleClose = () => {
    navigate('/rankingZone');
  };

  const navigateToDetailFeedback = (
    choice: VoteChoice,
    voteId: number,
    postId: number,
  ) => {
    navigate(`/evaluationDetailFeedback/${postId}?voteId=${voteId}&voteChoice=${choice}`);
  };

  const resetCurrentActionState = () => {
    setSelectedVote(null);
    setCreatedVoteId(null);
    setError('');
    animate(dragX, 0, { duration: 0.15 });
  };

  const removePostAndKeepFlow = (
    removedPostId: number,
    fromIndex: number,
    toIndex: number,
  ) => {
    setVoteSummaryMap((prev) => {
      const next = { ...prev };
      delete next[removedPostId];
      return next;
    });

    setPosts((prev) => {
      const nextPosts = prev.filter((post) => post.postId !== removedPostId);

      requestAnimationFrame(() => {
        const container = scrollRef.current;
        if (!container) return;

        const lastPageIndex = nextPosts.length;
        const adjustedIndex = toIndex > fromIndex ? toIndex - 1 : toIndex;
        const nextIndex = Math.max(0, Math.min(adjustedIndex, lastPageIndex));

        container.scrollTo({
          top: container.clientHeight * nextIndex,
          behavior: 'auto',
        });

        setCurrentIndex(nextIndex);
      });

      return nextPosts;
    });

    resetCurrentActionState();
  };

  const handleScroll = () => {
    const container = scrollRef.current;
    if (!container) return;

    const pageHeight = container.clientHeight;
    const rawIndex = Math.round(container.scrollTop / pageHeight);
    const nextIndex = Math.max(0, Math.min(rawIndex, pages.length - 1));

    if (nextIndex !== currentIndex) {
      const prevPage = pages[currentIndex];
      const prevPost = prevPage?.type === 'post' ? prevPage.post : null;
      const hadSavedVote = createdVoteId !== null;

      if (hadSavedVote && prevPost) {
        removePostAndKeepFlow(prevPost.postId, currentIndex, nextIndex);
        return;
      }

      setCurrentIndex(nextIndex);
      resetCurrentActionState();
    }
  };

  const submitVoteImmediately = async (choice: VoteChoice) => {
    if (!currentPost || submitting || hasCurrentVoteSaved) return;

    try {
      setSubmitting(true);
      setError('');

      const votedPostId = currentPost.postId;

      const data = await fetcher<CreateVoteResponse>(
        `/evaluations/posts/${votedPostId}/votes`,
        {
          method: 'POST',
          headers: getAuthHeaders(),
          body: JSON.stringify({ choice }),
        },
      );

      setSelectedVote(choice);
      setCreatedVoteId(data.voteId);
      setVoteSummaryMap((prev) => ({
        ...prev,
        [votedPostId]: getFallbackVoteSummary(choice),
      }));
      animate(dragX, 0, { duration: 0.2 });

      try {
        const detail = await fetcher<GetEvaluationPostDetailResponse>(
          `/evaluations/posts/${votedPostId}`,
          {
            headers: getAuthHeaders(),
          },
        );

        const normalizedSummary = normalizeVoteSummary(detail, choice);

        setVoteSummaryMap((prev) => ({
          ...prev,
          [votedPostId]: normalizedSummary,
        }));
      } catch {
        // fallback 그래프 유지
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : '투표에 실패했습니다.';
      setError(message);

      if (message.includes('이미 투표한 게시글')) {
        if (currentPost) {
          removePostAndKeepFlow(currentPost.postId, currentIndex, currentIndex + 1);
        }
        return;
      }

      if (
        message.includes('Unauthorized') ||
        message.includes('로그인이 필요합니다') ||
        message.includes('유효하지 않거나 만료된 토큰')
      ) {
        clearAuthTokens();
        navigate('/login');
      }
    } finally {
      setSubmitting(false);
    }
  };

  const handleVoteSelect = (choice: VoteChoice) => {
    if (!currentPost || submitting || isEmptyLastPage || hasCurrentVoteSaved) return;
    void submitVoteImmediately(choice);
  };

  const handleDragEnd = (
    _event: MouseEvent | TouchEvent | PointerEvent,
    info: { offset: { x: number } },
  ) => {
    if (!selectedVote || !currentPost || !createdVoteId || submitting) return;

    if (selectedVote === 'LIKE') {
      if (info.offset.x > maxDrag * 0.72) {
        animate(dragX, maxDrag, { duration: 0.15 }).then(() => {
          navigateToDetailFeedback('LIKE', createdVoteId, currentPost.postId);
        });
      } else {
        animate(dragX, 0, { duration: 0.2 });
      }
      return;
    }

    if (selectedVote === 'DISLIKE') {
      if (info.offset.x < -maxDrag * 0.72) {
        animate(dragX, -maxDrag, { duration: 0.15 }).then(() => {
          navigateToDetailFeedback('DISLIKE', createdVoteId, currentPost.postId);
        });
      } else {
        animate(dragX, 0, { duration: 0.2 });
      }
    }
  };

  const helperMessage = error
    ? error
    : isEmptyLastPage
      ? posts.length === 0
        ? '현재 평가할 게시글이 없습니다. 이 페이지가 마지막 평가존 페이지예요.'
        : '더 이상 평가할 게시글이 없습니다. 이 페이지가 마지막 평가존 페이지예요.'
      : '';

  if (loading) {
    return (
      <div className={styles.container}>
        <div className={styles.loadingState}>
          <div className={styles.loadingTitle}>평가 존</div>
          <div className={styles.statusText}>평가 목록 불러오는 중...</div>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.container}>
      <div className={styles.viewport} ref={scrollRef} onScroll={handleScroll}>
        {pages.map((page, idx) => (
          <section
            key={page.type === 'post' ? page.post.evaluationId : `empty-${idx}`}
            className={styles.slide}
          >
            {page.type === 'post' ? (
              <div
                className={styles.imageSection}
                style={{
                  backgroundImage: `url(${resolveAssetUrl(page.post.thumbnailUrl)})`,
                }}
              >
                <div className={styles.topGradient} />
                <div className={styles.bottomGradient} />
              </div>
            ) : (
              <div className={styles.emptyPageSection}>
                <div className={styles.topGradient} />
                <div className={styles.bottomGradient} />
                <div className={styles.emptyPageCenterText}>
                  {posts.length === 0
                    ? '현재 평가할 게시글이 없습니다.'
                    : '더 이상 평가할 게시글이 없습니다.'}
                </div>
              </div>
            )}
          </section>
        ))}
      </div>

      <div className={styles.overlay}>
        <button className={styles.closeButton} onClick={handleClose} aria-label="닫기">
          <CloseIcon />
        </button>

        <div className={styles.title}>평가 존</div>

        <div className={styles.slideIndicator}>
          {pages.map((_, idx) => (
            <div
              key={idx}
              className={
                idx === currentIndex
                  ? styles.slideIndicatorActive
                  : styles.slideIndicatorDot
              }
            />
          ))}
        </div>

        {helperMessage ? (
          <div className={styles.helperText}>{helperMessage}</div>
        ) : null}

        {!isEmptyLastPage && hasCurrentVoteSaved && (
          <div className={styles.voteGraphArea}>
            <div className={styles.progressTrack}>
              <div
                className={styles.likeFill}
                style={{ width: `${likePercent}%` }}
              />
              <div
                className={styles.dislikeFill}
                style={{ width: `${dislikePercent}%` }}
              />

              <div className={styles.leftPercent}>
                <ThumbUpIcon />
                <span>{likePercent}%</span>
              </div>

              <div className={styles.rightPercent}>
                <ThumbDownIcon />
                <span>{dislikePercent}%</span>
              </div>
            </div>
          </div>
        )}

        {!isEmptyLastPage && (
          <div className={styles.bottomActionArea}>
            {!isActionActive && (
              <>
                <button
                  type="button"
                  className={`${styles.circleButton} ${styles.circleButtonInactive} ${styles.leftButton}`}
                  onClick={() => handleVoteSelect('LIKE')}
                  aria-label="좋아요"
                  disabled={submitting}
                >
                  <ThumbUpIcon />
                </button>

                <button
                  type="button"
                  className={`${styles.circleButton} ${styles.circleButtonInactive} ${styles.rightButton}`}
                  onClick={() => handleVoteSelect('DISLIKE')}
                  aria-label="싫어요"
                  disabled={submitting}
                >
                  <ThumbDownIcon />
                </button>
              </>
            )}

            {isActionActive && hasCurrentVoteSaved && (
              <div
                ref={trackRef}
                className={`${styles.dragTrack} ${
                  isLikeSelected ? styles.dragTrackFromLeft : styles.dragTrackFromRight
                }`}
              >
                <div className={styles.trackText}>상세보기</div>

                {isLikeSelected && (
                  <div className={styles.trackHintRight}>
                    <ChevronRightDouble />
                  </div>
                )}

                {isDislikeSelected && (
                  <div className={styles.trackHintLeft}>
                    <ChevronLeftDouble />
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
                  {isLikeSelected ? <ThumbUpIcon dark /> : <ThumbDownIcon dark />}
                </motion.div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default EvaluationZone;