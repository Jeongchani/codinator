// src/pages/login.tsx
import { useNavigate } from 'react-router-dom';
import styles from './auth.module.css'; 

export default function Login() {
  const navigate = useNavigate();

  return (
    <div className={styles.container}>
      <div className={styles.mobileWrapper}>
        
        {/* 중앙 원형 그래픽 */}
        <div className={styles.centerCircle} />

        {/* 🌟 버튼 그룹을 묶어서 자연스럽게 나타나게 애니메이션 적용 */}
        <div className={styles.fadeInElements}>
          {/* 비회원 버튼 */}
          <div className={`${styles.btn} ${styles.btnGuest}`} onClick={() => navigate('/rankingList')}>
            <div className={styles.btnBgGray} />
            <div className={`${styles.btnText} ${styles.btnTextGuest}`}>비회원</div>
          </div>
          
          {/* 로그인 버튼 */}
          <div className={`${styles.btn} ${styles.btnLogin}`} onClick={() => navigate('/rankingList')}>
            <div className={styles.btnBgDark} />
            <div className={`${styles.btnText} ${styles.btnTextLogin}`}>로그인</div>
          </div>
        </div>

      </div>
    </div>
  );
}