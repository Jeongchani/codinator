import React from "react";
import { useNavigate } from "react-router-dom";
import styles from "./AuthEntry.module.css";
import { KakaoIcon, NaverIcon, GoogleIcon } from "../../components/icons/social";

export default function AuthEntry() {
  const navigate = useNavigate();

  const handleLogin = () => {
    navigate("/login");
  };

  const handleSignup = () => {
    navigate("/signup");
  };

  return (
    <div className={styles.container}>
      <section className={styles.topArea}>
        <div className={styles.colorPanel}>
          <div className={styles.colorMeta}>PANTONE COLOR OF THE YEAR 2026</div>
          <div className={styles.colorName}>Cloud Dancer</div>
          <div className={styles.colorCode}>11-4201</div>
          <div className={styles.colorSwatch} />
        </div>
      </section>

      <section className={styles.bottomSheet}>
        <h1 className={styles.title}>로그인</h1>
      </section>

      <button type="button" className={styles.loginButton} onClick={handleLogin}>
        로그인
      </button>

      <div className={styles.orWrap} aria-hidden="true">
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
        <button type="button" className={styles.bottomLink} onClick={handleSignup}>
          회원가입
        </button>
      </div>
    </div>
  );
}