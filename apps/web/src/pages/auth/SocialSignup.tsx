import { FormEvent, useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { SquareCheck } from 'lucide-react';
import type {
  Gender,
  SendPhoneVerificationRequest,
  SendPhoneVerificationResponse,
  SocialCompleteProfileRequest,
  SocialCompleteProfileResponse,
  SocialProvider,
  VerifyPhoneCodeRequest,
  VerifyPhoneCodeResponse,
} from '@codinator/contracts';

import {
  clearAuthTokens,
  fetcher,
  saveAuthTokens,
  saveCurrentUser,
} from '../../lib/api';

import signupDecorationImage from '../../assets/auth/signup-decoration.png';
import kakaoLogoImage from '../../assets/login/social-kakao.png';
import naverLogoImage from '../../assets/login/social-naver.png';
import googleLogoImage from '../../assets/login/social-google.png';

import styles from './SocialSignup.module.css';

type CheckResponse = {
  available: boolean;
  message?: string;
};

type SignupCheckRequest = {
  type: 'EMAIL' | 'NICKNAME' | 'PASSWORD';
  value: string;
};

type SignupGender = Gender | '';
type ModalType = 'success' | 'error' | 'info';

type SocialSignupLocationState = {
  provider?: SocialProvider;
  providerToken?: string;
  rememberMe?: boolean;
};

type SocialSignupContext = {
  provider: SocialProvider;
  providerToken: string;
  rememberMe: boolean;
};

const PHONE_CODE_TTL_SECONDS = 5 * 60;
const SOCIAL_SIGNUP_CONTEXT_KEY = 'codinator.socialSignup.context';

const providerMetaMap: Record<SocialProvider, { label: string; logoImage: string }> = {
  GOOGLE: { label: '구글', logoImage: googleLogoImage },
  KAKAO: { label: '카카오', logoImage: kakaoLogoImage },
  NAVER: { label: '네이버', logoImage: naverLogoImage },
};

function isSocialProvider(value: unknown): value is SocialProvider {
  return value === 'GOOGLE' || value === 'KAKAO' || value === 'NAVER';
}

function parseRememberMe(value: unknown) {
  if (typeof value === 'boolean') return value;
  if (typeof value === 'string') return value === 'true';
  return false;
}

function readStoredSocialSignupContext(): SocialSignupContext | null {
  try {
    const raw = sessionStorage.getItem(SOCIAL_SIGNUP_CONTEXT_KEY);
    if (!raw) return null;

    const parsed = JSON.parse(raw) as Partial<SocialSignupContext>;

    if (!isSocialProvider(parsed.provider) || !parsed.providerToken) {
      return null;
    }

    return {
      provider: parsed.provider,
      providerToken: parsed.providerToken,
      rememberMe: Boolean(parsed.rememberMe),
    };
  } catch {
    return null;
  }
}

function ProviderLogo({ provider }: { provider?: SocialProvider }) {
  if (!provider) return null;

  const providerMeta = providerMetaMap[provider];

  return (
    <span
      className={styles.providerLogoWrap}
      aria-label={`${providerMeta.label} 로고`}
    >
      <img
        src={providerMeta.logoImage}
        alt=""
        className={styles.providerLogoImage}
        draggable={false}
      />
    </span>
  );
}

function ModalStatusIcon({ type }: { type: ModalType }) {
  if (type === 'success') {
    return (
      <div className={`${styles.modalIcon} ${styles.modalIconSuccess}`}>
        <svg width="26" height="26" viewBox="0 0 24 24" fill="none" aria-hidden="true">
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

function normalizePhoneDigits(value: string) {
  return value.replace(/[^0-9]/g, '').slice(0, 11);
}

function formatPhoneNumber(value: string) {
  const digits = normalizePhoneDigits(value);

  if (!digits) return '';
  if (digits.length <= 3) return digits;
  if (digits.length <= 7) return `${digits.slice(0, 3)}-${digits.slice(3)}`;

  const middleLength = digits.length === 10 ? 3 : 4;

  return `${digits.slice(0, 3)}-${digits.slice(3, 3 + middleLength)}-${digits.slice(
    3 + middleLength,
    3 + middleLength + 4,
  )}`;
}

function formatCountdown(seconds: number) {
  const safeSeconds = Math.max(seconds, 0);
  const minutes = Math.floor(safeSeconds / 60);
  const remainSeconds = safeSeconds % 60;

  return `${String(minutes).padStart(2, '0')}:${String(remainSeconds).padStart(2, '0')}`;
}

function getFullBirthYear(twoDigitYear: number) {
  const currentYear = new Date().getFullYear();
  const currentTwoDigitYear = currentYear % 100;

  return twoDigitYear <= currentTwoDigitYear
    ? 2000 + twoDigitYear
    : 1900 + twoDigitYear;
}

function parseBirthDate(value: string) {
  if (!/^\d{6}$/.test(value)) return null;

  const twoDigitYear = Number(value.slice(0, 2));
  const month = Number(value.slice(2, 4));
  const day = Number(value.slice(4, 6));
  const year = getFullBirthYear(twoDigitYear);

  if (month < 1 || month > 12) return null;

  const date = new Date(year, month - 1, day);

  const isValid =
    date.getFullYear() === year &&
    date.getMonth() === month - 1 &&
    date.getDate() === day;

  if (!isValid) return null;

  return {
    year,
    month,
    day,
    isoDate: `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`,
  };
}

function isValidBirthDate(value: string) {
  return parseBirthDate(value) !== null;
}

const requestSignupCheck = async (body: SignupCheckRequest): Promise<CheckResponse> => {
  return fetcher<CheckResponse>('/auth/signup/check', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
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

export default function SocialSignup() {
  const navigate = useNavigate();
  const location = useLocation();

  const socialContext = useMemo<SocialSignupContext | null>(() => {
    const state = (location.state as SocialSignupLocationState | null) ?? null;
    const searchParams = new URLSearchParams(location.search);

    const stateProvider = state?.provider;
    const queryProvider = searchParams.get('provider');
    const storedContext = readStoredSocialSignupContext();

    const provider = isSocialProvider(stateProvider)
      ? stateProvider
      : isSocialProvider(queryProvider)
        ? queryProvider
        : storedContext?.provider;

    const providerToken =
      state?.providerToken ?? searchParams.get('providerToken') ?? storedContext?.providerToken ?? '';

    if (!provider || !providerToken) {
      return null;
    }

    const rememberMe =
      state?.rememberMe ??
      parseRememberMe(searchParams.get('rememberMe')) ??
      storedContext?.rememberMe ??
      false;

    return {
      provider,
      providerToken,
      rememberMe: Boolean(rememberMe),
    };
  }, [location.search, location.state]);

  const [nickname, setNickname] = useState('');
  const [birthDate, setBirthDate] = useState('');
  const [gender, setGender] = useState<SignupGender>('');
  const [phoneNumber, setPhoneNumber] = useState('');

  const [verificationCode, setVerificationCode] = useState('');
  const [phoneVerificationSent, setPhoneVerificationSent] = useState(false);
  const [phoneVerified, setPhoneVerified] = useState(false);
  const [phoneVerificationToken, setPhoneVerificationToken] = useState('');
  const [verifiedPhoneDigits, setVerifiedPhoneDigits] = useState('');
  const [phoneSendMessage, setPhoneSendMessage] = useState('');
  const [phoneDebugCode, setPhoneDebugCode] = useState('');
  const [phoneErrorMessage, setPhoneErrorMessage] = useState('');
  const [remainingSeconds, setRemainingSeconds] = useState(0);
  const [sendingCode, setSendingCode] = useState(false);
  const [verifyingCode, setVerifyingCode] = useState(false);

  const [nicknameChecked, setNicknameChecked] = useState(false);
  const [nicknameAvailable, setNicknameAvailable] = useState<boolean | null>(null);
  const [nicknameCheckLoading, setNicknameCheckLoading] = useState(false);
  const [signupLoading, setSignupLoading] = useState(false);

  const [showModal, setShowModal] = useState(false);
  const [modalTitle, setModalTitle] = useState('안내');
  const [modalMessage, setModalMessage] = useState('');
  const [modalType, setModalType] = useState<ModalType>('info');
  const [modalAction, setModalAction] = useState<(() => void) | null>(null);

  const phoneRegex = useMemo(() => /^01(?:0|1|6|7|8|9)-\d{3,4}-\d{4}$/, []);

  const trimmedNickname = nickname.trim();
  const trimmedBirthDate = birthDate.trim();
  const phoneDigits = normalizePhoneDigits(phoneNumber);

  const isNicknameValid = trimmedNickname.length > 0;
  const isBirthValid = isValidBirthDate(trimmedBirthDate);
  const isGenderValid = gender === 'MALE' || gender === 'FEMALE';
  const isPhoneValid = phoneRegex.test(phoneNumber);
  const isNicknameCheckDone = nicknameChecked && nicknameAvailable === true;

  const timerExpired = phoneVerificationSent && !phoneVerified && remainingSeconds === 0;

  const phoneReady =
    isPhoneValid &&
    phoneVerified &&
    phoneVerificationToken !== '' &&
    verifiedPhoneDigits === phoneDigits;

  const canResendCode = phoneVerificationSent && !phoneVerified && !sendingCode;

  const canSubmit =
    socialContext !== null &&
    isNicknameValid &&
    isBirthValid &&
    isGenderValid &&
    phoneReady &&
    isNicknameCheckDone &&
    !signupLoading;

  useEffect(() => {
    if (!socialContext) {
      return;
    }

    sessionStorage.setItem(SOCIAL_SIGNUP_CONTEXT_KEY, JSON.stringify(socialContext));
  }, [socialContext]);

  useEffect(() => {
    if (socialContext) {
      return;
    }

    setModalTitle('소셜 회원가입 정보 없음');
    setModalMessage('소셜 로그인 정보가 없습니다. 로그인 화면에서 다시 시도해주세요.');
    setModalType('error');
    setModalAction(() => () => navigate('/login', { replace: true }));
    setShowModal(true);
  }, [navigate, socialContext]);

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

  const openModal = (
    title: string,
    message: string,
    type: ModalType = 'info',
    action?: () => void,
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

  const resetNicknameCheck = (value: string) => {
    setNickname(value);
    setNicknameChecked(false);
    setNicknameAvailable(null);
  };

  const handlePhoneNumberChange = (value: string) => {
    const formatted = formatPhoneNumber(value);

    setPhoneNumber(formatted);
    setVerificationCode('');
    setPhoneVerificationSent(false);
    setPhoneVerified(false);
    setPhoneVerificationToken('');
    setVerifiedPhoneDigits('');
    setPhoneSendMessage('');
    setPhoneDebugCode('');
    setPhoneErrorMessage('');
    setRemainingSeconds(0);
  };

  const handleCheckNickname = async () => {
    if (!trimmedNickname) {
      openModal('닉네임 확인', '닉네임을 먼저 입력해주세요.', 'error');
      return;
    }

    setNicknameCheckLoading(true);

    try {
      const data = await requestSignupCheck({
        type: 'NICKNAME',
        value: trimmedNickname,
      });

      setNicknameChecked(true);
      setNicknameAvailable(data.available);

      openModal(
        '닉네임 중복확인',
        data.available
          ? data.message || '사용 가능한 닉네임입니다.'
          : data.message || '이미 사용 중인 닉네임입니다.',
        data.available ? 'success' : 'error',
      );
    } catch (error) {
      console.error('닉네임 중복체크 오류:', error);

      setNicknameChecked(false);
      setNicknameAvailable(null);

      openModal(
        '오류',
        error instanceof Error
          ? error.message
          : '닉네임 중복확인 요청에 실패했습니다.',
        'error',
      );
    } finally {
      setNicknameCheckLoading(false);
    }
  };

  const handleSendPhoneCode = async () => {
    if (!isPhoneValid) {
      setPhoneErrorMessage('전화번호를 정확히 입력해주세요. 예: 010-0000-0000');
      return;
    }

    const isResend = phoneVerificationSent;

    setSendingCode(true);
    setPhoneErrorMessage('');

    try {
      const response = await sendPhoneVerificationCode({
        phoneNumber: phoneDigits,
        purpose: 'SIGN_UP',
      });

      setPhoneVerificationSent(true);
      setPhoneVerified(false);
      setPhoneVerificationToken('');
      setVerifiedPhoneDigits('');
      setVerificationCode('');
      setRemainingSeconds(PHONE_CODE_TTL_SECONDS);
      setPhoneSendMessage(
        isResend ? '인증번호를 재요청했습니다.' : '인증번호가 발송되었습니다.',
      );
      setPhoneDebugCode(response.debugCode ?? '');
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
      const response = await verifyPhoneVerificationCode({
        phoneNumber: phoneDigits,
        purpose: 'SIGN_UP',
        code: verificationCode.trim(),
      });

      setPhoneVerified(true);
      setPhoneVerificationToken(response.phoneVerificationToken);
      setVerifiedPhoneDigits(phoneDigits);
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

  const validateBeforeSubmit = () => {
    if (!socialContext) {
      openModal('소셜 회원가입 정보 없음', '로그인 화면에서 다시 시도해주세요.', 'error');
      return false;
    }

    if (!isNicknameValid) {
      openModal('입력 확인', '닉네임을 입력해주세요.', 'error');
      return false;
    }

    if (!isNicknameCheckDone) {
      openModal('닉네임 확인', '닉네임 중복확인을 완료해주세요.', 'error');
      return false;
    }

    if (!isBirthValid) {
      openModal(
        '생년월일 확인',
        '생년월일을 정확히 입력해주세요. 예: 960208',
        'error',
      );
      return false;
    }

    if (!isGenderValid) {
      openModal('성별 확인', '성별을 선택해주세요.', 'error');
      return false;
    }

    if (!isPhoneValid) {
      openModal(
        '전화번호 확인',
        '전화번호를 정확히 입력해주세요. 예: 010-0000-0000',
        'error',
      );
      return false;
    }

    if (!phoneReady) {
      openModal('전화번호 인증', '전화번호 인증을 완료해주세요.', 'error');
      return false;
    }

    return true;
  };

  const handleSocialSignup = async () => {
    if (!validateBeforeSubmit()) return;
    if (!socialContext) return;
    if (gender !== 'MALE' && gender !== 'FEMALE') return;

    const parsedBirthDate = parseBirthDate(birthDate);

    if (!parsedBirthDate) {
      openModal('생년월일 확인', '생년월일을 정확히 입력해주세요. 예: 960208', 'error');
      return;
    }

    setSignupLoading(true);

    try {
      const requestBody: SocialCompleteProfileRequest = {
        provider: socialContext.provider,
        providerToken: socialContext.providerToken,
        nickname: trimmedNickname,
        birthDate: parsedBirthDate.isoDate,
        gender,
        phoneNumber: phoneDigits,
        phoneVerificationToken,
        rememberMe: socialContext.rememberMe,
      };

      const data = await fetcher<SocialCompleteProfileResponse>(
        '/auth/social/complete-profile',
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(requestBody),
        },
      );

      clearAuthTokens();
      saveAuthTokens(
        data.accessToken,
        socialContext.rememberMe ? data.refreshToken : undefined,
      );
      saveCurrentUser(data.user);

      if (socialContext.rememberMe) {
        localStorage.setItem('keepLoggedIn', 'true');
      } else {
        localStorage.removeItem('keepLoggedIn');
      }

      sessionStorage.removeItem(SOCIAL_SIGNUP_CONTEXT_KEY);

      openModal('회원가입 완료', '소셜 회원가입이 완료되었습니다.', 'success', () => {
        navigate('/rankingZone', { replace: true });
      });
    } catch (error) {
      console.error('소셜 회원가입 오류:', error);

      openModal(
        '회원가입 실패',
        error instanceof Error
          ? error.message
          : '소셜 회원가입 요청에 실패했습니다.',
        'error',
      );
    } finally {
      setSignupLoading(false);
    }
  };

  const getNicknameMessage = () => {
    if (nicknameAvailable === true) return '사용 가능한 닉네임입니다';
    if (nicknameAvailable === false) return '이미 사용 중인 닉네임입니다';
    return '닉네임 중복확인을 해주세요.';
  };

  const getBirthDateMessage = () => {
    if (!birthDate.trim()) return '생년월일 6자리를 입력해주세요. 예: 960208';
    if (!isBirthValid) return '생년월일을 정확히 입력해주세요. 예: 960208';
    return '올바른 생년월일 형식입니다.';
  };

  const getPhoneMessage = () => {
    if (phoneErrorMessage) return phoneErrorMessage;
    if (phoneReady) return '인증이 완료 되었습니다';
    if (timerExpired) return '인증시간이 만료되었습니다. 재요청해 주세요.';
    if (phoneVerificationSent) return '전화번호 인증을 완료해주세요.';
    if (phoneNumber.trim()) return '전화번호 인증이 필요합니다.';
    return '전화번호를 입력해주세요. 예: 010-0000-0000';
  };

  const nicknameMessageClass =
    nicknameAvailable === true
      ? styles.successText
      : nicknameAvailable === false
        ? styles.errorText
        : styles.helperText;

  const birthDateMessageClass =
    birthDate.trim() && !isBirthValid
      ? styles.errorText
      : birthDate.trim() && isBirthValid
        ? styles.successText
        : styles.helperText;

  const phoneMessageClass =
    phoneErrorMessage || timerExpired
      ? styles.errorText
      : phoneReady
        ? styles.successText
        : styles.helperText;

  const bottomOffsetClass = phoneVerificationSent
    ? styles.bottomObjectsExpanded
    : styles.bottomObjectsDefault;

  return (
    <main className={styles.root}>
      <div className={styles.content}>
        <img
          src={signupDecorationImage}
          alt=""
          className={styles.decorationImage}
          draggable={false}
        />

        <header className={styles.header}>
          <div className={styles.titleRow}>
            <ProviderLogo provider={socialContext?.provider} />
            <h1 className={styles.title}>소셜 회원가입</h1>
          </div>

          <p className={styles.description}>추가 정보를 입력하면 바로 시작할 수 있어요</p>
        </header>

        <form
          className={styles.form}
          onSubmit={(event: FormEvent<HTMLFormElement>) => {
            event.preventDefault();
            void handleSocialSignup();
          }}
          noValidate
        >
          <div className={`${styles.fieldGroup} ${styles.nicknameGroup}`}>
            <label className={styles.label} htmlFor="nickname">
              닉네임
            </label>

            <div className={styles.inputButtonBox}>
              <input
                id="nickname"
                type="text"
                className={styles.inputWithButton}
                value={nickname}
                placeholder="닉네임을 입력하세요"
                autoComplete="nickname"
                disabled={signupLoading}
                onChange={(event) => resetNicknameCheck(event.target.value)}
              />

              <button
                type="button"
                className={`${styles.innerButton} ${
                  isNicknameCheckDone ? styles.checkButtonDone : ''
                }`}
                onClick={handleCheckNickname}
                disabled={nicknameCheckLoading || signupLoading || !nickname.trim()}
              >
                {nicknameCheckLoading
                  ? '확인중...'
                  : isNicknameCheckDone
                    ? '확인 완료'
                    : '중복 확인'}
              </button>
            </div>

            <p className={nicknameMessageClass}>{getNicknameMessage()}</p>
          </div>

          <div className={`${styles.fieldGroup} ${styles.birthDateGroup}`}>
            <label className={styles.label} htmlFor="birthDate">
              생년월일
            </label>

            <input
              id="birthDate"
              type="text"
              inputMode="numeric"
              className={styles.input}
              value={birthDate}
              placeholder="생년월일을 입력해주세요"
              maxLength={6}
              disabled={signupLoading}
              onChange={(event) => {
                setBirthDate(event.target.value.replace(/[^0-9]/g, '').slice(0, 6));
              }}
            />

            <p className={birthDateMessageClass}>{getBirthDateMessage()}</p>
          </div>

          <div className={styles.genderGroup}>
            <h2 className={styles.label}>성별 확인</h2>

            <div className={styles.genderRow}>
              <button
                type="button"
                className={styles.genderButton}
                aria-pressed={gender === 'MALE'}
                disabled={signupLoading}
                onClick={() => setGender('MALE')}
              >
                <SquareCheck
                  size={28}
                  strokeWidth={gender === 'MALE' ? 2.6 : 1.9}
                  className={
                    gender === 'MALE'
                      ? styles.genderIconChecked
                      : styles.genderIconUnchecked
                  }
                  aria-hidden="true"
                />
                <span
                  className={
                    gender === 'MALE'
                      ? styles.genderTextChecked
                      : styles.genderTextUnchecked
                  }
                >
                  남성
                </span>
              </button>

              <button
                type="button"
                className={styles.genderButton}
                aria-pressed={gender === 'FEMALE'}
                disabled={signupLoading}
                onClick={() => setGender('FEMALE')}
              >
                <SquareCheck
                  size={28}
                  strokeWidth={gender === 'FEMALE' ? 2.6 : 1.9}
                  className={
                    gender === 'FEMALE'
                      ? styles.genderIconChecked
                      : styles.genderIconUnchecked
                  }
                  aria-hidden="true"
                />
                <span
                  className={
                    gender === 'FEMALE'
                      ? styles.genderTextChecked
                      : styles.genderTextUnchecked
                  }
                >
                  여성
                </span>
              </button>
            </div>
          </div>

          <div className={`${styles.fieldGroup} ${styles.phoneGroup}`}>
            <label className={styles.label} htmlFor="phoneNumber">
              전화번호
            </label>

            <div
              className={`${styles.phoneCard} ${
                phoneVerificationSent ? styles.phoneCardExpanded : ''
              }`}
            >
              <div className={styles.phoneTopRow}>
                <input
                  id="phoneNumber"
                  type="tel"
                  className={styles.phoneInput}
                  value={phoneNumber}
                  placeholder="전화번호를 입력해주세요"
                  autoComplete="tel"
                  disabled={signupLoading}
                  onChange={(event) => handlePhoneNumberChange(event.target.value)}
                />

                {!phoneVerificationSent ? (
                  <button
                    type="button"
                    className={styles.phoneButton}
                    onClick={handleSendPhoneCode}
                    disabled={signupLoading || sendingCode || !isPhoneValid}
                  >
                    {sendingCode ? '발송중' : '인증번호 발송'}
                  </button>
                ) : (
                  <span className={styles.sentText}>
                    {phoneSendMessage || '인증번호가 발송되었습니다.'}
                  </span>
                )}
              </div>

              {phoneVerificationSent ? (
                <>
                  <div className={styles.verificationMetaRow}>
                    <span className={styles.timerText}>
                      {phoneVerified
                        ? '인증 완료'
                        : `남은 시간 ${formatCountdown(remainingSeconds)}`}
                    </span>

                    <button
                      type="button"
                      className={styles.resendButton}
                      onClick={handleSendPhoneCode}
                      disabled={!canResendCode || signupLoading}
                    >
                      {sendingCode ? '재요청중' : '재요청'}
                    </button>
                  </div>

                  <div className={styles.verificationRow}>
                    <input
                      type="text"
                      inputMode="numeric"
                      value={verificationCode}
                      onChange={(event) =>
                        setVerificationCode(
                          event.target.value.replace(/[^0-9]/g, '').slice(0, 6),
                        )
                      }
                      placeholder="인증번호"
                      className={styles.verificationInput}
                      disabled={signupLoading || phoneVerified}
                    />

                    <button
                      type="button"
                      className={`${styles.verifyCodeButton} ${
                        phoneVerified ? styles.checkButtonDone : ''
                      }`}
                      onClick={handleVerifyPhoneCode}
                      disabled={
                        signupLoading ||
                        verifyingCode ||
                        !verificationCode.trim() ||
                        timerExpired ||
                        phoneVerified
                      }
                    >
                      {phoneVerified ? '인증완료' : verifyingCode ? '확인중' : '인증하기'}
                    </button>
                  </div>
                </>
              ) : null}
            </div>

            <p className={phoneMessageClass}>{getPhoneMessage()}</p>

            {phoneDebugCode ? (
              <p className={styles.debugCodeText}>테스트 코드: {phoneDebugCode}</p>
            ) : null}
          </div>

          <button
            type="submit"
            className={`${styles.submitButton} ${bottomOffsetClass} ${
              !canSubmit ? styles.buttonDisabled : ''
            }`}
            disabled={!canSubmit}
          >
            {signupLoading ? '가입 중...' : '회원가입'}
          </button>

          <div className={`${styles.loginGuideRow} ${bottomOffsetClass}`}>
            <span className={styles.loginGuideText}>다른 계정으로 로그인할까요?</span>

            <button
              type="button"
              className={styles.loginButton}
              disabled={signupLoading}
              onClick={() => navigate('/login')}
            >
              로그인
            </button>
          </div>
        </form>

        {showModal ? (
          <div className={styles.modalBackdrop}>
            <div className={styles.modalCard}>
              <ModalStatusIcon type={modalType} />

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
      </div>
    </main>
  );
}
