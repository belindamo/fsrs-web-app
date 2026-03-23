/**
 * Service Worker — offline caching for the FSRS web app.
 *
 * Strategy: cache-first for app shell assets, network-first for nothing else
 * (this is a fully static, localStorage-based app — no API calls to worry about).
 */

const CACHE_NAME = 'fsrs-v1';

const APP_SHELL = [
  './',
  './index.html',
  './css/style.css',
  './js/vendor/ts-fsrs.umd.js',
  './js/markdown.js',
  './js/fsrs.js',
  './js/better-fsrs.js',
  './js/storage.js',
  './js/app.js',
  './manifest.json',
  './icons/icon-192.png',
  './icons/icon-512.png',
];

// Install: pre-cache the app shell
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(APP_SHELL))
  );
  self.skipWaiting();
});

// Activate: clean up old caches
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k))
      )
    )
  );
  self.clients.claim();
});

// Fetch: cache-first for app shell, network-first fallback for everything else
self.addEventListener('fetch', (event) => {
  event.respondWith(
    caches.match(event.request).then((cached) => {
      if (cached) return cached;
      return fetch(event.request).then((response) => {
        // Don't cache non-GET or non-ok responses
        if (event.request.method !== 'GET' || !response.ok) return response;
        // Cache a clone
        const clone = response.clone();
        caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone));
        return response;
      }).catch(() => {
        // Offline fallback — return the cached index for navigation requests
        if (event.request.mode === 'navigate') {
          return caches.match('./index.html');
        }
      });
    })
  );
});
