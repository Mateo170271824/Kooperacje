// Service worker: aplikacja instaluje się z przeglądarki i uruchamia szybciej.
// Pliki aplikacji: najpierw sieć (zawsze najnowsza wersja), bez sieci – ostatnia kopia. Baza (Firebase) obsługuje się sama.
const CACHE = "app-v1";
self.addEventListener("install", e => self.skipWaiting());
self.addEventListener("activate", e => e.waitUntil(self.clients.claim()));
self.addEventListener("fetch", e => {
  const u = new URL(e.request.url);
  if (e.request.method !== "GET" || u.origin !== location.origin) return;
  e.respondWith(fetch(e.request).then(r => {
    if (r.ok) { const kopia = r.clone(); caches.open(CACHE).then(c => c.put(e.request, kopia)); }
    return r;
  }).catch(() => caches.match(e.request, { ignoreSearch: true }).then(r => r || caches.match("./index.html") || caches.match("./"))));
});
