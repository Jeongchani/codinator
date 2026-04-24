import { useEffect, useMemo, useState } from 'react';
import { ChevronLeft, Lock } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import type {
  PasswordResetRequest,
  PasswordResetResponse,
  SendPhoneVerificationRequest,
  SendPhoneVerificationResponse,
  VerifyPhoneCodeRequest,
  VerifyPhoneCodeResponse,
} from '@codinator/contracts';
import { fetcher } from '../../lib/api';
import styles from './PasswordReset.module.css';

const PHONE_CODE_TTL_SECONDS = 5 * 60;
const PASSWORD_RESET_PURPOSE = 'PASSWORD_RESET' as const;

const BackIcon = () => <ChevronLeft size={23} strokeWidth={2.2} aria-hidden="true" />;
const LockIcon = () => <Lock size={14} strokeWidth={2.4} aria-hidden="true" />;

const normalizePhoneDigits = (value: string) => value.replace(/[^0-9]/g, '').slice(0, 11);

const formatPhoneNumber = (value: string) => {
  const digits = normalizePhoneDigits(value);

  if (!digits) return '';
  if (digits.length <= 3) return digits;
  if (digits.length <= 7) return `${digits.slice(0, 3)}-${digits.slice(3)}`;

  const middleLength = digits.length === 10 ? 3 : 4;
  return `${digits.slice(0, 3)}-${digits.slice(3, 3 + middleLength)}-${digits.slice(
    3 + middleLength,
    3 + middleLength + 4,
  )}`;
};

const formatCountdown = (seconds: number) => {
  const safeSeconds = Math.max(seconds, 0);
  const minutes = Math.floor(safeSeconds / 60);
  const remainSeconds = safeSeconds % 60;

  return `${String(minutes).padStart(2, '0')}:${String(remainSeconds).padStart(2, '0')}`;
};

const getRemainingSecondsFromExpiresAt = (expiresAt: string) => {
  const expiresAtTime = Date.parse(expiresAt);

  if (!Number.isFinite(expiresAtTime)) {
    return PHONE_CODE_TTL_SECONDS;
  }

  return Math.max(0, Math.ceil((expiresAtTime - Date.now()) / 1000));
};

const passwordRegex = /^(?=.*[A-Za-z])(?=.*\d)(?=.*[^A-Za-z\d]).{8,}$/;

const sendPasswordResetPhoneCode = async (
  phoneNumber: string,
): Promise<SendPhoneVerificationResponse> => {
  const payload: SendPhoneVerificationRequest = {
    phoneNumber,
    purpose: PASSWORD_RESET_PURPOSE,
  };

  return fetcher<SendPhoneVerificationResponse>('/auth/phone/send', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  });
};

const verifyPasswordResetPhoneCode = async (
  phoneNumber: string,
  code: string,
): Promise<VerifyPhoneCodeResponse> => {
  const payload: VerifyPhoneCodeRequest = {
    phoneNumber,
    purpose: PASSWORD_RESET_PURPOSE,
    code,
  };

  return fetcher<VerifyPhoneCodeResponse>('/auth/phone/verify', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  });
};

const resetPassword = async (payload: PasswordResetRequest): Promise<PasswordResetResponse> => {
  return fetcher<PasswordResetResponse>('/auth/password-reset', {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  });
};

export default function PasswordReset() {
  const navigate = useNavigate();

  const [phoneNumber, setPhoneNumber] = useState('');
  const [verificationCode, setVerificationCode] = useState('');
  const [phoneVerificationSent, setPhoneVerificationSent] = useState(false);
  const [phoneVerified, setPhoneVerified] = useState(false);
  const [phoneVerificationToken, setPhoneVerificationToken] = useState('');
  const [phoneSendMessage, setPhoneSendMessage] = useState('');
  const [phoneDebugCode, setPhoneDebugCode] = useState('');
  const [phoneErrorMessage, setPhoneErrorMessage] = useState('');
  const [sendingCode, setSendingCode] = useState(false);
  const [verifyingCode, setVerifyingCode] = useState(false);
  const [remainingSeconds, setRemainingSeconds] = useState(0);

  const [password, setPassword] = useState('');
  const [passwordConfirm, setPasswordConfirm] = useState('');
  const [resettingPassword, setResettingPassword] = useState(false);
  const [confirmModalOpen, setConfirmModalOpen] = useState(false);

  const currentPhoneDigits = useMemo(() => normalizePhoneDigits(phoneNumber), [phoneNumber]);
  const trimmedPassword = useMemo(() => password.trim(), [password]);
  const trimmedPasswordConfirm = useMemo(() => passwordConfirm.trim(), [passwordConfirm]);

  const timerExpired = phoneVerificationSent && !phoneVerified && remainingSeconds === 0;
  const canSendCode = currentPhoneDigits.length >= 10 && !sendingCode;
  const canResendCode = phoneVerificationSent && !phoneVerified && !sendingCode && !verifyingCode;
  const passwordValid = passwordRegex.test(trimmedPassword);
  const isPasswordMatched =
    trimmedPassword.length > 0 && trimmedPassword === trimmedPasswordConfirm;
  const showPasswordConfirmMessage = trimmedPasswordConfirm.length > 0;
  const canSubmit =
    phoneVerified &&
    phoneVerificationToken !== '' &&
    passwordValid &&
    isPasswordMatched &&
    !resettingPassword;

  const passwordHelper = useMemo(() => {
    if (!trimmedPassword) return '영문, 숫자, 특수문자 포함 8자 이상';
    return passwordRegex.test(trimmedPassword)
      ? '사용 가능한 비밀번호입니다'
      : '영문, 숫자, 특수문자 포함 8자 이상 입력해주세요';
  }, [trimmedPassword]);

  const passwordConfirmMessage = useMemo(() => {
    if (!showPasswordConfirmMessage) return ' ';
    return isPasswordMatched ? '비밀번호가 일치합니다' : '비밀번호가 일치하지 않습니다';
  }, [isPasswordMatched, showPasswordConfirmMessage]);

  const phoneHelperMessage = useMemo(() => {
    if (phoneErrorMessage) return phoneErrorMessage;
    if (phoneVerified) return '인증이 완료 되었습니다';
    if (timerExpired) return '인증시간이 만료되었습니다. 재요청해 주세요.';
    if (phoneVerificationSent) return '전화번호 인증이 필요합니다.';
    return ' ';
  }, [phoneErrorMessage, phoneVerificationSent, phoneVerified, timerExpired]);

  useEffect(() => {
    if (!phoneVerificationSent || phoneVerified || remainingSeconds <= 0) {
      return;
    }

    const timerId = window.setInterval(() => {
      setRemainingSeconds((prev) => {
        if (prev <= 1) {
          window.clearInterval(timerId);
          return 0;
        }

        return prev - 1;
      });
    }, 1000);

    return () => {
      window.clearInterval(timerId);
    };
  }, [phoneVerificationSent, phoneVerified, remainingSeconds]);

  const handleBack = () => {
    navigate(-1);
  };

  const handleCancel = () => {
    navigate('/login');
  };

  const handlePhoneNumberChange = (value: string) => {
    setPhoneNumber(formatPhoneNumber(value));
    setVerificationCode('');
    setPhoneVerificationSent(false);
    setPhoneVerified(false);
    setPhoneVerificationToken('');
    setPhoneSendMessage('');
    setPhoneDebugCode('');
    setPhoneErrorMessage('');
    setRemainingSeconds(0);
  };

  const handleSendPhoneCode = async () => {
    if (currentPhoneDigits.length < 10) {
      setPhoneErrorMessage('올바른 전화번호를 입력해 주세요.');
      return;
    }

    const isResend = phoneVerificationSent;

    setSendingCode(true);
    setPhoneErrorMessage('');
    setPhoneVerificationToken('');

    try {
      const response = await sendPasswordResetPhoneCode(currentPhoneDigits);

      setPhoneVerificationSent(true);
      setPhoneVerified(false);
      setVerificationCode('');
      setRemainingSeconds(getRemainingSecondsFromExpiresAt(response.expiresAt));
      setPhoneSendMessage(
        response.message ||
          (isResend ? '인증번호가 재발송되었습니다.' : '인증번호가 발송되었습니다.'),
      );
      setPhoneDebugCode(response.debugCode ?? '');
    } catch (error) {
      console.error('비밀번호 재설정 인증번호 발송 실패:', error);
      setPhoneErrorMessage(
        error instanceof Error ? error.message : '인증번호 발송에 실패했습니다.',
      );
    } finally {
      setSendingCode(false);
    }
  };

  const handleVerifyCode = async () => {
    if (timerExpired) {
      setPhoneErrorMessage('인증시간이 만료되었습니다. 재요청해 주세요.');
      return;
    }

    if (!verificationCode.trim()) {
      setPhoneErrorMessage('인증번호를 입력해 주세요.');
      return;
    }

    setVerifyingCode(true);
    setPhoneErrorMessage('');

    try {
      const response = await verifyPasswordResetPhoneCode(
        currentPhoneDigits,
        verificationCode.trim(),
      );

      setPhoneVerified(true);
      setPhoneVerificationToken(response.phoneVerificationToken);
      setPhoneSendMessage('인증이 완료되었습니다.');
      setPhoneErrorMessage('');
    } catch (error) {
      console.error('비밀번호 재설정 전화번호 인증 실패:', error);
      setPhoneVerified(false);
      setPhoneVerificationToken('');
      setPhoneErrorMessage(
        error instanceof Error ? error.message : '인증번호를 다시 확인해 주세요.',
      );
    } finally {
      setVerifyingCode(false);
    }
  };

  const openConfirmModal = () => {
    if (!canSubmit) {
      return;
    }

    setConfirmModalOpen(true);
  };

  const closeConfirmModal = () => {
    if (resettingPassword) {
      return;
    }

    setConfirmModalOpen(false);
  };

  const handleSubmit = async () => {
    if (!canSubmit) {
      return;
    }

    setResettingPassword(true);

    try {
      const response = await resetPassword({
        phoneNumber: currentPhoneDigits,
        phoneVerificationToken,
        newPassword: trimmedPassword,
      });

      window.alert(response.message || '비밀번호가 재설정되었습니다.');
      navigate('/login', { replace: true });
    } catch (error) {
      console.error('비밀번호 재설정 실패:', error);
      window.alert(error instanceof Error ? error.message : '비밀번호 재설정에 실패했습니다.');
    } finally {
      setResettingPassword(false);
      setConfirmModalOpen(false);
    }
  };

  return (
    <div className={styles.container}>
      <header className={styles.header}>
        <div className={styles.headerInner}>
          <button
            type="button"
            aria-label="뒤로가기"
            className={styles.headerIconButton}
            onClick={handleBack}
          >
            <BackIcon />
          </button>

          <h1 className={styles.title}>비밀번호 재설정</h1>

          <button type="button" className={styles.cancelButton} onClick={handleCancel}>
            취소
          </button>
        </div>
      </header>

      <main className={styles.contentArea}>
        <section className={styles.noticeBox}>
          <div className={styles.noticeIconBox}>
            <LockIcon />
          </div>
          <p className={styles.noticeText}>전화번호 인증 후 새 비밀번호를 입력할 수 있습니다</p>
        </section>

        <section className={styles.sectionBlock}>
          <h2 className={styles.label}>전화번호</h2>

          {!phoneVerificationSent ? (
            <div className={styles.inputRowBox}>
              <input
                aria-label="전화번호"
                type="text"
                value={phoneNumber}
                onChange={(event) => handlePhoneNumberChange(event.target.value)}
                inputMode="numeric"
                placeholder="010-0000-0000"
                className={styles.input}
              />

              <button
                type="button"
                className={`${styles.fieldActionButton} ${styles.sendCodeButton}`}
                onClick={handleSendPhoneCode}
                disabled={!canSendCode}
              >
                {sendingCode ? '발송중' : '인증번호 발송'}
              </button>
            </div>
          ) : (
            <div className={`${styles.phoneCard} ${styles.phoneCardExpanded}`}>
              <div className={styles.phoneTopRow}>
                <input
                  aria-label="전화번호"
                  type="text"
                  value={phoneNumber}
                  onChange={(event) => handlePhoneNumberChange(event.target.value)}
                  inputMode="numeric"
                  className={styles.input}
                />

                <span className={styles.sentText}>
                  {phoneSendMessage || '인증번호가 발송되었습니다.'}
                </span>
              </div>

              <div className={styles.verificationMetaRow}>
                <span className={styles.timerText}>
                  {phoneVerified ? '인증 완료' : `남은 시간 ${formatCountdown(remainingSeconds)}`}
                </span>

                <button
                  type="button"
                  className={`${styles.fieldActionButton} ${styles.resendButton}`}
                  onClick={handleSendPhoneCode}
                  disabled={!canResendCode}
                >
                  {sendingCode ? '재요청중' : '재요청'}
                </button>
              </div>

              <div className={styles.verificationRow}>
                <input
                  aria-label="인증번호"
                  value={verificationCode}
                  onChange={(event) =>
                    setVerificationCode(event.target.value.replace(/[^0-9]/g, '').slice(0, 6))
                  }
                  inputMode="numeric"
                  placeholder="인증번호"
                  className={styles.input}
                />
                <button
                  type="button"
                  className={`${styles.fieldActionButton} ${styles.verifyCodeButton}`}
                  onClick={handleVerifyCode}
                  disabled={
                    verifyingCode || !verificationCode.trim() || timerExpired || phoneVerified
                  }
                >
                  {phoneVerified ? '인증완료' : verifyingCode ? '확인중' : '인증하기'}
                </button>
              </div>
            </div>
          )}

          <p
            className={`${styles.helperText} ${
              phoneErrorMessage || timerExpired
                ? styles.errorText
                : phoneVerified
                  ? styles.successText
                  : styles.mutedText
            }`}
          >
            {phoneHelperMessage}
          </p>

          {phoneDebugCode ? (
            <p className={styles.debugCodeText}>테스트 코드: {phoneDebugCode}</p>
          ) : null}
        </section>

        <section className={styles.sectionBlock}>
          <h2 className={styles.label}>새 비밀번호</h2>
          <div className={`${styles.inputBox} ${!phoneVerified ? styles.inputBoxDisabled : ''}`}>
            <input
              aria-label="새 비밀번호"
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              placeholder="새 비밀번호를 입력해 주세요"
              disabled={!phoneVerified}
              className={styles.input}
            />
          </div>
          <p
            className={`${styles.helperText} ${
              trimmedPassword.length > 0 && passwordValid ? styles.successText : styles.mutedText
            }`}
          >
            {passwordHelper}
          </p>
        </section>

        <section className={styles.sectionBlock}>
          <h2 className={styles.label}>새 비밀번호 재확인</h2>
          <div className={`${styles.inputBox} ${!phoneVerified ? styles.inputBoxDisabled : ''}`}>
            <input
              aria-label="새 비밀번호 재확인"
              type="password"
              value={passwordConfirm}
              onChange={(event) => setPasswordConfirm(event.target.value)}
              placeholder="한번 더 입력해주세요"
              disabled={!phoneVerified}
              className={styles.input}
            />
          </div>
          <p
            className={`${styles.helperText} ${
              showPasswordConfirmMessage && !isPasswordMatched
                ? styles.errorText
                : showPasswordConfirmMessage && isPasswordMatched
                  ? styles.successText
                  : styles.mutedText
            }`}
          >
            {passwordConfirmMessage}
          </p>
        </section>

        <button
          type="button"
          className={`${styles.submitButton} ${!canSubmit ? styles.submitButtonDisabled : ''}`}
          disabled={!canSubmit}
          onClick={openConfirmModal}
        >
          {resettingPassword ? '변경 중...' : '변경 완료'}
        </button>
      </main>

      {confirmModalOpen ? (
        <div className={styles.modalOverlay} role="presentation" onClick={closeConfirmModal}>
          <div
            className={styles.modalCard}
            role="dialog"
            aria-modal="true"
            aria-labelledby="password-reset-confirm-title"
            aria-describedby="password-reset-confirm-description"
            onClick={(event) => event.stopPropagation()}
          >
            <h2 id="password-reset-confirm-title" className={styles.modalTitle}>
              변경하시겠습니까?
            </h2>
            <p id="password-reset-confirm-description" className={styles.modalDescription}>
              새 비밀번호로 변경 후 로그인 화면으로 이동합니다.
            </p>

            <div className={styles.modalButtonRow}>
              <button
                type="button"
                className={styles.modalCancelButton}
                onClick={closeConfirmModal}
                disabled={resettingPassword}
              >
                취소
              </button>
              <button
                type="button"
                className={styles.modalConfirmButton}
                onClick={handleSubmit}
                disabled={resettingPassword}
              >
                {resettingPassword ? '변경 중...' : '변경하기'}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
