var CACHE = "buttle-shell-2";
var NETWORK_TIMEOUT = 4000;
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
  "./fonts/manrope-cyrillic.woff2",
  "./fonts/manrope-latin.woff2",
  "./fonts/manrope-cyrillic-600.woff2",
  "./fonts/manrope-latin-600.woff2",
  "./fonts/manrope-cyrillic-700.woff2",
  "./fonts/manrope-latin-700.woff2",
  "./icons/icon-192.png",
  "./icons/icon-512.png",
  "./icons/icon-maskable-192.png",
  "./icons/icon-maskable-512.png"
];

function isStatic(url) {
  return url.pathname.indexOf("/fonts/") !== -1 || url.pathname.indexOf("/icons/") !== -1;
}

function store(request, response) {
  if (!response || !response.ok || response.type !== "basic") return;
  var copy = response.clone();
  caches.open(CACHE).then(function (cache) {
    cache.put(request, copy);
  });
}

function fromNetwork(request) {
  return fetch(request).then(function (response) {
    store(request, response);
    return response;
  });
}

function networkFirst(request) {
  return new Promise(function (resolve, reject) {
    var done = false;
    var timer = setTimeout(function () {
      caches.match(request).then(function (cached) {
        if (cached && !done) {
          done = true;
          resolve(cached);
        }
      });
    }, NETWORK_TIMEOUT);

    fromNetwork(request).then(function (response) {
      clearTimeout(timer);
      if (!done) {
        done = true;
        resolve(response);
      }
    }).catch(function () {
      clearTimeout(timer);
      caches.match(request).then(function (cached) {
        if (done) return;
        done = true;
        if (cached) resolve(cached);
        else reject();
      });
    });
  });
}

self.addEventListener("install", function (event) {
  self.skipWaiting();
  event.waitUntil(caches.open(CACHE).then(function (cache) {
    return cache.addAll(ASSETS);
  }));
});

self.addEventListener("activate", function (event) {
  event.waitUntil(caches.keys().then(function (keys) {
    var replaced = keys.some(function (key) {
      return key !== CACHE;
    });
    return Promise.all(keys.filter(function (key) {
      return key !== CACHE;
    }).map(function (key) {
      return caches.delete(key);
    })).then(function () {
      return self.clients.claim().then(function () {
        if (!replaced) return;
        return self.clients.matchAll({ type: "window" }).then(function (clients) {
          clients.forEach(function (client) {
            if (client.navigate && client.url) client.navigate(client.url);
          });
        });
      });
    });
  }));
});

self.addEventListener("fetch", function (event) {
  var request = event.request;
  if (request.method !== "GET") return;
  var url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  if (isStatic(url)) {
    event.respondWith(caches.match(request).then(function (cached) {
      return cached || fromNetwork(request);
    }));
    return;
  }

  event.respondWith(networkFirst(request));
});
