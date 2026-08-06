// Service Worker — Tactical OS PWA
// Оболонка кешується, index.html — network-first (оновлення прилітають одразу,
// офлайн відкривається остання збережена версія). API-запити не чіпаємо.
var CACHE = 'tactical-os-v1';
var SHELL = ['./', './index.html', './manifest.webmanifest', './icon-192.png', './icon-512.png'];

self.addEventListener('install', function (e) {
  e.waitUntil(caches.open(CACHE).then(function (c) { return c.addAll(SHELL); }).then(function(){ return self.skipWaiting(); }));
});

self.addEventListener('activate', function (e) {
  e.waitUntil(caches.keys().then(function (keys) {
    return Promise.all(keys.filter(function (k) { return k !== CACHE; }).map(function (k) { return caches.delete(k); }));
  }).then(function(){ return self.clients.claim(); }));
});

self.addEventListener('fetch', function (e) {
  var url = new URL(e.request.url);
  // Тільки свій origin і тільки GET — API (script.google.com, POST) іде напряму
  if (e.request.method !== 'GET' || url.origin !== location.origin) return;

  if (e.request.mode === 'navigate' || url.pathname.endsWith('/index.html')) {
    // network-first для сторінки
    e.respondWith(
      fetch(e.request).then(function (r) {
        var copy = r.clone();
        caches.open(CACHE).then(function (c) { c.put(e.request, copy); });
        return r;
      }).catch(function () { return caches.match(e.request).then(function(m){ return m || caches.match('./index.html'); }); })
    );
    return;
  }
  // cache-first для решти оболонки (іконки, маніфест)
  e.respondWith(
    caches.match(e.request).then(function (m) {
      return m || fetch(e.request).then(function (r) {
        var copy = r.clone();
        caches.open(CACHE).then(function (c) { c.put(e.request, copy); });
        return r;
      });
    })
  );
});
