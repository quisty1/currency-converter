// Cache Storage name; bump when the asset list changes
const CACHE = 'fx-multi-v3';

// app shell for offline (no rates API)
const ASSETS = [
  './',
  './index.html',
  './css/styles.css',
  './js/app.js',
  './js/api.js',
  './js/i18n.js',
  './js/storage.js',
  './js/theme.js',
  './js/flags.js',
  './favicon.svg',
  './icons/icon-180.png',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './manifest.webmanifest',
  './robots.txt',
  './sitemap.xml',
];

// precache + skipWaiting so the new SW activates immediately
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(CACHE)
      .then((cache) => cache.addAll(ASSETS))
      .then(() => self.skipWaiting()),
  );
});

// drop old caches and take over clients
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)),
        ),
      )
      .then(() => self.clients.claim()),
  );
});

// GET same-origin: network-first; cache is offline fallback only
// leave open.er-api.com / api.coingecko.com alone — rates live in localStorage
self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;

  const url = new URL(request.url);
  // do not cache the rates API in the SW — the app uses localStorage
  if (
    url.hostname === 'open.er-api.com' ||
    url.hostname === 'api.coingecko.com' ||
    url.hostname.endsWith('coingecko.com')
  ) {
    return;
  }

  event.respondWith(
    fetch(request)
      .then((response) => {
        if (response.ok && url.origin === self.location.origin) {
          const copy = response.clone();
          caches.open(CACHE).then((cache) => cache.put(request, copy));
        }
        return response;
      })
      .catch(() => caches.match(request).then((cached) => cached)),
  );
});
