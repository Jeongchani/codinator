import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import styles from './RankingZone.module.css';
import Footer from '../../components/Footer';
import { fetcher } from '../../lib/api';
import type { LogoutResponse } from '@codinator/contracts';

const RankingZone: React.FC = () => {
  const navigate = useNavigate();
  const [isMenuOpen, setIsMenuOpen] = useState(false);

  // 로그아웃 기능
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

      alert("로그아웃 되었습니다.");
      navigate('/login');
    } catch (err) {
      console.error("로그아웃 중 오류 발생:", err);
      localStorage.removeItem('token');
      localStorage.removeItem('refreshToken');
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
      {/* 햄버거 메뉴 (Drawer) */}
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
              <path d="M24 11H0V13H24V11Z" fill="black"/>
              <path d="M24 4H0V6H24V4Z" fill="black"/>
              <path d="M24 18H0V20H24V18Z" fill="black"/>
            </svg>
          </button>
        </header>

        <div className={styles.divider} />

        {sections.map((section) => (
          <section key={section.id} className={styles.section}>
            <div className={styles.sectionHeader}>
              <h2 className={styles.sectionTitle}>{section.title}</h2>
              <div className={styles.moreBtn}>
                <span>더보기</span>
                <svg width="14" height="13" viewBox="0 0 14 13" fill="none">
                  <path d="M5.87321 10.1329L5.10669 9.36694L7.97994 6.4999L5.10669 3.63286L5.87539 2.86694L8.74646 5.73398C8.95015 5.93714 9.06457 6.21264 9.06457 6.4999C9.06457 6.78716 8.95015 7.06266 8.74646 7.26582L5.87321 10.1329Z" fill="#767676"/>
                </svg>
              </div>
            </div>

            {/* 🔴 가로 스크롤을 위해 cardGrid 사용 */}
            <div className={styles.cardGrid}>
              {[1, 2, 3, 4, 5].map((card) => (
                <div key={card} className={styles.card}>
                  <div className={styles.heartIcon}>
                    <svg width="24" height="24" viewBox="0 0 29 27" fill="none">
                      <path d="M20.4223 0C19.1086 0.0204341 17.8235 0.387162 16.6969 1.06315C15.5702 1.73914 14.6419 2.70045 14.0056 3.85C13.3694 2.70045 12.4411 1.73914 11.3144 1.06315C10.1878 0.387162 8.90271 0.0204341 7.58898 0C5.49475 0.0909892 3.52164 1.00713 2.10073 2.54827C0.679817 4.08941 -0.0733943 6.13028 0.00564795 8.225C0.00564795 16.1292 12.7876 25.2583 13.3313 25.6457L14.0056 26.1228L14.68 25.6457C15.2236 25.2607 28.0056 16.1292 28.0056 8.225C28.0847 6.13028 27.3315 4.08941 25.9106 2.54827C24.4897 1.00713 22.5165 0.0909892 20.4223 0ZM14.0056 23.2505C10.2105 20.4155 2.33898 13.4505 2.33898 8.225C2.25923 6.74884 2.76641 5.30102 3.7499 4.19732C4.7334 3.09361 6.11342 2.42358 7.58898 2.33333C9.06454 2.42358 10.4446 3.09361 11.4281 4.19732C12.4116 5.30102 12.9187 6.74884 12.839 8.225H15.1723C15.0926 6.74884 15.5997 5.30102 16.5832 4.19732C17.5667 3.09361 18.9468 2.42358 20.4223 2.33333C21.8979 2.42358 23.2779 3.09361 24.2614 4.19732C25.2449 5.30102 25.7521 6.74884 25.6723 8.225C25.6723 13.4528 17.8008 20.4155 14.0056 23.2505Z" fill="white" fillOpacity="0.5"/>
                    </svg>
                  </div>
                </div>
              ))}
            </div>
          </section>
        ))}
      </div>

      <Footer />
    </div>
  );
};

export default RankingZone;