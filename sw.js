// アプリのファイルを端末に保存し、通信がなくても開けるようにする。
// 開くときは保存済みのものをすぐ表示し、裏で新しい版を取りに行く（次に開いたときに反映）。
// ファイルを直したら CACHE の番号を上げる。
const CACHE = 'toeic-mimi-v4';
const FILES = [
  './',
  './index.html',
  './manifest.webmanifest',
  './js/app.js',
  './js/mimi.js',
  './js/words.js',
  './js/grammar.js',
  './js/lines.js',
  './vendor/gsap/gsap.min.js',
  './vendor/gsap/MorphSVGPlugin.min.js',
  './vendor/gsap/DrawSVGPlugin.min.js',
  './vendor/gsap/Physics2DPlugin.min.js',
  './vendor/gsap/CustomEase.min.js',
  './vendor/gsap/CustomWiggle.min.js',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './icons/icon-maskable-512.png',
  './icons/apple-touch-icon.png',
];

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE)
      .then(cache => cache.addAll(FILES))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys()
      .then(names => Promise.all(names.filter(name => name !== CACHE).map(name => caches.delete(name))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('fetch', event => {
  const { request } = event;
  if (request.method !== 'GET' || new URL(request.url).origin !== location.origin) return;

  event.respondWith((async () => {
    const cache = await caches.open(CACHE);
    const saved = await cache.match(request, { ignoreSearch: true });
    const latest = fetch(request).then(response => {
      if (response.ok) cache.put(request, response.clone());
      return response;
    });
    if (saved) {
      event.waitUntil(latest.catch(() => {}));
      return saved;
    }
    try {
      return await latest;
    } catch (error) {
      if (request.mode === 'navigate') return cache.match('./index.html');
      throw error;
    }
  })());
});
