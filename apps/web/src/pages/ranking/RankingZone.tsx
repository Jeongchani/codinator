import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import styles from './RankingZone.module.css';
import Footer from '../../components/Footer';
import { fetcher } from '../../lib/api';
import type { LogoutResponse } from '@codinator/contracts';
// 🔴 분리한 더미 데이터 임포트
import { DUMMY_RANKINGS } from '../../data/dummy'; 

const RankingZone: React.FC = () => {
  const navigate = useNavigate();
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [rankings, setRankings] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadRankings = async () => {
      try {
        setLoading(true);
        const data = await fetcher<any[]>('/rankings?period=WEEKLY');
        if (data && data.length > 0) {
          setRankings(data);
        } else {
          setRankings(DUMMY_RANKINGS);
        }
      } catch (err) {
        setRankings(DUMMY_RANKINGS);
      } finally {
        setLoading(false);
      }
    };
    loadRankings();
  }, []);

  const handleLogout = async () => {
    if (!window.confirm("로그아웃 하시겠습니까?")) return;
    try {
      const refreshToken = localStorage.getItem('refreshToken');
      if (refreshToken) {
        await fetcher<LogoutResponse>('/auth/logout', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ refreshToken }),
        });
      }
      localStorage.removeItem('token');
      localStorage.removeItem('refreshToken');
      navigate('/login');
    } catch (err) {
      localStorage.removeItem('token');
      navigate('/login');
    }
  };

  const sections = [
    { id: 'week', title: 'this week' },
    { id: 'month', title: 'this month' },
    { id: 'weather', title: 'this weather' },
  ];

  return (
    <div className={styles.container}>
      {/* 사이드 드로어 */}
      <div className={`${styles.drawer} ${isMenuOpen ? styles.drawerOpen : ''}`}>
        <div className={styles.drawerHeader}>
          <div className={styles.profileSection}>
            <div className={styles.profileCircle} />
            <span className={styles.profileName}>내 프로필</span>
          </div>
          <button className={styles.closeBtn} onClick={() => setIsMenuOpen(false)}>✕</button>
        </div>
        <nav className={styles.drawerNav}>
          <div className={styles.navItem} onClick={() => navigate('/post/write')}>게시글 작성</div>
          <div className={styles.navItem} onClick={() => navigate('/vote')}>평가 존</div>
          <div className={`${styles.navItem} ${styles.logoutBtn}`} onClick={handleLogout}>로그아웃</div>
        </nav>
      </div>

      {isMenuOpen && <div className={styles.overlay} onClick={() => setIsMenuOpen(false)} />}

      <div className={styles.contentArea}>
        <header className={styles.header}>
          <div className={styles.logo}>C:dinator</div>
          <button className={styles.menuBtn} onClick={() => setIsMenuOpen(true)}>
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
              <path d="M24 11H0V13H24V11Z" fill="black"/><path d="M24 4H0V6H24V4Z" fill="black"/><path d="M24 18H0V20H24V18Z" fill="black"/>
            </svg>
          </button>
        </header>

        <div className={styles.divider} />

        {loading ? (
          <div className={styles.loadingBox}>데이터 불러오는 중...</div>
        ) : (
          sections.map((section) => (
            <section key={section.id} className={styles.section}>
              <div className={styles.sectionHeader}>
                <h2 className={styles.sectionTitle}>{section.title}</h2>
                <div className={styles.moreBtn}>
                  <span>더보기</span>
                  <svg width="14" height="13" viewBox="0 0 14 13" fill="none">
                    <path d="M5.87 10.13L5.11 9.37L7.98 6.5L5.11 3.63L5.88 2.87L8.75 5.73C8.95 5.94 9.06 6.21 9.06 6.5C9.06 6.79 8.95 7.06 8.75 7.27L5.87 10.13Z" fill="#767676"/>
                  </svg>
                </div>
              </div>

              <div className={styles.horizontalScroll}>
                {rankings.map((post) => (
                  <div 
                    key={post.id} 
                    className={styles.card} 
                    onClick={() => navigate(`/ranking-detail/${post.id}`)}
                    style={{ backgroundImage: `url(${post.imageUrl})`, backgroundSize: 'cover', backgroundPosition: 'center' }}
                  >
                    <div className={styles.heartIcon}>
                      <svg width="24" height="24" viewBox="0 0 29 27" fill="none">
                        <path d="M20.42 0C19.11 0.02 17.82 0.39 16.7 1.06C15.57 1.74 14.64 2.7 14.01 3.85C13.37 2.7 12.44 1.74 11.31 1.06C10.19 0.39 8.9 0.02 7.59 0C5.49 0.09 3.52 1.01 2.1 2.55C0.68 4.09 -0.07 6.13 0.01 8.23C0.01 16.13 12.79 25.26 13.33 25.65L14.01 26.12L14.68 25.65C15.22 25.26 28.01 16.12 28.01 8.23Z" fill="white" fillOpacity="0.5"/>
                      </svg>
                    </div>
                  </div>
                ))}
              </div>
            </section>
          ))
        )}
      </div>
      <Footer />
    </div>
  );
};

export default RankingZone;