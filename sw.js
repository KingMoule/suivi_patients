// Met en cache les fichiers de l'app pour qu'elle fonctionne hors ligne.
// Changer CACHE à chaque modification de ces fichiers pour forcer la mise à jour.
const CACHE = 'suivi-v3';
const FILES = [
  './',
  './index.html',
  './manifest.webmanifest',
  './src/app.js',
  './src/crypto.js',
  './src/db.js',
  './src/faceid.js',
  './src/passphrase.js',
  './src/storage-status.js',
  './src/style.css',
  './src/vault.js',
];

self.addEventListener('install', (event) => {
  // cache: 'reload' contourne le cache HTTP, pour ne pas garder d'anciennes versions.
  const requests = FILES.map((file) => new Request(file, { cache: 'reload' }));
  event.waitUntil(caches.open(CACHE).then((cache) => cache.addAll(requests)));
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((key) => key !== CACHE).map((key) => caches.delete(key)))
    )
  );
});

self.addEventListener('fetch', (event) => {
  event.respondWith(
    caches.match(event.request).then((cached) => cached || fetch(event.request))
  );
});
