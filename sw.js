// Service worker — оффлайн-работа приложения.
// Стратегия stale-while-revalidate для своей статики: отдаём из кеша МГНОВЕННО
// (быстро и работает без сети), а свежую версию тихо подтягиваем в фоне для след. загрузки.
// Обновления кода прилетают через смену версии кеша ниже + skipWaiting/claim, а страница
// сама перезагрузится (см. регистрацию в index.html). Внешние API не трогаем.
// !!! Бампни CACHE при изменении любого файла из ASSETS.
const CACHE = 'georgia-v19';
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
  './js/wiki.js',
  './js/food.js',
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
  // Внешние API (DeepSeek, курс, OSRM) — всегда напрямую из сети, не кешируем.
  if (url.origin !== self.location.origin) return;

  // stale-while-revalidate: кеш сразу, обновление кеша — в фоне.
  e.respondWith(
    caches.match(req).then(cached => {
      const network = fetch(req).then(res => {
        const copy = res.clone();
        caches.open(CACHE).then(c => c.put(req, copy)).catch(() => {});
        return res;
      }).catch(() => cached || (req.mode === 'navigate' ? caches.match('./index.html') : undefined));
      return cached || network;   // есть в кеше — мгновенно; нет — ждём сеть
    })
  );
});
