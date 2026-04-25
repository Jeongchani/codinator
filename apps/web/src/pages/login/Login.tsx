import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import type { LoginResponse } from "@codinator/contracts";
import {
  clearAuthTokens,
  fetcher,
  saveAuthTokens,
  saveCurrentUser,
} from "../../lib/api";
import styles from "./Login.module.css";
import { KakaoIcon, NaverIcon, GoogleIcon } from "../../components/icons/social";

function CheckIcon({ checked }: { checked: boolean }) {
  return (
    <svg
      width="25"
      height="25"
      viewBox="0 0 25 25"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={styles.checkboxSvg}
    >
      <path
        d="M15.6251 10.4167L10.9639 14.5834L9.37508 13.1631M20.8334 7.29173L20.8334 17.7084C20.8334 19.4343 19.4343 20.8334 17.7084 20.8334H7.29175C5.56586 20.8334 4.16675 19.4343 4.16675 17.7084V7.29173C4.16675 5.56585 5.56586 4.16675 7.29175 4.16675H17.7084C19.4343 4.16675 20.8334 5.56585 20.8334 7.29173Z"
        stroke={checked ? "#111111" : "#999999"}
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

const Login: React.FC = () => {
  const navigate = useNavigate();

  const [email, setEmail] = useState("alice@codinator.com");
  const [password, setPassword] = useState("1234");
  const [isKeepLoggedIn, setIsKeepLoggedIn] = useState(() => localStorage.getItem("keepLoggedIn") === "true");
  const [loading, setLoading] = useState(false);

  const [showModal, setShowModal] = useState(false);
  const [modalTitle, setModalTitle] = useState("안내");
  const [modalMessage, setModalMessage] = useState("");

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
      openModal("입력 확인", "이메일과 비밀번호를 모두 입력해주세요.");
      return;
    }

    setLoading(true);

    try {
      const data = await fetcher<LoginResponse>("/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: trimmedEmail,
          password: trimmedPassword,
        }),
      });

      clearAuthTokens();
      saveAuthTokens(
        data.accessToken,
        isKeepLoggedIn ? data.refreshToken : undefined,
      );
      saveCurrentUser(data.user);

      if (isKeepLoggedIn) {
        localStorage.setItem("keepLoggedIn", "true");
      }

      navigate("/rankingZone", { replace: true });
    } catch (err) {
      console.error("로그인 에러:", err);
      const message =
        err instanceof Error
          ? err.message
          : "로그인 요청에 실패했습니다. 다시 시도해주세요.";
      openModal("로그인 실패", message);
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
            if (e.key === "Enter") {
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
            if (e.key === "Enter") {
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
          onClick={() => navigate("/passwordReset")}
        >
          비밀번호를 잊으셨나요?
        </button>
      </div>

      <button
        type="button"
        className={`${styles.primaryButton} ${loading ? styles.buttonDisabled : ""}`}
        onClick={handleLogin}
        disabled={loading}
      >
        {loading ? "로그인 중..." : "로그인"}
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
        <button
          type="button"
          className={styles.bottomLink}
          onClick={() => navigate("/signup")}
        >
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
