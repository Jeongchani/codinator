// src/pages/Splash.tsx
import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import styles from './splash.module.css';

export default function Splash() {
  const navigate = useNavigate();

  useEffect(() => {
    // 1.2초 뒤에 로그인 페이지로 바로 이동
    const navTimer = setTimeout(() => {
      navigate('/login');
    }, 1200);

    return () => clearTimeout(navTimer);
  }, [navigate]);

  return (
    <div className={styles.container}>
      <div className={styles.mobileWrapper}>
        <div className={styles.centerCircle} />
        <div className={styles.logoText}>Coodinator</div>
      </div>
    </div>
  );
}