import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import type { GetRankingsResponse, LogoutResponse, RankingItem } from '@codinator/contracts';
import Footer from '../../components/Footer';
import { DUMMY_RANKINGS } from '../../data/dummy';
import { clearAuthTokens, fetcher, getAuthHeaders, getRefreshToken } from '../../lib/api';
import styles from './RankingZone.module.css';

const FALLBACK_RANKINGS: RankingItem[] = DUMMY_RANKINGS.map((item, index) => ({
  rank: index + 1,
  postId: Number(item.id),
  thumbnailUrl: item.imageUrl,
  likeCount: item.likeCount,
  dislikeCount: 0,
  totalCount: item.likeCount,
  likeRate: 100,
}));

const RankingZone: React.FC = () => {
  const navigate = useNavigate();
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [rankings, setRankings] = useState<RankingItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadRankings = async () => {
      try {
        setLoading(true);
        const data = await fetcher<GetRankingsResponse>('/rankings?period=WEEKLY', {
          headers: getAuthHeaders(),
        });

        if (Array.isArray(data.items) && data.items.length > 0) {
          setRankings(data.items);
        } else {
          setRankings(FALLBACK_RANKINGS);
        }
      } catch (err) {
        console.error('랭킹 조회 실패:', err);
        setRankings(FALLBACK_RANKINGS);
      } finally {
        setLoading(false);
      }
    };

    loadRankings();
  }, []);

  const rankingSections = useMemo(
    () => [
      { id: 'week', title: 'this week', items: rankings },
      { id: 'month', title: 'this month', items: FALLBACK_RANKINGS },
      { id: 'weather', title: 'this weather', items: FALLBACK_RANKINGS },
    ],
    [rankings],
  );

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
        ) : (
          rankingSections.map((section) => (
            <section key={section.id} className={styles.section}>
              <div className={styles.sectionHeader}>
                <h2 className={styles.sectionTitle}>{section.title}</h2>
                <div className={styles.moreBtn}>
                  <span>더보기</span>
                  <svg width="14" height="13" viewBox="0 0 14 13" fill="none">
                    <path
                      d="M5.87 10.13L5.11 9.37L7.98 6.5L5.11 3.63L5.88 2.87L8.75 5.73C8.95 5.94 9.06 6.21 9.06 6.5C9.06 6.79 8.95 7.06 8.75 7.27L5.87 10.13Z"
                      fill="#767676"
                    />
                  </svg>
                </div>
              </div>

              <div className={styles.horizontalScroll}>
                {section.items.map((post) => (
                  <div
                    key={`${section.id}-${post.postId}`}
                    className={styles.card}
                    onClick={() => navigate(`/ranking-detail/${post.postId}`)}
                    style={{
                      backgroundImage: `url(${post.thumbnailUrl})`,
                      backgroundSize: 'cover',
                      backgroundPosition: 'center',
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
