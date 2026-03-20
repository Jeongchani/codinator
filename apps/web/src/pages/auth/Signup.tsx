import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import styles from './Signup.module.css';

// API 및 타입 임포트
import { fetcher } from '../../lib/api'; 
import type { SignupResponse, SeedCheckResponse } from '@codinator/contracts';

const Signup: React.FC = () => {
  const navigate = useNavigate();

  const [formData, setFormData] = useState({
    email: '',
    password: '',
    birthDate: '',
    gender: '',
    phone: ''
  });

  const [loading, setLoading] = useState(false);
  const [checkingEmail, setCheckingEmail] = useState(false);
  const [isEmailChecked, setIsEmailChecked] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [modalMessage, setModalMessage] = useState('');
  const [isSuccess, setIsSuccess] = useState(false);

  const handleChange = (field: keyof typeof formData, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    if (field === 'email') setIsEmailChecked(false);
  };

  const handleCheckEmail = async () => {
    if (!formData.email) {
      setModalMessage('이메일을 입력해주세요.');
      setIsSuccess(false);
      setShowModal(true);
      return;
    }

    setCheckingEmail(true);
    try {
      const data = await fetcher<SeedCheckResponse>('/users/seed-check', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: formData.email }),
      });

      if (data.found) {
        setModalMessage('이미 존재하는 이메일입니다.');
        setIsEmailChecked(false);
        setIsSuccess(false);
      } else {
        setModalMessage('사용 가능한 이메일입니다!');
        setIsEmailChecked(true);
        setIsSuccess(true);
      }
      setShowModal(true);
    } catch (err) {
      console.error("이메일 중복 확인 오류",err)
      setModalMessage('중복 확인 중 오류가 발생했습니다.');
      setIsSuccess(false);
      setShowModal(true);
    } finally {
      setCheckingEmail(false);
    }
  };

  const handleSignup = async () => {
    const { email, password } = formData;
    if (!isEmailChecked) {
      setModalMessage('이메일 중복 확인을 먼저 해주세요.');
      setIsSuccess(false);
      setShowModal(true);
      return;
    }
    if (!password) {
      setModalMessage('비밀번호를 입력해주세요.');
      setIsSuccess(false);
      setShowModal(true);
      return;
    }

    setLoading(true);
    try {
      await fetcher<SignupResponse>('/auth/signup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }), 
      });
      setModalMessage('회원가입이 완료되었습니다!');
      setIsSuccess(true);
      setShowModal(true);
    } catch (err) {
      console.error("회원가입 중 오류",err)
      setIsSuccess(false);
      setModalMessage('회원가입 중 오류가 발생했습니다.');
      setShowModal(true);
    } finally {
      setLoading(false);
    }
  };

  const closeModal = () => {
    setShowModal(false);
    if (isSuccess && modalMessage.includes('완료')) navigate('/login');
  };

  return (
    <div className={styles.container}>
      <div className={styles.headerSection}>
        <h1 className={styles.mainTitle}>회원가입<br />환영!</h1>
        <p className={styles.subTitle}>부가적인 설명 글</p>
      </div>

      <div className={styles.formContainer}>
        {/* 이메일 섹션 */}
        <div className={styles.fieldGroup}>
          <label className={styles.label}>이메일</label>
          <div className={styles.emailInputRow}>
            <div className={`${styles.inputWrapper} ${styles.flexFill}`}>
              <input 
                type="email" 
                placeholder="abcd@email.com" 
                className={styles.inputField}
                value={formData.email} 
                onChange={(e) => handleChange('email', e.target.value)} 
              />
            </div>
            <button 
              onClick={handleCheckEmail}
              disabled={checkingEmail || isEmailChecked}
              className={`${styles.checkButton} ${isEmailChecked ? styles.checkButtonDone : styles.checkButtonDefault}`}
            >
              {isEmailChecked ? '확인됨' : '중복 확인'}
            </button>
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
          <label className={styles.label}>성별</label>
          <div className={styles.genderSection}>
            <div className={styles.genderOption} onClick={() => handleChange('gender', 'M')}>
              <svg width="24" height="24" viewBox="0 0 35 35" fill="none">
                <path d="M21.875 14.5832L15.3494 20.4165L13.125 18.4281M29.1667 10.2082L29.1667 24.7916C29.1667 27.2078 27.208 29.1666 24.7917 29.1666H10.2084C7.79213 29.1666 5.83337 27.2078 5.83337 24.7916V10.2082C5.83337 7.792 7.79213 5.83325 10.2084 5.83325H24.7917C27.208 5.83325 29.1667 7.79199 29.1667 10.2082Z" stroke={formData.gender === 'M' ? "#111111" : "#999999"} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
              <span className={`${styles.genderText} ${formData.gender === 'M' ? styles.genderTextActive : ''}`}>남성</span>
            </div>
            <div className={styles.genderOption} onClick={() => handleChange('gender', 'F')}>
              <svg width="24" height="24" viewBox="0 0 35 35" fill="none">
                <path d="M21.875 14.5832L15.3494 20.4165L13.125 18.4281M29.1667 10.2082L29.1667 24.7916C29.1667 27.2078 27.208 29.1666 24.7917 29.1666H10.2084C7.79213 29.1666 5.83337 27.2078 5.83337 24.7916V10.2082C5.83337 7.792 7.79213 5.83325 10.2084 5.83325H24.7917C27.208 5.83325 29.1667 7.79199 29.1667 10.2082Z" stroke={formData.gender === 'F' ? "#111111" : "#999999"} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
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

        <button 
          className={`${styles.submitButton} ${(!isEmailChecked || loading) ? 'opacity-50 cursor-not-allowed' : ''}`} 
          onClick={handleSignup} 
          disabled={loading || !isEmailChecked}
        >
          {loading ? '처리 중...' : '회원가입'}
        </button>

        <div className={styles.loginPrompt}>
          <span className={styles.promptTextGray}>계정이 이미 있으신가요?</span>
          <span className={styles.promptTextBlack} onClick={() => navigate('/login')}>로그인</span>
        </div>
      </div>

      {/* 모달 창 (Tailwind 직접 사용) */}
      {showModal && (
        <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
          <div className="w-full max-w-[340px] rounded-2xl bg-white p-6 shadow-xl flex flex-col items-center">
            <div className={`mb-4 flex h-12 w-12 items-center justify-center rounded-full ${isSuccess ? 'bg-green-100' : 'bg-red-100'}`}>
              <svg className={`h-6 w-6 ${isSuccess ? 'text-green-600' : 'text-red-600'}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                {isSuccess ? (
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" />
                ) : (
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                )}
              </svg>
            </div>
            <h3 className="mb-2 text-lg font-bold text-neutral-900">{isSuccess ? '성공' : '알림'}</h3>
            <p className="mb-6 text-center text-sm text-neutral-500 font-medium leading-relaxed whitespace-nowrap">
              {modalMessage}
            </p>
            <button onClick={closeModal} className="w-full rounded-[100px] bg-neutral-900 py-3 text-base font-medium text-white transition-transform active:scale-95">
              확인
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default Signup;