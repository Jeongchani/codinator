import React, { useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import type { Gender, SignupRequest, SignupResponse } from "@codinator/contracts";
import { fetcher } from "../../lib/api";
import styles from "./Signup.module.css";
import { KakaoIcon, NaverIcon, GoogleIcon } from "../../components/icons/social";

type CheckResponse = {
  available: boolean;
  message?: string;
};

type SignupCheckRequest = {
  type: "EMAIL" | "NICKNAME" | "PASSWORD";
  value: string;
};

type SignupGender = Gender | "";
type ModalType = "success" | "error" | "info";

function CheckIcon({ checked }: { checked: boolean }) {
  return (
    <svg
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={styles.genderCheckSvg}
    >
      <rect
        x="1"
        y="1"
        width="22"
        height="22"
        rx="6"
        stroke={checked ? "#111111" : "#B3B3B3"}
        strokeWidth="2"
      />
      {checked && (
        <path
          d="M7 12.5L10.2 15.5L17 8.8"
          stroke="#111111"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      )}
    </svg>
  );
}

function RequiredLabel({ text }: { text: string }) {
  return (
    <span className={styles.requiredLabel}>
      {text}
      <span className={styles.requiredMark}>*</span>
    </span>
  );
}

function ModalStatusIcon({ type }: { type: ModalType }) {
  if (type === "success") {
    return (
      <div className={`${styles.modalIcon} ${styles.modalIconSuccess}`}>
        <svg width="26" height="26" viewBox="0 0 24 24" fill="none">
          <path
            d="M6.5 12.5L10 16L17.5 8.5"
            stroke="white"
            strokeWidth="2.4"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </div>
    );
  }

  return <div className={`${styles.modalIcon} ${styles.modalIconError}`}>!</div>;
}

export default function Signup() {
  const navigate = useNavigate();

  const [nickname, setNickname] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [birth, setBirth] = useState("");
  const [gender, setGender] = useState<SignupGender>("");

  const [phone1, setPhone1] = useState("");
  const [phone2, setPhone2] = useState("");
  const [phone3, setPhone3] = useState("");

  const phone1Ref = useRef<HTMLInputElement | null>(null);
  const phone2Ref = useRef<HTMLInputElement | null>(null);
  const phone3Ref = useRef<HTMLInputElement | null>(null);

  const [nicknameChecked, setNicknameChecked] = useState(false);
  const [emailChecked, setEmailChecked] = useState(false);
  const [nicknameAvailable, setNicknameAvailable] = useState<boolean | null>(null);
  const [emailAvailable, setEmailAvailable] = useState<boolean | null>(null);

  const [nicknameCheckLoading, setNicknameCheckLoading] = useState(false);
  const [emailCheckLoading, setEmailCheckLoading] = useState(false);
  const [signupLoading, setSignupLoading] = useState(false);

  const [showModal, setShowModal] = useState(false);
  const [modalTitle, setModalTitle] = useState("안내");
  const [modalMessage, setModalMessage] = useState("");
  const [modalType, setModalType] = useState<ModalType>("info");
  const [modalAction, setModalAction] = useState<(() => void) | null>(null);

  const openModal = (
    title: string,
    message: string,
    type: ModalType = "info",
    action?: () => void
  ) => {
    setModalTitle(title);
    setModalMessage(message);
    setModalType(type);
    setModalAction(() => action ?? null);
    setShowModal(true);
  };

  const closeModal = () => {
    setShowModal(false);

    if (modalAction) {
      const action = modalAction;
      setModalAction(null);
      action();
      return;
    }

    setModalAction(null);
  };

  const emailRegex = useMemo(() => /^[^\s@]+@[^\s@]+\.[^\s@]+$/, []);
  const birthRegex = useMemo(() => /^\d{8}$/, []);
  const phoneRegex = useMemo(() => /^01[0-9]-\d{3,4}-\d{4}$/, []);

  const phone = `${phone1}-${phone2}-${phone3}`;

  const isNicknameValid = nickname.trim().length > 0;
  const isEmailValid = emailRegex.test(email.trim());
  const isPasswordValid = password.trim().length >= 4;
  const isBirthValid = birthRegex.test(birth.trim());
  const isGenderValid = gender === "MALE" || gender === "FEMALE";
  const isPhoneValid = phoneRegex.test(phone);

  const isNicknameCheckDone = nicknameChecked && nicknameAvailable === true;
  const isEmailCheckDone = emailChecked && emailAvailable === true;

  const isFormFilled =
    nickname.trim() !== "" &&
    email.trim() !== "" &&
    password.trim() !== "" &&
    birth.trim() !== "" &&
    gender !== "" &&
    phone1.trim() !== "" &&
    phone2.trim() !== "" &&
    phone3.trim() !== "";

  const canSubmit =
    isFormFilled &&
    isNicknameValid &&
    isEmailValid &&
    isPasswordValid &&
    isBirthValid &&
    isGenderValid &&
    isPhoneValid &&
    isNicknameCheckDone &&
    isEmailCheckDone &&
    !signupLoading;

  const resetNicknameCheck = (value: string) => {
    setNickname(value);
    setNicknameChecked(false);
    setNicknameAvailable(null);
  };

  const resetEmailCheck = (value: string) => {
    setEmail(value);
    setEmailChecked(false);
    setEmailAvailable(null);
  };

  const requestSignupCheck = async (body: SignupCheckRequest): Promise<CheckResponse> => {
    return fetcher<CheckResponse>("/auth/signup/check", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
  };

  const handleCheckNickname = async () => {
    const trimmed = nickname.trim();

    if (!trimmed) {
      openModal("닉네임 확인", "닉네임을 먼저 입력해주세요.", "error");
      return;
    }

    setNicknameCheckLoading(true);

    try {
      const data = await requestSignupCheck({
        type: "NICKNAME",
        value: trimmed,
      });

      setNicknameChecked(true);
      setNicknameAvailable(data.available);

      openModal(
        "닉네임 중복확인",
        data.available
          ? data.message || "사용 가능한 닉네임입니다."
          : data.message || "이미 사용 중인 닉네임입니다.",
        data.available ? "success" : "error"
      );
    } catch (error) {
      console.error("닉네임 중복체크 오류:", error);
      setNicknameChecked(false);
      setNicknameAvailable(null);

      openModal(
        "오류",
        error instanceof Error ? error.message : "닉네임 중복확인 요청에 실패했습니다.",
        "error"
      );
    } finally {
      setNicknameCheckLoading(false);
    }
  };

  const handleCheckEmail = async () => {
    const trimmed = email.trim();

    if (!trimmed) {
      openModal("아이디 확인", "아이디(이메일)를 먼저 입력해주세요.", "error");
      return;
    }

    if (!isEmailValid) {
      openModal("아이디 확인", "올바른 이메일 형식을 입력해주세요.", "error");
      return;
    }

    setEmailCheckLoading(true);

    try {
      const data = await requestSignupCheck({
        type: "EMAIL",
        value: trimmed,
      });

      setEmailChecked(true);
      setEmailAvailable(data.available);

      openModal(
        "아이디 중복확인",
        data.available
          ? data.message || "사용 가능한 아이디입니다."
          : data.message || "이미 사용 중인 아이디입니다.",
        data.available ? "success" : "error"
      );
    } catch (error) {
      console.error("이메일 중복체크 오류:", error);
      setEmailChecked(false);
      setEmailAvailable(null);

      openModal(
        "오류",
        error instanceof Error ? error.message : "아이디 중복확인 요청에 실패했습니다.",
        "error"
      );
    } finally {
      setEmailCheckLoading(false);
    }
  };

  const handlePhone1Change = (value: string) => {
    const next = value.replace(/[^0-9]/g, "").slice(0, 3);
    setPhone1(next);

    if (next.length === 3) {
      phone2Ref.current?.focus();
    }
  };

  const handlePhone2Change = (value: string) => {
    const next = value.replace(/[^0-9]/g, "").slice(0, 4);
    setPhone2(next);

    if (next.length === 4) {
      phone3Ref.current?.focus();
    }
  };

  const handlePhone3Change = (value: string) => {
    const next = value.replace(/[^0-9]/g, "").slice(0, 4);
    setPhone3(next);
  };

  const handlePhoneKeyDown = (
    e: React.KeyboardEvent<HTMLInputElement>,
    currentValue: string,
    prevRef?: React.RefObject<HTMLInputElement | null>
  ) => {
    if (e.key === "Backspace" && currentValue.length === 0) {
      prevRef?.current?.focus();
    }
  };

  const validateBeforeSubmit = () => {
    if (!isFormFilled) {
      openModal("입력 확인", "모든 항목은 필수 입력입니다.", "error");
      return false;
    }

    if (!nicknameChecked || nicknameAvailable !== true) {
      openModal("닉네임 확인", "닉네임 중복확인을 완료해주세요.", "error");
      return false;
    }

    if (!emailChecked || emailAvailable !== true) {
      openModal("아이디 확인", "아이디 중복확인을 완료해주세요.", "error");
      return false;
    }

    if (!isEmailValid) {
      openModal("아이디 확인", "올바른 이메일 형식을 입력해주세요.", "error");
      return false;
    }

    if (!isPasswordValid) {
      openModal("비밀번호 확인", "비밀번호는 4자 이상 입력해주세요.", "error");
      return false;
    }

    if (!isBirthValid) {
      openModal(
        "생년월일 확인",
        "생년월일은 8자리 숫자로 입력해주세요. 예: 19900101",
        "error"
      );
      return false;
    }

    if (!isGenderValid) {
      openModal("성별 확인", "성별을 선택해주세요.", "error");
      return false;
    }

    if (!isPhoneValid) {
      openModal("전화번호 확인", "전화번호를 정확히 입력해주세요.", "error");
      return false;
    }

    return true;
  };

  const handleSignup = async () => {
    if (!validateBeforeSubmit()) return;
    if (gender !== "MALE" && gender !== "FEMALE") return;

    setSignupLoading(true);

    try {
      const requestBody: SignupRequest = {
        email: email.trim(),
        nickname: nickname.trim(),
        password: password.trim(),
        birthDate: `${birth.slice(0, 4)}-${birth.slice(4, 6)}-${birth.slice(6, 8)}`,
        gender,
        phoneNumber: `${phone1}${phone2}${phone3}`,
      };

      await fetcher<SignupResponse>("/auth/signup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(requestBody),
      });

      openModal("회원가입 완료", "회원가입이 완료되었습니다.", "success", () =>
        navigate("/login")
      );
    } catch (error) {
      console.error("회원가입 오류:", error);
      openModal(
        "회원가입 실패",
        error instanceof Error ? error.message : "회원가입 요청에 실패했습니다.",
        "error"
      );
    } finally {
      setSignupLoading(false);
    }
  };

  return (
    <div className={styles.container}>
      <div className={styles.hero}>
        <h1 className={styles.heroTitle}>
          회원가입
          <br />
          환영!
        </h1>
        <p className={styles.heroDesc}>빌더스도 해도 괜찮을 듯</p>
      </div>

      <div className={styles.formBlock}>
        <div className={styles.field}>
          <div className={styles.fieldHeader}>
            <label className={styles.label}>
              <RequiredLabel text="닉네임" />
            </label>
            <button
              type="button"
              className={`${styles.checkButton} ${
                isNicknameCheckDone ? styles.checkButtonDone : ""
              }`}
              onClick={handleCheckNickname}
              disabled={nicknameCheckLoading || nickname.trim() === ""}
            >
              {nicknameCheckLoading ? "확인중..." : "중복확인"}
            </button>
          </div>
          <input
            type="text"
            className={styles.input}
            value={nickname}
            onChange={(e) => resetNicknameCheck(e.target.value)}
            placeholder="닉네임을 입력하세요"
          />
          <div className={styles.line} />
          <p className={styles.helperText}>
            {!nickname.trim() && "필수 입력 항목입니다."}
            {nickname.trim() && !nicknameChecked && "닉네임 중복확인을 해주세요."}
            {nicknameAvailable === true && "사용 가능한 닉네임입니다."}
            {nicknameAvailable === false && "이미 사용 중인 닉네임입니다."}
          </p>
        </div>

        <div className={styles.field}>
          <div className={styles.fieldHeader}>
            <label className={styles.label}>
              <RequiredLabel text="아이디(이메일)" />
            </label>
            <button
              type="button"
              className={`${styles.checkButton} ${
                isEmailCheckDone ? styles.checkButtonDone : ""
              }`}
              onClick={handleCheckEmail}
              disabled={emailCheckLoading || email.trim() === ""}
            >
              {emailCheckLoading ? "확인중..." : "중복확인"}
            </button>
          </div>
          <input
            type="email"
            className={styles.input}
            value={email}
            onChange={(e) => resetEmailCheck(e.target.value)}
            placeholder="이메일을 입력하세요"
          />
          <div className={styles.line} />
          <p className={styles.helperText}>
            {!email.trim() && "필수 입력 항목입니다."}
            {email.trim() && !isEmailValid && "올바른 이메일 형식으로 입력해주세요."}
            {email.trim() && isEmailValid && !emailChecked && "아이디 중복확인을 해주세요."}
            {emailAvailable === true && "사용 가능한 아이디입니다."}
            {emailAvailable === false && "이미 사용 중인 아이디입니다."}
          </p>
        </div>

        <div className={styles.field}>
          <label className={styles.label}>
            <RequiredLabel text="비밀번호" />
          </label>
          <input
            type="password"
            className={styles.input}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="비밀번호를 입력하세요"
          />
          <div className={styles.line} />
          <p className={styles.helperText}>
            {!password.trim() && "필수 입력 항목입니다."}
            {password.trim() && !isPasswordValid && "비밀번호는 4자 이상 입력해주세요."}
            {isPasswordValid && "사용 가능한 비밀번호 형식입니다."}
          </p>
        </div>

        <div className={styles.field}>
          <label className={styles.label}>
            <RequiredLabel text="생년월일" />
          </label>
          <input
            type="text"
            className={styles.input}
            value={birth}
            onChange={(e) => setBirth(e.target.value.replace(/[^0-9]/g, "").slice(0, 8))}
            placeholder="19900101"
          />
          <div className={styles.line} />
          <p className={styles.helperText}>
            {!birth.trim() && "필수 입력 항목입니다."}
            {birth.trim() && !isBirthValid && "생년월일은 8자리 숫자로 입력해주세요."}
            {isBirthValid && "올바른 생년월일 형식입니다."}
          </p>
        </div>

        <div className={`${styles.field} ${styles.genderField}`}>
          <label className={styles.label}>
            <RequiredLabel text="성별" />
          </label>
          <div className={styles.genderRow}>
            <button
              type="button"
              className={styles.genderButton}
              onClick={() => setGender("MALE")}
            >
              <CheckIcon checked={gender === "MALE"} />
              <span className={gender === "MALE" ? styles.genderTextActive : styles.genderText}>
                남성
              </span>
            </button>

            <button
              type="button"
              className={styles.genderButton}
              onClick={() => setGender("FEMALE")}
            >
              <CheckIcon checked={gender === "FEMALE"} />
              <span className={gender === "FEMALE" ? styles.genderTextActive : styles.genderText}>
                여성
              </span>
            </button>
          </div>
          <div className={styles.line} />
          <p className={styles.helperText}>
            {!gender && "필수 선택 항목입니다."}
            {gender && "선택되었습니다."}
          </p>
        </div>

        <div className={styles.field}>
          <label className={styles.label}>
            <RequiredLabel text="전화번호" />
          </label>
          <div className={styles.phoneRow}>
            <input
              ref={phone1Ref}
              type="text"
              inputMode="numeric"
              className={styles.phoneInput}
              value={phone1}
              onChange={(e) => handlePhone1Change(e.target.value)}
              onKeyDown={(e) => handlePhoneKeyDown(e, phone1)}
              placeholder="010"
              maxLength={3}
            />
            <span className={styles.phoneDash}>-</span>
            <input
              ref={phone2Ref}
              type="text"
              inputMode="numeric"
              className={styles.phoneInput}
              value={phone2}
              onChange={(e) => handlePhone2Change(e.target.value)}
              onKeyDown={(e) => handlePhoneKeyDown(e, phone2, phone1Ref)}
              placeholder="1234"
              maxLength={4}
            />
            <span className={styles.phoneDash}>-</span>
            <input
              ref={phone3Ref}
              type="text"
              inputMode="numeric"
              className={styles.phoneInput}
              value={phone3}
              onChange={(e) => handlePhone3Change(e.target.value)}
              onKeyDown={(e) => handlePhoneKeyDown(e, phone3, phone2Ref)}
              placeholder="5678"
              maxLength={4}
            />
          </div>
          <p className={styles.helperText}>
            {!phone1 && !phone2 && !phone3 && "필수 입력 항목입니다."}
            {(phone1 || phone2 || phone3) && !isPhoneValid && "올바른 전화번호 형식이 아닙니다."}
            {isPhoneValid && "올바른 전화번호 형식입니다."}
          </p>
        </div>
      </div>

      <button
        type="button"
        className={`${styles.primaryButton} ${!canSubmit ? styles.buttonDisabled : ""}`}
        onClick={handleSignup}
        disabled={!canSubmit}
      >
        {signupLoading ? "회원가입 중..." : "회원가입"}
      </button>

      <div className={styles.orWrap}>
        <div className={styles.orLine} />
        <span className={styles.orText}>OR</span>
        <div className={styles.orLine} />
      </div>

      <div className={styles.socialRow}>
        <button type="button" className={styles.socialButton} aria-label="카카오 회원가입 준비중">
          <KakaoIcon className={styles.socialLogo} />
        </button>

        <button type="button" className={styles.socialButton} aria-label="네이버 회원가입 준비중">
          <NaverIcon className={styles.socialLogo} />
        </button>

        <button type="button" className={styles.socialButton} aria-label="구글 회원가입 준비중">
          <GoogleIcon className={styles.socialLogo} />
        </button>
      </div>

      <div className={styles.bottomText}>
        <span className={styles.bottomMuted}>계정이 이미 있으신가요?</span>
        <button type="button" className={styles.bottomLink} onClick={() => navigate("/login")}>
          로그인
        </button>
      </div>

      {showModal && (
        <div className={styles.modalBackdrop}>
          <div className={styles.modalCard}>
            <ModalStatusIcon type={modalType} />
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
}