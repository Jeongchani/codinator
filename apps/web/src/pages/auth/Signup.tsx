// src/pages/auth/Signup.tsx
import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import styles from './Signup.module.css';

const Signup: React.FC = () => {
  const navigate = useNavigate();

  // 입력 상태 관리
  const [formData, setFormData] = useState({
    email: '',
    password: '',
    birthDate: '',
    gender: '', // 'M' 또는 'F'
    phone: ''
  });

  const handleChange = (field: keyof typeof formData, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const handleSignup = () => {
    console.log("전송할 회원가입 데이터:", formData);
    // TODO: 백엔드 서버(API)로 데이터 전송 로직
    // 성공 시 navigate('/login') 처리
  };

  return (
    <div className={styles.container}>
      {/* 1. 환영 문구 */}
      <div className={styles.headerSection}>
        <h1 className={styles.mainTitle}>회원가입<br />환영!</h1>
        <p className={styles.subTitle}>부가적인 설명 글</p>
      </div>

      {/* 2. 입력 폼 영역 (여기서부터 아래로 쭉 스크롤됩니다) */}
      <div className={styles.formContainer}>
        
        {/* 이메일 */}
        <div className={styles.fieldGroup}>
          <label className={styles.label}>이메일</label>
          <div className={styles.inputWrapper}>
            <input
              type="email"
              placeholder="abcd@email.com"
              className={styles.inputField}
              value={formData.email}
              onChange={(e) => handleChange('email', e.target.value)}
            />
          </div>
        </div>

        {/* 비밀번호 */}
        <div className={styles.fieldGroup}>
          <label className={styles.label}>비밀번호</label>
          <div className={styles.inputWrapper}>
            <input
              type="password"
              placeholder="비밀번호를 입력하세요"
              className={styles.inputField}
              value={formData.password}
              onChange={(e) => handleChange('password', e.target.value)}
            />
          </div>
        </div>

        {/* 생년월일 */}
        <div className={styles.fieldGroup}>
          <label className={styles.label}>생년월일</label>
          <div className={styles.inputWrapper}>
            <input
              type="text"
              placeholder="19900101"
              maxLength={8}
              className={styles.inputField}
              value={formData.birthDate}
              onChange={(e) => handleChange('birthDate', e.target.value)}
            />
          </div>
        </div>

        {/* 성별 확인 */}
        <div className={styles.fieldGroup}>
          <label className={styles.label}>성별 확인</label>
          <div className={styles.genderSection}>
            {/* 남성 체크 */}
            <div className={styles.genderOption} onClick={() => handleChange('gender', 'M')}>
              <svg width="35" height="35" viewBox="0 0 35 35" fill="none">
                <path
                  d="M21.875 14.5832L15.3494 20.4165L13.125 18.4281M29.1667 10.2082L29.1667 24.7916C29.1667 27.2078 27.208 29.1666 24.7917 29.1666H10.2084C7.79213 29.1666 5.83337 27.2078 5.83337 24.7916V10.2082C5.83337 7.792 7.79213 5.83325 10.2084 5.83325H24.7917C27.208 5.83325 29.1667 7.79199 29.1667 10.2082Z"
                  stroke={formData.gender === 'M' ? "#111111" : "#999999"}
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
              <span className={`${styles.genderText} ${formData.gender === 'M' ? styles.genderTextActive : ''}`}>남성</span>
            </div>

            {/* 여성 체크 */}
            <div className={styles.genderOption} onClick={() => handleChange('gender', 'F')}>
              <svg width="35" height="35" viewBox="0 0 35 35" fill="none">
                <path
                  d="M21.875 14.5832L15.3494 20.4165L13.125 18.4281M29.1667 10.2082L29.1667 24.7916C29.1667 27.2078 27.208 29.1666 24.7917 29.1666H10.2084C7.79213 29.1666 5.83337 27.2078 5.83337 24.7916V10.2082C5.83337 7.792 7.79213 5.83325 10.2084 5.83325H24.7917C27.208 5.83325 29.1667 7.79199 29.1667 10.2082Z"
                  stroke={formData.gender === 'F' ? "#111111" : "#999999"}
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
              <span className={`${styles.genderText} ${formData.gender === 'F' ? styles.genderTextActive : ''}`}>여성</span>
            </div>
          </div>
        </div>

        {/* 전화번호 */}
        <div className={styles.fieldGroup}>
          <label className={styles.label}>전화번호</label>
          <div className={styles.inputWrapper}>
            <input
              type="tel"
              placeholder="010 - 0000 - 0000"
              className={styles.inputField}
              value={formData.phone}
              onChange={(e) => handleChange('phone', e.target.value)}
            />
          </div>
        </div>

        {/* 3. 회원가입 버튼 (폼 아래에 딱 붙어서 나옴) */}
        <button className={styles.submitButton} onClick={handleSignup}>
          회원가입
        </button>

        {/* 4. 로그인 유도 */}
        <div className={styles.loginPrompt}>
          <span className={styles.promptTextGray}>계정이 이미 있으신가요?</span>
          <span className={styles.promptTextBlack} onClick={() => navigate('/login')}>로그인</span>
        </div>

      </div>
    </div>
  );
};

export default Signup;