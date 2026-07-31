// имя Cache Storage; bump при смене списка ассетов
const CACHE = 'fx-multi-v3';

// shell приложения для offline (без API курсов)
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

// precache + skipWaiting, чтобы новый SW активировался сразу
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(CACHE)
      .then((cache) => cache.addAll(ASSETS))
      .then(() => self.skipWaiting()),
  );
});

// удаляет старые кэши и забирает клиентов
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

// GET same-origin: network-first, кэш только как offline fallback
// open.er-api.com / api.coingecko.com не трогаем — курсы в localStorage
self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;

  const url = new URL(request.url);
  // API курсов не кэшируем SW — остаётся localStorage в приложении
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
