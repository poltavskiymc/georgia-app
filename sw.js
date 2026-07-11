// Service worker — оффлайн-работа приложения.
// Вся своя статика (html/css/js) отдаётся network-first: при наличии сети всегда свежая
// (правки подхватываются сразу), без сети — из кеша. Внешние API не трогаем.
// Бампни версию при изменении файлов.
const CACHE = 'georgia-v7';
const ASSETS = [
  './',
  './index.html',
  './css/styles.css',
  './js/data.js',
  './js/util.js',
  './js/traffic.js',
  './js/nav.js',
  './js/phrases.js',
  './js/route.js',
  './js/money.js',
  './js/chat.js',
  './js/translate.js',
  './js/settings.js',
  './manifest.webmanifest',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './icons/apple-touch-icon.png'
];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(ASSETS)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  // Внешние API (DeepSeek, курс, OSRM) — всегда из сети, не кешируем.
  if (url.origin !== self.location.origin) return;

  // network-first для всей своей статики.
  e.respondWith(
    fetch(req).then(res => {
      const copy = res.clone();
      caches.open(CACHE).then(c => c.put(req, copy)).catch(() => {});
      return res;
    }).catch(() => caches.match(req).then(r => r || (req.mode === 'navigate' ? caches.match('./index.html') : undefined)))
  );
});
