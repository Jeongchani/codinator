import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import type {
  CreateVoteResponse,
  EvaluationListItem,
  GetEvaluationsResponse,
  VoteChoice,
} from '@codinator/contracts';
import {
  clearAuthTokens,
  fetchMyBookmarkMap,
  fetcher,
  getAuthHeaders,
  isAuthError,
  resolveAssetUrl,
  subscribeBookmarkUpdated,
  togglePostBookmark,
} from '../../lib/api';
import PostDetailBottomSheet from '../../components/postdetail/PostDetailBottomSheet';
import FocusScreen from '../../components/focus/FocusScreen';
import EvaluationDetailFeedback from './EvaluationDetailFeedback';
import styles from './EvaluationZone.module.css';

type VoteSummaryState = {
  likeCount: number;
  dislikeCount: number;
  totalCount: number;
};

type DisplayPage = { type: 'post'; post: EvaluationListItem } | { type: 'empty' };

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

const EvaluationZone: React.FC = () => {
  const navigate = useNavigate();
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const sheetContentRef = useRef<HTMLDivElement | null>(null);

  const [selectedVote, setSelectedVote] = useState<VoteChoice | null>(null);
  const [createdVoteId, setCreatedVoteId] = useState<number | null>(null);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [posts, setPosts] = useState<EvaluationListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [voteSummaryMap, setVoteSummaryMap] = useState<Record<number, VoteSummaryState>>({});
  const [detailSheetOpen, setDetailSheetOpen] = useState(false);
  const [bookmarks, setBookmarks] = useState<Record<number, boolean>>({});
  const [bookmarkLoadingIds, setBookmarkLoadingIds] = useState<number[]>([]);

  const pages = useMemo<DisplayPage[]>(() => {
    return [
      ...posts.map((post) => ({ type: 'post', post }) as DisplayPage),
      { type: 'empty' } as DisplayPage,
    ];
  }, [posts]);

  const focusItems = useMemo(() => {
    return pages.map((page, index) => {
      if (page.type === 'post') {
        return {
          id: page.post.evaluationId,
          imageUrl: resolveAssetUrl(page.post.thumbnailUrl),
        };
      }

      return {
        id: `empty-${index}`,
        fallbackText: '',
      };
    });
  }, [pages]);

  const currentPage = useMemo(
    () => pages[currentIndex] ?? pages[0] ?? { type: 'empty' },
    [pages, currentIndex],
  );

  const currentPost = useMemo(() => {
    return currentPage.type === 'post' ? currentPage.post : null;
  }, [currentPage]);

  const isEmptyLastPage = currentPage.type === 'empty';
  const hasCurrentVoteSaved = createdVoteId !== null;

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
        const message = err instanceof Error ? err.message : '평가 목록을 불러오지 못했습니다.';
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
    let cancelled = false;

    const loadBookmarks = async () => {
      try {
        const nextMap = await fetchMyBookmarkMap();
        if (!cancelled) setBookmarks(nextMap);
      } catch (err) {
        const message = err instanceof Error ? err.message : '북마크 정보를 불러오지 못했습니다.';
        if (isAuthError(message)) {
          clearAuthTokens();
          navigate('/login');
        }
      }
    };

    void loadBookmarks();

    return () => {
      cancelled = true;
    };
  }, [navigate]);

  useEffect(() => {
    const unsubscribe = subscribeBookmarkUpdated((detail) => {
      if (!detail) {
        void fetchMyBookmarkMap()
          .then(setBookmarks)
          .catch(() => undefined);
        return;
      }

      setBookmarks((prev) => ({
        ...prev,
        [detail.postId]: detail.bookmarked,
      }));
    });

    return unsubscribe;
  }, []);

  const toggleBookmarkByPostId = async (postId: number) => {
    if (bookmarkLoadingIds.includes(postId)) return;

    const isBookmarked = Boolean(bookmarks[postId]);
    setBookmarkLoadingIds((prev) => [...prev, postId]);
    setBookmarks((prev) => ({ ...prev, [postId]: !isBookmarked }));

    try {
      const nextValue = await togglePostBookmark(postId, isBookmarked);
      setBookmarks((prev) => ({ ...prev, [postId]: nextValue }));
    } catch (err) {
      const message = err instanceof Error ? err.message : '북마크 처리에 실패했습니다.';
      setBookmarks((prev) => ({ ...prev, [postId]: isBookmarked }));

      if (isAuthError(message)) {
        clearAuthTokens();
        navigate('/login');
        return;
      }

      window.alert(message);
    } finally {
      setBookmarkLoadingIds((prev) => prev.filter((id) => id !== postId));
    }
  };

  const handleClose = () => {
    navigate('/rankingZone');
  };

  const resetCurrentActionState = () => {
    setSelectedVote(null);
    setCreatedVoteId(null);
    setError('');
    setDetailSheetOpen(false);
  };

  const removePostAndKeepFlow = (removedPostId: number, fromIndex: number, toIndex: number) => {
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

  const handleFocusIndexChange = (nextIndex: number) => {
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
      setSelectedVote(choice);
      setError('');

      const votedPostId = currentPost.postId;

      const data = await fetcher<CreateVoteResponse>(`/evaluations/posts/${votedPostId}/votes`, {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify({ choice }),
      });

      setCreatedVoteId(data.voteId);
      setVoteSummaryMap((prev) => ({
        ...prev,
        [votedPostId]: {
          likeCount: data.summary.likeCount ?? 0,
          dislikeCount: data.summary.dislikeCount ?? 0,
          totalCount: data.summary.totalCount ?? 0,
        },
      }));
    } catch (err) {
      const message = err instanceof Error ? err.message : '투표에 실패했습니다.';
      setSelectedVote(null);
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

  useEffect(() => {
    if (!detailSheetOpen) return;

    const handleDocumentPointerDown = (event: PointerEvent) => {
      const target = event.target;
      if (!(target instanceof Node)) return;

      const targetElement = target instanceof HTMLElement ? target : null;
      const classText = String(targetElement?.className ?? '');

      if (
        classText.includes('handlerArea') ||
        classText.includes('handlerBar') ||
        classText.includes('bottomSheet') ||
        classText.includes('sheetScrollArea')
      ) {
        return;
      }

      if (sheetContentRef.current?.contains(target)) {
        return;
      }

      setDetailSheetOpen(false);
    };

    document.addEventListener('pointerdown', handleDocumentPointerDown, true);

    return () => {
      document.removeEventListener('pointerdown', handleDocumentPointerDown, true);
    };
  }, [detailSheetOpen]);

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

  const overlayChildren = (
    <>{helperMessage ? <div className={styles.helperText}>{helperMessage}</div> : null}</>
  );

  return (
    <div className={styles.container}>
      <FocusScreen
        isOpen
        items={focusItems}
        activeIndex={currentIndex}
        viewportRef={scrollRef}
        onActiveIndexChange={handleFocusIndexChange}
        onClose={handleClose}
        sheetOpen={detailSheetOpen}
        onCloseSheet={() => setDetailSheetOpen(false)}
        showSwipeIndicator={!detailSheetOpen && !isEmptyLastPage}
        showVoteGraph={!isEmptyLastPage && hasCurrentVoteSaved}
        likePercent={likePercent}
        dislikePercent={dislikePercent}
        showDetailButton={!isEmptyLastPage && hasCurrentVoteSaved}
        detailLabel="상세보기"
        onOpenDetail={() => setDetailSheetOpen(true)}
        contentText={!isEmptyLastPage ? currentPost?.content : null}
        showVoteActions={!isEmptyLastPage}
        showActionCounts={!isEmptyLastPage && hasCurrentVoteSaved}
        likeCount={currentVoteSummary.likeCount}
        dislikeCount={currentVoteSummary.dislikeCount}
        showBookmarkButton={!isEmptyLastPage && hasCurrentVoteSaved}
        isBookmarked={currentPost ? Boolean(bookmarks[currentPost.postId]) : false}
        bookmarkDisabled={currentPost ? bookmarkLoadingIds.includes(currentPost.postId) : false}
        onBookmarkClick={() => {
          if (currentPost) void toggleBookmarkByPostId(currentPost.postId);
        }}
        reportPostId={currentPost?.postId ?? null}
        reportDisplayText={currentPost?.content ?? null}
        allowUserReport={false}
        selectedVote={selectedVote}
        voteActionDisabled={submitting || hasCurrentVoteSaved}
        onLikeClick={() => handleVoteSelect('LIKE')}
        onDislikeClick={() => handleVoteSelect('DISLIKE')}
        overlayChildren={overlayChildren}
        ariaLabel="평가존 포커스 화면"
      >
        {currentPost && detailSheetOpen ? (
          <PostDetailBottomSheet
            isOpen={detailSheetOpen}
            onCloseRequest={() => setDetailSheetOpen(false)}
          >
            <div ref={sheetContentRef}>
              <EvaluationDetailFeedback
                embedded
                postIdOverride={currentPost.postId}
                voteIdOverride={createdVoteId}
                voteChoiceOverride={selectedVote}
              />
            </div>
          </PostDetailBottomSheet>
        ) : null}
      </FocusScreen>
    </div>
  );
};

export default EvaluationZone;
