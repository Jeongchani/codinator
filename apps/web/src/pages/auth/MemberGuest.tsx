// src/pages/auth/MemberGuest.tsx
import React from 'react';
import { useNavigate } from 'react-router-dom';
import styles from './MemberGuest.module.css';

const MemberGuest: React.FC = () => {
  const navigate = useNavigate();

  const handleLoginClick = () => navigate('/login');
  const handleGuestClick = () => navigate('/rankingList');
  const handleTestClick = () => navigate('/Test');

  return (
    <div className={styles.container}>
      <button 
        onClick={handleTestClick}
        className="absolute top-3 left-3 z-50 bg-neutral-900 text-white text-xs px-3 py-1.5 rounded-full transition-all active:scale-95" 
      >
        TestPage
      </button>
      <div className={styles.topBackground} />
      <div className={styles.bottomSheet} />

      <div className={styles.welcomeSection}>
        {/* 🔴 Login 페이지와 텍스트 일치화 */}
        <h1 className={styles.mainTitle}>메인<br/>환영글!</h1>
        <p className={styles.subTitle}>부가적인 설명 글</p>
      </div>

      <h2 className={styles.loginTitle}>로그인</h2>

      <div className={styles.buttonGroup}>
        <button className={styles.loginButton} onClick={handleLoginClick}>로그인</button>
        <button className={styles.guestButton} onClick={handleGuestClick}>비회원</button>
      </div>

      <div className={styles.signupPrompt}>
        <span className={styles.noAccountText}>계정이 없으신가요?</span>
        <span className={styles.signupLink} onClick={() => navigate('/signup')}>회원가입</span>
      </div>
    </div>
  );
};

export default MemberGuest;