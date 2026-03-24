import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import styles from './Signup.module.css';
import { fetcher } from '../../lib/api'; 
import type { SignupResponse } from '@codinator/contracts';

const Signup: React.FC = () => {
  const navigate = useNavigate();

  const [formData, setFormData] = useState({
    email: '',
    nickname: '',
    password: '',
    birthDate: '',
    gender: '',
    phone: ''
  });

  const [loading, setLoading] = useState(false);
  const [isEmailChecked, setIsEmailChecked] = useState(false);
  const [isNicknameChecked, setIsNicknameChecked] = useState(false);
  const [checkingEmail, setCheckingEmail] = useState(false);
  const [checkingNickname, setCheckingNickname] = useState(false);
  
  const [showModal, setShowModal] = useState(false);
  const [modalMessage, setModalMessage] = useState('');
  const [isSuccess, setIsSuccess] = useState(false);

  const handleChange = (field: keyof typeof formData, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    if (field === 'email') setIsEmailChecked(false);
    if (field === 'nickname') setIsNicknameChecked(false);
  };

  // 1. 이메일 중복 확인
  const handleCheckEmail = async () => {
    if (!formData.email) return setOpenModal('이메일을 입력해주세요.', false);
    setCheckingEmail(true);
    
    // 시뮬레이션 (백엔드 API 연결 시 fetcher 사용)
    setTimeout(() => {
      setOpenModal('사용 가능한 이메일입니다.', true);
      setIsEmailChecked(true);
      setCheckingEmail(false);
    }, 500);
  };

  // 2. 닉네임 중복 확인
  const handleCheckNickname = async () => {
    if (!formData.nickname) return setOpenModal('닉네임을 입력해주세요.', false);
    setCheckingNickname(true);
    
    setTimeout(() => {
      setOpenModal('사용 가능한 닉네임입니다.', true);
      setIsNicknameChecked(true);
      setCheckingNickname(false);
    }, 500);
  };

  // 3. 회원가입 실행
  const handleSignup = async () => {
    const { email, nickname, password, birthDate, gender, phone } = formData;

    if (!isEmailChecked) return setOpenModal('이메일 중복 확인을 해주세요.', false);
    if (!isNicknameChecked) return setOpenModal('닉네임 중복 확인을 해주세요.', false);
    if (!password.trim()) return setOpenModal('비밀번호를 입력해주세요.', false);

    setLoading(true);
    try {
      await fetcher<SignupResponse>('/auth/signup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, nickname, password, birthDate, gender, phone }), 
      });
      setOpenModal('회원가입이 완료되었습니다!', true);
    } catch (err: any) {
      setOpenModal(err.message || '회원가입 실패', false);
    } finally {
      setLoading(false);
    }
  };

  const setOpenModal = (msg: string, success: boolean) => {
    setModalMessage(msg);
    setIsSuccess(success);
    setShowModal(true);
  };

  const closeModal = () => {
    setShowModal(false);
    if (isSuccess && modalMessage.includes('완료')) navigate('/login');
  };

  return (
    <div className={styles.container}>
      <div className={styles.headerSection}>
        <h1 className={styles.mainTitle}>회원가입<br />반가워요!</h1>
        <p className={styles.subTitle}>필수 항목(*)은 반드시 입력해 주세요.</p>
      </div>

      <div className={styles.formContainer}>
        {/* 이메일 섹션 */}
        <div className={styles.fieldGroup}>
          <label className={styles.label}>이메일 *</label>
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

        {/* 닉네임 섹션 */}
        <div className={styles.fieldGroup}>
          <label className={styles.label}>닉네임 *</label>
          <div className={styles.emailInputRow}>
            <div className={`${styles.inputWrapper} ${styles.flexFill}`}>
              <input 
                type="text" 
                placeholder="닉네임을 입력하세요" 
                className={styles.inputField}
                value={formData.nickname} 
                onChange={(e) => handleChange('nickname', e.target.value)} 
              />
            </div>
            <button 
              onClick={handleCheckNickname}
              disabled={checkingNickname || isNicknameChecked}
              className={`${styles.checkButton} ${isNicknameChecked ? styles.checkButtonDone : styles.checkButtonDefault}`}
            >
              {isNicknameChecked ? '확인됨' : '중복 확인'}
            </button>
          </div>
        </div>

        {/* 비밀번호 섹션 */}
        <div className={styles.fieldGroup}>
          <label className={styles.label}>비밀번호 *</label>
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
            <input type="text" placeholder="19900101" maxLength={8} className={styles.inputField} value={formData.birthDate} onChange={(e) => handleChange('birthDate', e.target.value)} />
          </div>
        </div>

        {/* 성별 */}
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

        {/* 전화번호 (추가됨) */}
        <div className={styles.fieldGroup}>
          <label className={styles.label}>전화번호</label>
          <div className={styles.inputWrapper}>
            <input type="tel" placeholder="010 - 0000 - 0000" className={styles.inputField} value={formData.phone} onChange={(e) => handleChange('phone', e.target.value)} />
          </div>
        </div>

        <button 
          className={`${styles.submitButton} ${(!isEmailChecked || !isNicknameChecked || loading) ? 'opacity-50 cursor-not-allowed' : ''}`} 
          onClick={handleSignup} 
          disabled={loading || !isEmailChecked || !isNicknameChecked}
        >
          {loading ? '처리 중...' : '회원가입'}
        </button>

        <div className={styles.loginPrompt}>
          <span className={styles.promptTextGray}>계정이 이미 있으신가요?</span>
          <span className={styles.promptTextBlack} onClick={() => navigate('/login')}>로그인</span>
        </div>
      </div>

      {/* 모달 창 */}
      {showModal && (
        <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
          <div className="w-full max-w-[340px] rounded-2xl bg-white p-6 shadow-xl flex flex-col items-center">
            <h3 className="mb-2 text-lg font-bold text-neutral-900">{isSuccess ? '성공' : '알림'}</h3>
            <p className="mb-6 text-center text-sm text-neutral-500 font-medium leading-relaxed">
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