// Service worker minimale di SLEPBOLO.
// Strategia: network-first per le pagine (contenuti sempre freschi quando c'è rete),
// cache-first per gli asset statici. Fallback offline quando la rete manca.

const CACHE = "slepbolo-v7";
const OFFLINE_ASSETS = ["/app", "/icon-192.png", "/manifest.webmanifest"];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE).then((c) => c.addAll(OFFLINE_ASSETS)).catch(() => {}),
  );
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))),
    ),
  );
  self.clients.claim();
});

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return;

  const url = new URL(request.url);
  // Non intercettiamo le chiamate verso Supabase o i tile della mappa.
  if (url.origin !== self.location.origin) return;

  // L'area admin non passa mai di qui: quelle pagine contengono le password
  // degli iscritti e finirebbero scritte nella cache su disco del browser.
  // Resta anche sempre fresca, senza codice vecchio servito dalla cache.
  if (url.pathname === "/admin" || url.pathname.startsWith("/admin/")) return;

  const isStatic = url.pathname.startsWith("/_next/static") || /\.(png|jpg|svg|css|js|woff2?)$/.test(url.pathname);

  if (isStatic) {
    event.respondWith(
      caches.match(request).then((hit) => hit || fetchAndCache(request)),
    );
  } else {
    event.respondWith(
      fetchAndCache(request).catch(() => caches.match(request).then((h) => h || caches.match("/"))),
    );
  }
});

function fetchAndCache(request) {
  return fetch(request).then((res) => {
    if (res && res.status === 200 && res.type === "basic") {
      const copy = res.clone();
      caches.open(CACHE).then((c) => c.put(request, copy));
    }
    return res;
  });
}
