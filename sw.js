// Met en cache les fichiers de l'app pour qu'elle fonctionne hors ligne.
// Changer CACHE à chaque modification de ces fichiers pour forcer la mise à jour.
const CACHE = 'suivi-v1';
const FILES = [
  './',
  './index.html',
  './manifest.webmanifest',
  './src/app.js',
  './src/storage-status.js',
  './src/style.css',
];

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(CACHE).then((cache) => cache.addAll(FILES)));
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
