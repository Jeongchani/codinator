import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent,
  type PointerEvent,
} from 'react';
import { Bell, Megaphone, ShieldCheck } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import styles from './ForegroundPushCenter.module.css';
import {
  bindForegroundPushBridge,
  emitForegroundPush,
  type ForegroundPushPayload,
  subscribeForegroundPush,
} from '../../lib/pushNotifications';

type NotificationVisual = {
  Icon: typeof Bell;
  iconClassName: string;
};

const AUTO_DISMISS_MS = 3500;
const EXIT_ANIMATION_MS = 280;
const CLOSE_DRAG_DISTANCE = 18;
const MAX_DRAG_UP_DISTANCE = 132;
const DRAG_START_THRESHOLD = 2;

const buildVisual = (payload: ForegroundPushPayload): NotificationVisual => {
  if (payload.category === 'MARKETING') {
    return {
      Icon: Megaphone,
      iconClassName: styles.iconMarketing,
    };
  }

  if (payload.category === 'SYSTEM') {
    return {
      Icon: Bell,
      iconClassName: styles.iconSystem,
    };
  }

  return {
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
  const [dragY, setDragY] = useState(0);
  const [isClosing, setIsClosing] = useState(false);
  const [isDragging, setIsDragging] = useState(false);

  const pointerStartYRef = useRef<number | null>(null);
  const dragYRef = useRef(0);
  const didDragRef = useRef(false);
  const dismissTimerRef = useRef<number | null>(null);
  const closeTimerRef = useRef<number | null>(null);

  const clearDismissTimer = useCallback(() => {
    if (dismissTimerRef.current !== null) {
      window.clearTimeout(dismissTimerRef.current);
      dismissTimerRef.current = null;
    }
  }, []);

  const clearCloseTimer = useCallback(() => {
    if (closeTimerRef.current !== null) {
      window.clearTimeout(closeTimerRef.current);
      closeTimerRef.current = null;
    }
  }, []);

  const resetGesture = useCallback(() => {
    dragYRef.current = 0;
    setDragY(0);
    setIsDragging(false);
    pointerStartYRef.current = null;
    didDragRef.current = false;
  }, []);

  const finishCloseNotification = useCallback(() => {
    clearDismissTimer();
    clearCloseTimer();
    setActive(null);
    setIsClosing(false);
    resetGesture();
  }, [clearCloseTimer, clearDismissTimer, resetGesture]);

  const closeNotification = useCallback(() => {
    if (!active || closeTimerRef.current !== null) {
      return;
    }

    clearDismissTimer();
    setIsDragging(false);
    pointerStartYRef.current = null;

    // 위로 드래그해서 닫을 때는 현재 끌어올린 위치를 유지한 상태에서
    // viewport의 닫힘 애니메이션만 이어서 실행한다.
    // 이 값을 0으로 되돌리면 손을 떼는 순간 알림이 아래를 한 번 찍고 올라가 보인다.
    setIsClosing(true);

    closeTimerRef.current = window.setTimeout(() => {
      closeTimerRef.current = null;
      finishCloseNotification();
    }, EXIT_ANIMATION_MS);
  }, [active, clearDismissTimer, finishCloseNotification]);

  useEffect(() => {
    // 현재 V3 코드에는 실제 Web Push/FCM 수신용 Service Worker 파일이 아직 없으므로
    // /codinator-push-sw.js 등록을 시도하지 않는다.
    // 앱이 켜져 있는 동안 사용하는 인앱 알림 미리보기/브릿지만 유지한다.
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
      clearDismissTimer();
      clearCloseTimer();
    };
  }, [clearCloseTimer, clearDismissTimer]);

  useEffect(() => {
    if (active || queue.length === 0) {
      return;
    }

    const next = queue[0];
    setActive(next);
    setQueue((prev) => prev.slice(1));
    setIsClosing(false);
    resetGesture();
  }, [active, queue, resetGesture]);

  useEffect(() => {
    if (!active || isClosing) {
      return;
    }

    clearDismissTimer();
    dismissTimerRef.current = window.setTimeout(() => {
      closeNotification();
    }, AUTO_DISMISS_MS);

    return () => {
      clearDismissTimer();
    };
  }, [active, clearDismissTimer, closeNotification, isClosing]);

  const visual = useMemo(() => {
    return active ? buildVisual(active) : null;
  }, [active]);

  if (!active || !visual) {
    return null;
  }

  const { Icon, iconClassName } = visual;

  const handleOpen = () => {
    if (active.targetPath) {
      navigate(active.targetPath);
    }

    closeNotification();
  };

  const handlePointerDown = (event: PointerEvent<HTMLDivElement>) => {
    if (isClosing) {
      return;
    }

    clearDismissTimer();
    pointerStartYRef.current = event.clientY;
    didDragRef.current = false;
    dragYRef.current = 0;
    setIsDragging(true);
    event.currentTarget.setPointerCapture(event.pointerId);
  };

  const handlePointerMove = (event: PointerEvent<HTMLDivElement>) => {
    if (isClosing) {
      return;
    }

    const startY = pointerStartYRef.current;
    if (startY === null) {
      return;
    }

    const diffY = event.clientY - startY;
    if (Math.abs(diffY) > DRAG_START_THRESHOLD) {
      didDragRef.current = true;
    }

    // 위로 살짝만 밀어도 손가락을 따라 바로 올라가도록 보정한다.
    // 아래 방향 이동은 알림을 닫는 동작이 아니므로 0으로 고정한다.
    const nextDragY = Math.min(0, Math.max(-MAX_DRAG_UP_DISTANCE, diffY * 1.18));
    dragYRef.current = nextDragY;
    setDragY(nextDragY);
  };

  const handlePointerUp = (event: PointerEvent<HTMLDivElement>) => {
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }

    pointerStartYRef.current = null;
    setIsDragging(false);

    if (dragYRef.current <= -CLOSE_DRAG_DISTANCE) {
      closeNotification();
      return;
    }

    dragYRef.current = 0;
    setDragY(0);

    if (!isClosing) {
      clearDismissTimer();
      dismissTimerRef.current = window.setTimeout(() => {
        closeNotification();
      }, AUTO_DISMISS_MS);
    }
  };

  const handlePointerCancel = (event: PointerEvent<HTMLDivElement>) => {
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }

    resetGesture();

    if (!isClosing) {
      clearDismissTimer();
      dismissTimerRef.current = window.setTimeout(() => {
        closeNotification();
      }, AUTO_DISMISS_MS);
    }
  };

  const handleClick = () => {
    if (didDragRef.current || isClosing) {
      didDragRef.current = false;
      return;
    }

    handleOpen();
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (isClosing) {
      return;
    }

    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      handleOpen();
    }
  };

  return (
    <div
      className={`${styles.viewport} ${isClosing ? styles.closing : ''}`}
      aria-live="polite"
      aria-atomic="true"
    >
      <div
        className={`${styles.card} ${isDragging ? styles.dragging : ''}`}
        role="button"
        tabIndex={0}
        style={dragY ? { transform: `translateY(${dragY}px)` } : undefined}
        onClick={handleClick}
        onKeyDown={handleKeyDown}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerCancel}
      >
        <div className={styles.inner}>
          <div className={styles.iconWrap}>
            <Icon size={17} className={iconClassName} />
          </div>

          <div className={styles.content}>
            <div className={styles.titleRow}>
              <p className={styles.title}>{active.title}</p>
              <span className={styles.time}>{formatRelativeTime(active.sentAt)}</span>
            </div>
            <p className={styles.body}>{active.body}</p>
          </div>
        </div>
      </div>
    </div>
  );
}
