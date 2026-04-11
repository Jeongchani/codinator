import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent,
} from "react";
import { useNavigate } from "react-router-dom";
import { ChevronLeft, Menu, Pencil } from "lucide-react";
import SideMenu from "../../components/SideMenu";
import { clearAuthTokens, fetcher, getAuthHeaders } from "../../lib/api";
import styles from "./MyPage.module.css";

type ActiveSection = "nickname" | "password" | "phone" | null;

type MeResponse = {
  id?: number;
  email?: string;
  nickname?: string;
  phoneNumber?: string | null;
};

type UpdateMeRequest = {
  nickname?: string;
  phoneNumber?: string;
};

type UpdatePasswordRequest = {
  currentPassword: string;
  newPassword: string;
};

type LoginRequest = {
  email: string;
  password: string;
};

const normalizePhoneDigits = (value: string) => value.replace(/[^0-9]/g, "");

const splitPhoneDigits = (value: string) => {
  const digits = normalizePhoneDigits(value);

  if (!digits) {
    return { phone1: "", phone2: "", phone3: "" };
  }

  const phone1 = digits.slice(0, 3);

  if (digits.length <= 3) {
    return { phone1, phone2: "", phone3: "" };
  }

  if (digits.length <= 7) {
    return {
      phone1,
      phone2: digits.slice(3),
      phone3: "",
    };
  }

  const middleLength = digits.length === 10 ? 3 : 4;

  return {
    phone1,
    phone2: digits.slice(3, 3 + middleLength),
    phone3: digits.slice(3 + middleLength, 3 + middleLength + 4),
  };
};

const formatPhoneNumber = (value: string) => {
  const digits = normalizePhoneDigits(value);

  if (!digits) return "전화번호";

  const { phone1, phone2, phone3 } = splitPhoneDigits(digits);

  if (!phone2 && !phone3) return phone1;
  if (!phone3) return `${phone1}-${phone2}`;

  return `${phone1}-${phone2}-${phone3}`;
};

export default function MyPage() {
  const navigate = useNavigate();

  const [menuOpen, setMenuOpen] = useState(false);
  const [activeSection, setActiveSection] = useState<ActiveSection>(null);

  const [originalNickname, setOriginalNickname] = useState("닉네임");
  const [originalEmail, setOriginalEmail] = useState("이메일");
  const [originalPhoneDigits, setOriginalPhoneDigits] = useState("");

  const [nicknameDraft, setNicknameDraft] = useState("닉네임");

  const [phone1, setPhone1] = useState("");
  const [phone2, setPhone2] = useState("");
  const [phone3, setPhone3] = useState("");

  const [currentPassword, setCurrentPassword] = useState("");
  const [currentPasswordChecked, setCurrentPasswordChecked] = useState(false);
  const [checkingCurrentPassword, setCheckingCurrentPassword] = useState(false);
  const [passwordCheckMessage, setPasswordCheckMessage] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [newPasswordConfirm, setNewPasswordConfirm] = useState("");

  const [pendingNickname, setPendingNickname] = useState<string | null>(null);
  const [pendingPhoneDigits, setPendingPhoneDigits] = useState<string | null>(
    null,
  );
  const [pendingPassword, setPendingPassword] =
    useState<UpdatePasswordRequest | null>(null);

  const [loadingProfile, setLoadingProfile] = useState(true);
  const [savingAll, setSavingAll] = useState(false);

  const nicknameInputRef = useRef<HTMLInputElement>(null);
  const currentPasswordRef = useRef<HTMLInputElement>(null);
  const phone1Ref = useRef<HTMLInputElement>(null);
  const phone2Ref = useRef<HTMLInputElement>(null);
  const phone3Ref = useRef<HTMLInputElement>(null);

  const nicknameMeasureRef = useRef<HTMLSpanElement>(null);
  const [nicknameWidth, setNicknameWidth] = useState(120);

  const displayedNickname = pendingNickname ?? originalNickname;
  const displayedPhone = pendingPhoneDigits ?? originalPhoneDigits;

  const phoneRegex = useMemo(() => /^01[0-9]\d{3,4}\d{4}$/, []);
  const isNicknameActive = activeSection === "nickname";
  const isPasswordActive = activeSection === "password";
  const isPhoneActive = activeSection === "phone";

  const phoneDigits = `${phone1}${phone2}${phone3}`;
  const isPhoneValid = phoneRegex.test(phoneDigits);
  const isPasswordReady =
    currentPassword.trim() !== "" &&
    currentPasswordChecked &&
    newPassword.trim() !== "" &&
    newPasswordConfirm.trim() !== "" &&
    newPassword === newPasswordConfirm;

  const hasPendingChanges =
    pendingNickname !== null ||
    pendingPhoneDigits !== null ||
    pendingPassword !== null;

  const canSubmitAll = hasPendingChanges && !savingAll;

  useEffect(() => {
    const loadMe = async () => {
      try {
        const data = await fetcher<MeResponse>("/users/me", {
          headers: getAuthHeaders(),
        });

        const fetchedNickname = data.nickname?.trim() || "닉네임";
        const fetchedEmail = data.email?.trim() || "이메일";
        const fetchedPhoneDigits = normalizePhoneDigits(data.phoneNumber ?? "");

        setOriginalNickname(fetchedNickname);
        setOriginalEmail(fetchedEmail);
        setOriginalPhoneDigits(fetchedPhoneDigits);
        setNicknameDraft(fetchedNickname);

        const split = splitPhoneDigits(fetchedPhoneDigits);
        setPhone1(split.phone1);
        setPhone2(split.phone2);
        setPhone3(split.phone3);
      } catch (error) {
        console.error("마이페이지 정보 조회 실패:", error);
      } finally {
        setLoadingProfile(false);
      }
    };

    void loadMe();
  }, []);

  useEffect(() => {
    if (isNicknameActive) {
      nicknameInputRef.current?.focus();
      const length = nicknameDraft.length;
      nicknameInputRef.current?.setSelectionRange(length, length);
    }

    if (isPasswordActive) {
      currentPasswordRef.current?.focus();
    }

    if (isPhoneActive) {
      phone1Ref.current?.focus();
    }
  }, [isNicknameActive, isPasswordActive, isPhoneActive, nicknameDraft]);

  useEffect(() => {
    if (nicknameMeasureRef.current) {
      setNicknameWidth(Math.max(48, nicknameMeasureRef.current.offsetWidth));
    }
  }, [isNicknameActive, nicknameDraft, displayedNickname]);

  const closeActiveEditor = () => {
    if (activeSection === "nickname") {
      setNicknameDraft(displayedNickname);
    }

    if (activeSection === "password") {
      setCurrentPassword("");
      setCurrentPasswordChecked(false);
      setCheckingCurrentPassword(false);
      setPasswordCheckMessage("");
      setNewPassword("");
      setNewPasswordConfirm("");
    }

    if (activeSection === "phone") {
      const split = splitPhoneDigits(displayedPhone);
      setPhone1(split.phone1);
      setPhone2(split.phone2);
      setPhone3(split.phone3);
    }

    setActiveSection(null);
  };

  const handleBack = () => {
    if (activeSection) {
      closeActiveEditor();
      return;
    }

    navigate(-1);
  };

  const openNicknameEditor = () => {
    setNicknameDraft(displayedNickname);
    setActiveSection("nickname");
  };

  const openPasswordEditor = () => {
    setCurrentPassword("");
    setCurrentPasswordChecked(false);
    setCheckingCurrentPassword(false);
    setPasswordCheckMessage("");
    setNewPassword("");
    setNewPasswordConfirm("");
    setActiveSection("password");
  };

  const openPhoneEditor = () => {
    setPhone1("");
    setPhone2("");
    setPhone3("");
    setActiveSection("phone");
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
    e: KeyboardEvent<HTMLInputElement>,
    currentValue: string,
    prevRef?: React.RefObject<HTMLInputElement | null>,
  ) => {
    if (e.key === "Backspace" && currentValue.length === 0) {
      prevRef?.current?.focus();
    }
  };

  const handleCurrentPasswordCheck = async () => {
    if (!currentPassword.trim()) return;
    if (!originalEmail.trim()) return;

    setCheckingCurrentPassword(true);
    setPasswordCheckMessage("");

    try {
      await fetcher("/auth/login", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          email: originalEmail,
          password: currentPassword.trim(),
        } satisfies LoginRequest),
      });

      setCurrentPasswordChecked(true);
      setPasswordCheckMessage("현재 비밀번호가 확인되었습니다.");
    } catch (error) {
      console.error("현재 비밀번호 확인 실패:", error);
      setCurrentPasswordChecked(false);
      setPasswordCheckMessage("현재 비밀번호가 일치하지 않습니다.");
    } finally {
      setCheckingCurrentPassword(false);
    }
  };

  const applyNicknameChange = () => {
    const nextNickname = nicknameDraft.trim();
    if (!nextNickname) return;

    if (nextNickname === originalNickname) {
      setPendingNickname(null);
    } else {
      setPendingNickname(nextNickname);
    }

    setActiveSection(null);
  };

  const applyPasswordChange = () => {
    if (!isPasswordReady) return;

    setPendingPassword({
      currentPassword: currentPassword.trim(),
      newPassword: newPassword.trim(),
    });

    setActiveSection(null);
  };

  const applyPhoneChange = () => {
    if (!isPhoneValid) return;

    if (phoneDigits === originalPhoneDigits) {
      setPendingPhoneDigits(null);
    } else {
      setPendingPhoneDigits(phoneDigits);
    }

    setActiveSection(null);
  };

  const handleWithdraw = async () => {
    const confirmed = window.confirm("정말 회원 탈퇴하시겠습니까? 탈퇴 후에는 다시 복구할 수 없습니다.");

    if (!confirmed) {
      return;
    }

    try {
      await fetcher<{ success: boolean; message: string }>("/users/me", {
        method: "DELETE",
        headers: getAuthHeaders(),
      });

      clearAuthTokens();
      navigate("/loginSelect", { replace: true });
    } catch (error) {
      console.error("회원 탈퇴 실패:", error);
      window.alert(
        error instanceof Error ? error.message : "회원 탈퇴에 실패했습니다.",
      );
    }
  };

  const handleSubmitAll = async () => {
    if (!canSubmitAll) return;

    setSavingAll(true);

    try {
      const profileUpdateBody: UpdateMeRequest = {};

      if (pendingNickname !== null) {
        profileUpdateBody.nickname = pendingNickname;
      }

      if (pendingPhoneDigits !== null) {
        profileUpdateBody.phoneNumber = pendingPhoneDigits;
      }

      if (Object.keys(profileUpdateBody).length > 0) {
        await fetcher("/users/me", {
          method: "PATCH",
          headers: {
            ...getAuthHeaders(),
            "Content-Type": "application/json",
          },
          body: JSON.stringify(profileUpdateBody),
        });
      }

      if (pendingPassword) {
        await fetcher("/users/me/password", {
          method: "PATCH",
          headers: {
            ...getAuthHeaders(),
            "Content-Type": "application/json",
          },
          body: JSON.stringify(pendingPassword),
        });
      }

      if (pendingNickname !== null) {
        setOriginalNickname(pendingNickname);
        setNicknameDraft(pendingNickname);
        localStorage.setItem("nickname", pendingNickname);
      }

      if (pendingPhoneDigits !== null) {
        setOriginalPhoneDigits(pendingPhoneDigits);
        const split = splitPhoneDigits(pendingPhoneDigits);
        setPhone1(split.phone1);
        setPhone2(split.phone2);
        setPhone3(split.phone3);
      }

      setPendingNickname(null);
      setPendingPhoneDigits(null);
      setPendingPassword(null);

      setCurrentPassword("");
      setCurrentPasswordChecked(false);
      setCheckingCurrentPassword(false);
      setPasswordCheckMessage("");
      setNewPassword("");
      setNewPasswordConfirm("");
    } catch (error) {
      console.error("마이페이지 수정 실패:", error);
    } finally {
      setSavingAll(false);
    }
  };

  return (
    <>
      <div className={styles.container}>
        <header className={styles.header}>
          <div className={styles.headerInner}>
            <button
              type="button"
              className={styles.headerIconButton}
              onClick={handleBack}
              aria-label="뒤로가기"
            >
              <ChevronLeft size={25} strokeWidth={2.2} />
            </button>

            <h1 className={styles.title}>마이 페이지</h1>

            <button
              type="button"
              className={styles.menuButton}
              onClick={() => setMenuOpen(true)}
              aria-label="메뉴 열기"
            >
              <Menu size={25} strokeWidth={2.2} />
            </button>
          </div>
        </header>

        <main className={styles.contentArea}>
          <section className={styles.nicknameSection}>
            <span ref={nicknameMeasureRef} className={styles.nicknameMeasure}>
              {(isNicknameActive ? nicknameDraft : displayedNickname) || "닉네임"}
            </span>

            <div className={styles.nicknameTopRow}>
              <div className={styles.nicknameTextWrap}>
                <input
                  ref={nicknameInputRef}
                  type="text"
                  value={isNicknameActive ? nicknameDraft : displayedNickname}
                  onChange={(e) => setNicknameDraft(e.target.value)}
                  readOnly={!isNicknameActive}
                  className={`${styles.nicknameInput} ${
                    isNicknameActive
                      ? styles.nicknameInputActive
                      : styles.nicknameInputInactive
                  }`}
                  style={{ width: `${nicknameWidth + 4}px` }}
                  aria-label="닉네임"
                />

                {isNicknameActive && (
                  <div
                    className={styles.nicknameUnderline}
                    style={{ width: `${nicknameWidth + 4}px` }}
                  />
                )}
              </div>

              {isNicknameActive ? (
                <button
                  type="button"
                  className={styles.actionButton}
                  onClick={applyNicknameChange}
                  disabled={!nicknameDraft.trim()}
                >
                  수정하기
                </button>
              ) : (
                <button
                  type="button"
                  className={`${styles.iconButton} ${styles.nicknameEditButton}`}
                  onClick={openNicknameEditor}
                  aria-label="닉네임 수정"
                >
                  <Pencil size={18} strokeWidth={2.2} />
                </button>
              )}
            </div>
          </section>

          <section className={styles.fieldList}>
            <div className={styles.fieldCard}>
              <input
                type="text"
                value={loadingProfile ? "불러오는 중..." : originalEmail}
                readOnly
                className={`${styles.fieldInput} ${styles.readonlyInput}`}
                aria-label="이메일"
              />
            </div>

            <div className={styles.fieldGroup}>
              <div className={styles.fieldCard}>
                <div className={styles.fieldText}>비밀번호</div>

                {isPasswordActive ? (
                  <button
                    type="button"
                    className={styles.actionButton}
                    onClick={applyPasswordChange}
                    disabled={!isPasswordReady}
                  >
                    수정하기
                  </button>
                ) : (
                  <button
                    type="button"
                    className={styles.iconButton}
                    onClick={openPasswordEditor}
                    aria-label="비밀번호 수정"
                  >
                    <Pencil size={18} strokeWidth={2.2} />
                  </button>
                )}
              </div>

              {isPasswordActive && (
                <div className={styles.editorBlock}>
                  <div className={styles.editorField}>
                    <div className={styles.fieldHeader}>
                      <label className={styles.editorLabel}>현재 비밀번호</label>
                      <button
                        type="button"
                        className={`${styles.checkButton} ${
                          currentPasswordChecked ? styles.checkButtonDone : ""
                        }`}
                        onClick={handleCurrentPasswordCheck}
                        disabled={
                          !currentPassword.trim() || checkingCurrentPassword
                        }
                      >
                        {checkingCurrentPassword
                          ? "확인중..."
                          : currentPasswordChecked
                          ? "확인완료"
                          : "확인"}
                      </button>
                    </div>

                    <input
                      ref={currentPasswordRef}
                      type="password"
                      value={currentPassword}
                      onChange={(e) => {
                        setCurrentPassword(e.target.value);
                        setCurrentPasswordChecked(false);
                        setPasswordCheckMessage("");
                      }}
                      placeholder="현재 비밀번호를 입력하세요"
                      className={styles.editorInput}
                    />

                    <p
                      className={`${styles.helperText} ${
                        passwordCheckMessage ===
                        "현재 비밀번호가 일치하지 않습니다."
                          ? styles.helperTextError
                          : ""
                      }`}
                    >
                      {passwordCheckMessage ||
                        (!currentPassword.trim() &&
                          "현재 비밀번호를 입력해주세요.")}
                    </p>
                  </div>

                  <div className={styles.editorField}>
                    <label className={styles.editorLabel}>새 비밀번호</label>
                    <input
                      type="password"
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      placeholder="새 비밀번호를 입력하세요"
                      className={styles.editorInput}
                    />
                  </div>

                  <div className={styles.editorField}>
                    <label className={styles.editorLabel}>새 비밀번호 확인</label>
                    <input
                      type="password"
                      value={newPasswordConfirm}
                      onChange={(e) => setNewPasswordConfirm(e.target.value)}
                      placeholder="새 비밀번호를 다시 입력하세요"
                      className={styles.editorInput}
                    />

                    <p className={styles.helperText}>
                      {(newPassword.trim() !== "" &&
                        newPasswordConfirm.trim() !== "" &&
                        newPassword !== newPasswordConfirm &&
                        "새 비밀번호가 일치하지 않습니다.") ||
                        (isPasswordReady &&
                          "비밀번호 변경 항목이 수정완료에 반영됩니다.")}
                    </p>
                  </div>
                </div>
              )}
            </div>

            <div className={styles.fieldGroup}>
              <div className={styles.fieldCard}>
                <div className={styles.fieldText}>
                  {formatPhoneNumber(displayedPhone)}
                </div>

                {isPhoneActive ? (
                  <button
                    type="button"
                    className={styles.actionButton}
                    onClick={applyPhoneChange}
                    disabled={!isPhoneValid}
                  >
                    수정하기
                  </button>
                ) : (
                  <button
                    type="button"
                    className={styles.iconButton}
                    onClick={openPhoneEditor}
                    aria-label="전화번호 수정"
                  >
                    <Pencil size={18} strokeWidth={2.2} />
                  </button>
                )}
              </div>

              {isPhoneActive && (
                <div className={styles.editorBlock}>
                  <label className={styles.editorLabel}>전화번호</label>

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
                    {!phone1 && !phone2 && !phone3 && "전화번호를 입력해주세요."}
                    {(phone1 || phone2 || phone3) &&
                      !isPhoneValid &&
                      "올바른 전화번호 형식으로 입력해주세요."}
                    {isPhoneValid && "전화번호 변경 항목이 수정완료에 반영됩니다."}
                  </p>
                </div>
              )}
            </div>
          </section>

          <button
            type="button"
            className={styles.withdrawButton}
            onClick={handleWithdraw}
          >
            회원 탈퇴
          </button>
        </main>

        <div className={styles.finalSubmitWrap}>
          <button
            type="button"
            className={`${styles.finalSubmitButton} ${
              !canSubmitAll ? styles.buttonDisabled : ""
            }`}
            onClick={handleSubmitAll}
            disabled={!canSubmitAll}
          >
            {savingAll ? "수정 중..." : "수정완료"}
          </button>
        </div>
      </div>

      <SideMenu isOpen={menuOpen} onClose={() => setMenuOpen(false)} />
    </>
  );
}