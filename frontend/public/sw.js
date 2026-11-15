/* AKM-33: same-origin application shell only. Never cache /api responses implicitly. */
const CACHE_NAME = 'akm-health-shell-v1';
self.addEventListener('install', event => {
  event.waitUntil(caches.open(CACHE_NAME).then(cache => cache.addAll(['/', '/index.html'])).then(() => self.skipWaiting()));
});
self.addEventListener('activate', event => {
  event.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(key => key !== CACHE_NAME).map(key => caches.delete(key)))).then(() => self.clients.claim()));
});
self.addEventListener('fetch', event => {
  const request = event.request;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin || url.pathname.startsWith('/api/') || url.pathname === '/sw.js') return;
  // Network first for HTML navigation; immutable/cached asset fallback offline.
  if (request.mode === 'navigate') {
    event.respondWith(fetch(request).then(response => {
      if (response.ok) { const copy = response.clone(); void caches.open(CACHE_NAME).then(cache => cache.put('/index.html', copy)); }
      return response;
    }).catch(async () => (await caches.match('/index.html')) || Response.error()));
  } else {
    event.respondWith(caches.match(request).then(cached => cached || fetch(request).then(response => {
      if (response.ok) { const copy = response.clone(); void caches.open(CACHE_NAME).then(cache => cache.put(request, copy)); }
      return response;
    })));
  }
});
