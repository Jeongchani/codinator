import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import styles from './Signup.module.css';
import { fetcher } from '../../lib/api';
import type { SignupResponse } from '@codinator/contracts';

type SignupForm = {
  email: string;
  nickname: string;
  password: string;
  birthDate: string;
  gender: string;
  phone: string;
};

const Signup: React.FC = () => {
  const navigate = useNavigate();

  const [formData, setFormData] = useState<SignupForm>({
    email: '',
    nickname: '',
    password: '',
    birthDate: '',
    gender: '',
    phone: '',
  });

  const [loading, setLoading] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [modalMessage, setModalMessage] = useState('');
  const [isSuccess, setIsSuccess] = useState(false);

  const handleChange = (field: keyof SignupForm, value: string) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  const openModal = (message: string, success: boolean) => {
    setModalMessage(message);
    setIsSuccess(success);
    setShowModal(true);
  };

  const handleCheckEmail = () => {
    if (!formData.email.trim()) {
      openModal('이메일을 입력해주세요.', false);
      return;
    }

    openModal(
      'V1 API에는 이메일 중복 확인 전용 엔드포인트가 없습니다. 회원가입 요청 시 서버에서 중복 여부를 검사합니다.',
      false,
    );
  };

  const handleCheckNickname = () => {
    if (!formData.nickname.trim()) {
      openModal('닉네임을 입력해주세요.', false);
      return;
    }

    openModal(
      'V1 API에는 닉네임 중복 확인 전용 엔드포인트가 없습니다. 회원가입 요청 시 서버에서 중복 여부를 검사합니다.',
      false,
    );
  };

  const handleSignup = async () => {
    const { email, nickname, password } = formData;

    if (!email.trim()) {
      openModal('이메일을 입력해주세요.', false);
      return;
    }

    if (!nickname.trim()) {
      openModal('닉네임을 입력해주세요.', false);
      return;
    }

    if (!password.trim()) {
      openModal('비밀번호를 입력해주세요.', false);
      return;
    }

    setLoading(true);
    try {
      await fetcher<SignupResponse>('/auth/signup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, nickname, password }),
      });
      openModal('회원가입이 완료되었습니다!', true);
    } catch (err) {
      openModal(err instanceof Error ? err.message : '회원가입 실패', false);
    } finally {
      setLoading(false);
    }
  };

  const closeModal = () => {
    setShowModal(false);
    if (isSuccess) {
      navigate('/login');
    }
  };

  return (
    <div className={styles.container}>
      <div className={styles.headerSection}>
        <h1 className={styles.mainTitle}>
          회원가입
          <br />
          반가워요!
        </h1>
        <p className={styles.subTitle}>V1 API 기준 필수 항목은 이메일, 닉네임, 비밀번호입니다.</p>
      </div>

      <div className={styles.formContainer}>
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
            <button onClick={handleCheckEmail} className={`${styles.checkButton} ${styles.checkButtonDefault}`}>
              중복 확인
            </button>
          </div>
        </div>

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
            <button onClick={handleCheckNickname} className={`${styles.checkButton} ${styles.checkButtonDefault}`}>
              중복 확인
            </button>
          </div>
        </div>

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

        <div className={styles.fieldGroup}>
          <label className={styles.label}>생년월일</label>
          <div className={styles.inputWrapper}>
            <input
              type="text"
              placeholder="현재 V1 API 전송 제외"
              maxLength={8}
              className={styles.inputField}
              value={formData.birthDate}
              onChange={(e) => handleChange('birthDate', e.target.value)}
            />
          </div>
        </div>

        <div className={styles.fieldGroup}>
          <label className={styles.label}>성별</label>
          <div className={styles.genderSection}>
            <div className={styles.genderOption} onClick={() => handleChange('gender', 'M')}>
              <svg width="24" height="24" viewBox="0 0 35 35" fill="none">
                <path
                  d="M21.875 14.5832L15.3494 20.4165L13.125 18.4281M29.1667 10.2082L29.1667 24.7916C29.1667 27.2078 27.208 29.1666 24.7917 29.1666H10.2084C7.79213 29.1666 5.83337 27.2078 5.83337 24.7916V10.2082C5.83337 7.792 7.79213 5.83325 10.2084 5.83325H24.7917C27.208 5.83325 29.1667 7.79199 29.1667 10.2082Z"
                  stroke={formData.gender === 'M' ? '#111111' : '#999999'}
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
              <span className={`${styles.genderText} ${formData.gender === 'M' ? styles.genderTextActive : ''}`}>남성</span>
            </div>
            <div className={styles.genderOption} onClick={() => handleChange('gender', 'F')}>
              <svg width="24" height="24" viewBox="0 0 35 35" fill="none">
                <path
                  d="M21.875 14.5832L15.3494 20.4165L13.125 18.4281M29.1667 10.2082L29.1667 24.7916C29.1667 27.2078 27.208 29.1666 24.7917 29.1666H10.2084C7.79213 29.1666 5.83337 27.2078 5.83337 24.7916V10.2082C5.83337 7.792 7.79213 5.83325 10.2084 5.83325H24.7917C27.208 5.83325 29.1667 7.79199 29.1667 10.2082Z"
                  stroke={formData.gender === 'F' ? '#111111' : '#999999'}
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
              <span className={`${styles.genderText} ${formData.gender === 'F' ? styles.genderTextActive : ''}`}>여성</span>
            </div>
          </div>
        </div>

        <div className={styles.fieldGroup}>
          <label className={styles.label}>전화번호</label>
          <div className={styles.inputWrapper}>
            <input
              type="tel"
              placeholder="현재 V1 API 전송 제외"
              className={styles.inputField}
              value={formData.phone}
              onChange={(e) => handleChange('phone', e.target.value)}
            />
          </div>
        </div>

        <button
          className={`${styles.submitButton} ${loading ? 'opacity-50 cursor-not-allowed' : ''}`}
          onClick={handleSignup}
          disabled={loading}
        >
          {loading ? '처리 중...' : '회원가입'}
        </button>

        <div className={styles.loginPrompt}>
          <span className={styles.promptTextGray}>계정이 이미 있으신가요?</span>
          <span className={styles.promptTextBlack} onClick={() => navigate('/login')}>
            로그인
          </span>
        </div>
      </div>

      {showModal && (
        <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
          <div className="flex w-full max-w-[340px] flex-col items-center rounded-2xl bg-white p-6 shadow-xl">
            <h3 className="mb-2 text-lg font-bold text-neutral-900">{isSuccess ? '성공' : '알림'}</h3>
            <p className="mb-6 text-center text-sm font-medium leading-relaxed text-neutral-500">
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

export default Signup;
