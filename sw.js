// Service worker: permite usar la app sin conexión.
// Estrategia: primero la red (así siempre llegan las actualizaciones) y, si no hay conexión, la copia guardada.
// Al añadir archivos nuevos a la app, inclúyelos en APP_FILES y sube el número de versión.
const CACHE = 'padel-metric-v4';
const APP_FILES = [
  './',
  './index.html',
  './manifest.json',
  './css/styles.css',
  './js/core/state.js',
  './js/core/storage.js',
  './js/core/utils.js',
  './js/setup.js',
  './js/players.js',
  './js/match/scoring.js',
  './js/match/voice.js',
  './js/match/live.js',
  './js/analysis.js',
  './js/heatmap.js',
  './js/stats.js',
  './js/poster.js',
  './js/ranking.js',
  './js/history.js',
  './js/events/common.js',
  './js/events/tournament.js',
  './js/events/americano.js',
  './assets/logo.svg',
  './js/home.js',
  './js/app.js',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './icons/icon-maskable-512.png',
  './icons/apple-touch-icon.png'
];

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(CACHE).then((cache) => cache.addAll(APP_FILES)));
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))
    )
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;
  const sameOrigin = new URL(req.url).origin === self.location.origin;

  // Archivos de la app: red primero, copia guardada si no hay conexión
  if (sameOrigin) {
    event.respondWith(
      fetch(req)
        .then((res) => {
          if (res.ok) {
            const copy = res.clone();
            caches.open(CACHE).then((cache) => cache.put(req, copy));
          }
          return res;
        })
        .catch(() =>
          caches.match(req).then((cached) => cached || (req.mode === 'navigate' ? caches.match('./index.html') : undefined))
        )
    );
    return;
  }

  // Fuentes de Google: copia guardada primero (no cambian)
  event.respondWith(
    caches.match(req).then((cached) =>
      cached ||
      fetch(req).then((res) => {
        if (res.ok || res.type === 'opaque') {
          const copy = res.clone();
          caches.open(CACHE).then((cache) => cache.put(req, copy));
        }
        return res;
      })
    )
  );
});
