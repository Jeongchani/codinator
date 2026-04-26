import { FormEvent, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { SquareCheck } from 'lucide-react';
import type { LoginResponse } from '@codinator/contracts';

import {
  clearAuthTokens,
  fetcher,
  saveAuthTokens,
  saveCurrentUser,
} from '../../lib/api';

import { KakaoIcon, NaverIcon, GoogleIcon } from '../../components/icons/social';

import loginHeroImage from '../../assets/login/login-hero.png';

import styles from './Login.module.css';

export default function Login() {
  const navigate = useNavigate();

  const [email, setEmail] = useState("alice@codinator.com");
  const [password, setPassword] = useState("1234");

  const [keepLoggedIn, setKeepLoggedIn] = useState(() => {
    return localStorage.getItem('keepLoggedIn') === 'true';
  });

  const [loading, setLoading] = useState(false);

  const [showModal, setShowModal] = useState(false);
  const [modalTitle, setModalTitle] = useState('안내');
  const [modalMessage, setModalMessage] = useState('');

  const openModal = (title: string, message: string) => {
    setModalTitle(title);
    setModalMessage(message);
    setShowModal(true);
  };

  const closeModal = () => {
    setShowModal(false);
  };

  const handleLogin = async () => {
    const trimmedEmail = email.trim();

    if (loading) return;

    if (!trimmedEmail || !password) {
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
          password,
        }),
      });

      clearAuthTokens();

      saveAuthTokens(
        data.accessToken,
        keepLoggedIn ? data.refreshToken : undefined,
      );

      saveCurrentUser(data.user);

      if (keepLoggedIn) {
        localStorage.setItem('keepLoggedIn', 'true');
      } else {
        localStorage.removeItem('keepLoggedIn');
      }

      navigate('/rankingZone', { replace: true });
    } catch (error) {
      console.error('로그인 에러:', error);

      const message =
        error instanceof Error
          ? error.message
          : '로그인 요청에 실패했습니다. 다시 시도해주세요.';

      openModal('로그인 실패', message);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    void handleLogin();
  };

  return (
    <main className={styles.root}>
      <img
        src={loginHeroImage}
        alt="당신의 패션을 Develop하다"
        className={styles.heroImage}
        draggable={false}
      />

      <form className={styles.form} onSubmit={handleSubmit} noValidate>
        <label className={styles.emailLabel} htmlFor="email">
          이메일
        </label>

        <input
          id="email"
          type="email"
          className={styles.input}
          value={email}
          placeholder="이메일을 입력하세요"
          autoComplete="email"
          disabled={loading}
          onChange={(event) => setEmail(event.target.value)}
        />

        <label className={styles.passwordLabel} htmlFor="password">
          비밀번호
        </label>

        <input
          id="password"
          type="password"
          className={styles.input}
          value={password}
          placeholder="비밀번호를 입력해 주세요"
          autoComplete="current-password"
          disabled={loading}
          onChange={(event) => setPassword(event.target.value)}
        />

        <div className={styles.optionRow}>
          <button
            type="button"
            className={styles.keepLoginButton}
            disabled={loading}
            aria-pressed={keepLoggedIn}
            onClick={() => setKeepLoggedIn((prev) => !prev)}
          >
            <SquareCheck
              size={25}
              strokeWidth={keepLoggedIn ? 2.6 : 1.7}
              className={
                keepLoggedIn
                  ? styles.keepLoginIconChecked
                  : styles.keepLoginIconUnchecked
              }
              aria-hidden="true"
            />

            <span className={styles.keepLoginText}>로그인 상태 유지</span>
          </button>

          <button
            type="button"
            className={styles.passwordResetButton}
            disabled={loading}
            onClick={() => navigate('/passwordReset')}
          >
            비밀번호를 잊으셨나요?
          </button>
        </div>

        <button
          type="submit"
          className={`${styles.loginButton} ${loading ? styles.buttonDisabled : ''}`}
          disabled={loading}
        >
          {loading ? '로그인 중...' : '로그인'}
        </button>

        <div className={styles.orRow} aria-hidden="true">
          <span className={styles.orLine} />
          <span className={styles.orText}>OR</span>
          <span className={styles.orLine} />
        </div>

        <div className={styles.socialButtonRow}>
          <button
            type="button"
            className={styles.socialButton}
            aria-label="카카오 간편 로그인"
            disabled={loading}
          >
            <span className={styles.socialLogo}>
              <KakaoIcon />
            </span>
          </button>

          <button
            type="button"
            className={styles.socialButton}
            aria-label="네이버 간편 로그인"
            disabled={loading}
          >
            <span className={styles.socialLogo}>
              <NaverIcon />
            </span>
          </button>

          <button
            type="button"
            className={styles.socialButton}
            aria-label="구글 간편 로그인"
            disabled={loading}
          >
            <span className={styles.socialLogo}>
              <GoogleIcon />
            </span>
          </button>
        </div>

        <div className={styles.signupRow}>
          <span className={styles.signupGuideText}>계정이 없으신가요?</span>

          <button
            type="button"
            className={styles.signupButton}
            disabled={loading}
            onClick={() => navigate('/signup')}
          >
            회원가입
          </button>
        </div>
      </form>

      {showModal ? (
        <div className={styles.modalBackdrop}>
          <div className={styles.modalCard}>
            <div className={styles.modalIcon}>!</div>

            <h3 className={styles.modalTitle}>{modalTitle}</h3>

            <p className={styles.modalMessage}>{modalMessage}</p>

            <button
              type="button"
              className={styles.modalButton}
              onClick={closeModal}
            >
              확인
            </button>
          </div>
        </div>
      ) : null}
    </main>
  );
}