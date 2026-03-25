import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import styles from './RankingZone.module.css';
import Footer from '../../components/Footer';
import {
  clearAuthTokens,
  fetcher,
  getAuthHeaders,
  getRefreshToken,
  resolveAssetUrl,
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

  const [bookmarks, setBookmarks] = useState<Record<string, boolean>>(() => {
    const saved = localStorage.getItem('codinator_bookmarks');
    return saved ? (JSON.parse(saved) as Record<string, boolean>) : {};
  });

  useEffect(() => {
    const syncBookmarks = () => {
      const saved = localStorage.getItem('codinator_bookmarks');
      setBookmarks(saved ? (JSON.parse(saved) as Record<string, boolean>) : {});
    };

    syncBookmarks();
    window.addEventListener('storage', syncBookmarks);

    return () => {
      window.removeEventListener('storage', syncBookmarks);
    };
  }, []);

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

        if (
          message.includes('Unauthorized') ||
          message.includes('유효하지 않거나 만료된 토큰') ||
          message.includes('로그인이 필요합니다')
        ) {
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

    void loadRankings();
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

  const toggleBookmark = (e: React.MouseEvent, postId: string) => {
    e.stopPropagation();

    setBookmarks((prev) => {
      const next = { ...prev, [postId]: !prev[postId] };
      localStorage.setItem('codinator_bookmarks', JSON.stringify(next));
      return next;
    });
  };

  const sections: RankingSection[] = useMemo(
    () => [
      { id: 'week', title: 'This Week', period: 'WEEKLY', items: weeklyRankings },
      { id: 'month', title: 'This Month', period: 'MONTHLY', items: monthlyRankings },
    ],
    [weeklyRankings, monthlyRankings],
  );

  return (
    <div className={styles.container}>
      <div className={`${styles.drawer} ${isMenuOpen ? styles.drawerOpen : ''}`}>
        <div className={styles.drawerHeader}>
          <div className={styles.profileSection}>
            <div className={styles.profileCircle} />
            <span className={styles.profileName}>내 프로필</span>
          </div>

          <button
            type="button"
            className={styles.closeBtn}
            onClick={() => setIsMenuOpen(false)}
          >
            ✕
          </button>
        </div>

        <nav className={styles.drawerNav}>
          <div className={styles.navItem} onClick={() => navigate('/post/write')}>
            게시글 작성
          </div>
          <div className={styles.navItem} onClick={() => navigate('/evaluationZone')}>
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

          <button
            type="button"
            className={styles.menuBtn}
            onClick={() => setIsMenuOpen(true)}
          >
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
              <path d="M4 6H20" stroke="black" strokeWidth="2" strokeLinecap="round" />
              <path d="M4 12H20" stroke="black" strokeWidth="2" strokeLinecap="round" />
              <path d="M4 18H20" stroke="black" strokeWidth="2" strokeLinecap="round" />
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
                  section.items.map((post) => {
                    const postId = String(post.postId);
                    const isBookmarked = !!bookmarks[postId];
                    const imageUrl = resolveAssetUrl(post.thumbnailUrl);

                    return (
                      <div
                        key={`${section.period}-${post.postId}`}
                        className={styles.card}
                        onClick={() =>
                          navigate(`/ranking-detail/${post.postId}?period=${section.period}`)
                        }
                        style={{
                          position: 'relative',
                          overflow: 'hidden',
                          borderRadius: '24px',
                          cursor: 'pointer',
                          backgroundColor: '#f4f4f4',
                        }}
                      >
                        {imageUrl ? (
                          <img
                            src={imageUrl}
                            alt={`ranking-${post.rank}`}
                            style={{
                              width: '100%',
                              height: '100%',
                              objectFit: 'cover',
                              display: 'block',
                            }}
                          />
                        ) : (
                          <div
                            style={{
                              width: '100%',
                              height: '100%',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              color: '#999',
                              fontSize: '12px',
                              background: '#f3f3f3',
                            }}
                          >
                            이미지 없음
                          </div>
                        )}

                        <button
                          type="button"
                          className={styles.heartIcon}
                          onClick={(e) => toggleBookmark(e, postId)}
                          aria-label="북마크"
                          style={{
                            position: 'absolute',
                            top: '10px',
                            right: '10px',
                            width: '24px',
                            height: '24px',
                            border: 'none',
                            background: 'transparent',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            cursor: 'pointer',
                            padding: 0,
                          }}
                        >
                          <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
                            <path
                              d="M12 21.35L10.55 20.03C5.4 15.36 2 12.28 2 8.5C2 5.42 4.42 3 7.5 3C9.24 3 10.91 3.81 12 5.09C13.09 3.81 14.76 3 16.5 3C19.58 3 22 5.42 22 8.5C22 12.28 18.6 15.36 13.45 20.03L12 21.35Z"
                              fill={isBookmarked ? '#FF3B30' : '#D1D5DB'}
                            />
                          </svg>
                        </button>
                      </div>
                    );
                  })
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