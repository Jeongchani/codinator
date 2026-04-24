import React, { useState } from 'react';
import { SquareCheck } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import type { LoginResponse } from '@codinator/contracts';
import { clearAuthTokens, fetcher, saveAuthTokens, saveCurrentUser } from '../../lib/api';
import styles from './Login.module.css';
import { KakaoIcon, NaverIcon, GoogleIcon } from '../../components/icons/social';

function CheckIcon({ checked }: { checked: boolean }) {
  return (
    <SquareCheck
      size={25}
      strokeWidth={2}
      className={styles.checkboxSvg}
      color={checked ? '#111111' : '#999999'}
      aria-hidden="true"
    />
  );
}

const Login: React.FC = () => {
  const navigate = useNavigate();

  const [email, setEmail] = useState('alice@codinator.com');
  const [password, setPassword] = useState('1234');
  const [isKeepLoggedIn, setIsKeepLoggedIn] = useState(
    () => localStorage.getItem('keepLoggedIn') === 'true',
  );
  const [loading, setLoading] = useState(false);

  const [showModal, setShowModal] = useState(false);
  const [modalTitle, setModalTitle] = useState('안내');
  const [modalMessage, setModalMessage] = useState('');

  const openModal = (title: string, message: string) => {
    setModalTitle(title);
    setModalMessage(message);
    setShowModal(true);
  };

  const closeModal = () => setShowModal(false);

  const handleLogin = async () => {
    const trimmedEmail = email.trim();
    const trimmedPassword = password.trim();

    if (!trimmedEmail || !trimmedPassword) {
      openModal('입력 확인', '이메일과 비밀번호를 모두 입력해주세요.');
      return;
    }

    setLoading(true);

    try {
      const data = await fetcher<LoginResponse>('/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: trimmedEmail,
          password: trimmedPassword,
        }),
      });

      clearAuthTokens();
      saveAuthTokens(data.accessToken, isKeepLoggedIn ? data.refreshToken : undefined);
      saveCurrentUser(data.user);

      if (isKeepLoggedIn) {
        localStorage.setItem('keepLoggedIn', 'true');
      }

      navigate('/rankingZone', { replace: true });
    } catch (err) {
      console.error('로그인 에러:', err);
      const message =
        err instanceof Error ? err.message : '로그인 요청에 실패했습니다. 다시 시도해주세요.';
      openModal('로그인 실패', message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className={styles.container}>
      <div className={styles.hero}>
        <div className={styles.heroTitle}>
          로그인
          <br />
          환영!
        </div>
        <div className={styles.heroDesc}>
          부가적인 설명 글 또는 이 공간을
          <br />
          일러스트로 해도 괜찮을 듯
        </div>
      </div>

      <div className={styles.formBlock}>
        <label className={styles.label}>이메일</label>
        <input
          type="email"
          className={styles.input}
          placeholder="이메일을 입력하세요"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              handleLogin();
            }
          }}
        />
        <div className={styles.line} />

        <label className={styles.label}>비밀번호</label>
        <input
          type="password"
          className={styles.input}
          placeholder="비밀번호를 입력하세요"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              handleLogin();
            }
          }}
        />
        <div className={styles.line} />
      </div>

      <div className={styles.optionRow}>
        <button
          type="button"
          className={styles.keepLoginButton}
          onClick={() => setIsKeepLoggedIn((prev) => !prev)}
        >
          <CheckIcon checked={isKeepLoggedIn} />
          <span className={styles.optionText}>로그인 상태 유지</span>
        </button>

        <button
          type="button"
          className={styles.linkButton}
          onClick={() => navigate('/passwordReset')}
        >
          비밀번호를 잊으셨나요?
        </button>
      </div>

      <button
        type="button"
        className={`${styles.primaryButton} ${loading ? styles.buttonDisabled : ''}`}
        onClick={handleLogin}
        disabled={loading}
      >
        {loading ? '로그인 중...' : '로그인'}
      </button>

      <div className={styles.orWrap}>
        <div className={styles.orLine} />
        <span className={styles.orText}>OR</span>
        <div className={styles.orLine} />
      </div>

      <div className={styles.socialRow}>
        <button type="button" className={styles.socialButton} aria-label="카카오 로그인 준비중">
          <KakaoIcon className={styles.socialLogo} />
        </button>

        <button type="button" className={styles.socialButton} aria-label="네이버 로그인 준비중">
          <NaverIcon className={styles.socialLogo} />
        </button>

        <button type="button" className={styles.socialButton} aria-label="구글 로그인 준비중">
          <GoogleIcon className={styles.socialLogo} />
        </button>
      </div>

      <div className={styles.bottomText}>
        <span className={styles.bottomMuted}>계정이 없으신가요?</span>
        <button type="button" className={styles.bottomLink} onClick={() => navigate('/signup')}>
          회원가입
        </button>
      </div>

      {showModal && (
        <div className={styles.modalBackdrop}>
          <div className={styles.modalCard}>
            <div className={styles.modalIcon}>!</div>
            <h3 className={styles.modalTitle}>{modalTitle}</h3>
            <p className={styles.modalMessage}>{modalMessage}</p>
            <button type="button" className={styles.modalButton} onClick={closeModal}>
              확인
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default Login;
