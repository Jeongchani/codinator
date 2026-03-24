import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import styles from './RankingZone.module.css';
import Footer from '../../components/Footer';
import { fetcher } from '../../lib/api';
import type { LogoutResponse } from '@codinator/contracts';
import { DUMMY_RANKINGS } from '../../data/dummy';

type RankingUser = {
  nickname: string;
};

type OutfitItem = {
  brand: string;
  itemName: string;
};

type RankingPost = {
  id: number | string;
  content: string;
  likeCount: number;
  imageUrl?: string;
  image_url?: string;
  user?: RankingUser;
  outfitItems?: OutfitItem[];
};

const RankingZone: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();

  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [rankings, setRankings] = useState<RankingPost[]>([]);
  const [loading, setLoading] = useState(true);

  const [bookmarks, setBookmarks] = useState<Record<string, boolean>>(() => {
    const saved = localStorage.getItem('codinator_bookmarks');
    return saved ? (JSON.parse(saved) as Record<string, boolean>) : {};
  });

  useEffect(() => {
    const saved = localStorage.getItem('codinator_bookmarks');
    if (saved) {
      setBookmarks(JSON.parse(saved) as Record<string, boolean>);
    }
  }, [location]);

  useEffect(() => {
    const loadRankings = async () => {
      try {
        setLoading(true);
        const data = await fetcher<RankingPost[]>('/rankings?period=WEEKLY');

        if (data && data.length > 0) {
          setRankings(data);
        } else {
          setRankings(DUMMY_RANKINGS as RankingPost[]);
        }
      } catch {
        setRankings(DUMMY_RANKINGS as RankingPost[]);
      } finally {
        setLoading(false);
      }
    };

    loadRankings();
  }, []);

  const handleLogout = async () => {
    if (!window.confirm('로그아웃 하시겠습니까?')) return;

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
    } catch {
      localStorage.removeItem('token');
      localStorage.removeItem('refreshToken');
      navigate('/login');
    }
  };

  const toggleBookmark = (e: React.MouseEvent, postId: string) => {
    e.stopPropagation();

    setBookmarks((prev) => {
      const newState = { ...prev, [postId]: !prev[postId] };
      localStorage.setItem('codinator_bookmarks', JSON.stringify(newState));
      return newState;
    });
  };

  const sections = [
    { id: 'week', title: 'this week' },
    { id: 'month', title: 'this month' },
    { id: 'weather', title: 'this weather' },
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
        ) : (
          sections.map((section) => (
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
                {rankings.map((post) => (
                  <div
                    key={String(post.id)}
                    className={styles.card}
                    onClick={() =>
                      navigate(`/ranking-detail/${post.id}`, {
                        state: {
                          sectionTitle: section.title,
                          period: section.id === 'month' ? 'MONTHLY' : 'WEEKLY',
                        },
                      })
                    }
                    style={{
                      backgroundImage: `url(${post.imageUrl || post.image_url || ''})`,
                      backgroundSize: 'cover',
                      backgroundPosition: 'center',
                    }}
                  >
                    <div
                      className={styles.heartIcon}
                      onClick={(e) => toggleBookmark(e, String(post.id))}
                    >
                      <svg
                        width="20"
                        height="20"
                        viewBox="0 0 24 24"
                        xmlns="http://www.w3.org/2000/svg"
                      >
                        <path
                          d="M12 21.35L10.55 20.03C5.4 15.36 2 12.28 2 8.5C2 5.42 4.42 3 7.5 3C9.24 3 10.91 3.81 12 5.09C13.09 3.81 14.76 3 16.5 3C19.58 3 22 5.42 22 8.5C22 12.28 18.6 15.36 13.45 20.03L12 21.35Z"
                          fill={bookmarks[String(post.id)] ? '#FF3B30' : 'rgba(255,255,255,0.75)'}
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