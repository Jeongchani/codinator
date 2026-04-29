/* eslint-env serviceworker */
/* global self, URL */

const DEFAULT_TITLE = 'Codinator';
const DEFAULT_BODY = '새 알림이 도착했어요.';
const DEFAULT_TARGET_PATH = '/settings';
const FOREGROUND_PUSH_MESSAGE_TYPE = 'CODINATOR_FOREGROUND_PUSH';

const isPlainObject = (value) =>
  value !== null && typeof value === 'object' && !Array.isArray(value);

const normalizePayload = (payload) => {
  if (!isPlainObject(payload)) {
    return {
      title: DEFAULT_TITLE,
      body: DEFAULT_BODY,
      url: DEFAULT_TARGET_PATH,
    };
  }

  return {
    title: typeof payload.title === 'string' && payload.title.trim() ? payload.title : DEFAULT_TITLE,
    body: typeof payload.body === 'string' && payload.body.trim() ? payload.body : DEFAULT_BODY,
    url: typeof payload.url === 'string' && payload.url.trim() ? payload.url : DEFAULT_TARGET_PATH,
    category:
      typeof payload.category === 'string' && payload.category.trim()
        ? payload.category
        : undefined,
    postId:
      typeof payload.postId === 'number' || typeof payload.postId === 'string'
        ? payload.postId
        : undefined,
  };
};

const readPushPayload = async (event) => {
  if (!event.data) {
    return normalizePayload({});
  }

  try {
    return normalizePayload(event.data.json());
  } catch {
    try {
      return normalizePayload({ body: event.data.text() });
    } catch {
      return normalizePayload({});
    }
  }
};

const buildAbsoluteUrl = (path) => {
  try {
    return new URL(path || DEFAULT_TARGET_PATH, self.location.origin).href;
  } catch {
    return new URL(DEFAULT_TARGET_PATH, self.location.origin).href;
  }
};

const postForegroundPayload = async (payload) => {
  const windowClients = await self.clients.matchAll({
    type: 'window',
    includeUncontrolled: true,
  });

  windowClients.forEach((client) => {
    client.postMessage({
      type: FOREGROUND_PUSH_MESSAGE_TYPE,
      payload,
    });
  });

  return windowClients;
};

self.addEventListener('install', () => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener('push', (event) => {
  event.waitUntil(
    (async () => {
      const payload = await readPushPayload(event);
      const windowClients = await postForegroundPayload(payload);

      if (windowClients.length > 0) {
        return;
      }

      await self.registration.showNotification(payload.title, {
        body: payload.body,
        icon: '/icons/icon-192.png',
        badge: '/icons/icon-192.png',
        data: {
          url: buildAbsoluteUrl(payload.url),
          category: payload.category,
          postId: payload.postId,
        },
      });
    })(),
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();

  const targetUrl = buildAbsoluteUrl(event.notification.data?.url);

  event.waitUntil(
    (async () => {
      const windowClients = await self.clients.matchAll({
        type: 'window',
        includeUncontrolled: true,
      });

      for (const client of windowClients) {
        if ('focus' in client) {
          await client.focus();

          if ('navigate' in client) {
            try {
              await client.navigate(targetUrl);
            } catch {
              // Some browsers do not allow navigate from service workers.
            }
          }

          return;
        }
      }

      await self.clients.openWindow(targetUrl);
    })(),
  );
});
