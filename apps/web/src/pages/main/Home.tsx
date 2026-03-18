import React, { useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import styles from './main.module.css';
import Footer from '../../components/Footer';

export default function Home() {
  const navigate = useNavigate();
  const carouselRef = useRef<HTMLDivElement>(null);
  
  const [activeTab, setActiveTab] = useState<'month' | 'year'>('month');
  const [scrollProgress, setScrollProgress] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const [startX, setStartX] = useState(0);
  const [startScrollLeft, setStartScrollLeft] = useState(0);

  const handleScroll = () => {
    if (!carouselRef.current) return;
    const { scrollLeft, scrollWidth, clientWidth } = carouselRef.current;
    const maxScroll = scrollWidth - clientWidth;
    const progress = maxScroll > 0 ? (scrollLeft / maxScroll) * 100 : 0;
    setScrollProgress(progress);
  };

  const handleRangeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newProgress = Number(e.target.value);
    setScrollProgress(newProgress);
    if (carouselRef.current) {
      const { scrollWidth, clientWidth } = carouselRef.current;
      const maxScroll = scrollWidth - clientWidth;
      carouselRef.current.scrollLeft = (newProgress / 100) * maxScroll;
    }
  };

  const onMouseDown = (e: React.MouseEvent) => {
    if (!carouselRef.current) return;
    setIsDragging(true);
    setStartX(e.pageX - carouselRef.current.offsetLeft);
    setStartScrollLeft(carouselRef.current.scrollLeft);
  };

  const onMouseMove = (e: React.MouseEvent) => {
    if (!isDragging || !carouselRef.current) return;
    e.preventDefault();
    const x = e.pageX - carouselRef.current.offsetLeft;
    const walk = (x - startX) * 1.5;
    carouselRef.current.scrollLeft = startScrollLeft - walk;
  };

  const onMouseUpOrLeave = () => setIsDragging(false);

  return (
    <div className={styles.container}>
      <div className={styles.mobileWrapper}>
        
        {/* 상단 아이콘 */}
        <div className={styles.searchIcon}>
          <div style={{ width: 24.03, height: 24.03, left: -0.03, top: -0.03, position: 'absolute', background: '#374957' }} />
        </div>
        <div className={styles.menuIcon}>
          <div style={{ width: 24, height: 2, left: 0, top: 11, position: 'absolute', background: '#374957' }} />
          <div style={{ width: 24, height: 2, left: 0, top: 4, position: 'absolute', background: '#374957' }} />
          <div style={{ width: 24, height: 2, left: 0, top: 18, position: 'absolute', background: '#374957' }} />
        </div>

        {/* 슬라이딩 토글 버튼 */}
        <div className={styles.toggleContainer}>
          <div className={`${styles.toggleIndicator} ${activeTab === 'month' ? styles.indicatorMonth : styles.indicatorYear}`} />
          <div className={styles.tabButton} onClick={() => setActiveTab('month')}>이달의 랭킹</div>
          <div className={styles.tabButton} onClick={() => setActiveTab('year')}>올해의 랭킹</div>
        </div>

        {/* 랭킹 캐러셀 */}
        <div 
          className={styles.carouselContainer}
          ref={carouselRef}
          onScroll={handleScroll}
          onMouseDown={onMouseDown}
          onMouseMove={onMouseMove}
          onMouseUp={onMouseUpOrLeave}
          onMouseLeave={onMouseUpOrLeave}
        >
          {[1, 2, 3].map((id) => (
            <div key={id} className={styles.cardWrapper} onClick={() => navigate('/ranking')} style={{ cursor: 'pointer' }}>
              <div className={styles.cardBg} />
              <div className={styles.profileCircle} />
              <div className={styles.crownIconWrap}><div className={styles.crownIconFill} /></div>
            </div>
          ))}
        </div>

        {/* 스크롤바 & 구분선 */}
        <input type="range" min="0" max="100" value={scrollProgress} onChange={handleRangeChange} className={styles.customScrollbar} />
        <div className={styles.divider} />
        <div className={styles.darkBanner} />

        {/* 카테고리 (절대 좌표) */}
        <div className={`${styles.categoryBox} ${styles.cat1}`} />
        <div className={`${styles.categoryText} ${styles.catText1}`}>카테고리-1</div>
        <div className={`${styles.categoryBox} ${styles.cat2}`} />
        <div className={`${styles.categoryText} ${styles.catText2}`}>카테고리-2</div>
        <div className={`${styles.categoryBox} ${styles.cat3}`} />
        <div className={`${styles.categoryText} ${styles.catText3}`}>카테고리-3</div>

        {/* ⭐️ 중요: absolute 요소들의 높이를 잡아주는 가상 공간 */}
        <div className={styles.scrollSpacer} />

        {/* ⭐️ 푸터 적용 */}
        <Footer />
      </div>
    </div>
  );
}