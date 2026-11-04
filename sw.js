// Service worker: permite usar la app sin conexión.
// Estrategia: primero la red (así siempre llegan las actualizaciones), pero si la red tarda más de 3 segundos
// (poca cobertura en la pista) se abre la copia guardada al momento y la red termina de actualizarla por detrás.
// Sin conexión, la copia guardada.
// Al añadir archivos nuevos a la app, inclúyelos en APP_FILES y sube el número de versión.
const CACHE = 'padel-metric-v28';
const NET_TIMEOUT_MS = 3000;
const APP_FILES = [
  './',
  './index.html',
  './presentacion.html',
  './privacidad.html',
  './manifest.json',
  './css/styles.css',
  './js/nativo.js',
  './js/core/state.js',
  './js/core/storage.js',
  './js/core/utils.js',
  './js/fx.js',
  './js/intro.js',
  './js/setup.js',
  './js/players.js',
  './js/winprob.js',
  './js/match/scoring.js',
  './js/match/voice.js',
  './js/match/live.js',
  './js/match/pista.js',
  './js/analysis.js',
  './js/heatmap.js',
  './js/stats.js',
  './js/poster.js',
  './js/ranking.js',
  './js/card.js',
  './js/wrapped.js',
  './js/history.js',
  './js/events/common.js',
  './js/events/tournament.js',
  './js/events/americano.js',
  './assets/logo.svg',
  './js/share.js',
  './js/sync.js',
  './js/qr.js',
  './js/directo.js',
  './js/links.js',
  './js/inscripcion.js',
  './js/install.js',
  './js/quick.js',
  './js/mando.js',
  './js/resumen.js',
  './js/caras.js',
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

function fromCache(req) {
  return caches.match(req, { ignoreSearch: req.mode === 'navigate' })
    .then((cached) => cached || (req.mode === 'navigate' ? caches.match('./index.html') : undefined));
}

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);

  // Archivos de la app: red primero con tiempo límite; copia guardada si tarda o no hay conexión
  if (url.origin === self.location.origin) {
    const net = fetch(req);
    // La copia se guarda aunque ya se haya respondido con la versión guardada
    event.waitUntil(net.then((res) => {
      if (!res.ok) return;
      const copy = res.clone();
      return caches.open(CACHE).then((cache) => cache.put(req, copy));
    }).catch(() => {}));
    event.respondWith(new Promise((resolve) => {
      let done = false;
      const finish = (res) => { if (!done && res) { done = true; resolve(res); } };
      const timer = setTimeout(() => fromCache(req).then(finish), NET_TIMEOUT_MS);
      net.then((res) => { clearTimeout(timer); finish(res); })
        .catch(() => { clearTimeout(timer); fromCache(req).then((cached) => { if (!done) { done = true; resolve(cached || Response.error()); } }); });
    }));
    return;
  }

  // Fuentes de Google: copia guardada primero (no cambian). El resto (Supabase…) va siempre a la red.
  if (!/(^|\.)fonts\.(googleapis|gstatic)\.com$/.test(url.hostname)) return;
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
