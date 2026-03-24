import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import styles from './RankingZone.module.css';
import Footer from '../../components/Footer';
import {
  fetcher,
  getAuthHeaders,
  getRefreshToken,
  clearAuthTokens,
} from '../../lib/api';
import type { GetRankingsResponse, LogoutResponse, RankingItem } from '@codinator/contracts';

type RankingSection = {
  id: string;
  title: string;
  period: 'WEEKLY' | 'MONTHLY';
  items: RankingItem[];
};

const RankingZone: React.FC = () => {
  const navigate = useNavigate();

  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [weeklyRankings, setWeeklyRankings] = useState<RankingItem[]>([]);
  const [monthlyRankings, setMonthlyRankings] = useState<RankingItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    const loadRankings = async () => {
      try {
        setLoading(true);
        setError('');

        const [weeklyData, monthlyData] = await Promise.all([
          fetcher<GetRankingsResponse>('/rankings?period=WEEKLY', {
            headers: getAuthHeaders(),
          }),
          fetcher<GetRankingsResponse>('/rankings?period=MONTHLY', {
            headers: getAuthHeaders(),
          }),
        ]);

        setWeeklyRankings(weeklyData.items ?? []);
        setMonthlyRankings(monthlyData.items ?? []);
      } catch (err) {
        console.error('랭킹 불러오기 실패:', err);

        const message =
          err instanceof Error ? err.message : '랭킹 데이터를 불러오지 못했습니다.';
        setError(message);

        if (message.includes('Unauthorized') || message.includes('로그인이 필요합니다')) {
          clearAuthTokens();
          navigate('/login');
          return;
        }

        setWeeklyRankings([]);
        setMonthlyRankings([]);
      } finally {
        setLoading(false);
      }
    };

    loadRankings();
  }, [navigate]);

  const handleLogout = async () => {
    if (!window.confirm('로그아웃 하시겠습니까?')) return;

    try {
      const refreshToken = getRefreshToken();

      if (refreshToken) {
        await fetcher<LogoutResponse>('/auth/logout', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ refreshToken }),
        });
      }
    } catch (err) {
      console.error('로그아웃 요청 실패:', err);
    } finally {
      clearAuthTokens();
      navigate('/login');
    }
  };

  const sections: RankingSection[] = [
    { id: 'week', title: 'This Week', period: 'WEEKLY', items: weeklyRankings },
    { id: 'month', title: 'This Month', period: 'MONTHLY', items: monthlyRankings },
  ];

  return (
    <div className={styles.container}>
      <div className={`${styles.drawer} ${isMenuOpen ? styles.drawerOpen : ''}`}>
        <div className={styles.drawerHeader}>
          <div className={styles.profileSection}>
            <div className={styles.profileCircle} />
            <span className={styles.profileName}>내 프로필</span>
          </div>
          <button className={styles.closeBtn} onClick={() => setIsMenuOpen(false)}>
            ✕
          </button>
        </div>

        <nav className={styles.drawerNav}>
          <div className={styles.navItem} onClick={() => navigate('/post/write')}>
            게시글 작성
          </div>
          <div className={styles.navItem} onClick={() => navigate('/vote')}>
            평가 존
          </div>
          <div className={`${styles.navItem} ${styles.logoutBtn}`} onClick={handleLogout}>
            로그아웃
          </div>
        </nav>
      </div>

      {isMenuOpen && <div className={styles.overlay} onClick={() => setIsMenuOpen(false)} />}

      <div className={styles.contentArea}>
        <header className={styles.header}>
          <div className={styles.logo}>C:dinator</div>
          <button className={styles.menuBtn} onClick={() => setIsMenuOpen(true)}>
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
              <path d="M24 11H0V13H24V11Z" fill="black" />
              <path d="M24 4H0V6H24V4Z" fill="black" />
              <path d="M24 18H0V20H24V18Z" fill="black" />
            </svg>
          </button>
        </header>

        <div className={styles.divider} />

        {loading ? (
          <div className={styles.loadingBox}>데이터 불러오는 중...</div>
        ) : error ? (
          <div className={styles.loadingBox}>{error}</div>
        ) : (
          sections.map((section) => (
            <section key={section.id} className={styles.section}>
              <div className={styles.sectionHeader}>
                <h2 className={styles.sectionTitle}>{section.title}</h2>
              </div>

              <div className={styles.horizontalScroll}>
                {section.items.length > 0 ? (
                  section.items.map((post) => (
                    <div
                      key={`${section.period}-${post.postId}`}
                      className={styles.card}
                      onClick={() =>
                        navigate(`/ranking-detail/${post.postId}?period=${section.period}`)
                      }
                      style={{
                        backgroundImage: `url(${post.thumbnailUrl})`,
                        backgroundSize: 'cover',
                        backgroundPosition: 'center',
                        backgroundRepeat: 'no-repeat',
                      }}
                    >
                      <div className={styles.heartIcon}>
                        <svg width="24" height="24" viewBox="0 0 29 27" fill="none">
                          <path
                            d="M20.42 0C19.11 0.02 17.82 0.39 16.7 1.06C15.57 1.74 14.64 2.7 14.01 3.85C13.37 2.7 12.44 1.74 11.31 1.06C10.19 0.39 8.9 0.02 7.59 0C5.49 0.09 3.52 1.01 2.1 2.55C0.68 4.09 -0.07 6.13 0.01 8.23C0.01 16.13 12.79 25.26 13.33 25.65L14.01 26.12L14.68 25.65C15.22 25.26 28.01 16.12 28.01 8.23Z"
                            fill="white"
                            fillOpacity="0.5"
                          />
                        </svg>
                      </div>
                    </div>
                  ))
                ) : (
                  <div className={styles.loadingBox}>표시할 랭킹이 없습니다.</div>
                )}
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