// Offline-Unterstützung: App-Dateien werden zwischengespeichert.
// Online wird immer die neueste Version geladen, offline die gespeicherte.
const CACHE = 'mylib-v11';
const APP_FILES = [
  './',
  'index.html',
  'src/ui/style.css',
  'src/ui/main.js',
  'src/ui/book-list.js',
  'src/ui/book-form.js',
  'src/ui/scanner.js',
  'src/vendor/zxing/zxing.min.js',
  'src/core/index.js',
  'src/core/books.js',
  'src/core/isbn.js',
  'src/core/covers.js',
  'src/core/settings.js',
  'src/core/storage.js',
  'manifest.webmanifest',
  'icons/icon-180.png',
  'icons/icon-192.png',
  'icons/icon-512.png',
];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(APP_FILES)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE && k !== COVER_CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

// Cover-Bilder ändern sich nicht: einmal geladen, kommen sie aus dem Speicher (auch offline).
const COVER_HOSTS = [
  'portal.dnb.de', 'www.buchhandel.de', 'images-na.ssl-images-amazon.com',
  'covers.openlibrary.org', 'books.google.com', 'books.googleusercontent.com',
];
const COVER_CACHE = 'mylib-covers-v2';

self.addEventListener('fetch', (e) => {
  const url = new URL(e.request.url);
  if (e.request.method !== 'GET') return;
  if (COVER_HOSTS.includes(url.hostname) && e.request.destination === 'image') {
    e.respondWith(
      caches.open(COVER_CACHE).then((c) => c.match(e.request).then((hit) => hit || fetch(e.request).then((res) => {
        // Fremde Bilder kommen ohne CORS als "opaque" an; auch diese speichern.
        if (res.ok || res.type === 'opaque') c.put(e.request, res.clone());
        return res;
      }))),
    );
    return;
  }
  if (url.origin !== location.origin) return;
  e.respondWith(
    // no-cache: immer beim Server nachfragen, damit Updates sofort ankommen.
    fetch(e.request, { cache: 'no-cache' })
      .then((res) => {
        const copy = res.clone();
        caches.open(CACHE).then((c) => c.put(e.request, copy));
        return res;
      })
      .catch(() => caches.match(e.request, { ignoreSearch: true })),
  );
});
