// src/pages/auth/Login.tsx
import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import styles from './Login.module.css';

const Login: React.FC = () => {
  const navigate = useNavigate();
  
  // 상태 관리
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isKeepLoggedIn, setIsKeepLoggedIn] = useState(false);

  const handleLogin = () => {
    console.log("로그인 시도:", { email, password, isKeepLoggedIn });
    // 백엔드 연동 시 fetcher 사용 지점
  };

  return (
    <div className={styles.container}>
      {/* 1. 환영 문구 */}
      <div className={styles.headerSection}>
        <div className={styles.welcomeTextWrapper}>
          <h1 className={styles.mainTitle}>메인<br />환영글!</h1>
          <p className={styles.subTitle}>부가적인 설명 글</p>
        </div>
      </div>

      {/* 2. 입력란 */}
      <div className={styles.inputSection}>
        {/* 이메일 */}
        <div className="relative h-12 mb-[19px]">
          <div className={styles.inputBg} />
          <input 
            type="email" 
            placeholder="abcd@email.com"
            className={styles.inputField}
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
        </div>
        {/* 비밀번호 */}
        <div className="relative h-12">
          <div className={styles.inputBg} />
          <input 
            type="password" 
            placeholder="비밀번호를 입력하세요"
            className={styles.inputField}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
        </div>
      </div>

      {/* 3. 로그인 상태 유지 & 비밀번호 찾기 */}
      <div className={styles.optionSection}>
        <div className={styles.checkboxWrapper} onClick={() => setIsKeepLoggedIn(!isKeepLoggedIn)}>
          <svg width="25" height="25" viewBox="0 0 25 25" fill="none">
            <path 
              d="M15.625 10.4167L10.9638 14.5834L9.37496 13.1631M20.8333 7.29173L20.8333 17.7084C20.8333 19.4343 19.4342 20.8334 17.7083 20.8334H7.29163C5.56574 20.8334 4.16663 19.4343 4.16663 17.7084V7.29173C4.16663 5.56585 5.56574 4.16675 7.29163 4.16675H17.7083C19.4342 4.16675 20.8333 5.56585 20.8333 7.29173Z" 
              stroke={isKeepLoggedIn ? "#111111" : "#999999"} 
              strokeWidth="2" 
              strokeLinecap="round" 
              strokeLinejoin="round"
            />
          </svg>
          <span className={styles.optionText}>로그인 상태 유지</span>
        </div>
        <div className={styles.optionText + " cursor-pointer"}>비밀번호를 잊으셨나요?</div>
      </div>

      {/* 4. 로그인/회원가입 버튼 */}
      <div className={styles.buttonGroup}>
        <button className={styles.primaryButton} onClick={handleLogin}>로그인</button>
        <button className={styles.secondaryButton} onClick={() => navigate('/signup')}>회원가입</button>
      </div>

      {/* 5. 최하단 유도 문구 */}
      <div className={styles.footerSection}>
        <span className={styles.footerTextGray}>계정이 없으신가요?</span>
        <span className={styles.footerTextBlack} onClick={() => navigate('/signup')}>회원가입</span>
      </div>
    </div>
  );
};

export default Login;