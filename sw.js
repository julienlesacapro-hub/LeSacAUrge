/* LeSacAUrge - service worker (fonctionnement hors ligne)
   ©2026 LESACA Julien - Tous droits reserves. */
const VERSION = '1.1.1'; // a aligner avec index.html (?v=) et js/config.js
const CACHE = 'lsau-v' + VERSION;
const V = '?v=' + VERSION;
const ASSETS = [
  './', 'index.html', 'manifest.webmanifest', 'css/styles.css' + V,
  'js/config.js' + V, 'js/data.js' + V, 'js/sync.js' + V, 'js/app.js' + V, 'js/vendor/qrcode.js' + V,
  'icons/icon-32.png', 'icons/icon-64.png', 'icons/icon-180.png', 'icons/icon-192.png', 'icons/icon-512.png'
];
self.addEventListener('install', e => {
  // cache: 'reload' : ne jamais reprendre une ancienne copie du cache HTTP du navigateur
  e.waitUntil(caches.open(CACHE)
    .then(c => c.addAll(ASSETS.map(u => new Request(u, { cache: 'reload' }))))
    .then(() => self.skipWaiting()));
});
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
    .then(() => self.clients.claim()));
});
self.addEventListener('fetch', e => {
  const url = new URL(e.request.url);
  if (e.request.method !== 'GET' || url.origin !== self.location.origin) return; // jamais la base distante
  // Reseau d'abord, en revalidant aupres du serveur (pas de copie perimee du
  // cache HTTP), cache de l'application en secours hors ligne.
  e.respondWith(
    fetch(e.request, { cache: 'no-cache' }).then(res => {
      const copy = res.clone();
      if (res.ok) caches.open(CACHE).then(c => c.put(e.request, copy));
      return res;
    }).catch(() => caches.match(e.request)
      .then(r => r || caches.match(e.request, { ignoreSearch: true }))
      .then(r => r || caches.match('index.html')))
  );
});
