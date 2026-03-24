import React, { useEffect, useState } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import styles from './RankingDetail.module.css';
import { motion, useAnimation, PanInfo } from 'framer-motion';
import { fetcher, getAuthHeaders, clearAuthTokens } from '../../lib/api';
import type { GetRankingPostDetailResponse } from '@codinator/contracts';

const RankingDetail: React.FC = () => {
  const { postId } = useParams();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const controls = useAnimation();

  const [postData, setPostData] = useState<GetRankingPostDetailResponse | null>(null);
  const [isExpanded, setIsExpanded] = useState(false);
  const [loading, setLoading] = useState(true);

  const COLLAPSED_Y = 740;
  const EXPANDED_Y = 350;

  const period = searchParams.get('period') === 'MONTHLY' ? 'MONTHLY' : 'WEEKLY';

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

        const message =
          err instanceof Error ? err.message : '상세 데이터를 불러오지 못했습니다.';

        if (message.includes('Unauthorized') || message.includes('로그인이 필요합니다')) {
          clearAuthTokens();
          navigate('/login');
          return;
        }

        setPostData(null);
      } finally {
        setLoading(false);
        controls.start({ y: COLLAPSED_Y });
      }
    };

    if (postId) {
      loadDetail();
    } else {
      setLoading(false);
      setPostData(null);
    }
  }, [postId, period, navigate, controls]);

  const onDragEnd = (_: unknown, info: PanInfo) => {
    const isDraggingUp = info.offset.y < -50 || info.velocity.y < -500;
    const isDraggingDown = info.offset.y > 50 || info.velocity.y > 500;

    if (!isExpanded && isDraggingUp) {
      expandSheet();
    } else if (isExpanded && isDraggingDown) {
      collapseSheet();
    } else {
      controls.start({ y: isExpanded ? EXPANDED_Y : COLLAPSED_Y });
    }
  };

  const expandSheet = () => {
    setIsExpanded(true);
    controls.start({
      y: EXPANDED_Y,
      transition: { type: 'spring', stiffness: 300, damping: 30 },
    });
  };

  const collapseSheet = () => {
    setIsExpanded(false);
    controls.start({
      y: COLLAPSED_Y,
      transition: { type: 'spring', stiffness: 300, damping: 30 },
    });
  };

  if (loading) return <div className={styles.loading}>데이터 로드 중...</div>;
  if (!postData) return <div className={styles.loading}>게시글을 불러올 수 없습니다.</div>;

  return (
    <div className={styles.container}>
      <div className={styles.imageSection}>
        <div
          className={styles.mainImage}
          style={{
            backgroundImage: `url(${postData.image.imageUrl})`,
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

      <motion.div
        className={styles.bottomSheet}
        drag="y"
        dragConstraints={{ top: EXPANDED_Y, bottom: COLLAPSED_Y }}
        dragElastic={0}
        initial={{ y: COLLAPSED_Y }}
        animate={controls}
        onDragEnd={onDragEnd}
      >
        <div
          className={styles.handlerArea}
          onClick={() => (isExpanded ? collapseSheet() : expandSheet())}
        >
          <div className={styles.handlerBar} />
        </div>

        <div className={`${styles.sheetContent} ${isExpanded ? styles.scroll : styles.noScroll}`}>
          <div className={styles.infoRow}>
            <div>
              <h2 className={styles.title}>{postData.content}</h2>
              <p className={styles.author}>작성자: {postData.author.nickname}</p>
            </div>

            <div className={styles.likeBadge}>
              <span className={styles.likeCount}>
                {postData.voteSummary.likeCount.toLocaleString()}
              </span>
            </div>
          </div>

          <div className={styles.divider} />

          <h3 className={styles.subTitle}>착용 아이템</h3>
          <div className={styles.itemScroll}>
            {postData.outfitItems.map((item, idx) => (
              <div key={idx} className={styles.outfitCard}>
                <div className={styles.itemImg} />
                <p className={styles.brandName}>{item.brand}</p>
                <p className={styles.itemName}>{item.itemName}</p>
              </div>
            ))}
          </div>
        </div>
      </motion.div>
    </div>
  );
};

export default RankingDetail;