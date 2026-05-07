import { FormEvent, useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { SquareCheck } from 'lucide-react';
import type {
  Gender,
  LoginResponse,
  SendPhoneVerificationRequest,
  SendPhoneVerificationResponse,
  SignupRequest,
  SignupResponse,
  SocialCodeExchangeResponse,
  SocialCompleteProfileRequest,
  SocialCompleteProfileResponse,
  SocialLoginRequest,
  SocialLoginResponse,
  SocialProvider,
  VerifyPhoneCodeRequest,
} from '@codinator/contracts';

import { clearAuthTokens, fetcher, saveAuthTokens, saveCurrentUser } from '../../lib/api';
import signupDecorationImage from '../../assets/auth/signup-decoration.png';
import kakaoLogoImage from '../../assets/login/social-kakao.png';
import naverLogoImage from '../../assets/login/social-naver.png';
import googleLogoImage from '../../assets/login/social-google.png';

import styles from './Signup.module.css';

type CheckResponse = {
  available: boolean;
  message?: string;
};

type SignupCheckRequest = {
  type: 'EMAIL' | 'NICKNAME' | 'PASSWORD';
  value: string;
};

type VerifyPhoneCodeResponse = {
  phoneVerificationToken: string;
  expiresAt: string;
};

type SignupGender = Gender | '';
type ModalType = 'success' | 'error' | 'info' | 'social';
type ModalAction = (() => void) | null;
type OAuthProvider = Extract<SocialProvider, 'KAKAO' | 'NAVER'>;
type SocialButtonProvider = Extract<SocialProvider, 'GOOGLE' | 'NAVER' | 'KAKAO'>;

type SocialOAuthState = {
  provider: OAuthProvider;
  redirectUri: string;
  rememberMe: boolean;
  state?: string;
};

type GoogleCredentialResponse = {
  credential?: string;
};

type GooglePromptMomentNotification = {
  isNotDisplayed?: () => boolean;
  isSkippedMoment?: () => boolean;
  isDismissedMoment?: () => boolean;
};

type PersistAuthData = {
  accessToken: SocialCompleteProfileResponse['accessToken'];
  refreshToken?: SocialCompleteProfileResponse['refreshToken'] | null;
  user: SocialCompleteProfileResponse['user'];
};

type SocialLoginButton = {
  provider: SocialButtonProvider;
  label: string;
  logoImage: string;
};

type SignupLocationState = {
  mode?: 'social';
  provider?: SocialProvider;
  providerToken?: string;
  rememberMe?: boolean;
};

type SocialSignupContext = {
  provider: SocialProvider;
  providerToken: string;
  rememberMe: boolean;
};

declare global {
  interface Window {
    google?: {
      accounts: {
        id: {
          initialize: (config: {
            client_id: string;
            callback: (response: GoogleCredentialResponse) => void;
          }) => void;
          prompt: (callback?: (notification: GooglePromptMomentNotification) => void) => void;
        };
      };
    };
  }
}

const PHONE_CODE_TTL_SECONDS = 5 * 60;
const SOCIAL_OAUTH_STATE_KEY = 'codinator:socialOAuthState';
const GOOGLE_IDENTITY_SCRIPT_ID = 'google-identity-services';
const SOCIAL_LOGIN_REMEMBER_ME = true;
const DEMO_SIGNUP_NICKNAME = '코디데모0508';
const DEMO_SIGNUP_EMAIL = 'demo0508@codinator.com';
const DEMO_SIGNUP_PASSWORD = 'qwer1234!';
const DEMO_SIGNUP_BIRTH_DATE = '050508';
const DEMO_SIGNUP_GENDER: SignupGender = 'MALE';
const DEMO_SIGNUP_PHONE_NUMBER = '010-0508-0508';

const SOCIAL_LOGIN_BUTTONS: SocialLoginButton[] = [
  {
    provider: 'KAKAO',
    label: '카카오 간편 회원가입',
    logoImage: kakaoLogoImage,
  },
  {
    provider: 'NAVER',
    label: '네이버 간편 회원가입',
    logoImage: naverLogoImage,
  },
  {
    provider: 'GOOGLE',
    label: '구글 간편 회원가입',
    logoImage: googleLogoImage,
  },
];

const getSocialLogoImage = (provider: SocialProvider) => {
  return SOCIAL_LOGIN_BUTTONS.find((socialButton) => socialButton.provider === provider)?.logoImage;
};

const isSocialProvider = (value: unknown): value is SocialProvider => {
  return value === 'GOOGLE' || value === 'NAVER' || value === 'KAKAO';
};

const getStringEnv = (key: string): string => {
  const value = import.meta.env[key];
  return typeof value === 'string' ? value.trim() : '';
};

const createRandomState = () => {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return crypto.randomUUID();
  }

  return `${Date.now()}-${Math.random().toString(36).slice(2)}`;
};

const getSignupRedirectUri = () => `${window.location.origin}${window.location.pathname}`;

const loadGoogleIdentityScript = () => {
  return new Promise<void>((resolve, reject) => {
    if (window.google?.accounts?.id) {
      resolve();
      return;
    }

    const existingScript = document.getElementById(
      GOOGLE_IDENTITY_SCRIPT_ID,
    ) as HTMLScriptElement | null;

    if (existingScript) {
      existingScript.addEventListener('load', () => resolve(), { once: true });
      existingScript.addEventListener(
        'error',
        () => reject(new Error('Google 로그인 스크립트 로드에 실패했습니다.')),
        { once: true },
      );
      return;
    }

    const script = document.createElement('script');
    script.id = GOOGLE_IDENTITY_SCRIPT_ID;
    script.src = 'https://accounts.google.com/gsi/client';
    script.async = true;
    script.defer = true;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error('Google 로그인 스크립트 로드에 실패했습니다.'));
    document.head.appendChild(script);
  });
};

function ModalStatusIcon({
  type,
  socialProvider,
}: {
  type: ModalType;
  socialProvider?: SocialButtonProvider | null;
}) {
  if (type === 'social' && socialProvider) {
    const logoImage = getSocialLogoImage(socialProvider);

    return (
      <div className={`${styles.modalIcon} ${styles.modalIconSocial}`}>
        {logoImage ? (
          <img
            src={logoImage}
            alt=""
            className={styles.modalLogoImage}
            draggable={false}
            aria-hidden="true"
          />
        ) : null}
      </div>
    );
  }

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

  return twoDigitYear <= currentTwoDigitYear ? 2000 + twoDigitYear : 1900 + twoDigitYear;
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
    date.getFullYear() === year && date.getMonth() === month - 1 && date.getDate() === day;

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

export default function Signup() {
  const navigate = useNavigate();
  const location = useLocation();

  const socialSignupContext = useMemo<SocialSignupContext | null>(() => {
    const state = location.state as SignupLocationState | null;

    if (state?.mode !== 'social' || !isSocialProvider(state.provider) || !state.providerToken) {
      return null;
    }

    return {
      provider: state.provider,
      providerToken: state.providerToken,
      rememberMe: SOCIAL_LOGIN_REMEMBER_ME,
    };
  }, [location.state]);

  const isSocialSignup = socialSignupContext !== null;

  const [nickname, setNickname] = useState(DEMO_SIGNUP_NICKNAME);
  const [email, setEmail] = useState(DEMO_SIGNUP_EMAIL);
  const [password, setPassword] = useState(DEMO_SIGNUP_PASSWORD);
  const [passwordConfirm, setPasswordConfirm] = useState(DEMO_SIGNUP_PASSWORD);
  const [birthDate, setBirthDate] = useState(DEMO_SIGNUP_BIRTH_DATE);
  const [gender, setGender] = useState<SignupGender>(DEMO_SIGNUP_GENDER);
  const [phoneNumber, setPhoneNumber] = useState(DEMO_SIGNUP_PHONE_NUMBER);

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
  const [emailChecked, setEmailChecked] = useState(false);
  const [nicknameAvailable, setNicknameAvailable] = useState<boolean | null>(null);
  const [emailAvailable, setEmailAvailable] = useState<boolean | null>(null);

  const [nicknameCheckLoading, setNicknameCheckLoading] = useState(false);
  const [emailCheckLoading, setEmailCheckLoading] = useState(false);
  const [signupLoading, setSignupLoading] = useState(false);
  const [socialLoading, setSocialLoading] = useState(false);

  const [showModal, setShowModal] = useState(false);
  const [modalTitle, setModalTitle] = useState('안내');
  const [modalMessage, setModalMessage] = useState('');
  const [modalType, setModalType] = useState<ModalType>('info');
  const [modalAction, setModalAction] = useState<ModalAction>(null);
  const [modalSocialProvider, setModalSocialProvider] = useState<SocialButtonProvider | null>(null);

  const emailRegex = useMemo(() => /^[^\s@]+@[^\s@]+\.[^\s@]+$/, []);

  // 비밀번호 정책:
  // 8자 이상, 영문, 숫자, 특수문자 각각 1개 이상 필수 포함
  const passwordRegex = useMemo(() => /^(?=.*[A-Za-z])(?=.*\d)(?=.*[^A-Za-z0-9]).{8,}$/, []);

  const phoneRegex = useMemo(() => /^01(?:0|1|6|7|8|9)-\d{3,4}-\d{4}$/, []);

  const trimmedNickname = nickname.trim();
  const trimmedEmail = email.trim();
  const trimmedPassword = password.trim();
  const trimmedBirthDate = birthDate.trim();
  const phoneDigits = normalizePhoneDigits(phoneNumber);

  const isNicknameValid = trimmedNickname.length > 0;
  const isEmailValid = emailRegex.test(trimmedEmail);
  const isPasswordValid = passwordRegex.test(trimmedPassword);
  const isPasswordConfirmValid = passwordConfirm.trim().length > 0 && password === passwordConfirm;
  const isBirthValid = isValidBirthDate(trimmedBirthDate);
  const isGenderValid = gender === 'MALE' || gender === 'FEMALE';
  const isPhoneValid = phoneRegex.test(phoneNumber);

  const isNicknameCheckDone = nicknameChecked && nicknameAvailable === true;
  const isEmailCheckDone = emailChecked && emailAvailable === true;
  const isEmailReady = isSocialSignup || (isEmailValid && isEmailCheckDone);

  const timerExpired = phoneVerificationSent && !phoneVerified && remainingSeconds === 0;

  const phoneReady =
    isPhoneValid &&
    phoneVerified &&
    phoneVerificationToken !== '' &&
    verifiedPhoneDigits === phoneDigits;

  const canResendCode = phoneVerificationSent && !phoneVerified && !sendingCode;

  const canSubmit =
    isNicknameValid &&
    isEmailReady &&
    isPasswordValid &&
    isPasswordConfirmValid &&
    isBirthValid &&
    isGenderValid &&
    phoneReady &&
    isNicknameCheckDone &&
    !signupLoading;

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
    socialProvider?: SocialButtonProvider,
  ) => {
    setModalTitle(title);
    setModalMessage(message);
    setModalType(type);
    setModalAction(() => action ?? null);
    setModalSocialProvider(socialProvider ?? null);
    setShowModal(true);
  };

  const closeModal = () => {
    setShowModal(false);

    if (modalAction) {
      const action = modalAction;
      setModalAction(null);
      setModalSocialProvider(null);
      action();
      return;
    }

    setModalAction(null);
    setModalSocialProvider(null);
  };

  const persistSocialAuthSession = (
    authData: PersistAuthData,
    rememberMe = SOCIAL_LOGIN_REMEMBER_ME,
  ) => {
    clearAuthTokens();

    const refreshToken = rememberMe ? (authData.refreshToken ?? undefined) : undefined;
    saveAuthTokens(authData.accessToken, refreshToken);

    saveCurrentUser({
      ...authData.user,
      email: authData.user.email ?? '',
    } as LoginResponse['user']);

    if (rememberMe && authData.refreshToken) {
      localStorage.setItem('keepLoggedIn', 'true');
    } else {
      localStorage.removeItem('keepLoggedIn');
    }

    navigate('/rankingZone', { replace: true });
  };

  const moveToSignupForNewSocialAccount = (provider: SocialProvider, providerToken: string) => {
    openModal(
      '추가 정보가 필요해요',
      '처음 사용하는 소셜 계정입니다. 회원가입 페이지에서 추가 정보를 입력하면 가입이 완료됩니다.',
      'social',
      () =>
        navigate('/signup', {
          state: {
            mode: 'social',
            provider,
            providerToken,
            rememberMe: SOCIAL_LOGIN_REMEMBER_ME,
          },
        }),
      provider as SocialButtonProvider,
    );
  };

  const completeSocialLogin = async (provider: SocialProvider, providerToken: string) => {
    const requestBody: SocialCompleteProfileRequest = {
      provider,
      providerToken,
      rememberMe: SOCIAL_LOGIN_REMEMBER_ME,
    };

    const data = await fetcher<SocialCompleteProfileResponse>('/auth/social/complete-profile', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(requestBody),
    });

    persistSocialAuthSession(
      {
        accessToken: data.accessToken,
        refreshToken: data.refreshToken,
        user: data.user,
      },
      SOCIAL_LOGIN_REMEMBER_ME,
    );
  };

  const handleProviderTokenLogin = async (provider: SocialProvider, providerToken: string) => {
    const loginRequest: SocialLoginRequest = {
      provider,
      providerToken,
    };

    const loginCheck = await fetcher<SocialLoginResponse>('/auth/social/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(loginRequest),
    });

    if (loginCheck.isNewUser) {
      moveToSignupForNewSocialAccount(provider, providerToken);
      return;
    }

    await completeSocialLogin(provider, providerToken);
  };

  const handleSocialRedirectCallback = async () => {
    const storedStateRaw = sessionStorage.getItem(SOCIAL_OAUTH_STATE_KEY);
    if (!storedStateRaw) return;

    const searchParams = new URLSearchParams(window.location.search);
    const code = searchParams.get('code');
    const returnedState = searchParams.get('state') ?? undefined;
    const error = searchParams.get('error');

    if (!code && !error) return;

    sessionStorage.removeItem(SOCIAL_OAUTH_STATE_KEY);
    window.history.replaceState(null, '', window.location.pathname);

    if (error) {
      openModal('소셜 로그인 실패', '소셜 로그인 인증이 취소되었거나 실패했습니다.', 'error');
      return;
    }

    if (!code) {
      openModal('소셜 로그인 실패', '소셜 로그인 인가코드를 확인할 수 없습니다.', 'error');
      return;
    }

    let storedState: SocialOAuthState;

    try {
      storedState = JSON.parse(storedStateRaw) as SocialOAuthState;
    } catch {
      openModal(
        '소셜 로그인 실패',
        '소셜 로그인 상태값을 확인할 수 없습니다. 다시 시도해주세요.',
        'error',
      );
      return;
    }

    if (storedState.provider === 'NAVER' && storedState.state !== returnedState) {
      openModal(
        '소셜 로그인 실패',
        '네이버 로그인 상태값이 일치하지 않습니다. 다시 시도해주세요.',
        'error',
      );
      return;
    }

    setSocialLoading(true);

    try {
      const exchangeEndpoint =
        storedState.provider === 'KAKAO'
          ? '/auth/social/kakao/exchange-code'
          : '/auth/social/naver/exchange-code';

      const exchangeBody =
        storedState.provider === 'KAKAO'
          ? {
              code,
              redirectUri: storedState.redirectUri,
              rememberMe: storedState.rememberMe,
            }
          : {
              code,
              state: returnedState ?? '',
              redirectUri: storedState.redirectUri,
              rememberMe: storedState.rememberMe,
            };

      const exchangeResult = await fetcher<SocialCodeExchangeResponse>(exchangeEndpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(exchangeBody),
      });

      if (exchangeResult.isNewUser) {
        moveToSignupForNewSocialAccount(storedState.provider, exchangeResult.providerToken);
        return;
      }

      await completeSocialLogin(storedState.provider, exchangeResult.providerToken);
    } catch (err) {
      console.error('소셜 로그인 콜백 처리 오류:', err);
      openModal(
        '소셜 로그인 실패',
        err instanceof Error ? err.message : '소셜 로그인 처리에 실패했습니다.',
        'error',
      );
    } finally {
      setSocialLoading(false);
    }
  };

  useEffect(() => {
    void handleSocialRedirectCallback();
    // 최초 진입 시 URL callback만 처리한다.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const startKakaoLogin = () => {
    const clientId = getStringEnv('VITE_KAKAO_REST_API_KEY');

    if (!clientId) {
      openModal(
        '카카오 로그인 설정 필요',
        'VITE_KAKAO_REST_API_KEY가 설정되어 있지 않습니다. 환경변수 설정 후 다시 시도해주세요.',
        'error',
      );
      return;
    }

    const redirectUri = getSignupRedirectUri();
    const oauthState: SocialOAuthState = {
      provider: 'KAKAO',
      redirectUri,
      rememberMe: SOCIAL_LOGIN_REMEMBER_ME,
    };

    sessionStorage.setItem(SOCIAL_OAUTH_STATE_KEY, JSON.stringify(oauthState));

    const url = new URL('https://kauth.kakao.com/oauth/authorize');
    url.searchParams.set('response_type', 'code');
    url.searchParams.set('client_id', clientId);
    url.searchParams.set('redirect_uri', redirectUri);

    window.location.href = url.toString();
  };

  const startNaverLogin = () => {
    const clientId = getStringEnv('VITE_NAVER_CLIENT_ID');

    if (!clientId) {
      openModal(
        '네이버 로그인 설정 필요',
        'VITE_NAVER_CLIENT_ID가 설정되어 있지 않습니다. 환경변수 설정 후 다시 시도해주세요.',
        'error',
      );
      return;
    }

    const redirectUri = getSignupRedirectUri();
    const state = createRandomState();
    const oauthState: SocialOAuthState = {
      provider: 'NAVER',
      redirectUri,
      rememberMe: SOCIAL_LOGIN_REMEMBER_ME,
      state,
    };

    sessionStorage.setItem(SOCIAL_OAUTH_STATE_KEY, JSON.stringify(oauthState));

    const url = new URL('https://nid.naver.com/oauth2.0/authorize');
    url.searchParams.set('response_type', 'code');
    url.searchParams.set('client_id', clientId);
    url.searchParams.set('redirect_uri', redirectUri);
    url.searchParams.set('state', state);

    window.location.href = url.toString();
  };

  const startGoogleLogin = async () => {
    const clientId = getStringEnv('VITE_GOOGLE_CLIENT_ID');

    if (!clientId) {
      openModal(
        '구글 로그인 설정 필요',
        'VITE_GOOGLE_CLIENT_ID가 설정되어 있지 않습니다. 환경변수 설정 후 다시 시도해주세요.',
        'error',
      );
      return;
    }

    if (socialLoading) return;

    setSocialLoading(true);

    try {
      await loadGoogleIdentityScript();

      if (!window.google?.accounts?.id) {
        throw new Error('Google 로그인 모듈을 사용할 수 없습니다.');
      }

      window.google.accounts.id.initialize({
        client_id: clientId,
        callback: (response) => {
          void (async () => {
            try {
              if (!response.credential) {
                throw new Error('Google ID token을 확인할 수 없습니다.');
              }

              await handleProviderTokenLogin('GOOGLE', response.credential);
            } catch (err) {
              console.error('Google 로그인 오류:', err);
              openModal(
                '구글 로그인 실패',
                err instanceof Error ? err.message : '구글 로그인 처리에 실패했습니다.',
                'error',
              );
            } finally {
              setSocialLoading(false);
            }
          })();
        },
      });

      window.google.accounts.id.prompt((notification) => {
        if (
          notification.isNotDisplayed?.() ||
          notification.isSkippedMoment?.() ||
          notification.isDismissedMoment?.()
        ) {
          setSocialLoading(false);
        }
      });
    } catch (err) {
      console.error('Google 로그인 초기화 오류:', err);
      setSocialLoading(false);
      openModal(
        '구글 로그인 실패',
        err instanceof Error ? err.message : '구글 로그인 초기화에 실패했습니다.',
        'error',
      );
    }
  };

  const handleSocialLoginClick = (provider: SocialButtonProvider) => {
    if (signupLoading || socialLoading) return;

    if (provider === 'KAKAO') {
      startKakaoLogin();
      return;
    }

    if (provider === 'NAVER') {
      startNaverLogin();
      return;
    }

    void startGoogleLogin();
  };

  const requestSignupCheck = async (body: SignupCheckRequest): Promise<CheckResponse> => {
    return fetcher<CheckResponse>('/auth/signup/check', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
  };

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
        error instanceof Error ? error.message : '닉네임 중복확인 요청에 실패했습니다.',
        'error',
      );
    } finally {
      setNicknameCheckLoading(false);
    }
  };

  const handleCheckEmail = async () => {
    if (!trimmedEmail) {
      openModal('이메일 확인', '이메일을 먼저 입력해주세요.', 'error');
      return;
    }

    if (!isEmailValid) {
      openModal('이메일 확인', '올바른 이메일 형식을 입력해주세요.', 'error');
      return;
    }

    setEmailCheckLoading(true);

    try {
      const data = await requestSignupCheck({
        type: 'EMAIL',
        value: trimmedEmail,
      });

      setEmailChecked(true);
      setEmailAvailable(data.available);

      openModal(
        '이메일 중복확인',
        data.available
          ? data.message || '사용 가능한 이메일입니다.'
          : data.message || '이미 사용 중인 이메일입니다.',
        data.available ? 'success' : 'error',
      );
    } catch (error) {
      console.error('이메일 중복체크 오류:', error);

      setEmailChecked(false);
      setEmailAvailable(null);

      openModal(
        '오류',
        error instanceof Error ? error.message : '이메일 중복확인 요청에 실패했습니다.',
        'error',
      );
    } finally {
      setEmailCheckLoading(false);
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
      setPhoneSendMessage(isResend ? '인증번호를 재요청했습니다.' : '인증번호가 발송되었습니다.');
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
    if (!isNicknameValid) {
      openModal('입력 확인', '닉네임을 입력해주세요.', 'error');
      return false;
    }

    if (!isNicknameCheckDone) {
      openModal('닉네임 확인', '닉네임 중복확인을 완료해주세요.', 'error');
      return false;
    }

    if (!isSocialSignup) {
      if (!isEmailValid) {
        openModal('이메일 확인', '올바른 이메일 형식을 입력해주세요.', 'error');
        return false;
      }

      if (!isEmailCheckDone) {
        openModal('이메일 확인', '이메일 중복확인을 완료해주세요.', 'error');
        return false;
      }
    }

    if (!isPasswordValid) {
      openModal(
        '비밀번호 확인',
        '비밀번호는 8자 이상이며 영문, 숫자, 특수문자를 각각 1개 이상 포함해야 합니다.',
        'error',
      );
      return false;
    }

    if (!isPasswordConfirmValid) {
      openModal('비밀번호 확인', '비밀번호가 일치하지 않습니다.', 'error');
      return false;
    }

    if (!isBirthValid) {
      openModal('생년월일 확인', '생년월일을 정확히 입력해주세요. 예: 960208', 'error');
      return false;
    }

    if (!isGenderValid) {
      openModal('성별 확인', '성별을 선택해주세요.', 'error');
      return false;
    }

    if (!isPhoneValid) {
      openModal('전화번호 확인', '전화번호를 정확히 입력해주세요. 예: 010-0000-0000', 'error');
      return false;
    }

    if (!phoneReady) {
      openModal('전화번호 인증', '전화번호 인증을 완료해주세요.', 'error');
      return false;
    }

    return true;
  };

  const handleSignup = async () => {
    if (!validateBeforeSubmit()) return;
    if (gender !== 'MALE' && gender !== 'FEMALE') return;

    const parsedBirthDate = parseBirthDate(birthDate);

    if (!parsedBirthDate) {
      openModal('생년월일 확인', '생년월일을 정확히 입력해주세요. 예: 960208', 'error');
      return;
    }

    setSignupLoading(true);

    try {
      if (socialSignupContext) {
        const requestBody: SocialCompleteProfileRequest = {
          provider: socialSignupContext.provider,
          providerToken: socialSignupContext.providerToken,
          nickname: trimmedNickname,
          password: trimmedPassword,
          birthDate: parsedBirthDate.isoDate,
          gender,
          phoneNumber: phoneDigits,
          phoneVerificationToken,
          rememberMe: SOCIAL_LOGIN_REMEMBER_ME,
        };

        const data = await fetcher<SocialCompleteProfileResponse>('/auth/social/complete-profile', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(requestBody),
        });

        openModal('회원가입 완료', '소셜 회원가입이 완료되었습니다.', 'success', () => {
          persistSocialAuthSession(
            {
              accessToken: data.accessToken,
              refreshToken: data.refreshToken,
              user: data.user,
            },
            SOCIAL_LOGIN_REMEMBER_ME,
          );
        });
        return;
      }

      const requestBody: SignupRequest = {
        email: trimmedEmail,
        nickname: trimmedNickname,
        password: trimmedPassword,
        birthDate: parsedBirthDate.isoDate,
        gender,
        phoneNumber: phoneDigits,
        phoneVerificationToken,
      };

      await fetcher<SignupResponse>('/auth/signup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestBody),
      });

      openModal('회원가입 완료', '회원가입이 완료되었습니다.', 'success', () => {
        navigate('/login');
      });
    } catch (error) {
      console.error('회원가입 오류:', error);

      openModal(
        '회원가입 실패',
        error instanceof Error ? error.message : '회원가입 요청에 실패했습니다.',
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

  const getEmailMessage = () => {
    if (emailAvailable === true) return '사용 가능한 이메일입니다';
    if (emailAvailable === false) return '이미 사용 중인 이메일입니다';
    if (email.trim() && !isEmailValid) return '올바른 이메일 형식으로 입력해주세요.';
    return '이메일 중복확인을 해주세요.';
  };

  const getPasswordMessage = () => {
    if (!password.trim()) {
      return '8자 이상, 영문, 숫자, 특수문자 각각 1개 이상 필수 포함';
    }

    if (!isPasswordValid) {
      return '8자 이상이며 영문, 숫자, 특수문자를 각각 1개 이상 포함해야 합니다.';
    }

    return '사용 가능한 비밀번호 형식입니다.';
  };

  const getPasswordConfirmMessage = () => {
    if (!passwordConfirm.trim()) return '';
    if (!isPasswordConfirmValid) return '비밀번호가 일치하지 않습니다.';
    return '비밀번호가 일치합니다';
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

  const emailMessageClass =
    emailAvailable === true
      ? styles.successText
      : emailAvailable === false || (email.trim() && !isEmailValid)
        ? styles.errorText
        : styles.helperText;

  const passwordMessageClass =
    password.trim() && !isPasswordValid
      ? styles.errorText
      : password.trim() && isPasswordValid
        ? styles.successText
        : styles.helperText;

  const passwordConfirmMessageClass =
    passwordConfirm.trim() && !isPasswordConfirmValid
      ? styles.errorText
      : isPasswordConfirmValid
        ? styles.successText
        : styles.helperText;

  const birthDateMessageClass =
    birthDate.trim() && !isBirthValid
      ? styles.errorText
      : birthDate.trim() && isBirthValid
        ? styles.successText
        : styles.helperText;

  const phoneMessageClass = `${styles.phoneMessageText} ${
    phoneErrorMessage || timerExpired
      ? styles.errorText
      : phoneReady
        ? styles.successText
        : styles.helperText
  }`;

  const bottomOffsetClass = phoneVerificationSent
    ? styles.bottomObjectsExpanded
    : styles.bottomObjectsDefault;

  const contentHeightClass = phoneVerificationSent ? styles.contentExpanded : styles.contentDefault;

  return (
    <main className={styles.root}>
      <div
        className={`${styles.content} ${contentHeightClass} ${
          isSocialSignup ? styles.socialContent : ''
        }`}
      >
        <img
          src={signupDecorationImage}
          alt=""
          className={styles.decorationImage}
          draggable={false}
        />

        <header className={styles.header}>
          <h1 className={styles.title}>회원가입</h1>
          <p className={styles.description}>
            {isSocialSignup
              ? '추가 정보를 입력하면 바로 시작할 수 있어요'
              : '내 코디를 공유하고 평가를 받아보세요'}
          </p>
        </header>

        <form
          className={`${styles.form} ${isSocialSignup ? styles.socialForm : ''}`}
          onSubmit={(event: FormEvent<HTMLFormElement>) => {
            event.preventDefault();
            void handleSignup();
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

          {!isSocialSignup ? (
            <div className={`${styles.fieldGroup} ${styles.emailGroup}`}>
              <label className={styles.label} htmlFor="email">
                이메일
              </label>

              <div className={styles.inputButtonBox}>
                <input
                  id="email"
                  type="email"
                  className={styles.inputWithButton}
                  value={email}
                  placeholder="이메일을 입력하세요"
                  autoComplete="email"
                  disabled={signupLoading}
                  onChange={(event) => resetEmailCheck(event.target.value)}
                />

                <button
                  type="button"
                  className={`${styles.innerButton} ${
                    isEmailCheckDone ? styles.checkButtonDone : ''
                  }`}
                  onClick={handleCheckEmail}
                  disabled={emailCheckLoading || signupLoading || !email.trim()}
                >
                  {emailCheckLoading ? '확인중...' : isEmailCheckDone ? '확인 완료' : '중복 확인'}
                </button>
              </div>

              <p className={emailMessageClass}>{getEmailMessage()}</p>
            </div>
          ) : null}

          <div className={`${styles.fieldGroup} ${styles.passwordGroup}`}>
            <label className={styles.label} htmlFor="password">
              비밀번호
            </label>

            <input
              id="password"
              type="password"
              className={styles.input}
              value={password}
              placeholder="비밀번호를 입력해 주세요"
              autoComplete="new-password"
              disabled={signupLoading}
              onChange={(event) => setPassword(event.target.value)}
            />

            <p className={passwordMessageClass}>{getPasswordMessage()}</p>
          </div>

          <div className={`${styles.fieldGroup} ${styles.passwordConfirmGroup}`}>
            <label className={styles.label} htmlFor="passwordConfirm">
              비밀번호 재확인
            </label>

            <input
              id="passwordConfirm"
              type="password"
              className={styles.input}
              value={passwordConfirm}
              placeholder="한번 더 입력해주세요"
              autoComplete="new-password"
              disabled={signupLoading}
              onChange={(event) => setPasswordConfirm(event.target.value)}
            />

            <p className={passwordConfirmMessageClass}>{getPasswordConfirmMessage()}</p>
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
                    gender === 'MALE' ? styles.genderIconChecked : styles.genderIconUnchecked
                  }
                  aria-hidden="true"
                />
                <span
                  className={
                    gender === 'MALE' ? styles.genderTextChecked : styles.genderTextUnchecked
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
                    gender === 'FEMALE' ? styles.genderIconChecked : styles.genderIconUnchecked
                  }
                  aria-hidden="true"
                />
                <span
                  className={
                    gender === 'FEMALE' ? styles.genderTextChecked : styles.genderTextUnchecked
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
                        setVerificationCode(event.target.value.replace(/[^0-9]/g, '').slice(0, 6))
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
            className={`${styles.signupSubmitButton} ${bottomOffsetClass} ${
              !canSubmit ? styles.buttonDisabled : ''
            }`}
            disabled={!canSubmit}
          >
            {signupLoading ? '회원가입 중...' : '회원가입'}
          </button>

          <div className={`${styles.orRow} ${bottomOffsetClass}`} aria-hidden="true">
            <span className={styles.orLine} />
            <span className={styles.orText}>OR</span>
            <span className={styles.orLine} />
          </div>

          <div className={`${styles.socialButtonRow} ${bottomOffsetClass}`}>
            {SOCIAL_LOGIN_BUTTONS.map((socialButton) => (
              <button
                key={socialButton.provider}
                type="button"
                className={styles.socialButton}
                aria-label={socialButton.label}
                disabled={signupLoading || socialLoading}
                onClick={() => handleSocialLoginClick(socialButton.provider)}
              >
                <img
                  src={socialButton.logoImage}
                  alt=""
                  className={styles.socialLogoImage}
                  draggable={false}
                  aria-hidden="true"
                />
              </button>
            ))}
          </div>

          <div className={`${styles.loginGuideRow} ${bottomOffsetClass}`}>
            <span className={styles.loginGuideText}>계정이 이미 있으신가요?</span>

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
              <ModalStatusIcon type={modalType} socialProvider={modalSocialProvider} />

              <h3 className={styles.modalTitle}>{modalTitle}</h3>

              <p className={styles.modalMessage}>{modalMessage}</p>

              <button type="button" className={styles.modalButton} onClick={closeModal}>
                확인
              </button>
            </div>
          </div>
        ) : null}
      </div>
    </main>
  );
}
