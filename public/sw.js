/*
 * FitHub service worker — hand-rolled and deliberately small.
 *
 * Strategy:
 *  - Navigations: network first, falling back to the cached app shell, so the
 *    app opens offline but picks up new deploys as soon as it can.
 *  - Hashed build assets (/assets/) and icons: cache first — their names change
 *    when their content does, so a cache hit is always correct.
 *  - Everything else same-origin: network first with cache fallback.
 *
 * Bump VERSION to invalidate every cache in one move.
 */
const VERSION = 'fithub-v1';
const SHELL = ['/', '/manifest.webmanifest', '/icons/icon-192.png', '/icons/icon-512.png'];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(VERSION).then((cache) => cache.addAll(SHELL)).then(() => self.skipWaiting()),
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== VERSION).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .then((response) => {
          const copy = response.clone();
          caches.open(VERSION).then((cache) => cache.put('/', copy));
          return response;
        })
        .catch(() => caches.match('/', { ignoreSearch: true })),
    );
    return;
  }

  const immutable = url.pathname.startsWith('/assets/') || url.pathname.startsWith('/icons/');
  if (immutable) {
    event.respondWith(
      caches.match(request).then(
        (hit) => hit ?? fetch(request).then((response) => {
          const copy = response.clone();
          caches.open(VERSION).then((cache) => cache.put(request, copy));
          return response;
        }),
      ),
    );
    return;
  }

  event.respondWith(
    fetch(request)
      .then((response) => {
        const copy = response.clone();
        caches.open(VERSION).then((cache) => cache.put(request, copy));
        return response;
      })
      .catch(() => caches.match(request)),
  );
});
