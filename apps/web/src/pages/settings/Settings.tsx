import { useCallback, useEffect, useState, type ReactNode } from 'react';
import type {
  GetSettingsResponse,
  ThemeMode,
  UpdateSettingsRequest,
} from '@codinator/contracts';
import {
  Bell,
  ChevronLeft,
  CircleAlert,
  LoaderCircle,
  Megaphone,
  Menu,
  MoonStar,
  ShieldCheck,
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import SideMenu from '../../components/SideMenu';
import {
  clearAuthTokens,
  fetchMySettings,
  isAuthError,
  updateMySettings,
} from '../../lib/api';
import { saveAndApplyThemeMode } from '../../lib/theme';
import styles from './Settings.module.css';

type ToggleSwitchProps = {
  checked: boolean;
  disabled?: boolean;
  loading?: boolean;
  ariaLabel: string;
  onClick: () => void;
};

type SettingRowProps = {
  icon: ReactNode;
  title: string;
  description?: string;
  checked: boolean;
  disabled?: boolean;
  loading?: boolean;
  iconTone?: 'gray' | 'green' | 'blue';
  showDivider?: boolean;
  onToggle: () => void;
};

type SettingsState = GetSettingsResponse;

type SavingKey = 'theme' | 'pushEnabled' | 'servicePushEnabled' | 'marketingPushEnabled' | null;

const DEFAULT_SETTINGS: SettingsState = {
  theme: 'LIGHT',
  pushEnabled: true,
  servicePushEnabled: true,
  marketingPushEnabled: false,
};

function ToggleSwitch({
  checked,
  disabled = false,
  loading = false,
  ariaLabel,
  onClick,
}: ToggleSwitchProps) {
  return (
    <button
      type="button"
      className={`${styles.toggle} ${checked ? styles.toggleOn : styles.toggleOff}`}
      aria-label={ariaLabel}
      aria-pressed={checked}
      disabled={disabled}
      onClick={onClick}
    >
      {loading ? (
        <span className={styles.toggleSpinner}>
          <LoaderCircle size={14} strokeWidth={2.4} className={styles.spinnerIcon} />
        </span>
      ) : null}
      <span className={`${styles.toggleThumb} ${checked ? styles.toggleThumbOn : ''}`} />
    </button>
  );
}

function SettingRow({
  icon,
  title,
  description,
  checked,
  disabled = false,
  loading = false,
  iconTone = 'gray',
  showDivider = false,
  onToggle,
}: SettingRowProps) {
  const iconToneClass =
    iconTone === 'green'
      ? styles.iconToneGreen
      : iconTone === 'blue'
        ? styles.iconToneBlue
        : styles.iconToneGray;

  return (
    <div className={`${styles.row} ${disabled ? styles.rowDisabled : ''}`}>
      {showDivider ? <div className={styles.rowDivider} /> : null}

      <div className={styles.rowLeft}>
        <div className={`${styles.iconBadge} ${iconToneClass}`}>{icon}</div>

        <div className={styles.textWrap}>
          <p className={styles.rowTitle}>{title}</p>
          {description ? <p className={styles.rowDescription}>{description}</p> : null}
        </div>
      </div>

      <ToggleSwitch
        checked={checked}
        disabled={disabled}
        loading={loading}
        ariaLabel={`${title} ${checked ? '끄기' : '켜기'}`}
        onClick={onToggle}
      />
    </div>
  );
}

const requestBrowserNotificationPermission = async (): Promise<boolean> => {
  if (typeof window === 'undefined' || !("Notification" in window)) {
    return true;
  }

  if (Notification.permission === 'granted') {
    return true;
  }

  if (Notification.permission === 'denied') {
    window.alert('브라우저에서 알림 권한이 차단되어 있습니다. 브라우저 설정에서 알림 권한을 허용해 주세요.');
    return false;
  }

  const permission = await Notification.requestPermission();

  if (permission !== 'granted') {
    window.alert('푸시 알림을 사용하려면 브라우저 알림 권한을 허용해 주세요.');
    return false;
  }

  return true;
};

export default function Settings() {
  const navigate = useNavigate();

  const [menuOpen, setMenuOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [savingKey, setSavingKey] = useState<SavingKey>(null);
  const [errorMessage, setErrorMessage] = useState('');
  const [settings, setSettings] = useState<SettingsState>(DEFAULT_SETTINGS);

  const moveToLogin = useCallback(() => {
    clearAuthTokens();
    navigate('/login', { replace: true });
  }, [navigate]);

  useEffect(() => {
    let cancelled = false;

    const loadSettings = async () => {
      try {
        setLoading(true);
        setErrorMessage('');

        const response = await fetchMySettings();
        if (cancelled) {
          return;
        }

        setSettings(response);
        saveAndApplyThemeMode(response.theme);
      } catch (error) {
        const message = error instanceof Error ? error.message : '설정 정보를 불러오지 못했습니다.';

        if (isAuthError(message)) {
          moveToLogin();
          return;
        }

        if (!cancelled) {
          setErrorMessage(message);
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    };

    void loadSettings();

    return () => {
      cancelled = true;
    };
  }, [moveToLogin]);

  const patchSettings = useCallback(
    async (partial: UpdateSettingsRequest, nextSavingKey: Exclude<SavingKey, null>) => {
      const previousSettings = settings;
      const optimisticSettings: SettingsState = {
        ...previousSettings,
        ...partial,
      };

      setSavingKey(nextSavingKey);
      setErrorMessage('');
      setSettings(optimisticSettings);

      if (partial.theme) {
        saveAndApplyThemeMode(partial.theme);
      }

      try {
        const updated = await updateMySettings(partial);
        setSettings(updated);
        saveAndApplyThemeMode(updated.theme);
      } catch (error) {
        setSettings(previousSettings);
        saveAndApplyThemeMode(previousSettings.theme);

        const message = error instanceof Error ? error.message : '설정 저장에 실패했습니다.';

        if (isAuthError(message)) {
          moveToLogin();
          return;
        }

        setErrorMessage(message);
        window.alert(message);
      } finally {
        setSavingKey((current) => (current === nextSavingKey ? null : current));
      }
    },
    [moveToLogin, settings],
  );

  const handleToggleTheme = async () => {
    if (loading || savingKey) {
      return;
    }

    const nextTheme: ThemeMode = settings.theme === 'DARK' ? 'LIGHT' : 'DARK';
    await patchSettings({ theme: nextTheme }, 'theme');
  };

  const handleTogglePush = async () => {
    if (loading || savingKey) {
      return;
    }

    const nextValue = !settings.pushEnabled;

    if (nextValue) {
      const granted = await requestBrowserNotificationPermission();
      if (!granted) {
        return;
      }
    }

    await patchSettings({ pushEnabled: nextValue }, 'pushEnabled');
  };

  const handleToggleServicePush = async () => {
    if (loading || savingKey || !settings.pushEnabled) {
      return;
    }

    await patchSettings(
      { servicePushEnabled: !settings.servicePushEnabled },
      'servicePushEnabled',
    );
  };

  const handleToggleMarketingPush = async () => {
    if (loading || savingKey || !settings.pushEnabled) {
      return;
    }

    await patchSettings(
      { marketingPushEnabled: !settings.marketingPushEnabled },
      'marketingPushEnabled',
    );
  };

  const isDetailDisabled = loading || !!savingKey || !settings.pushEnabled;
  const isAnySaving = Boolean(savingKey);

  return (
    <>
      <div className={styles.container}>
        <header className={styles.header}>
          <div className={styles.headerInner}>
            <button
              type="button"
              className={styles.headerIconButton}
              onClick={() => navigate(-1)}
              aria-label="뒤로가기"
            >
              <ChevronLeft size={23} strokeWidth={2.2} />
            </button>

            <h1 className={styles.title}>설정</h1>

            <button
              type="button"
              className={styles.menuButton}
              onClick={() => setMenuOpen(true)}
              aria-label="사이드 메뉴 열기"
            >
              <Menu size={25} strokeWidth={2.2} />
            </button>
          </div>
        </header>

        <main className={styles.contentArea}>
          <section className={styles.sectionBlock}>
            <h2 className={styles.sectionTitle}>테마</h2>

            <div className={styles.card}>
              <SettingRow
                icon={<MoonStar size={19} strokeWidth={2.1} />}
                title="다크모드"
                checked={settings.theme === 'DARK'}
                disabled={loading || isAnySaving}
                loading={savingKey === 'theme'}
                onToggle={handleToggleTheme}
              />
            </div>
          </section>

          <section className={styles.sectionBlock}>
            <h2 className={styles.sectionTitle}>알림</h2>

            <div className={styles.card}>
              <SettingRow
                icon={<Bell size={19} strokeWidth={2.1} />}
                title="푸시 알림"
                description="앱의 모든 알림"
                checked={settings.pushEnabled}
                disabled={loading || isAnySaving}
                loading={savingKey === 'pushEnabled'}
                onToggle={handleTogglePush}
              />
            </div>
          </section>

          <section className={styles.sectionBlock}>
            <h2 className={styles.sectionTitle}>상세 알림</h2>

            <div className={styles.card}>
              <SettingRow
                icon={<ShieldCheck size={19} strokeWidth={2.1} />}
                title="서비스 알림"
                description="평가완료, Top 10 달성, 신고 접수 결과"
                checked={settings.servicePushEnabled}
                disabled={isDetailDisabled}
                loading={savingKey === 'servicePushEnabled'}
                iconTone="green"
                onToggle={handleToggleServicePush}
              />

              <SettingRow
                icon={<Megaphone size={19} strokeWidth={2.1} />}
                title="마케팅 / 광고 알림"
                description="이벤트, 프로모션, 광고성 메시지"
                checked={settings.marketingPushEnabled}
                disabled={isDetailDisabled}
                loading={savingKey === 'marketingPushEnabled'}
                iconTone="blue"
                showDivider
                onToggle={handleToggleMarketingPush}
              />
            </div>
          </section>

          <section className={styles.infoSection}>
            <div className={`${styles.infoCard} ${errorMessage ? styles.infoCardError : ''}`}>
              <div className={styles.infoIconWrap}>
                <CircleAlert size={15} strokeWidth={2} />
              </div>

              <p className={styles.infoText}>
                {errorMessage ? (
                  errorMessage
                ) : (
                  <>
                    푸시 알림을 끄면 모든 알림이 꺼집니다.
                    <br />
                    개별 알림 설정은 푸시 알림이 켜져 있을 때 적용됩니다.
                  </>
                )}
              </p>
            </div>
          </section>

          <div className={styles.bottomSpacer} aria-hidden="true" />
        </main>
      </div>

      <SideMenu isOpen={menuOpen} onClose={() => setMenuOpen(false)} />
    </>
  );
}
