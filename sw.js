// Service worker (SteelFlow): instalacja z przeglądarki, szybszy start i praca bez internetu.
// • pliki aplikacji: najpierw sieć (zawsze najnowsza wersja), bez sieci – ostatnia kopia,
// • biblioteki z zewnątrz (Firebase z gstatic, cdnjs, czcionki Google): z pamięci – mają wersję w adresie, więc się nie zmieniają,
// • baza danych (Firestore) obsługuje się sama – dane są w pamięci przeglądarki (tryb offline we wspólnym module).
// Wzór: repo Logistyka, wspolne/sw-wzor.js (kopiuje node wspolne/kopiuj.mjs, z nazwą pamięci modułu).
const CACHE = "kooperacje-v2";
const ZEWN = /^https:\/\/(www\.gstatic\.com\/firebasejs\/|cdnjs\.cloudflare\.com\/ajax\/libs\/|fonts\.googleapis\.com\/|fonts\.gstatic\.com\/)/;
self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", e => e.waitUntil((async () => {
  for (const k of await caches.keys()) if (k === "app-v1" || (k.startsWith("kooperacje-") && k !== CACHE)) await caches.delete(k);
  await self.clients.claim();
})()));
self.addEventListener("fetch", e => {
  if (e.request.method !== "GET") return;
  const u = new URL(e.request.url);
  if (ZEWN.test(u.href)) {
    e.respondWith(caches.match(e.request).then(r => r || fetch(e.request).then(res => {
      if (res.ok || res.type === "opaque") { const k = res.clone(); caches.open(CACHE).then(c => c.put(e.request, k)); }
      return res;
    })));
    return;
  }
  if (u.origin !== location.origin) return;
  e.respondWith(fetch(e.request).then(r => {
    if (r.ok) { const k = r.clone(); caches.open(CACHE).then(c => c.put(e.request, k)); }
    return r;
  }).catch(async () => (await caches.match(e.request, { ignoreSearch: true })) || (e.request.mode === "navigate" ? (await caches.match(new URL("./", self.registration.scope).href, { ignoreSearch: true })) || (await caches.match(new URL("./index.html", self.registration.scope).href, { ignoreSearch: true })) : Response.error())));
});
