// アプリのファイルを端末に保存し、通信がなくても開けるようにする。
// 版（CACHE）ごとに全部のファイルをまとめて保存し、その版のファイルだけを返す（古い版と新しい版が混ざらない）。
// sw.js が変わるとブラウザが新しい版を取りに来て、届いたらすぐ切り替える。画面には「新しい版になりました」と出る。
// ファイルを直したら CACHE の番号を上げる。
const CACHE = 'toeic-mimi-v14';
// 英語の音声（voice/*.mp3、約770個）は数が多いので、アプリの版とは別に保存し、版が上がっても取り直さない。
// 一度鳴らしたもの、またはアプリが空いた時間に少しずつ取ったものから保存される。
// 音声を作り直したら番号を上げる（js/app.js の VOICE_CACHE も同じ名前にする）
const VOICE_CACHE = 'toeic-mimi-voice-1';
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
  './voice/index.js',
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
    await Promise.all(names.filter(name => name !== CACHE && name !== VOICE_CACHE).map(name => caches.delete(name)));
    await self.clients.claim();
  })());
});

self.addEventListener('fetch', event => {
  const { request } = event;
  const url = new URL(request.url);
  if (request.method !== 'GET' || url.origin !== location.origin) return;

  // 英語の音声：保存してあればそれを返し、なければ取って保存する
  if (/\/voice\/[0-9a-f]{8}\.mp3$/.test(url.pathname)) {
    event.respondWith((async () => {
      const voices = await caches.open(VOICE_CACHE);
      const saved = await voices.match(request);
      if (saved) return saved;
      const response = await fetch(request);
      if (response.ok) await voices.put(request, response.clone());
      return response;
    })());
    return;
  }

  event.respondWith((async () => {
    const cache = await caches.open(CACHE);
    // ?go=daily などのつきは同じページとして扱う
    const saved = await cache.match(request, { ignoreSearch: true });
    if (saved) return saved;
    try {
      const response = await fetch(request);
      if (response.ok && url.pathname.includes('/icons/')) cache.put(request, response.clone());
      return response;
    } catch (error) {
      if (request.mode === 'navigate') return (await cache.match('./index.html')) || Response.error();
      throw error;
    }
  })());
});
