import React, { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import styles from './RankingDetail.module.css';
import { motion, useAnimation, PanInfo } from 'framer-motion';
import { fetcher } from '../../lib/api';
import { DUMMY_RANKINGS } from '../../data/dummy';

const RankingDetail: React.FC = () => {
  const { postId } = useParams();
  const navigate = useNavigate();
  
  // 🔴 Framer Motion 애니메이션 컨트롤러
  const controls = useAnimation();
  
  const [postData, setPostData] = useState<any>(null);
  const [isExpanded, setIsExpanded] = useState(false);
  const [loading, setLoading] = useState(true);

  // 🔴 y축 좌표 설정 (top: 0 기준으로 얼마나 내려가 있을지 결정)
  const COLLAPSED_Y = 740; // 닫혀있을 때 (아래쪽에 살짝 보임)
  const EXPANDED_Y = 350;  // 열려있을 때 (화면 중간까지 올라옴)

  useEffect(() => {
    const loadDetail = async () => {
      try {
        setLoading(true);
        const data = await fetcher<any>(`/rankings/posts/${postId}?period=WEEKLY`);
        if (data) {
          setPostData(data);
        } else {
          const dummy = DUMMY_RANKINGS.find(item => item.id === postId);
          setPostData(dummy || DUMMY_RANKINGS[0]);
        }
      } catch (err) {
        const dummy = DUMMY_RANKINGS.find(item => item.id === postId);
        setPostData(dummy || DUMMY_RANKINGS[0]);
      } finally {
        setLoading(false);
        // 초기 로딩 시 바텀 시트를 닫힌 위치로 설정
        controls.start({ y: COLLAPSED_Y });
      }
    };
    if (postId) loadDetail();
  }, [postId, controls]);

  // 🔴 드래그 끝났을 때 위치 판정
  const onDragEnd = (_: any, info: PanInfo) => {
    // 사용자가 드래그한 거리(offset.y)와 속도(velocity.y)를 계산
    const isDraggingUp = info.offset.y < -50 || info.velocity.y < -500;
    const isDraggingDown = info.offset.y > 50 || info.velocity.y > 500;

    if (!isExpanded && isDraggingUp) {
      expandSheet(); // 위로 확 끌어올렸을 때
    } else if (isExpanded && isDraggingDown) {
      collapseSheet(); // 아래로 확 내렸을 때
    } else {
      // 어중간하게 끌다 말았을 때는 원래 위치로 튕겨 돌아가기
      controls.start({ y: isExpanded ? EXPANDED_Y : COLLAPSED_Y });
    }
  };

  const expandSheet = () => {
    setIsExpanded(true);
    // top이 아니라 y를 변경합니다.
    controls.start({ y: EXPANDED_Y, transition: { type: 'spring', stiffness: 300, damping: 30 } });
  };

  const collapseSheet = () => {
    setIsExpanded(false);
    // top이 아니라 y를 변경합니다.
    controls.start({ y: COLLAPSED_Y, transition: { type: 'spring', stiffness: 300, damping: 30 } });
  };

  if (loading) return <div className={styles.loading}>데이터 로드 중...</div>;

  return (
    <div className={styles.container}>
      {/* 1. 배경 이미지 */}
      <div className={styles.imageSection}>
        <div className={styles.mainImage} style={{ backgroundImage: `url(${postData?.imageUrl})` }} />
        <div className={styles.topGradient} />
        <div className={styles.bottomGradient} />
      </div>

      <div className={styles.headerTitle}>this week</div>
      <button onClick={() => navigate(-1)} className={styles.closeBtn}>
        <svg width="36" height="36" viewBox="0 0 36 36" fill="none">
          <path d="M28.06 10.06L25.94 7.94L18 15.88L10.06 7.94L7.94 10.06L15.88 18L7.94 25.94L10.06 28.06L18 20.12L25.94 28.06L28.06 25.94L20.12 18L28.06 10.06Z" fill="white"/>
        </svg>
      </button>

      {/* 2. 바텀 시트 (드래그 영역) */}
      <motion.div 
        className={styles.bottomSheet}
        // 🔴 드래그 핵심 설정
        drag="y"
        dragConstraints={{ top: EXPANDED_Y, bottom: COLLAPSED_Y }}
        dragElastic={0} // 위로 딸려올라가는 고무줄 현상 완벽 제거 (0)
        initial={{ y: COLLAPSED_Y }}
        animate={controls}
        onDragEnd={onDragEnd}
      >
        {/* 핸들러 영역 (클릭으로도 열리게 유지) */}
        <div className={styles.handlerArea} onClick={() => isExpanded ? collapseSheet() : expandSheet()}>
          <div className={styles.handlerBar} />
        </div>

        {/* 내부 콘텐츠 영역 */}
        <div className={`${styles.sheetContent} ${isExpanded ? styles.scroll : styles.noScroll}`}>
          <div className={styles.infoRow}>
            <div>
              <h2 className={styles.title}>{postData?.content}</h2>
              <p className={styles.author}>작성자: {postData?.user?.nickname}</p>
            </div>
            <div className={styles.likeBadge}>
              <span className={styles.likeCount}>{postData?.likeCount?.toLocaleString()}</span>
            </div>
          </div>

          <div className={styles.divider} />
          
          <h3 className={styles.subTitle}>착용 아이템</h3>
          <div className={styles.itemScroll}>
            {postData?.outfitItems?.map((item: any, idx: number) => (
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