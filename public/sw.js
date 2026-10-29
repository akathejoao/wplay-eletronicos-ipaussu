const CACHE_NAME = 'wplay-app-v3';
const OFFLINE_URL = '/offline.html';

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => cache.addAll([OFFLINE_URL, '/icon-192.png', '/icons/icon-192.png']))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter((key) => key.startsWith('wplay-app-') && key !== CACHE_NAME)
            .map((key) => caches.delete(key))
        )
      )
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);
  // Never cache authentication, admin pages, API responses or catalog prices.
  if (
    event.request.method !== 'GET' ||
    url.origin !== self.location.origin ||
    url.pathname.startsWith('/api/') ||
    url.pathname.startsWith('/admin') ||
    event.request.mode !== 'navigate'
  ) {
    return;
  }

  event.respondWith(
    fetch(event.request).catch(async () => {
      const cached = await caches.match(OFFLINE_URL);
      return (
        cached ||
        new Response('Sem conexão. Conecte-se à internet e tente novamente.', {
          status: 503,
          headers: { 'Content-Type': 'text/plain; charset=utf-8' },
        })
      );
    })
  );
});

/* ==========================================================================
   WEB PUSH NOTIFICATIONS: NATIVE ANDROID/IOS RECEIVE & INTERACTION
   ========================================================================== */

self.addEventListener('push', (event) => {
  let data = {};
  if (event.data) {
    try {
      data = event.data.json();
    } catch {
      data = {
        title: 'WPlay Eletrônicos',
        body: event.data.text(),
      };
    }
  }

  const title = data.title || 'WPlay Eletrônicos';
  const options = {
    body: data.body || 'Confira os lançamentos e ofertas exclusivas na WPlay!',
    icon: data.icon || '/icon-192.png',
    badge: data.badge || '/icon-192.png',
    image: data.image || undefined,
    vibrate: [200, 100, 200, 100, 200],
    tag: data.tag || 'wplay-sales-alert',
    renotify: true,
    data: {
      url: data.url || '/',
      timestamp: Date.now(),
    },
  };

  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  let targetUrl = new URL('/', self.location.origin);
  try {
    const rawUrl = event.notification.data?.url || '/';
    const candidate = new URL(rawUrl, self.location.origin);
    if (candidate.origin === self.location.origin) {
      targetUrl = candidate;
    }
  } catch {
    /* Invalid targets return to the storefront. */
  }

  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(async (windows) => {
      // If a window is already open at the target URL, bring it to focus
      for (const client of windows) {
        if (client.url === targetUrl.href && 'focus' in client) {
          return client.focus();
        }
      }
      // If any window is open to the app, navigate it to targetUrl and focus
      for (const client of windows) {
        if ('navigate' in client && 'focus' in client) {
          await client.navigate(targetUrl.href);
          return client.focus();
        }
      }
      // Otherwise open a new window
      if (self.clients.openWindow) {
        return self.clients.openWindow(targetUrl.href);
      }
    })
  );
});
