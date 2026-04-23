import { useState } from 'react';
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
import styles from './Settings.module.css';

type ToggleSwitchProps = {
  checked: boolean;
  disabled?: boolean;
  ariaLabel: string;
  onClick: () => void;
};

type SettingRowProps = {
  icon: React.ReactNode;
  title: string;
  description?: string;
  checked: boolean;
  disabled?: boolean;
  iconTone?: 'gray' | 'green' | 'blue';
  showDivider?: boolean;
  onToggle: () => void;
};

function ToggleSwitch({ checked, disabled = false, ariaLabel, onClick }: ToggleSwitchProps) {
  return (
    <button
      type="button"
      className={`${styles.toggle} ${checked ? styles.toggleOn : styles.toggleOff}`}
      aria-label={ariaLabel}
      aria-pressed={checked}
      disabled={disabled}
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
        ariaLabel={`${title} ${checked ? '끄기' : '켜기'}`}
        onClick={onToggle}
      />
    </div>
  );
}

export default function Settings() {
  const navigate = useNavigate();

  const [isDarkMode, setIsDarkMode] = useState(false);
  const [isPushEnabled, setIsPushEnabled] = useState(true);
  const [isServiceEnabled, setIsServiceEnabled] = useState(true);
  const [isMarketingEnabled, setIsMarketingEnabled] = useState(true);

  const isDetailDisabled = !isPushEnabled;

  return (
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

          <button type="button" className={styles.menuButton} aria-label="사이드 메뉴 열기">
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
              onToggle={() => setIsDarkMode((prev) => !prev)}
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
              checked={isPushEnabled}
              onToggle={() => setIsPushEnabled((prev) => !prev)}
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
              checked={isServiceEnabled}
              disabled={isDetailDisabled}
              iconTone="green"
              onToggle={() => setIsServiceEnabled((prev) => !prev)}
            />

            <SettingRow
              icon={<Megaphone size={19} strokeWidth={2.1} />}
              title="마케팅 / 광고 알림"
              description="이벤트, 프로모션, 광고성 메시지"
              checked={isMarketingEnabled}
              disabled={isDetailDisabled}
              iconTone="blue"
              showDivider
              onToggle={() => setIsMarketingEnabled((prev) => !prev)}
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
  );
}
