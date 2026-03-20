import React, { useEffect, useState } from 'react';
import styles from './splash.module.css';

interface SplashProps {
  onFinish: () => void;
}

const Splash: React.FC<SplashProps> = ({ onFinish }) => {
  useEffect(() => {
    const timer = setTimeout(() => {
      onFinish(); // 1초 뒤 부모 컴포넌트에 알림
    }, 800);
    return () => clearTimeout(timer);
  }, [onFinish]);

  return (
    <div className={`${styles.container} ${styles.fadeAnimation}`}>
      {/* 흰색 원형 배경 */}
      <div className={styles.circleBg}>
        {/* 유저 아이콘 형상화 */}
        <div className={styles.userIconWrapper}>
          <div className={styles.userHead} />
          <div className={styles.userBody} />
        </div>
      </div>

      {/* 로고 텍스트 */}
      <div className={styles.logoText}>
        C:dinator
      </div>
    </div>
  );
};

export default Splash;