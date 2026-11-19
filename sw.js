// アプリのファイルを端末に保存し、通信がなくても開けるようにする。
// 版（CACHE）ごとに全部のファイルをまとめて保存し、その版のファイルだけを返す（古い版と新しい版が混ざらない）。
// sw.js が変わるとブラウザが新しい版を取りに来て、届いたらすぐ切り替える。画面には「新しい版になりました」と出る。
// ファイルを直したら CACHE の番号を上げる。
const CACHE = 'toeic-mimi-v9';
const FILES = [
  './',
  './index.html',
  './privacy.html',
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
  './icons/icon-monochrome-512.png',
  './icons/apple-touch-icon.png',
  './audio/bgm.dat',
];

self.addEventListener('install', event => {
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE);
    // ブラウザの一時保存（GitHub Pages は10分）を通さず、公開されたばかりのファイルを取る
    await cache.addAll(FILES.map(url => new Request(url, { cache: 'reload' })));
    await self.skipWaiting();
  })());
});

self.addEventListener('activate', event => {
  event.waitUntil((async () => {
    const names = await caches.keys();
    await Promise.all(names.filter(name => name !== CACHE).map(name => caches.delete(name)));
    await self.clients.claim();
  })());
});

self.addEventListener('fetch', event => {
  const { request } = event;
  if (request.method !== 'GET' || new URL(request.url).origin !== location.origin) return;

  event.respondWith((async () => {
    const cache = await caches.open(CACHE);
    // ?go=daily などのつきは同じページとして扱う
    const saved = await cache.match(request, { ignoreSearch: true });
    if (saved) return saved;
    try {
      const response = await fetch(request);
      if (response.ok && new URL(request.url).pathname.includes('/icons/')) cache.put(request, response.clone());
      return response;
    } catch (error) {
      if (request.mode === 'navigate') return (await cache.match('./index.html')) || Response.error();
      throw error;
    }
  })());
});
