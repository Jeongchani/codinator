import { useEffect, useMemo, useState } from 'react';
import type { ThemeMode, UpdateSettingsRequest } from '@codinator/contracts';
import {
  Bell,
  ChevronLeft,
  CircleAlert,
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
import { applyThemeMode, getStoredThemeMode, saveThemeMode } from '../../lib/theme';
import styles from './Settings.module.css';

type SettingsState = {
  theme: ThemeMode;
  pushEnabled: boolean;
  servicePushEnabled: boolean;
  marketingPushEnabled: boolean;
};

type ToggleSwitchProps = {
  checked: boolean;
  disabled?: boolean;
  loading?: boolean;
  ariaLabel: string;
  onClick: () => void;
};

type SettingRowProps = {
  icon: React.ReactNode;
  title: string;
  description?: string;
  checked: boolean;
  disabled?: boolean;
  loading?: boolean;
  iconTone?: 'gray' | 'green' | 'blue';
  showDivider?: boolean;
  onToggle: () => void;
};

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
      disabled={disabled || loading}
      onClick={onClick}
    >
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

export default function Settings() {
  const navigate = useNavigate();

  const [menuOpen, setMenuOpen] = useState(false);
  const [settings, setSettings] = useState<SettingsState>({
    ...DEFAULT_SETTINGS,
    theme: getStoredThemeMode() ?? DEFAULT_SETTINGS.theme,
  });
  const [loading, setLoading] = useState(true);
  const [savingKeys, setSavingKeys] = useState<string[]>([]);

  const isDetailDisabled = !settings.pushEnabled;

  useEffect(() => {
    let cancelled = false;

    const loadSettings = async () => {
      try {
        setLoading(true);
        const response = await fetchMySettings();

        if (cancelled) return;
        setSettings(response);
        saveThemeMode(response.theme);
        applyThemeMode(response.theme);
      } catch (error) {
        const message = error instanceof Error ? error.message : '설정을 불러오지 못했습니다.';
        if (isAuthError(message)) {
          clearAuthTokens();
          navigate('/login', { replace: true });
          return;
        }

        console.warn(message);
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
  }, [navigate]);

  const savingMap = useMemo(() => new Set(savingKeys), [savingKeys]);

  const requestNotificationPermission = async () => {
    if (typeof window === 'undefined' || !('Notification' in window)) return;
    if (Notification.permission === 'default') {
      try {
        await Notification.requestPermission();
      } catch (error) {
        console.warn('알림 권한 요청 실패:', error);
      }
    }
  };

  const patchSettings = async (partial: UpdateSettingsRequest, savingKey: string) => {
    const previous = settings;
    const optimistic = { ...settings, ...partial };
    setSettings(optimistic);

    if (partial.theme) {
      saveThemeMode(partial.theme);
      applyThemeMode(partial.theme);
    }

    setSavingKeys((prev) => [...prev, savingKey]);

    try {
      const updated = await updateMySettings(partial);
      setSettings(updated);
      saveThemeMode(updated.theme);
      applyThemeMode(updated.theme);
    } catch (error) {
      const message = error instanceof Error ? error.message : '설정 저장에 실패했습니다.';
      setSettings(previous);
      saveThemeMode(previous.theme);
      applyThemeMode(previous.theme);

      if (isAuthError(message)) {
        clearAuthTokens();
        navigate('/login', { replace: true });
        return;
      }

      window.alert(message);
    } finally {
      setSavingKeys((prev) => prev.filter((key) => key !== savingKey));
    }
  };

  const handleThemeToggle = () => {
    const nextTheme: ThemeMode = settings.theme === 'DARK' ? 'LIGHT' : 'DARK';
    void patchSettings({ theme: nextTheme }, 'theme');
  };

  const handlePushToggle = async () => {
    const nextPushEnabled = !settings.pushEnabled;
    if (nextPushEnabled) {
      await requestNotificationPermission();
    }
    void patchSettings({ pushEnabled: nextPushEnabled }, 'pushEnabled');
  };

  const handleServiceToggle = () => {
    if (isDetailDisabled) return;
    void patchSettings(
      { servicePushEnabled: !settings.servicePushEnabled },
      'servicePushEnabled',
    );
  };

  const handleMarketingToggle = () => {
    if (isDetailDisabled) return;
    void patchSettings(
      { marketingPushEnabled: !settings.marketingPushEnabled },
      'marketingPushEnabled',
    );
  };

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
              aria-label="사이드 메뉴 열기"
              onClick={() => setMenuOpen(true)}
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
                loading={loading || savingMap.has('theme')}
                onToggle={handleThemeToggle}
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
                loading={loading || savingMap.has('pushEnabled')}
                onToggle={handlePushToggle}
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
                loading={loading || savingMap.has('servicePushEnabled')}
                iconTone="green"
                onToggle={handleServiceToggle}
              />

              <SettingRow
                icon={<Megaphone size={19} strokeWidth={2.1} />}
                title="마케팅 / 광고 알림"
                description="이벤트, 프로모션, 광고성 메시지"
                checked={settings.marketingPushEnabled}
                disabled={isDetailDisabled}
                loading={loading || savingMap.has('marketingPushEnabled')}
                iconTone="blue"
                showDivider
                onToggle={handleMarketingToggle}
              />
            </div>
          </section>

          <section className={styles.infoSection}>
            <div className={styles.infoCard}>
              <div className={styles.infoIconWrap}>
                <CircleAlert size={15} strokeWidth={2} />
              </div>

              <p className={styles.infoText}>
                푸시 알림을 끄면 모든 알림이 꺼집니다.
                <br />
                개별 알림 설정은 푸시 알림이 켜져 있을 때 적용됩니다.
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
