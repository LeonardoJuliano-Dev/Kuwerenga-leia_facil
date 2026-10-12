const CACHE_NAME = 'kuwerenga-v2';
const STATIC_ASSETS = [
  '/',
  '/index.html',
  '/manifest.json'
];

// Install: faz cache do shell essencial
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(STATIC_ASSETS))
  );
  self.skipWaiting();
});

// Activate: limpa caches antigos
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_NAME && k !== 'leitura-books').map((k) => caches.delete(k)))
    )
  );
  self.clients.claim();
});

// Fetch: estratégia inteligente para SPA e suporte offline
self.addEventListener('fetch', (event) => {
  // Apenas lida com requisições GET
  if (event.request.method !== 'GET') return;

  const url = new URL(event.request.url);

  // 1. Chamadas de API ao Supabase (Network-first ou offline fallback)
  if (url.hostname.includes('supabase.co')) {
    event.respondWith(
      fetch(event.request).catch(() => {
        return new Response(JSON.stringify({ error: 'offline', offline: true }), {
          status: 503,
          headers: { 'Content-Type': 'application/json' }
        });
      })
    );
    return;
  }

  // 2. Livros em cache de arquivos
  if (url.pathname.startsWith('/offline-books/')) {
    event.respondWith(
      caches.match(event.request).then((cached) => cached || fetch(event.request))
    );
    return;
  }

  // 3. Navegação de páginas (SPA: /library, /reader, /profile, etc.)
  if (event.request.mode === 'navigate') {
    event.respondWith(
      fetch(event.request)
        .then((response) => {
          if (response.ok) {
            const clone = response.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone));
          }
          return response;
        })
        .catch(() => {
          return caches.match('/index.html').then((cachedIndex) => cachedIndex || caches.match('/'));
        })
    );
    return;
  }

  // 4. Recursos estáticos (JS, CSS, Fontes, Imagens, Workers) - Stale-while-revalidate / Network-first
  event.respondWith(
    caches.match(event.request).then((cachedResponse) => {
      const fetchPromise = fetch(event.request)
        .then((networkResponse) => {
          if (networkResponse && networkResponse.status === 200) {
            const clone = networkResponse.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone));
          }
          return networkResponse;
        })
        .catch(() => cachedResponse);

      return cachedResponse || fetchPromise;
    })
  );
});

// Mensagens da aplicação
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'CACHE_BOOK') {
    const { url, bookId } = event.data;
    caches.open('leitura-books').then((cache) => {
      fetch(url).then((response) => {
        if (response.ok) {
          cache.put(`/offline-books/${bookId}`, response);
        }
      });
    });
  }
});
