import { useEffect, useMemo, useState, type KeyboardEvent, type MouseEvent } from 'react';
import { ArrowRight, Bell, Megaphone, ShieldCheck, X } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import styles from './ForegroundPushCenter.module.css';
import {
  bindForegroundPushBridge,
  emitForegroundPush,
  ensurePushServiceWorkerRegistration,
  type ForegroundPushPayload,
  subscribeForegroundPush,
} from '../../lib/pushNotifications';

type NotificationVisual = {
  badgeLabel: string;
  Icon: typeof Bell;
  iconClassName: string;
};

const AUTO_DISMISS_MS = 4500;

const buildVisual = (payload: ForegroundPushPayload): NotificationVisual => {
  if (payload.category === 'MARKETING') {
    return {
      badgeLabel: '마케팅 알림',
      Icon: Megaphone,
      iconClassName: styles.iconMarketing,
    };
  }

  if (payload.category === 'SYSTEM') {
    return {
      badgeLabel: '시스템 알림',
      Icon: Bell,
      iconClassName: styles.iconSystem,
    };
  }

  return {
    badgeLabel: '서비스 알림',
    Icon: ShieldCheck,
    iconClassName: styles.iconService,
  };
};

const formatRelativeTime = (sentAt?: string): string => {
  if (!sentAt) {
    return '방금';
  }

  const sentTime = new Date(sentAt).getTime();
  if (Number.isNaN(sentTime)) {
    return '방금';
  }

  const diffMs = Date.now() - sentTime;
  const diffMinutes = Math.max(0, Math.floor(diffMs / 60000));

  if (diffMinutes < 1) {
    return '방금';
  }

  if (diffMinutes < 60) {
    return `${diffMinutes}분 전`;
  }

  const diffHours = Math.floor(diffMinutes / 60);
  if (diffHours < 24) {
    return `${diffHours}시간 전`;
  }

  return '며칠 전';
};

export default function ForegroundPushCenter() {
  const navigate = useNavigate();
  const [queue, setQueue] = useState<ForegroundPushPayload[]>([]);
  const [active, setActive] = useState<ForegroundPushPayload | null>(null);

  useEffect(() => {
    void ensurePushServiceWorkerRegistration();
    const detachWorkerBridge = bindForegroundPushBridge();
    const unsubscribe = subscribeForegroundPush((payload) => {
      setQueue((prev) => [...prev, payload]);
    });

    if (import.meta.env.DEV && typeof window !== 'undefined') {
      (window as Window & { __codinatorPreviewPush?: () => void }).__codinatorPreviewPush = () => {
        emitForegroundPush({
          category: 'SERVICE',
          title: '평가가 완료되었어요',
          body: '내 게시글의 평가가 종료되었어요. 결과를 바로 확인해보세요.',
          targetPath: '/myFeed',
          actionLabel: '결과 보기',
          sentAt: new Date().toISOString(),
        });
      };
    }

    return () => {
      detachWorkerBridge();
      unsubscribe();
    };
  }, []);

  useEffect(() => {
    if (active || queue.length === 0) {
      return;
    }

    const next = queue[0];
    setActive(next);
    setQueue((prev) => prev.slice(1));
  }, [active, queue]);

  useEffect(() => {
    if (!active) {
      return;
    }

    const timeoutId = window.setTimeout(() => {
      setActive(null);
    }, AUTO_DISMISS_MS);

    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [active]);

  const visual = useMemo(() => {
    return active ? buildVisual(active) : null;
  }, [active]);

  if (!active || !visual) {
    return null;
  }

  const { Icon, badgeLabel, iconClassName } = visual;

  const handleClose = (event: MouseEvent<HTMLButtonElement>) => {
    event.stopPropagation();
    setActive(null);
  };

  const handleOpen = () => {
    if (active.targetPath) {
      navigate(active.targetPath);
    }
    setActive(null);
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      handleOpen();
    }
  };

  return (
    <div className={styles.viewport} aria-live="polite" aria-atomic="true">
      <div className={styles.card} role="button" tabIndex={0} onClick={handleOpen} onKeyDown={handleKeyDown}>
        <div className={styles.inner}>
          <div className={styles.iconWrap}>
            <Icon size={20} className={iconClassName} />
          </div>

          <div className={styles.content}>
            <div className={styles.topRow}>
              <span className={styles.badge}>{badgeLabel}</span>
              <span className={styles.time}>{formatRelativeTime(active.sentAt)}</span>
            </div>

            <p className={styles.title}>{active.title}</p>
            <p className={styles.body}>{active.body}</p>

            <div className={styles.footerRow}>
              <span className={styles.action}>
                {active.actionLabel ?? '확인하기'}
                <ArrowRight size={13} />
              </span>
            </div>
          </div>

          <button type="button" className={styles.closeButton} onClick={handleClose} aria-label="알림 닫기">
            <X size={15} />
          </button>
        </div>

        <div className={styles.progressTrack} aria-hidden="true">
          <div key={active.id ?? active.sentAt ?? active.title} className={styles.progressBar} />
        </div>
      </div>
    </div>
  );
}
