const CACHE_NAME = 'leitura-v1';
const STATIC_ASSETS = [
  '/',
  '/index.html',
  '/manifest.json',
];

// Install: cache shell assets
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(STATIC_ASSETS))
  );
  self.skipWaiting();
});

// Activate: clean old caches
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
    )
  );
  self.clients.claim();
});

// Fetch strategy: Network first, fallback to cache
// Exception: downloaded books are always served from cache
self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);

  // For book files stored in IndexedDB/Cache, serve cache-first
  if (url.pathname.startsWith('/offline-books/')) {
    event.respondWith(
      caches.match(event.request).then((cached) => cached || fetch(event.request))
    );
    return;
  }

  // For API calls (Supabase), network-only
  if (url.hostname.includes('supabase')) {
    event.respondWith(fetch(event.request));
    return;
  }

  // For app shell: network first, cache fallback
  event.respondWith(
    fetch(event.request)
      .then((response) => {
        // Cache successful responses for offline
        if (response.ok) {
          const clone = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone));
        }
        return response;
      })
      .catch(() => caches.match(event.request).then((cached) => cached || caches.match('/')))
  );
});

// Listen for messages from the app (e.g. cache a downloaded book)
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'CACHE_BOOK') {
    const { url, bookId } = event.data;
    caches.open('leitura-books').then((cache) => {
      fetch(url).then((response) => {
        cache.put(`/offline-books/${bookId}`, response);
      });
    });
  }
});
