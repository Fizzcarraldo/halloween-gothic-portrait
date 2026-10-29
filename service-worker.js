// Service Worker: macht die App offline-fähig.
// Beim ersten Online-Laden werden App-Shell + alle angeforderten Dateien gecacht
// (auch Figuren-Clips und die MediaPipe-Gesichtserkennung von der CDN).
const CACHE = 'gothic-v5';
const CORE = [
  './', './index.html', './app.js', './style.css',
  './manifest.json', './icon-192.png', './icon-512.png',
  './assets/bg.jpg',
  // Gesichtserkennung lokal gebuendelt -> nie Internet noetig
  './assets/mediapipe/vision_bundle.mjs',
  './assets/mediapipe/wasm/vision_wasm_internal.js',
  './assets/mediapipe/wasm/vision_wasm_internal.wasm',
  './assets/mediapipe/face_landmarker.task',
];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(CORE)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

// Cache-first: liegt es im Cache -> offline nutzbar; sonst holen + cachen (auch CDN/Videos/Model).
self.addEventListener('fetch', (e) => {
  if (e.request.method !== 'GET') return;
  e.respondWith((async () => {
    const cache = await caches.open(CACHE);
    const hit = await cache.match(e.request);
    if (hit) return hit;
    try {
      const res = await fetch(e.request);
      try { await cache.put(e.request, res.clone()); } catch {}
      return res;
    } catch (err) {
      return hit || Response.error();
    }
  })());
});
