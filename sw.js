var CACHE = "buttle-v1";
var ASSETS = [
  "./",
  "./index.html",
  "./styles.css",
  "./manifest.webmanifest",
  "./cards.js",
  "./js/players.js",
  "./js/deck.js",
  "./js/spin.js",
  "./js/app.js",
  "./sw.js",
  "./fonts/cormorant-garamond-cyrillic.woff2",
  "./fonts/cormorant-garamond-latin.woff2",
  "./fonts/manrope-cyrillic.woff2",
  "./fonts/manrope-latin.woff2",
  "./icons/icon-192.png",
  "./icons/icon-512.png",
  "./icons/icon-maskable-192.png",
  "./icons/icon-maskable-512.png"
];

self.addEventListener("install", function (event) {
  event.waitUntil(caches.open(CACHE).then(function (cache) {
    return cache.addAll(ASSETS);
  }));
});

self.addEventListener("activate", function (event) {
  event.waitUntil(caches.keys().then(function (keys) {
    return Promise.all(keys.filter(function (key) {
      return key !== CACHE;
    }).map(function (key) {
      return caches.delete(key);
    }));
  }).then(function () {
    return self.clients.claim();
  }));
});

self.addEventListener("fetch", function (event) {
  event.respondWith(caches.match(event.request).then(function (cached) {
    return cached || fetch(event.request);
  }));
});
