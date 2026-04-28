import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import type {
  LoginResponse,
  SocialCodeExchangeResponse,
  SocialCompleteProfileRequest,
  SocialCompleteProfileResponse,
  SocialLoginRequest,
  SocialLoginResponse,
  SocialProvider,
} from '@codinator/contracts';

import { clearAuthTokens, fetcher, saveAuthTokens, saveCurrentUser } from '../../lib/api';

import loginSelectHeroImage from '../../assets/login/login-select-hero.png';
import googleLogoImage from '../../assets/login/social-google.png';
import naverLogoImage from '../../assets/login/social-naver.png';
import kakaoLogoImage from '../../assets/login/social-kakao.png';

import styles from './LoginSelect.module.css';

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

const SOCIAL_OAUTH_STATE_KEY = 'codinator:socialOAuthState';
const GOOGLE_IDENTITY_SCRIPT_ID = 'google-identity-services';

const SOCIAL_LOGIN_BUTTONS: SocialLoginButton[] = [
  {
    provider: 'KAKAO',
    label: '카카오 간편 로그인',
    logoImage: kakaoLogoImage,
  },
  {
    provider: 'NAVER',
    label: '네이버 간편 로그인',
    logoImage: naverLogoImage,
  },
  {
    provider: 'GOOGLE',
    label: '구글 간편 로그인',
    logoImage: googleLogoImage,
  },
];

const getSocialLogoImage = (provider: SocialProvider) => {
  return SOCIAL_LOGIN_BUTTONS.find((socialButton) => socialButton.provider === provider)?.logoImage;
};

const getSocialLoginBlockedMessage = (reason?: string) => {
  switch (reason) {
    case 'ACCOUNT_DELETED':
      return '탈퇴 처리된 계정입니다. 다른 계정으로 로그인해주세요.';
    case 'ACCOUNT_SUSPENDED':
      return '정지된 계정입니다. 관리자에게 문의해주세요.';
    case 'EMAIL_LINK_BLOCKED':
      return '동일한 이메일로 가입된 계정이 있습니다. 이메일/비밀번호로 로그인한 뒤 소셜 계정 연동을 진행해주세요.';
    default:
      return '이 소셜 계정으로는 가입 또는 로그인을 계속 진행할 수 없습니다.';
  }
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

const getLoginRedirectUri = () => `${window.location.origin}${window.location.pathname}`;

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

export default function LoginSelect() {
  const navigate = useNavigate();

  const [loading, setLoading] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [modalTitle, setModalTitle] = useState('안내');
  const [modalMessage, setModalMessage] = useState('');
  const [modalAction, setModalAction] = useState<ModalAction>(null);
  const [modalLogoImage, setModalLogoImage] = useState<string | null>(null);

  const handleLoginClick = () => {
    if (loading) return;
    navigate('/login');
  };

  const handleSignupClick = () => {
    if (loading) return;
    navigate('/signup');
  };

  const openModal = (title: string, message: string, action?: () => void, logoImage?: string) => {
    setModalTitle(title);
    setModalMessage(message);
    setModalAction(() => action ?? null);
    setModalLogoImage(logoImage ?? null);
    setShowModal(true);
  };

  const closeModal = () => {
    setShowModal(false);

    if (modalAction) {
      const action = modalAction;
      setModalAction(null);
      setModalLogoImage(null);
      action();
      return;
    }

    setModalAction(null);
    setModalLogoImage(null);
  };

  const persistAuthSession = (authData: PersistAuthData) => {
    clearAuthTokens();

    saveAuthTokens(authData.accessToken, undefined);

    saveCurrentUser({
      ...authData.user,
      email: authData.user.email ?? '',
    } as LoginResponse['user']);

    localStorage.removeItem('keepLoggedIn');

    navigate('/rankingZone', { replace: true });
  };

  const moveToSignupForNewSocialAccount = (provider: SocialProvider, providerToken: string) => {
    openModal(
      '추가 정보가 필요해요',
      '처음 사용하는 소셜 계정입니다. 회원가입 페이지에서 추가 정보를 입력하면 가입이 완료됩니다.',
      () =>
        navigate('/signup', {
          state: {
            mode: 'social',
            provider,
            providerToken,
            rememberMe: false,
          },
        }),
      getSocialLogoImage(provider),
    );
  };

  const completeSocialLogin = async (provider: SocialProvider, providerToken: string) => {
    const requestBody: SocialCompleteProfileRequest = {
      provider,
      providerToken,
      rememberMe: false,
    };

    const data = await fetcher<SocialCompleteProfileResponse>('/auth/social/complete-profile', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(requestBody),
    });

    persistAuthSession({
      accessToken: data.accessToken,
      refreshToken: data.refreshToken,
      user: data.user,
    });
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

    if (!loginCheck.canProceed) {
      openModal(
        '소셜 로그인 실패',
        getSocialLoginBlockedMessage(loginCheck.reason),
        undefined,
        getSocialLogoImage(provider),
      );
      return;
    }

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
      openModal('소셜 로그인 실패', '소셜 로그인 인증이 취소되었거나 실패했습니다.');
      return;
    }

    if (!code) {
      openModal('소셜 로그인 실패', '소셜 로그인 인가코드를 확인할 수 없습니다.');
      return;
    }

    let storedState: SocialOAuthState;

    try {
      storedState = JSON.parse(storedStateRaw) as SocialOAuthState;
    } catch {
      openModal('소셜 로그인 실패', '소셜 로그인 상태값을 확인할 수 없습니다. 다시 시도해주세요.');
      return;
    }

    if (storedState.provider === 'NAVER' && storedState.state !== returnedState) {
      openModal('소셜 로그인 실패', '네이버 로그인 상태값이 일치하지 않습니다. 다시 시도해주세요.');
      return;
    }

    setLoading(true);

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

      if (!exchangeResult.canProceed) {
        openModal(
          '소셜 로그인 실패',
          getSocialLoginBlockedMessage(exchangeResult.reason),
          undefined,
          getSocialLogoImage(storedState.provider),
        );
        return;
      }

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
      );
    } finally {
      setLoading(false);
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
      );
      return;
    }

    const redirectUri = getLoginRedirectUri();
    const oauthState: SocialOAuthState = {
      provider: 'KAKAO',
      redirectUri,
      rememberMe: false,
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
      );
      return;
    }

    const redirectUri = getLoginRedirectUri();
    const state = createRandomState();
    const oauthState: SocialOAuthState = {
      provider: 'NAVER',
      redirectUri,
      rememberMe: false,
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
      );
      return;
    }

    if (loading) return;

    setLoading(true);

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
              );
            } finally {
              setLoading(false);
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
          setLoading(false);
        }
      });
    } catch (err) {
      console.error('Google 로그인 초기화 오류:', err);
      setLoading(false);
      openModal(
        '구글 로그인 실패',
        err instanceof Error ? err.message : '구글 로그인 초기화에 실패했습니다.',
      );
    }
  };

  const handleSocialLoginClick = (provider: SocialButtonProvider) => {
    if (loading) return;

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

        <button
          type="button"
          className={styles.loginButton}
          disabled={loading}
          onClick={handleLoginClick}
        >
          로그인
        </button>

        <div className={styles.orRow} aria-hidden="true">
          <span className={styles.orLine} />
          <span className={styles.orText}>OR</span>
          <span className={styles.orLine} />
        </div>

        <div className={styles.socialButtonRow}>
          {SOCIAL_LOGIN_BUTTONS.map((socialButton) => (
            <button
              key={socialButton.provider}
              type="button"
              className={styles.socialButton}
              aria-label={socialButton.label}
              disabled={loading}
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

        <div className={styles.signupRow}>
          <span className={styles.signupGuideText}>계정이 없으신가요?</span>

          <button
            type="button"
            className={styles.signupButton}
            disabled={loading}
            onClick={handleSignupClick}
          >
            회원가입
          </button>
        </div>
      </section>

      {showModal ? (
        <div className={styles.modalBackdrop}>
          <div className={styles.modalCard}>
            <div
              className={
                modalLogoImage ? `${styles.modalIcon} ${styles.modalIconSocial}` : styles.modalIcon
              }
            >
              {modalLogoImage ? (
                <img
                  src={modalLogoImage}
                  alt=""
                  className={styles.modalLogoImage}
                  draggable={false}
                  aria-hidden="true"
                />
              ) : (
                '!'
              )}
            </div>

            <h3 className={styles.modalTitle}>{modalTitle}</h3>

            <p className={styles.modalMessage}>{modalMessage}</p>

            <button type="button" className={styles.modalButton} onClick={closeModal}>
              확인
            </button>
          </div>
        </div>
      ) : null}
    </main>
  );
}
