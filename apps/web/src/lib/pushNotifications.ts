export const FOREGROUND_PUSH_EVENT = 'codinator:foreground-push';
export const FOREGROUND_PUSH_MESSAGE_TYPE = 'CODINATOR_FOREGROUND_PUSH';

export type ForegroundPushCategory = 'SERVICE' | 'MARKETING' | 'SYSTEM';

export type ForegroundPushPayload = {
  id?: string;
  category?: ForegroundPushCategory;
  title: string;
  body: string;
  targetPath?: string;
  actionLabel?: string;
  sentAt?: string;
};

const isRecord = (value: unknown): value is Record<string, unknown> => {
  return typeof value === 'object' && value !== null;
};

const extractString = (value: unknown, fallback = ''): string => {
  return typeof value === 'string' ? value : fallback;
};

const normalizeCategory = (value: unknown): ForegroundPushCategory => {
  if (value === 'MARKETING' || value === 'SYSTEM') {
    return value;
  }

  return 'SERVICE';
};

export const normalizeForegroundPushPayload = (input: unknown): ForegroundPushPayload | null => {
  if (!isRecord(input)) {
    return null;
  }

  const title = extractString(input.title);
  const body = extractString(input.body);

  if (!title.trim() || !body.trim()) {
    return null;
  }

  return {
    id: extractString(input.id) || `${Date.now()}`,
    category: normalizeCategory(input.category),
    title,
    body,
    targetPath: extractString(input.targetPath) || undefined,
    actionLabel: extractString(input.actionLabel) || '확인하기',
    sentAt: extractString(input.sentAt) || new Date().toISOString(),
  };
};

export const emitForegroundPush = (payload: ForegroundPushPayload): void => {
  if (typeof window === 'undefined') {
    return;
  }

  window.dispatchEvent(
    new CustomEvent<ForegroundPushPayload>(FOREGROUND_PUSH_EVENT, {
      detail: payload,
    }),
  );
};

export const previewForegroundPush = (payload?: Partial<ForegroundPushPayload>): void => {
  emitForegroundPush({
    id: payload?.id ?? `preview-${Date.now()}`,
    category: payload?.category ?? 'SERVICE',
    title: payload?.title ?? '평가가 완료되었어요',
    body: payload?.body ?? '내 게시글의 평가가 종료되었어요. 결과를 바로 확인해보세요.',
    targetPath: payload?.targetPath ?? '/myFeed',
    actionLabel: payload?.actionLabel ?? '결과 보기',
    sentAt: payload?.sentAt ?? new Date().toISOString(),
  });
};

export const subscribeForegroundPush = (
  listener: (payload: ForegroundPushPayload) => void,
): (() => void) => {
  if (typeof window === 'undefined') {
    return () => undefined;
  }

  const handler = (event: Event) => {
    const customEvent = event as CustomEvent<ForegroundPushPayload>;
    if (customEvent.detail) {
      listener(customEvent.detail);
    }
  };

  window.addEventListener(FOREGROUND_PUSH_EVENT, handler as EventListener);

  return () => {
    window.removeEventListener(FOREGROUND_PUSH_EVENT, handler as EventListener);
  };
};

export const isBrowserNotificationSupported = (): boolean => {
  return typeof window !== 'undefined' && 'Notification' in window;
};

export const requestBrowserNotificationPermission = async (): Promise<NotificationPermission> => {
  if (!isBrowserNotificationSupported()) {
    return 'denied';
  }

  if (Notification.permission === 'granted') {
    return 'granted';
  }

  return Notification.requestPermission();
};

const PUSH_SERVICE_WORKER_PATH = '/codinator-push-sw.js';
const PUSH_SERVICE_WORKER_SCOPE = '/';

export const ensurePushServiceWorkerRegistration = async (): Promise<ServiceWorkerRegistration | null> => {
  if (typeof navigator === 'undefined' || !('serviceWorker' in navigator)) {
    return null;
  }

  try {
    const existingRegistration = await navigator.serviceWorker.getRegistration(
      PUSH_SERVICE_WORKER_SCOPE,
    );

    if (existingRegistration) {
      return existingRegistration;
    }

    return await navigator.serviceWorker.register(PUSH_SERVICE_WORKER_PATH, {
      scope: PUSH_SERVICE_WORKER_SCOPE,
    });
  } catch (error) {
    console.warn('[push] service worker registration skipped', error);
    return null;
  }
};

export const bindForegroundPushBridge = (): (() => void) => {
  if (typeof navigator === 'undefined' || !('serviceWorker' in navigator)) {
    return () => undefined;
  }

  const handleMessage = (event: MessageEvent) => {
    const data = event.data;

    if (!isRecord(data) || data.type !== FOREGROUND_PUSH_MESSAGE_TYPE) {
      return;
    }

    const payload = normalizeForegroundPushPayload(data.payload);
    if (!payload) {
      return;
    }

    emitForegroundPush(payload);
  };

  navigator.serviceWorker.addEventListener('message', handleMessage);

  return () => {
    navigator.serviceWorker.removeEventListener('message', handleMessage);
  };
};
