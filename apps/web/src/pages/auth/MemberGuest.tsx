// src/pages/auth/MemberGuest.tsx
import React from 'react';
import { useNavigate } from 'react-router-dom';
import styles from './MemberGuest.module.css';

const MemberGuest: React.FC = () => {
  const navigate = useNavigate();

  const handleLoginClick = () => {
    //로그인 페이지(Login)로 이동
    navigate('/login');
  };

  const handleGuestClick = () => {
    // 비회원 메인(RankingList)으로 이동
    navigate('/rankingList');
  };

  return (
    <div className={styles.container}>
      {/* 상단 배경 영역 */}
      <div className={styles.topBackground}>
        {/* 여기에 로고나 이미지를 추가할 수 있습니다 */}
      </div>

      {/* 하단 화이트 시트 레이아웃 */}
      <div className={styles.bottomSheet} />

      {/* 환영 문구 */}
      <div className={styles.welcomeSection}>
        <h1 className={styles.mainTitle}>메인<br/>환영글!</h1>
        <p className={styles.subTitle}>부가적인 설명 글</p>
      </div>

      {/* 로그인 타이틀 */}
      <h2 className={styles.loginTitle}>로그인</h2>

      {/* 버튼 섹션 */}
      <div className={styles.buttonGroup}>
        <button className={styles.loginButton} onClick={handleLoginClick}>
          로그인
        </button>
        <button className={styles.guestButton} onClick={handleGuestClick}>
          비회원
        </button>
      </div>

      {/* 회원가입 유도 */}
      <div className={styles.signupPrompt}>
        <span className={styles.noAccountText}>계정이 없으신가요?</span>
        <span className={styles.signupLink} onClick={() => navigate('/signup')}>
          회원가입
        </span>
      </div>
    </div>
  );
};

export default MemberGuest;