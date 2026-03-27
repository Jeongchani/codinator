import React, { useEffect, useState } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import styles from './RankingDetail.module.css';
import { motion, useAnimation, type PanInfo } from 'framer-motion';
import {
  clearAuthTokens,
  fetcher,
  getAuthHeaders,
  resolveAssetUrl,
} from '../../lib/api';
import type { GetRankingPostDetailResponse } from '@codinator/contracts';

type SheetPosition = 'expanded' | 'collapsed' | 'hidden';

const RankingDetail: React.FC = () => {
  const { postId } = useParams();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const controls = useAnimation();

  const [postData, setPostData] = useState<GetRankingPostDetailResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [isBookmarked, setIsBookmarked] = useState(false);
  const [sheetPosition, setSheetPosition] = useState<SheetPosition>('collapsed');

  const EXPANDED_Y = 350;
  const COLLAPSED_Y = 700;
  const HIDDEN_Y = 860;

  const period = searchParams.get('period') === 'MONTHLY' ? 'MONTHLY' : 'WEEKLY';

  useEffect(() => {
    if (!postId) return;

    const saved = localStorage.getItem('codinator_bookmarks');
    if (saved) {
      const parsed = JSON.parse(saved) as Record<string, boolean>;
      setIsBookmarked(!!parsed[String(postId)]);
    } else {
      setIsBookmarked(false);
    }
  }, [postId]);

  useEffect(() => {
    const loadDetail = async () => {
      try {
        setLoading(true);

        const data = await fetcher<GetRankingPostDetailResponse>(
          `/rankings/posts/${postId}?period=${period}`,
          {
            headers: getAuthHeaders(),
          },
        );

        setPostData(data);
      } catch (err) {
        console.error('랭킹 상세 불러오기 실패:', err);

        const message = err instanceof Error ? err.message : '상세 데이터를 불러오지 못했습니다.';

        if (message.includes('Unauthorized') || message.includes('로그인이 필요합니다')) {
          clearAuthTokens();
          navigate('/login');
          return;
        }

        setPostData(null);
      } finally {
        setLoading(false);
        setSheetPosition('collapsed');
        controls.start({ y: COLLAPSED_Y });
      }
    };

    if (postId) {
      void loadDetail();
    } else {
      setLoading(false);
      setPostData(null);
    }
  }, [postId, period, navigate, controls]);

  const snapTo = (position: SheetPosition) => {
    setSheetPosition(position);

    const nextY =
      position === 'expanded'
        ? EXPANDED_Y
        : position === 'collapsed'
          ? COLLAPSED_Y
          : HIDDEN_Y;

    controls.start({
      y: nextY,
      transition: { type: 'spring', stiffness: 300, damping: 30 },
    });
  };

  const expandSheet = () => {
    snapTo('expanded');
  };

  const collapseSheet = () => {
    snapTo('collapsed');
  };

  const hideSheet = () => {
    snapTo('hidden');
  };

  const onDragEnd = (_: MouseEvent | TouchEvent | PointerEvent, info: PanInfo) => {
    const isDraggingUp = info.offset.y < -50 || info.velocity.y < -500;
    const isDraggingDown = info.offset.y > 50 || info.velocity.y > 500;
    const isStrongDraggingDown = info.offset.y > 140 || info.velocity.y > 900;

    if (isDraggingUp) {
      if (sheetPosition === 'hidden') {
        collapseSheet();
      } else {
        expandSheet();
      }
      return;
    }

    if (isStrongDraggingDown) {
      hideSheet();
      return;
    }

    if (isDraggingDown) {
      if (sheetPosition === 'expanded') {
        collapseSheet();
      } else {
        hideSheet();
      }
      return;
    }

    snapTo(sheetPosition);
  };

  const handleToggleBookmark = (e: React.MouseEvent<HTMLButtonElement>) => {
    e.stopPropagation();

    const next = !isBookmarked;
    setIsBookmarked(next);

    if (postId) {
      const saved = localStorage.getItem('codinator_bookmarks');
      const parsed = saved ? (JSON.parse(saved) as Record<string, boolean>) : {};
      parsed[String(postId)] = next;
      localStorage.setItem('codinator_bookmarks', JSON.stringify(parsed));
    }
  };

  const handleGoToUserFeed = () => {
    if (!postData?.author?.userId) return;
    navigate(`/user/${postData.author.userId}/feed`);
  };

  const handleShowHiddenSheet = () => {
    collapseSheet();
  };

  if (loading) return <div className={styles.loading}>데이터 로드 중...</div>;
  if (!postData) return <div className={styles.loading}>게시글을 불러올 수 없습니다.</div>;

  return (
    <div className={styles.container}>
      <div className={styles.imageSection}>
        <div
          className={styles.mainImage}
          style={{
            backgroundImage: `url(${resolveAssetUrl(postData.image.imageUrl)})`,
            backgroundSize: 'cover',
            backgroundPosition: 'center',
            backgroundRepeat: 'no-repeat',
          }}
        />
        <div className={styles.topGradient} />
        <div className={styles.bottomGradient} />
      </div>

      <div className={styles.headerTitle}>
        {period === 'MONTHLY' ? 'this month' : 'this week'}
      </div>

      <button onClick={() => navigate(-1)} className={styles.closeBtn}>
        <svg width="36" height="36" viewBox="0 0 36 36" fill="none">
          <path
            d="M28.06 10.06L25.94 7.94L18 15.88L10.06 7.94L7.94 10.06L15.88 18L7.94 25.94L10.06 28.06L18 20.12L25.94 28.06L28.06 25.94L20.12 18L28.06 10.06Z"
            fill="white"
          />
        </svg>
      </button>

      {sheetPosition === 'hidden' && (
        <button
          type="button"
          className={styles.hiddenPeekButton}
          onClick={handleShowHiddenSheet}
          aria-label="상세정보 다시 보기"
        >
          <div className={styles.hiddenPeekBar} />
        </button>
      )}

      <motion.div
        className={styles.bottomSheet}
        drag="y"
        dragConstraints={{ top: EXPANDED_Y, bottom: HIDDEN_Y }}
        dragElastic={0}
        initial={{ y: COLLAPSED_Y }}
        animate={controls}
        onDragEnd={onDragEnd}
      >
        <div
          className={styles.handlerArea}
          onClick={() => {
            if (sheetPosition === 'expanded') {
              collapseSheet();
            } else if (sheetPosition === 'hidden') {
              collapseSheet();
            } else {
              expandSheet();
            }
          }}
        >
          <div className={styles.handlerBar} />
        </div>

        <div
          className={`${styles.sheetContent} ${
            sheetPosition === 'expanded' ? styles.scroll : styles.noScroll
          }`}
        >
          <div className={styles.titleRow}>
            <h2 className={styles.title}>{postData.content}</h2>

            <div className={styles.actionGroup}>
              <button
                type="button"
                className={styles.bookmarkBtn}
                onClick={handleToggleBookmark}
                aria-label="북마크"
              >
                <svg width="26" height="26" viewBox="0 0 24 24" fill="none">
                  <path
                    d="M12 21.35L10.55 20.03C5.4 15.36 2 12.28 2 8.5C2 5.42 4.42 3 7.5 3C9.24 3 10.91 3.81 12 5.09C13.09 3.81 14.76 3 16.5 3C19.58 3 22 5.42 22 8.5C22 12.28 18.6 15.36 13.45 20.03L12 21.35Z"
                    fill={isBookmarked ? '#FF3B30' : '#D9D9D9'}
                  />
                </svg>
              </button>

              <div className={styles.likeBadge}>
                <span className={styles.likeCount}>
                  {postData.voteSummary.likeCount.toLocaleString()}
                </span>
              </div>
            </div>
          </div>

          <div className={styles.authorRow}>
            <p className={styles.author}>작성자: {postData.author.nickname}</p>

            <button
              type="button"
              className={styles.feedMoveBtn}
              onClick={handleGoToUserFeed}
            >
              <span>피드보러가기</span>
              <span className={styles.feedMoveIcon}>&gt;&gt;</span>
            </button>
          </div>

          <div className={styles.divider} />

          <h3 className={styles.subTitle}>착용 아이템</h3>
          <div className={styles.itemScroll}>
            {postData.outfitItems.map((item) => (
              <div key={item.id} className={styles.outfitCard}>
                <div className={styles.itemImg} />
                <p className={styles.brandName}>{item.brand || item.category}</p>
                <p className={styles.itemName}>{item.itemName || '아이템명 없음'}</p>
              </div>
            ))}
          </div>
        </div>
      </motion.div>
    </div>
  );
};

export default RankingDetail;