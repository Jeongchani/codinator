// src/pages/auth/Login.tsx
import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import styles from './Login.module.css';

// API 및 타입 임포트 (경로는 프로젝트에 맞게 확인)
import { fetcher } from '../../lib/api'; 
import type { LoginResponse } from '@codinator/contracts';

const Login: React.FC = () => {
  const navigate = useNavigate();
  
  // 상태 관리
  const [email, setEmail] = useState('alice@codinator.com');
  const [password, setPassword] = useState('1234');
  const [isKeepLoggedIn, setIsKeepLoggedIn] = useState(false);
  const [loading, setLoading] = useState(false);
  
  // 모달을 위한 새로운 상태 (화면에 띄울지 말지 결정)
  const [showModal, setShowModal] = useState(false);
  const [modalMessage, setModalMessage] = useState('');

  // 백엔드 연동 로그인 함수
  const handleLogin = async () => {
    // 1. 빈칸 검사
    if (!email || !password) {
      setModalMessage('이메일과 비밀번호를 모두 입력해주세요.');
      setShowModal(true); // 에러 시 모달 띄우기
      return;
    }

    setLoading(true);

    try {
      // 2. API 호출
      const data = await fetcher<LoginResponse>('/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });

      // 3. 성공 시: 토큰 저장 및 이동
      localStorage.setItem('token', data.accessToken);
      navigate('/rankingList'); 
      
    } catch (err) {
      // 4. 실패 시: 에러 메시지를 모달로 띄우기
      console.error("로그인 에러 상세 내용", err)
      setModalMessage('이메일 또는 비밀번호가 일치하지 않습니다.');
      setShowModal(true);
      
    } finally {
      setLoading(false);
    }
  };

  // 모달 닫기 함수
  const closeModal = () => setShowModal(false);

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
            onKeyDown={(e) => {
              if (e.key === 'Enter') handleLogin();
            }}
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
        <button 
          className={`${styles.primaryButton} ${loading ? 'opacity-70' : ''}`} 
          onClick={handleLogin}
          disabled={loading}
        >
          {loading ? '로그인 중...' : '로그인'}
        </button>
        <button className={styles.secondaryButton} onClick={() => navigate('/signup')}>회원가입</button>
      </div>

      {/* 5. 최하단 유도 문구 */}
      <div className={styles.footerSection}>
        <span className={styles.footerTextGray}>계정이 없으신가요?</span>
        <span className={styles.footerTextBlack} onClick={() => navigate('/signup')}>회원가입</span>
      </div>

      {/* 🔴 모달(Modal) 창 구현 영역 */}
      {showModal && (
        <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
          <div className="w-full max-w-[340px] rounded-2xl bg-white p-6 shadow-xl flex flex-col items-center">
            {/* 경고 아이콘 */}
            <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-red-100">
              <svg className="h-6 w-6 text-red-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
            </div>
            
            <h3 className="mb-2 text-lg font-bold text-neutral-900 text-center">로그인 실패</h3>
            
            {/* 🔴 whitespace-nowrap 추가됨! */}
            <p className="mb-6 text-center text-sm text-neutral-500 font-medium leading-relaxed whitespace-nowrap">
              {modalMessage}
            </p>
            
            <button
              onClick={closeModal}
              className="w-full rounded-[100px] bg-neutral-900 py-3 text-base font-medium text-white transition-transform active:scale-95"
            >
              확인
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default Login;