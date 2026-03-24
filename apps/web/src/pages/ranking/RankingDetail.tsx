import React, { useEffect, useMemo, useState } from 'react';
import { motion, type PanInfo, useAnimation } from 'framer-motion';
import { useNavigate, useParams } from 'react-router-dom';
import type { GetRankingPostDetailResponse, RankingPostDetail } from '@codinator/contracts';
import { DUMMY_RANKINGS } from '../../data/dummy';
import { fetcher, getAuthHeaders } from '../../lib/api';
import styles from './RankingDetail.module.css';

const makeFallbackPost = (postId?: string): RankingPostDetail => {
  const matched =
    DUMMY_RANKINGS.find((item) => item.id === postId) ??
    DUMMY_RANKINGS.find((item) => item.id === '1') ??
    DUMMY_RANKINGS[0];

  return {
    postId: Number(matched.id),
    content: matched.content,
    status: 'ACTIVE',
    createdAt: new Date().toISOString(),
    image: {
      id: Number(matched.id),
      imageUrl: matched.imageUrl,
    },
    outfitItems: matched.outfitItems.map((item, index) => ({
      id: index + 1,
      category: 'TOP',
      itemName: item.itemName,
      brand: item.brand,
    })),
    author: {
      userId: 1,
      nickname: matched.user.nickname,
    },
    evaluation: {
      id: 1,
      status: 'OPEN',
      endsAt: new Date().toISOString(),
    },
    hasVoted: false,
    canVote: false,
    voteSummary: {
      likeCount: matched.likeCount,
      dislikeCount: 0,
      totalCount: matched.likeCount,
      likeRate: 100,
    },
    feedbackSummary: [],
    ranking: {
      period: 'WEEKLY',
      rank: Number(matched.id),
      startDate: new Date().toISOString(),
      endDate: new Date().toISOString(),
    },
  };
};

const RankingDetail: React.FC = () => {
  const { postId } = useParams();
  const navigate = useNavigate();
  const controls = useAnimation();

  const [postData, setPostData] = useState<RankingPostDetail | null>(null);
  const [isExpanded, setIsExpanded] = useState(false);
  const [loading, setLoading] = useState(true);

  const COLLAPSED_Y = 740;
  const EXPANDED_Y = 350;

  useEffect(() => {
    const loadDetail = async () => {
      try {
        setLoading(true);
        const data = await fetcher<GetRankingPostDetailResponse>(`/rankings/posts/${postId}?period=WEEKLY`, {
          headers: getAuthHeaders(),
        });
        setPostData(data);
      } catch (err) {
        console.error('랭킹 상세 조회 실패:', err);
        setPostData(makeFallbackPost(postId));
      } finally {
        setLoading(false);
        controls.start({ y: COLLAPSED_Y });
      }
    };

    if (postId) {
      loadDetail();
    } else {
      setPostData(makeFallbackPost());
      setLoading(false);
      controls.start({ y: COLLAPSED_Y });
    }
  }, [postId, controls]);

  const displayData = useMemo(() => postData ?? makeFallbackPost(postId), [postData, postId]);

  const onDragEnd = (_event: MouseEvent | TouchEvent | PointerEvent, info: PanInfo) => {
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
    controls.start({ y: EXPANDED_Y, transition: { type: 'spring', stiffness: 300, damping: 30 } });
  };

  const collapseSheet = () => {
    setIsExpanded(false);
    controls.start({ y: COLLAPSED_Y, transition: { type: 'spring', stiffness: 300, damping: 30 } });
  };

  if (loading) return <div className={styles.loading}>데이터 로드 중...</div>;

  return (
    <div className={styles.container}>
      <div className={styles.imageSection}>
        <div className={styles.mainImage} style={{ backgroundImage: `url(${displayData.image.imageUrl})` }} />
        <div className={styles.topGradient} />
        <div className={styles.bottomGradient} />
      </div>

      <div className={styles.headerTitle}>this week</div>
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
        <div className={styles.handlerArea} onClick={() => (isExpanded ? collapseSheet() : expandSheet())}>
          <div className={styles.handlerBar} />
        </div>

        <div className={`${styles.sheetContent} ${isExpanded ? styles.scroll : styles.noScroll}`}>
          <div className={styles.infoRow}>
            <div>
              <h2 className={styles.title}>{displayData.content}</h2>
              <p className={styles.author}>작성자: {displayData.author.nickname}</p>
            </div>
            <div className={styles.likeBadge}>
              <span className={styles.likeCount}>{displayData.voteSummary.likeCount.toLocaleString()}</span>
            </div>
          </div>

          <div className={styles.divider} />

          <h3 className={styles.subTitle}>착용 아이템</h3>
          <div className={styles.itemScroll}>
            {displayData.outfitItems.map((item) => (
              <div key={item.id} className={styles.outfitCard}>
                <div className={styles.itemImg} />
                <p className={styles.brandName}>{item.brand ?? '브랜드 미정'}</p>
                <p className={styles.itemName}>{item.itemName ?? '아이템 정보 없음'}</p>
              </div>
            ))}
          </div>
        </div>
      </motion.div>
    </div>
  );
};

export default RankingDetail;
