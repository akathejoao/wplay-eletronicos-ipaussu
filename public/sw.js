const CACHE_NAME = 'wplay-app-v2';
const OFFLINE_URL = '/offline.html';

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(CACHE_NAME)
    .then((cache) => cache.addAll([OFFLINE_URL, '/icons/icon-192.png']))
    .then(() => self.skipWaiting()));
});

self.addEventListener('activate', (event) => {
  event.waitUntil(caches.keys()
    .then((keys) => Promise.all(keys
      .filter((key) => key.startsWith('wplay-app-') && key !== CACHE_NAME)
      .map((key) => caches.delete(key))))
    .then(() => self.clients.claim()));
});

self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);
  // Never cache authentication, admin pages, API responses or catalog prices.
  if (event.request.method !== 'GET' || url.origin !== self.location.origin ||
      url.pathname.startsWith('/api/') || url.pathname.startsWith('/admin') ||
      event.request.mode !== 'navigate') return;
  event.respondWith(fetch(event.request).catch(async () => {
    const cached = await caches.match(OFFLINE_URL);
    return cached || new Response('Sem conexão. Conecte-se à internet e tente novamente.', {
      status: 503, headers: { 'Content-Type': 'text/plain; charset=utf-8' },
    });
  }));
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  let targetUrl = new URL('/', self.location.origin);
  try {
    const candidate = new URL(event.notification.data?.url || '/', self.location.origin);
    if (candidate.origin === self.location.origin) targetUrl = candidate;
  } catch { /* Invalid targets return to the storefront. */ }
  event.waitUntil(self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(async (windows) => {
    const existing = windows.find((client) => client.url === targetUrl.href);
    if (existing) return existing.focus();
    return self.clients.openWindow(targetUrl.href);
  }));
});
