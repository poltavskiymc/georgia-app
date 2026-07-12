// Service worker — оффлайн-работа приложения.
//
// Две стратегии, и это принципиально (сборка 21 залипла у пользователя именно из-за одной общей):
//  1. HTML (навигация) — NETWORK-FIRST. Есть сеть — всегда свежая разметка, нет сети — из кеша.
//     Пока index.html отдавался из кеша, телефон мог сколько угодно долго жить на старой версии.
//  2. Остальная статика (css/js/иконки) — stale-while-revalidate: мгновенно из кеша, обновление в фоне.
//     Залипнуть на старом js она не может, потому что свежий index.html просит файлы с ?v=VER —
//     это другой URL, в кеше его нет, и он гарантированно тянется из сети.
//
// !!! При изменении любого css/js: подними VER здесь И ТОТ ЖЕ номер в ?v=… у тегов в index.html
//     (плюс APP_VERSION в js/settings.js). Номера должны совпадать, иначе файлы уедут мимо кеша.
const VER = '22';
const CACHE = 'georgia-v' + VER;

// файлы, которые index.html подключает с ?v=VER — в кеш кладём ровно с тем же URL
const VERSIONED = [
  './css/styles.css',
  './js/data.js',
  './js/util.js',
  './js/traffic.js',
  './js/nav.js',
  './js/phrases.js',
  './js/plan.js',
  './js/route.js',
  './js/wiki.js',
  './js/food.js',
  './js/money.js',
  './js/chat.js',
  './js/translate.js',
  './js/settings.js'
];
const ASSETS = [
  './',
  './index.html',
  './manifest.webmanifest',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './icons/apple-touch-icon.png',
  ...VERSIONED.map(f => f + '?v=' + VER)
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
  // Внешние API (DeepSeek, курс, OSRM, Википедия) — всегда напрямую из сети, не кешируем.
  if (url.origin !== self.location.origin) return;

  // HTML: сначала сеть, кеш — только если сети нет.
  if (req.mode === 'navigate') {
    e.respondWith(
      fetch(req).then(res => {
        const copy = res.clone();
        caches.open(CACHE).then(c => c.put('./index.html', copy)).catch(() => {});
        return res;
      }).catch(() => caches.match('./index.html').then(r => r || caches.match('./')))
    );
    return;
  }

  // Статика: кеш сразу, обновление кеша — в фоне.
  e.respondWith(
    caches.match(req).then(cached => {
      const network = fetch(req).then(res => {
        const copy = res.clone();
        caches.open(CACHE).then(c => c.put(req, copy)).catch(() => {});
        return res;
      }).catch(() => cached);
      return cached || network;   // есть в кеше — мгновенно; нет — ждём сеть
    })
  );
});
