import { useEffect, useMemo, useState } from 'react';
import { ChevronLeft } from 'lucide-react';
import { useLocation, useNavigate } from 'react-router-dom';
import type {
  ChangePhoneRequest,
  ChangePhoneResponse,
  GetMeResponse,
  SendPhoneVerificationRequest,
  SendPhoneVerificationResponse,
  UpdateMeRequest,
  UpdateMeResponse,
  UpdatePasswordRequest,
  UpdatePasswordResponse,
  VerifyPhoneCodeRequest,
} from '@codinator/contracts';
import { fetcher, getAuthHeaders } from '../../lib/api';
import styles from './MyPageEdit.module.css';

type LocationState = {
  verifiedCurrentPassword?: string;
};

type ConfirmModalProps = {
  open: boolean;
  title: string;
  description?: string;
  confirmText: string;
  cancelText?: string;
  loading?: boolean;
  onConfirm: () => void;
  onClose: () => void;
};

type VerifyPhoneCodeResponse = {
  phoneVerificationToken: string;
  expiresAt: string;
};

type SignupAvailabilityResponse = {
  available: boolean;
  message: string;
};

const getMyProfile = async (): Promise<GetMeResponse> => {
  return fetcher<GetMeResponse>('/users/me', {
    headers: getAuthHeaders(),
  });
};

const checkNicknameAvailability = async (nickname: string): Promise<SignupAvailabilityResponse> => {
  return fetcher<SignupAvailabilityResponse>('/auth/signup/check', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      type: 'NICKNAME',
      value: nickname,
    }),
  });
};

const sendPhoneVerificationCode = async (
  payload: SendPhoneVerificationRequest,
): Promise<SendPhoneVerificationResponse> => {
  return fetcher<SendPhoneVerificationResponse>('/auth/phone/send', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  });
};

const verifyPhoneVerificationCode = async (
  payload: VerifyPhoneCodeRequest,
): Promise<VerifyPhoneCodeResponse> => {
  return fetcher<VerifyPhoneCodeResponse>('/auth/phone/verify', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  });
};

const updateMyProfile = async (payload: UpdateMeRequest): Promise<UpdateMeResponse> => {
  return fetcher<UpdateMeResponse>('/users/me', {
    method: 'PATCH',
    headers: getAuthHeaders(),
    body: JSON.stringify(payload),
  });
};

const updateMyPassword = async (
  payload: UpdatePasswordRequest,
): Promise<UpdatePasswordResponse> => {
  return fetcher<UpdatePasswordResponse>('/users/me/password', {
    method: 'PATCH',
    headers: getAuthHeaders(),
    body: JSON.stringify(payload),
  });
};

const changeMyPhoneNumber = async (payload: ChangePhoneRequest): Promise<ChangePhoneResponse> => {
  return fetcher<ChangePhoneResponse>('/users/me/phone', {
    method: 'PATCH',
    headers: getAuthHeaders(),
    body: JSON.stringify(payload),
  });
};

function ConfirmModal({
  open,
  title,
  description,
  confirmText,
  cancelText = '취소',
  loading = false,
  onConfirm,
  onClose,
}: ConfirmModalProps) {
  if (!open) {
    return null;
  }

  return (
    <div className={styles.modalOverlay} role="presentation" onClick={onClose}>
      <div
        className={styles.modalCard}
        role="dialog"
        aria-modal="true"
        onClick={(event) => event.stopPropagation()}
      >
        <h2 className={styles.modalTitle}>{title}</h2>
        {description ? <p className={styles.modalDescription}>{description}</p> : null}

        <div className={styles.modalButtonRow}>
          <button type="button" className={styles.modalCancelButton} onClick={onClose}>
            {cancelText}
          </button>
          <button
            type="button"
            className={styles.modalConfirmButton}
            onClick={onConfirm}
            disabled={loading}
          >
            {loading ? '처리 중...' : confirmText}
          </button>
        </div>
      </div>
    </div>
  );
}

const normalizePhoneDigits = (value: string) => value.replace(/[^0-9]/g, '').slice(0, 11);

const formatPhoneNumber = (value: string) => {
  const digits = normalizePhoneDigits(value);

  if (!digits) return '';
  if (digits.length <= 3) return digits;
  if (digits.length <= 7) return `${digits.slice(0, 3)}-${digits.slice(3)}`;

  const middleLength = digits.length === 10 ? 3 : 4;
  return `${digits.slice(0, 3)}-${digits.slice(3, 3 + middleLength)}-${digits.slice(3 + middleLength, 3 + middleLength + 4)}`;
};

const passwordRegex = /^(?=.*[A-Za-z])(?=.*\d)(?=.*[^A-Za-z\d]).{8,}$/;

export default function MyPageEdit() {
  const navigate = useNavigate();
  const location = useLocation();
  const locationState = (location.state as LocationState | null) ?? null;
  const verifiedCurrentPassword = locationState?.verifiedCurrentPassword ?? '';

  const [loading, setLoading] = useState(true);
  const [email, setEmail] = useState('');
  const [originalNickname, setOriginalNickname] = useState('');
  const [originalPhoneDigits, setOriginalPhoneDigits] = useState('');

  const [nickname, setNickname] = useState('');
  const [nicknameMessage, setNicknameMessage] = useState('');
  const [nicknameChecked, setNicknameChecked] = useState(false);
  const [nicknameChecking, setNicknameChecking] = useState(false);
  const [nicknameError, setNicknameError] = useState(false);

  const [newPassword, setNewPassword] = useState('');
  const [newPasswordConfirm, setNewPasswordConfirm] = useState('');

  const [phoneNumber, setPhoneNumber] = useState('');
  const [verificationCode, setVerificationCode] = useState('');
  const [phoneSendMessage, setPhoneSendMessage] = useState('');
  const [phoneErrorMessage, setPhoneErrorMessage] = useState('');
  const [sendingCode, setSendingCode] = useState(false);
  const [verifyingCode, setVerifyingCode] = useState(false);
  const [phoneVerificationSent, setPhoneVerificationSent] = useState(false);
  const [phoneVerified, setPhoneVerified] = useState(false);
  const [verifiedPhoneDigits, setVerifiedPhoneDigits] = useState('');
  const [phoneVerificationToken, setPhoneVerificationToken] = useState('');

  const [confirmModalOpen, setConfirmModalOpen] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!verifiedCurrentPassword) {
      window.alert('정보 변경 전에 비밀번호 확인이 필요합니다.');
      navigate('/myPage', { replace: true });
      return;
    }

    const loadProfile = async () => {
      try {
        const response = await getMyProfile();
        const normalizedPhone = normalizePhoneDigits(response.phoneNumber);

        setEmail(response.email);
        setOriginalNickname(response.nickname);
        setOriginalPhoneDigits(normalizedPhone);
        setNickname(response.nickname);
        setPhoneNumber(formatPhoneNumber(normalizedPhone));
      } catch (error) {
        console.error('정보 변경 페이지 조회 실패:', error);
        window.alert(error instanceof Error ? error.message : '회원정보를 불러오지 못했습니다.');
        navigate('/myPage', { replace: true });
      } finally {
        setLoading(false);
      }
    };

    void loadProfile();
  }, [navigate, verifiedCurrentPassword]);

  const currentPhoneDigits = useMemo(() => normalizePhoneDigits(phoneNumber), [phoneNumber]);
  const trimmedNickname = useMemo(() => nickname.trim(), [nickname]);
  const nicknameChanged = trimmedNickname !== '' && trimmedNickname !== originalNickname;
  const nicknameReady = nicknameChanged && nicknameChecked && !nicknameError;

  const passwordChanged = newPassword.trim() !== '' || newPasswordConfirm.trim() !== '';
  const passwordMatched = newPassword.trim() !== '' && newPassword === newPasswordConfirm;
  const passwordValid = passwordRegex.test(newPassword);
  const passwordReady = passwordChanged && passwordValid && passwordMatched;

  const phoneChanged = currentPhoneDigits !== '' && currentPhoneDigits !== originalPhoneDigits;
  const phoneReady =
    phoneChanged &&
    phoneVerified &&
    phoneVerificationToken !== '' &&
    verifiedPhoneDigits === currentPhoneDigits;

  const hasAnyReadyChange = nicknameReady || passwordReady || phoneReady;

  const handleNicknameChange = (value: string) => {
    setNickname(value);
    setNicknameChecked(false);
    setNicknameError(false);

    if (!value.trim()) {
      setNicknameMessage('닉네임을 입력해 주세요.');
      return;
    }

    if (value.trim() === originalNickname) {
      setNicknameMessage('현재 사용 중인 닉네임입니다.');
      return;
    }

    setNicknameMessage('닉네임 중복 확인이 필요합니다.');
  };

  const handleCheckNickname = async () => {
    if (!trimmedNickname) {
      setNicknameChecked(false);
      setNicknameError(true);
      setNicknameMessage('닉네임을 입력해 주세요.');
      return;
    }

    if (trimmedNickname === originalNickname) {
      setNicknameChecked(false);
      setNicknameError(false);
      setNicknameMessage('현재 사용 중인 닉네임입니다.');
      return;
    }

    setNicknameChecking(true);

    try {
      const response = await checkNicknameAvailability(trimmedNickname);
      setNicknameChecked(response.available);
      setNicknameError(!response.available);
      setNicknameMessage(response.message);
    } catch (error) {
      console.error('닉네임 중복 확인 실패:', error);
      setNicknameChecked(false);
      setNicknameError(true);
      setNicknameMessage(error instanceof Error ? error.message : '닉네임 확인에 실패했습니다.');
    } finally {
      setNicknameChecking(false);
    }
  };

  const handlePhoneNumberChange = (value: string) => {
    const formatted = formatPhoneNumber(value);
    setPhoneNumber(formatted);
    setPhoneVerificationSent(false);
    setPhoneVerified(false);
    setPhoneVerificationToken('');
    setVerifiedPhoneDigits('');
    setVerificationCode('');
    setPhoneSendMessage('');
    setPhoneErrorMessage('');
  };

  const handleSendPhoneCode = async () => {
    const digits = normalizePhoneDigits(phoneNumber);

    if (digits.length < 10) {
      setPhoneErrorMessage('올바른 전화번호를 입력해 주세요.');
      return;
    }

    setSendingCode(true);
    setPhoneErrorMessage('');

    try {
      const response = await sendPhoneVerificationCode({
        phoneNumber: digits,
        purpose: 'PHONE_CHANGE',
      });

      setPhoneVerificationSent(true);
      setPhoneVerified(false);
      setPhoneVerificationToken('');
      setVerifiedPhoneDigits('');
      setPhoneSendMessage(
        response.debugCode
          ? `인증번호 발송됨 (테스트 코드: ${response.debugCode})`
          : '인증번호 발송됨',
      );
    } catch (error) {
      console.error('인증번호 발송 실패:', error);
      setPhoneErrorMessage(
        error instanceof Error ? error.message : '인증번호 발송에 실패했습니다.',
      );
    } finally {
      setSendingCode(false);
    }
  };

  const handleVerifyPhoneCode = async () => {
    const digits = normalizePhoneDigits(phoneNumber);

    if (!verificationCode.trim()) {
      setPhoneErrorMessage('인증번호를 입력해 주세요.');
      return;
    }

    setVerifyingCode(true);
    setPhoneErrorMessage('');

    try {
      const response = await verifyPhoneVerificationCode({
        phoneNumber: digits,
        purpose: 'PHONE_CHANGE',
        code: verificationCode.trim(),
      });

      setPhoneVerified(true);
      setPhoneVerificationToken(response.phoneVerificationToken);
      setVerifiedPhoneDigits(digits);
      setPhoneErrorMessage('');
    } catch (error) {
      console.error('전화번호 인증 실패:', error);
      setPhoneVerified(false);
      setPhoneVerificationToken('');
      setVerifiedPhoneDigits('');
      setPhoneErrorMessage(
        error instanceof Error ? error.message : '인증번호를 다시 확인해 주세요.',
      );
    } finally {
      setVerifyingCode(false);
    }
  };

  const handleSubmitChanges = async () => {
    if (!hasAnyReadyChange) {
      return;
    }

    setSaving(true);

    try {
      if (nicknameReady) {
        await updateMyProfile({
          nickname: trimmedNickname,
        });
        localStorage.setItem('nickname', trimmedNickname);
      }

      if (passwordReady) {
        await updateMyPassword({
          currentPassword: verifiedCurrentPassword,
          newPassword: newPassword.trim(),
        });
      }

      if (phoneReady) {
        await changeMyPhoneNumber({
          phoneNumber: currentPhoneDigits,
          phoneVerificationToken,
        });
      }

      window.alert('회원정보가 변경되었습니다.');
      navigate('/myPage', { replace: true });
    } catch (error) {
      console.error('회원정보 변경 실패:', error);
      window.alert(error instanceof Error ? error.message : '회원정보 변경에 실패했습니다.');
    } finally {
      setSaving(false);
      setConfirmModalOpen(false);
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
              onClick={() => navigate('/myPage')}
              aria-label="뒤로가기"
            >
              <ChevronLeft size={25} strokeWidth={2.2} />
            </button>

            <h1 className={styles.title}>정보 변경</h1>

            <button
              type="button"
              className={styles.cancelButton}
              onClick={() => navigate('/myPage')}
            >
              취소
            </button>
          </div>
        </header>

        <main className={styles.contentArea}>
          <section className={styles.sectionBlock}>
            <h2 className={styles.label}>이메일</h2>
            <div className={`${styles.inputBox} ${styles.inputBoxDisabled}`}>
              <input
                type="text"
                value={loading ? '불러오는 중...' : email}
                readOnly
                disabled
                className={styles.input}
              />
            </div>
            <p className={styles.helperText}>이메일은 변경할 수 없습니다</p>
          </section>

          <section className={styles.sectionBlock}>
            <h2 className={styles.label}>닉네임</h2>
            <div className={styles.inputRowBox}>
              <input
                type="text"
                value={nickname}
                onChange={(event) => handleNicknameChange(event.target.value)}
                placeholder="닉네임"
                className={styles.input}
              />
              <button
                type="button"
                className={styles.inlineButton}
                onClick={handleCheckNickname}
                disabled={
                  nicknameChecking || !trimmedNickname || trimmedNickname === originalNickname
                }
              >
                {nicknameChecking ? '확인중' : '중복 확인'}
              </button>
            </div>
            <p
              className={`${styles.helperText} ${
                nicknameError ? styles.errorText : nicknameReady ? styles.successText : ''
              }`}
            >
              {nicknameMessage || '닉네임을 수정한 경우 중복 확인이 필요합니다.'}
            </p>
          </section>

          <section className={styles.sectionBlock}>
            <h2 className={styles.label}>비밀번호</h2>
            <div className={styles.inputBox}>
              <input
                type="password"
                value={newPassword}
                onChange={(event) => setNewPassword(event.target.value)}
                placeholder="새 비밀번호를 입력해 주세요"
                className={styles.input}
              />
            </div>
            <p className={styles.helperText}>영문, 숫자, 특수문자 포함 8자 이상</p>
          </section>

          <section className={styles.sectionBlock}>
            <h2 className={styles.label}>비밀번호 재확인</h2>
            <div className={styles.inputBox}>
              <input
                type="password"
                value={newPasswordConfirm}
                onChange={(event) => setNewPasswordConfirm(event.target.value)}
                placeholder="한번 더 입력해주세요"
                className={styles.input}
              />
            </div>
            <p
              className={`${styles.helperText} ${
                passwordChanged && !passwordMatched
                  ? styles.errorText
                  : passwordReady
                    ? styles.successText
                    : ''
              }`}
            >
              {passwordChanged && !passwordValid
                ? '비밀번호 조건을 확인해 주세요.'
                : passwordChanged && !passwordMatched
                  ? '비밀번호가 일치하지 않습니다.'
                  : passwordReady
                    ? '비밀번호가 일치합니다'
                    : ' '}
            </p>
          </section>

          <section className={styles.sectionBlock}>
            <h2 className={styles.label}>전화번호</h2>
            <div
              className={`${styles.phoneCard} ${
                phoneVerificationSent ? styles.phoneCardExpanded : ''
              }`}
            >
              <div className={styles.phoneTopRow}>
                <input
                  type="text"
                  value={phoneNumber}
                  onChange={(event) => handlePhoneNumberChange(event.target.value)}
                  placeholder="010-0000-0000"
                  className={styles.input}
                />

                {!phoneVerificationSent ? (
                  <button
                    type="button"
                    className={styles.inlineButton}
                    onClick={handleSendPhoneCode}
                    disabled={sendingCode || !phoneChanged}
                  >
                    {sendingCode ? '발송중' : '인증번호 발송'}
                  </button>
                ) : (
                  <span className={styles.sentText}>{phoneSendMessage || '인증번호 발송됨'}</span>
                )}
              </div>

              {phoneVerificationSent ? (
                <div className={styles.verificationRow}>
                  <input
                    type="text"
                    value={verificationCode}
                    onChange={(event) =>
                      setVerificationCode(event.target.value.replace(/[^0-9]/g, '').slice(0, 6))
                    }
                    placeholder="인증번호"
                    className={styles.input}
                  />
                  <button
                    type="button"
                    className={styles.inlineButton}
                    onClick={handleVerifyPhoneCode}
                    disabled={verifyingCode || !verificationCode.trim()}
                  >
                    {verifyingCode ? '확인중' : '인증하기'}
                  </button>
                </div>
              ) : null}
            </div>
            <p
              className={`${styles.helperText} ${
                phoneErrorMessage ? styles.errorText : phoneReady ? styles.successText : ''
              }`}
            >
              {phoneErrorMessage ||
                (phoneReady
                  ? '인증이 완료 되었습니다'
                  : phoneChanged
                    ? '전화번호를 변경한 경우 인증이 필요합니다.'
                    : ' ')}
            </p>
          </section>
        </main>

        <div className={styles.submitArea}>
          <button
            type="button"
            className={`${styles.submitButton} ${
              !hasAnyReadyChange ? styles.submitButtonDisabled : ''
            }`}
            disabled={!hasAnyReadyChange || saving}
            onClick={() => setConfirmModalOpen(true)}
          >
            {saving ? '변경 중...' : '변경 완료'}
          </button>
        </div>
      </div>

      <ConfirmModal
        open={confirmModalOpen}
        title="변경하시겠습니까?"
        description="완료된 수정사항만 반영됩니다."
        confirmText="변경하기"
        loading={saving}
        onClose={() => {
          if (saving) return;
          setConfirmModalOpen(false);
        }}
        onConfirm={handleSubmitChanges}
      />
    </>
  );
}
