// Stara wersja Kooperacji (GitHub Pages) – wyłącza zainstalowany wcześniej service worker i czyści jego pamięć,
// żeby stary adres zawsze kierował do SteelFlow.
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', e => e.waitUntil((async () => {
  for (const k of await caches.keys()) await caches.delete(k);
  await self.registration.unregister();
  for (const c of await self.clients.matchAll({ type: 'window' })) c.navigate(c.url);
})()));
