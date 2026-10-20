/* JUNTÔ — push notification handlers.
 * Imported by the Workbox-generated service worker at /sw.js.
 * Keeping these handlers in a separate file lets vite-plugin-pwa own
 * precaching/offline logic without losing Web Push support.
 */

self.addEventListener('push', (event) => {
  let data = {
    title: 'JUNTÔ 🕊️',
    body: 'O Pulso da Semana está pronto para você e seu par.',
    type: 'weekly_pulse',
    url: '/',
  };

  if (event.data) {
    try {
      data = { ...data, ...event.data.json() };
    } catch {
      data = { ...data, body: event.data.text() };
    }
  }

  event.waitUntil(
    self.registration.showNotification(data.title, {
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
        { action: 'close', title: 'Dispensar' },
      ],
    })
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();

  if (event.action === 'close') return;

  const notificationData = event.notification.data || {};
  const targetUrl = notificationData.url || '/';

  event.waitUntil(
    self.clients
      .matchAll({ type: 'window', includeUncontrolled: true })
      .then((clientList) => {
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
        if (self.clients.openWindow) {
          return self.clients.openWindow(targetUrl);
        }
      })
  );
});
