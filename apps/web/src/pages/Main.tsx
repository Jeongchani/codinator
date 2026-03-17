// src/pages/Main.tsx
import React, { useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom'; // 🌟 페이지 이동을 위한 훅 불러오기
import styles from './main.module.css';

export default function Main() {
  const navigate = useNavigate(); // 🌟 네비게이트 함수 초기화
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
        
        {/* 상단 돋보기 아이콘 */}
        <div className={styles.searchIcon}>
          <div style={{ width: 24.03, height: 24.03, left: -0.03, top: -0.03, position: 'absolute', background: '#374957' }} />
        </div>
        
        {/* 상단 햄버거 메뉴 아이콘 */}
        <div className={styles.menuIcon}>
          <div style={{ width: 24, height: 2, left: 0, top: 11, position: 'absolute', background: '#374957' }} />
          <div style={{ width: 24, height: 2, left: 0, top: 4, position: 'absolute', background: '#374957' }} />
          <div style={{ width: 24, height: 2, left: 0, top: 18, position: 'absolute', background: '#374957' }} />
        </div>

        {/* 완벽한 비율의 슬라이딩 토글 버튼 */}
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
          {/* 🌟 랭킹 카드 1 (클릭 시 프로필 화면으로 이동) */}
          <div 
            className={styles.cardWrapper} 
            onClick={() => navigate('/profile')} 
            style={{ cursor: 'pointer' }}
          >
            <div className={styles.cardBg} />
            <div className={styles.profileCircle} />
            <div className={styles.crownIconWrap}><div className={styles.crownIconFill} /></div>
          </div>

          {/* 🌟 랭킹 카드 2 (클릭 시 프로필 화면으로 이동) */}
          <div 
            className={styles.cardWrapper} 
            onClick={() => navigate('/profile')} 
            style={{ cursor: 'pointer' }}
          >
            <div className={styles.cardBg} />
            <div className={styles.profileCircle} />
            <div className={styles.crownIconWrap}><div className={styles.crownIconFill} /></div>
          </div>

          {/* 🌟 랭킹 카드 3 (클릭 시 프로필 화면으로 이동) */}
          <div 
            className={styles.cardWrapper} 
            onClick={() => navigate('/profile')} 
            style={{ cursor: 'pointer' }}
          >
            <div className={styles.cardBg} />
            <div className={styles.profileCircle} />
            <div className={styles.crownIconWrap}><div className={styles.crownIconFill} /></div>
          </div>
        </div>

        {/* 진행 상태 스크롤바 */}
        <input 
          type="range" 
          min="0" 
          max="100" 
          value={scrollProgress} 
          onChange={handleRangeChange}
          className={styles.customScrollbar} 
        />
        
        <div className={styles.divider} />

        <div className={styles.darkBanner} />

        {/* 카테고리 1 (이미지 자리) */}
        <div className={`${styles.categoryBox} ${styles.cat1}`} />
        <div className={`${styles.categoryText} ${styles.catText1}`}>카테고리-1</div>

        {/* 카테고리 2 (이미지 자리) */}
        <div className={`${styles.categoryBox} ${styles.cat2}`} />
        <div className={`${styles.categoryText} ${styles.catText2}`}>카테고리-2</div>

        {/* 카테고리 3 (이미지 자리) */}
        <div className={`${styles.categoryBox} ${styles.cat3}`} />
        <div className={`${styles.categoryText} ${styles.catText3}`}>카테고리-3</div>

        {/* 하단 네비게이션 바 */}
        <div className={styles.bottomNav}>
          <div className={styles.navIconWrap}>
            <div style={{ width: 39, height: 3.25, left: 0, top: 17.88, position: 'absolute', background: '#374957' }} />
            <div style={{ width: 39, height: 3.25, left: 0, top: 6.5, position: 'absolute', background: '#374957' }} />
            <div style={{ width: 39, height: 3.25, left: 0, top: 29.25, position: 'absolute', background: '#374957' }} />
          </div>
          <div className={styles.navIconCenterWrap}>
            <div style={{ width: 11.25, height: 18.8, left: 16.88, top: 26.25, position: 'absolute', background: '#374957' }} />
            <div style={{ width: 45, height: 44.46, left: 0, top: 0.6, position: 'absolute', background: '#374957' }} />
          </div>
          <div className={styles.navIconWrap}>
            <div style={{ width: 6.5, height: 6.5, left: 16.25, top: 0, position: 'absolute', background: '#374957' }} />
            <div style={{ width: 6.5, height: 6.5, left: 16.25, top: 16.25, position: 'absolute', background: '#374957' }} />
            <div style={{ width: 6.5, height: 6.5, left: 16.25, top: 32.5, position: 'absolute', background: '#374957' }} />
          </div>
        </div>

      </div>
    </div>
  );
}