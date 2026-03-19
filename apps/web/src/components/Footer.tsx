import React from 'react';
import { useNavigate } from 'react-router-dom';
import styles from './componets.module.css'; // 파일명 확인해주세요!

const Footer = () => {
  const navigate = useNavigate();

  return (
    <footer className={styles.footer}>
      {/* 메뉴 버튼 */}
      <button className={styles.iconBtn} onClick={() => navigate('/main/menu')}>
        <span className="material-icons" style={{ fontSize: '30px' }}>menu</span>
      </button>

      {/* 홈 버튼 */}
      <button className={styles.homeBtn} onClick={() => navigate('/main')}>
        <div className={styles.homeSquare}></div>
      </button>

      {/* 마이페이지 버튼 */}
      <button className={styles.iconBtn} onClick={() => navigate('/profile/mypage')}>
        <span className="material-icons" style={{ fontSize: '30px' }}>more_vert</span>
      </button>
    </footer>
  );
};

export default Footer;