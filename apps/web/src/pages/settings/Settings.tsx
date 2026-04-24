import { useEffect, useMemo, useState, type ReactNode } from 'react';
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
import type { ThemeMode } from '@codinator/contracts';
import { useNavigate } from 'react-router-dom';
import styles from './Settings.module.css';
import { fetchMySettings, updateMySettings } from '../../lib/api';
import SideMenu from '../../components/SideMenu';
import {
  ensurePushServiceWorkerRegistration,
  previewForegroundPush,
  requestBrowserNotificationPermission,
} from '../../lib/pushNotifications';
import { applyThemeMode } from '../../lib/theme';

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
      {loading ? (
        <span className={styles.toggleSpinnerWrap} aria-hidden="true">
          <LoaderCircle size={14} className={styles.toggleSpinner} />
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

const getErrorMessage = (error: unknown): string => {
  if (error instanceof Error && error.message.trim()) {
    return error.message;
  }

  return '설정을 저장하지 못했어요. 잠시 후 다시 시도해주세요.';
};

export default function Settings() {
  const navigate = useNavigate();

  const [theme, setTheme] = useState<ThemeMode>('LIGHT');
  const [isPushEnabled, setIsPushEnabled] = useState(true);
  const [isServiceEnabled, setIsServiceEnabled] = useState(true);
  const [isMarketingEnabled, setIsMarketingEnabled] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [savingKey, setSavingKey] = useState<'theme' | 'push' | 'service' | 'marketing' | null>(
    null,
  );
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [statusTone, setStatusTone] = useState<'neutral' | 'error'>('neutral');

  const [isSideMenuOpen, setIsSideMenuOpen] = useState(false);

  const isDarkMode = theme === 'DARK';
  const isDetailDisabled = !isPushEnabled;

  useEffect(() => {
    let isMounted = true;

    const load = async () => {
      try {
        const settings = await fetchMySettings();
        if (!isMounted) {
          return;
        }

        setTheme(settings.theme);
        setIsPushEnabled(settings.pushEnabled);
        setIsServiceEnabled(settings.servicePushEnabled);
        setIsMarketingEnabled(settings.marketingPushEnabled);
        applyThemeMode(settings.theme);
      } catch (error) {
        if (!isMounted) {
          return;
        }

        setStatusTone('error');
        setStatusMessage(getErrorMessage(error));
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    };

    void load();

    return () => {
      isMounted = false;
    };
  }, []);

  const statusClassName = useMemo(() => {
    return statusTone === 'error' ? styles.statusError : styles.statusNeutral;
  }, [statusTone]);

  const isDevPreviewEnabled = import.meta.env.DEV;

  const commitTheme = async (nextTheme: ThemeMode) => {
    const prevTheme = theme;

    setSavingKey('theme');
    setStatusMessage(null);
    setTheme(nextTheme);
    applyThemeMode(nextTheme);

    try {
      const updated = await updateMySettings({ theme: nextTheme });
      setTheme(updated.theme);
      applyThemeMode(updated.theme);
      setStatusTone('neutral');
      setStatusMessage('테마 설정이 저장되었어요.');
    } catch (error) {
      setTheme(prevTheme);
      applyThemeMode(prevTheme);
      setStatusTone('error');
      setStatusMessage(getErrorMessage(error));
    } finally {
      setSavingKey(null);
    }
  };

  const commitPushEnabled = async (nextValue: boolean) => {
    const prevPush = isPushEnabled;
    const prevService = isServiceEnabled;
    const prevMarketing = isMarketingEnabled;

    if (nextValue) {
      const permission = await requestBrowserNotificationPermission();

      if (permission !== 'granted') {
        setStatusTone('error');
        setStatusMessage('브라우저 알림 권한이 허용되어야 푸시 알림을 켤 수 있어요.');
        return;
      }

      await ensurePushServiceWorkerRegistration();
    }

    setSavingKey('push');
    setStatusMessage(null);
    setIsPushEnabled(nextValue);

    if (!nextValue) {
      setIsServiceEnabled(false);
      setIsMarketingEnabled(false);
    }

    try {
      const updated = await updateMySettings({
        pushEnabled: nextValue,
        servicePushEnabled: nextValue ? prevService : false,
        marketingPushEnabled: nextValue ? prevMarketing : false,
      });

      setIsPushEnabled(updated.pushEnabled);
      setIsServiceEnabled(updated.servicePushEnabled);
      setIsMarketingEnabled(updated.marketingPushEnabled);
      setStatusTone('neutral');
      setStatusMessage('푸시 알림 설정이 저장되었어요.');
    } catch (error) {
      setIsPushEnabled(prevPush);
      setIsServiceEnabled(prevService);
      setIsMarketingEnabled(prevMarketing);
      setStatusTone('error');
      setStatusMessage(getErrorMessage(error));
    } finally {
      setSavingKey(null);
    }
  };

  const commitServiceEnabled = async (nextValue: boolean) => {
    const prevValue = isServiceEnabled;

    setSavingKey('service');
    setStatusMessage(null);
    setIsServiceEnabled(nextValue);

    try {
      const updated = await updateMySettings({ servicePushEnabled: nextValue });
      setIsServiceEnabled(updated.servicePushEnabled);
      setStatusTone('neutral');
      setStatusMessage('서비스 알림 설정이 저장되었어요.');
    } catch (error) {
      setIsServiceEnabled(prevValue);
      setStatusTone('error');
      setStatusMessage(getErrorMessage(error));
    } finally {
      setSavingKey(null);
    }
  };

  const commitMarketingEnabled = async (nextValue: boolean) => {
    const prevValue = isMarketingEnabled;

    setSavingKey('marketing');
    setStatusMessage(null);
    setIsMarketingEnabled(nextValue);

    try {
      const updated = await updateMySettings({ marketingPushEnabled: nextValue });
      setIsMarketingEnabled(updated.marketingPushEnabled);
      setStatusTone('neutral');
      setStatusMessage('마케팅 알림 설정이 저장되었어요.');
    } catch (error) {
      setIsMarketingEnabled(prevValue);
      setStatusTone('error');
      setStatusMessage(getErrorMessage(error));
    } finally {
      setSavingKey(null);
    }
  };

  return (
    <div className={styles.container}>
      <SideMenu isOpen={isSideMenuOpen} onClose={() => setIsSideMenuOpen(false)} />

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
            onClick={() => setIsSideMenuOpen(true)}
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
              checked={isDarkMode}
              loading={savingKey === 'theme' || isLoading}
              disabled={isLoading}
              onToggle={() => {
                if (savingKey) {
                  return;
                }
                void commitTheme(isDarkMode ? 'LIGHT' : 'DARK');
              }}
            />
          </div>
        </section>

        <section className={styles.sectionBlock}>
          <h2 className={styles.sectionTitle}>알림</h2>

          <div className={styles.card}>
            <SettingRow
              icon={<Bell size={19} strokeWidth={2.1} />}
              title="푸시 알림"
              description="평가 완료, Top 10 달성, 신고 접수 결과 등"
              checked={isPushEnabled}
              loading={savingKey === 'push' || isLoading}
              disabled={isLoading}
              onToggle={() => {
                if (savingKey) {
                  return;
                }
                void commitPushEnabled(!isPushEnabled);
              }}
            />
          </div>
        </section>

        <section className={styles.sectionBlock}>
          <h2 className={styles.sectionTitle}>상세 알림</h2>

          <div className={styles.card}>
            <SettingRow
              icon={<ShieldCheck size={19} strokeWidth={2.1} />}
              title="서비스 알림"
              description="평가 완료, Top 10 달성, 신고 접수 결과"
              checked={isServiceEnabled}
              disabled={isDetailDisabled || isLoading}
              loading={savingKey === 'service'}
              iconTone="green"
              onToggle={() => {
                if (savingKey || isDetailDisabled) {
                  return;
                }
                void commitServiceEnabled(!isServiceEnabled);
              }}
            />

            <SettingRow
              icon={<Megaphone size={19} strokeWidth={2.1} />}
              title="마케팅 / 광고 알림"
              description="이벤트, 프로모션, 광고성 메시지"
              checked={isMarketingEnabled}
              disabled={isDetailDisabled || isLoading}
              loading={savingKey === 'marketing'}
              iconTone="blue"
              showDivider
              onToggle={() => {
                if (savingKey || isDetailDisabled) {
                  return;
                }
                void commitMarketingEnabled(!isMarketingEnabled);
              }}
            />
          </div>
        </section>

        <section className={styles.infoSection}>
          <div className={styles.infoCard}>
            <div className={styles.infoIconWrap}>
              <CircleAlert size={15} strokeWidth={2} />
            </div>

            <p className={styles.infoText}>
              앱이 열려 있으면 상단 배너로 먼저 보여주고,
              <br />
              앱이 닫혀 있거나 백그라운드면 기기 푸시 알림으로 전달돼요.
            </p>
          </div>

          {statusMessage ? (
            <p className={`${styles.statusText} ${statusClassName}`}>{statusMessage}</p>
          ) : null}

          {isDevPreviewEnabled ? (
            <button
              type="button"
              className={styles.previewButton}
              onClick={() => {
                previewForegroundPush({
                  category: 'SERVICE',
                  title: '평가가 완료되었어요',
                  body: '내 게시글의 평가가 종료되었어요. 결과를 바로 확인해보세요.',
                  targetPath: '/myFeed',
                  actionLabel: '결과 보기',
                });
              }}
            >
              알림 미리보기
            </button>
          ) : null}
        </section>

        <div className={styles.bottomSpacer} aria-hidden="true" />
      </main>
    </div>
  );
}
