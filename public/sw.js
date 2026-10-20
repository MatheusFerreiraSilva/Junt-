const CACHE_NAME = 'junto-pwa-v2';
const ASSETS_TO_CACHE = [
  '/',
  '/favicon.svg',
  '/manifest.webmanifest'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(ASSETS_TO_CACHE);
    })
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))
      );
    })
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  // Only cache GET requests
  if (event.request.method !== 'GET') return;

  // Ignore API requests
  if (event.request.url.includes('/api/')) return;

  event.respondWith(
    caches.match(event.request).then((cachedResponse) => {
      if (cachedResponse) {
        return cachedResponse;
      }
      return fetch(event.request).catch(() => {
        // Offline fallback
        return caches.match('/');
      });
    })
  );
});

// Push notification listener (FCM & Web Push)
self.addEventListener('push', (event) => {
  let data = {
    title: 'JUNTÔ 🕊️',
    body: 'O Pulso da Semana está pronto para você e seu par.',
    type: 'weekly_pulse',
    url: '/',
  };

  if (event.data) {
    try {
      data = event.data.json();
    } catch {
      data = {
        title: 'JUNTÔ 🕊️',
        body: event.data.text(),
        type: 'weekly_pulse',
        url: '/',
      };
    }
  }

  const options = {
    body: data.body,
    icon: '/favicon.svg',
    badge: '/favicon.svg',
    vibrate: [150, 75, 150],
    tag: data.tag || `junto-${data.type || 'alert'}`,
    renotify: true,
    data: {
      dateOfArrival: Date.now(),
      url: data.url || '/',
      type: data.type || 'weekly_pulse',
      logId: data.logId,
      dataPayload: data.dataPayload,
    },
    actions: data.actions || [
      { action: 'open_pulse', title: 'Ver Semana' },
      { action: 'close', title: 'Dispensar' }
    ],
  };

  event.waitUntil(
    self.registration.showNotification(data.title, options)
  );
});

// Notification click event handler
self.addEventListener('notificationclick', (event) => {
  event.notification.close();

  if (event.action === 'close') {
    return;
  }

  const notificationData = event.notification.data || {};
  const targetUrl = notificationData.url || '/';

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      for (const client of clientList) {
        if ('focus' in client) {
          client.focus();
          client.postMessage({
            type: 'NOTIFICATION_OPENED',
            data: notificationData,
          });
          return;
        }
      }
      if (clients.openWindow) {
        return clients.openWindow(targetUrl);
      }
    })
  );
});
