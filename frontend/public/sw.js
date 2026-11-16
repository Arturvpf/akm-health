/* AKM-33: same-origin application shell only. Never cache /api responses implicitly. */
const CACHE_NAME = 'akm-health-shell-v4';
// Precache the whole application shell on install: index.html, every built asset it references
// and the fonts referenced from the built CSS. Without this, a first offline reload would find
// index.html but no JavaScript, because the first page load happens before this worker controls it.
async function precacheShell() {
  const cache = await caches.open(CACHE_NAME);
  const page = await fetch('/index.html', { cache: 'no-store' });
  if (!page.ok) throw new Error('Cannot precache the application shell');
  const html = await page.clone().text();
  await cache.put('/index.html', page.clone());
  await cache.put('/', page);
  const assets = new Set(['/akm-mark.svg', '/body-hologram.webp']);
  for (const match of html.matchAll(/(?:src|href)="(\/[^"#?]+\.(?:js|css|svg|png|ico))"/g)) assets.add(match[1]);
  for (const url of [...assets]) {
    try {
      const response = await fetch(url);
      if (!response.ok) continue;
      await cache.put(url, response.clone());
      if (url.endsWith('.css')) {
        for (const font of (await response.text()).matchAll(/url\((?:"|')?(\/[^"')]+\.(?:woff2?|ttf|svg|png))(?:"|')?\)/g)) assets.add(font[1]);
      }
    } catch { /* an optional asset that cannot be fetched is skipped; the page still loads online */ }
  }
  for (const url of assets) {
    if (!(await cache.match(url))) {
      try { const response = await fetch(url); if (response.ok) await cache.put(url, response); } catch { /* skip */ }
    }
  }
}
self.addEventListener('install', event => {
  event.waitUntil(precacheShell().then(() => self.skipWaiting()));
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
