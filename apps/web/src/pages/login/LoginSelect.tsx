import { useNavigate } from 'react-router-dom';

import loginSelectHeroImage from '../../assets/login/login-select-hero.png';

import styles from './LoginSelect.module.css';

type SocialProvider = 'kakao' | 'naver' | 'google';

export default function LoginSelect() {
  const navigate = useNavigate();

  const handleLoginClick = () => {
    navigate('/login');
  };

  const handleSignupClick = () => {
    navigate('/signup');
  };

  const handleSocialLoginClick = (provider: SocialProvider) => {
    console.log(`${provider} login clicked`);
  };

  return (
    <main className={styles.root}>
      <section className={styles.heroSection} aria-label="로그인 선택 이미지">
        <img
          src={loginSelectHeroImage}
          alt="내 코디 어떻게 보일까?"
          className={styles.heroImage}
          draggable={false}
        />
      </section>

      <section className={styles.contentPanel}>
        <h1 className={styles.title}>내 코디 평가 시작하기</h1>

        <button type="button" className={styles.loginButton} onClick={handleLoginClick}>
          로그인
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
            onClick={() => handleSocialLoginClick('kakao')}
          />

          <button
            type="button"
            className={styles.socialButton}
            aria-label="네이버 간편 로그인"
            onClick={() => handleSocialLoginClick('naver')}
          />

          <button
            type="button"
            className={styles.socialButton}
            aria-label="구글 간편 로그인"
            onClick={() => handleSocialLoginClick('google')}
          />
        </div>

        <div className={styles.signupRow}>
          <span className={styles.signupGuideText}>계정이 없으신가요?</span>

          <button type="button" className={styles.signupButton} onClick={handleSignupClick}>
            회원가입
          </button>
        </div>
      </section>
    </main>
  );
}