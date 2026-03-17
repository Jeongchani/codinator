// src/pages/login.tsx
import { useNavigate } from 'react-router-dom';
import styles from './login.module.css'; // 🌟 CSS 모듈 불러오기

export default function Login() {
  const navigate = useNavigate();

  return (
    <div className={styles.container}>
      <div className={styles.mobileWrapper}>
        
        {/* 비회원 버튼 */}
        <div className={`${styles.btn} ${styles.btnGuest}`} onClick={() => navigate('/guest')}>
          <div className={styles.btnBgGray} />
          <div className={`${styles.btnText} ${styles.btnTextGuest}`}>비회원</div>
        </div>
        
        {/* 로그인 버튼 */}
        <div className={`${styles.btn} ${styles.btnLogin}`} onClick={() => navigate('/login')}>
          <div className={styles.btnBgDark} />
          <div className={`${styles.btnText} ${styles.btnTextLogin}`}>로그인</div>
        </div>
        
        {/* 중앙 원형 그래픽 */}
        <div className={styles.centerCircle} />
        
        {/* 상단 상태바 */}
        <div className={styles.statusBar}>
          <div className={styles.timeText}>9:41</div>
          <div className={styles.batteryIcon}>
            <div style={{width: 25, height: 12, left: 46.66, top: 2.33, position: 'absolute'}}>
              <div className={styles.batteryBody} />
              <div className={styles.batteryTip} />
              <div className={styles.batteryFill} />
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}