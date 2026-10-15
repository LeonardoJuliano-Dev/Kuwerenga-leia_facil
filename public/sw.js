const CACHE_NAME = 'kuwerenga-v3';
const STATIC_ASSETS = [
  '/',
  '/index.html',
  '/manifest.json',
  '/icon-192.png',
  '/icon-512.png',
  '/badge-96.png',
  '/favicon.svg'
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

// ────────────────────────────────────────────────────────────────
// ARMAZENAMENTO E NOTIFICAÇÕES EM SEGUNDO PLANO (BACKGROUND TASKS)
// ────────────────────────────────────────────────────────────────
const BG_DATA_CACHE = 'kuwerenga-bg-data-v1';

async function setBgData(key, value) {
  try {
    const cache = await caches.open(BG_DATA_CACHE);
    await cache.put(
      new Request(`https://kuwerenga.internal/bg/${key}`),
      new Response(JSON.stringify(value), {
        headers: { 'Content-Type': 'application/json' },
      })
    );
  } catch (err) {
    console.warn('Erro ao guardar dados de fundo no SW:', err);
  }
}

async function getBgData(key) {
  try {
    const cache = await caches.open(BG_DATA_CACHE);
    const res = await cache.match(new Request(`https://kuwerenga.internal/bg/${key}`));
    if (!res) return null;
    return await res.json();
  } catch {
    return null;
  }
}

/**
 * Executa as verificações em segundo plano de forma autónoma:
 * 1. Livros parados há mais de 2 dias.
 * 2. Lembretes diários de leitura caso o leitor ainda não tenha lido hoje.
 */
async function runBackgroundReadingChecks() {
  try {
    const settings = (await getBgData('settings')) || {
      bookIdleReminders: true,
      dailyReadingReminders: true,
      muteAll: false,
    };

    if (settings.muteAll) return;

    const books = (await getBgData('books')) || [];
    const meta = (await getBgData('last_checks')) || {};
    const now = Date.now();
    const TWO_DAYS_MS = 2 * 24 * 60 * 60 * 1000;
    const ONE_DAY_MS = 24 * 60 * 60 * 1000;
    const todayStr = new Date().toISOString().split('T')[0];

    const notifiedIdle = meta.notifiedIdleBooks || {};

    // 1. Verificar livros inativos (+2 dias sem ler)
    if (settings.bookIdleReminders && books.length > 0) {
      for (const book of books) {
        if (!book.lastReadAt) continue;
        const lastReadTime = new Date(book.lastReadAt).getTime();
        const diffMs = now - lastReadTime;

        if (diffMs >= TWO_DAYS_MS) {
          const lastNotified = notifiedIdle[book.id] || 0;
          if (now - lastNotified >= ONE_DAY_MS) {
            const daysIdle = Math.floor(diffMs / ONE_DAY_MS);

            await self.registration.showNotification(
              `Continua a tua leitura: "${book.title}"`,
              {
                icon: '/icon-192.png',
                badge: '/badge-96.png',
                vibrate: [200, 100, 200],
                body: `Já passaram ${daysIdle} dias desde a tua última leitura. Que tal avançar mais algumas páginas hoje?`,
                tag: `book_idle_${book.id}`,
                data: { url: `/reader?bookId=${book.id}` },
              }
            );

            notifiedIdle[book.id] = now;
            break; // Notifica um livro de cada vez para não inundar o ecrã
          }
        }
      }
    }

    // 2. Lembrete Diário de Leitura (se ainda não leu hoje)
    if (settings.dailyReadingReminders && meta.lastDailyReminder !== todayStr) {
      const hasReadToday = books.some((b) => b.lastReadAt && b.lastReadAt.startsWith(todayStr));

      if (!hasReadToday) {
        const motivationalMessages = [
          'Dedica 10 minutos à tua leitura de hoje e mantém o teu hábito vivo!',
          'Uma página por dia transforma o teu conhecimento. Tens um momento para ler?',
          'O teu próximo capítulo favorito está à tua espera no Kuwerenga.',
          'Cultiva a tua mente: ler um pouco todos os dias faz toda a diferença.',
        ];
        const randomMsg = motivationalMessages[Math.floor(Math.random() * motivationalMessages.length)];

        await self.registration.showNotification('Hora da Leitura • Kuwerenga', {
          icon: '/icon-192.png',
          badge: '/badge-96.png',
          vibrate: [200, 100, 200],
          body: randomMsg,
          tag: `daily_reminder_${todayStr}`,
          data: { url: '/home' },
        });

        meta.lastDailyReminder = todayStr;
      }
    }

    meta.lastIdleCheck = now;
    meta.notifiedIdleBooks = notifiedIdle;
    await setBgData('last_checks', meta);
  } catch (err) {
    console.warn('Erro ao processar verificações no Service Worker:', err);
  }
}

// ────────────────────────────────────────────────────────────────
// EVENTOS DE SINCRONIZAÇÃO EM SEGUNDO PLANO (ANDROID / CHROME)
// ────────────────────────────────────────────────────────────────

// Periodic Background Sync (executado periodicamente pelo SO mesmo com APK fechado)
self.addEventListener('periodicsync', (event) => {
  if (event.tag === 'kuwerenga-reading-reminders') {
    event.waitUntil(runBackgroundReadingChecks());
  }
});

// Background Sync (ao restaurar rede ou permissão)
self.addEventListener('sync', (event) => {
  if (event.tag === 'kuwerenga-bg-sync') {
    event.waitUntil(runBackgroundReadingChecks());
  }
});

// Mensagens da aplicação
self.addEventListener('message', (event) => {
  if (!event.data) return;

  if (event.data.type === 'CACHE_BOOK') {
    const { url, bookId } = event.data;
    caches.open('leitura-books').then((cache) => {
      fetch(url).then((response) => {
        if (response.ok) {
          cache.put(`/offline-books/${bookId}`, response);
        }
      });
    });
  }

  // Notificação nativa imediata
  if (event.data.type === 'SHOW_NOTIFICATION') {
    const { title, options } = event.data;
    if (self.registration && 'showNotification' in self.registration) {
      self.registration.showNotification(title, {
        icon: '/icon-192.png',
        badge: '/badge-96.png',
        vibrate: [200, 100, 200],
        ...options,
      });
    }
  }

  // Sincronização de dados da app para o Service Worker (executado ao sair ou atualizar)
  if (event.data.type === 'SYNC_BACKGROUND_DATA') {
    const { books, settings } = event.data.payload || {};
    event.waitUntil(
      Promise.all([
        books ? setBgData('books', books) : Promise.resolve(),
        settings ? setBgData('settings', settings) : Promise.resolve(),
      ])
    );
  }

  // Agendamento de lembrete com timer em segundo plano
  if (event.data.type === 'SCHEDULE_BACKGROUND_REMINDER') {
    const delayMs = event.data.delayMs || 3600000;
    setTimeout(() => {
      runBackgroundReadingChecks();
    }, delayMs);
  }
});

// Suporte a Web Push Notifications nativas (do servidor para o telemóvel fechado)
self.addEventListener('push', (event) => {
  if (event.data) {
    try {
      const data = event.data.json();
      event.waitUntil(
        self.registration.showNotification(data.title || 'Kuwerenga', {
          icon: '/icon-192.png',
          badge: '/badge-96.png',
          vibrate: [200, 100, 200],
          body: data.body || data.message || '',
          tag: data.tag || `push_${Date.now()}`,
          data: { url: data.link || data.url || '/' },
        })
      );
    } catch {
      event.waitUntil(
        self.registration.showNotification('Kuwerenga • Nova Notificação', {
          icon: '/icon-192.png',
          badge: '/badge-96.png',
          body: event.data.text(),
          data: { url: '/' },
        })
      );
    }
  }
});

// Abertura e foco ao clicar em notificações no telemóvel/computador
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const urlToOpen = event.notification.data?.url || '/';

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((windowClients) => {
      for (const client of windowClients) {
        if (client.url.includes(urlToOpen) && 'focus' in client) {
          return client.focus();
        }
      }
      if (clients.openWindow) {
        return clients.openWindow(urlToOpen);
      }
    })
  );
});
