import { supabase } from "./supabase";
import { getLocalCustomBooks } from "./bookshelfService";

export interface AppNotification {
  id: string;
  type: "community_message" | "book_idle" | "reading_reminder" | "system" | "admin_approval";
  title: string;
  message: string;
  timestamp: string;
  read: boolean;
  link?: string;
  metadata?: {
    clubId?: string;
    clubName?: string;
    bookId?: string;
    bookTitle?: string;
    authorName?: string;
    idleDays?: number;
  };
}

export interface NotificationSettings {
  communityMessages: boolean; // Notificar mensagens nos clubes onde é membro
  bookIdleReminders: boolean;  // Notificar quando livro está há + de 2 dias sem ler
  dailyReadingReminders: boolean; // Lembretes diários de leitura / entrar no sistema
  muteAll: boolean;            // Silenciar tudo (Não incomodar)
  mutedClubIds: string[];      // IDs de clubes silenciados individualmente
  browserNotifications: boolean; // Notificações ativas no navegador/telemóvel
}

const SETTINGS_KEY = "kuwerenga_notification_settings";
const NOTIFICATIONS_KEY = "kuwerenga_app_notifications";
const LAST_CHECKS_KEY = "kuwerenga_last_notif_checks";

const DEFAULT_SETTINGS: NotificationSettings = {
  communityMessages: true,
  bookIdleReminders: true,
  dailyReadingReminders: true,
  muteAll: false,
  mutedClubIds: [],
  browserNotifications: typeof window !== "undefined" && "Notification" in window && Notification.permission === "granted",
};

// Listeners subscritos a alterações nas notificações
type NotificationListener = (notifications: AppNotification[]) => void;
const listeners = new Set<NotificationListener>();

function notifyListeners(list: AppNotification[]) {
  listeners.forEach((fn) => {
    try {
      fn(list);
    } catch (e) {
      console.warn("Erro no listener de notificações:", e);
    }
  });
}

/** Obtém as configurações de notificação */
export function getNotificationSettings(): NotificationSettings {
  if (typeof window === "undefined") return DEFAULT_SETTINGS;
  try {
    const raw = localStorage.getItem(SETTINGS_KEY);
    if (!raw) return DEFAULT_SETTINGS;
    const parsed = JSON.parse(raw);
    return {
      ...DEFAULT_SETTINGS,
      ...parsed,
      browserNotifications: "Notification" in window && Notification.permission === "granted",
    };
  } catch {
    return DEFAULT_SETTINGS;
  }
}

/** Guarda ou atualiza as configurações de notificação */
export function saveNotificationSettings(updates: Partial<NotificationSettings>): NotificationSettings {
  const current = getNotificationSettings();
  const updated: NotificationSettings = {
    ...current,
    ...updates,
  };
  try {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(updated));
  } catch (err) {
    console.warn("Erro ao guardar preferências de notificação:", err);
  }
  return updated;
}

/** Verifica se um clube específico está silenciado */
export function isClubMuted(clubId: string): boolean {
  const settings = getNotificationSettings();
  if (settings.muteAll) return true;
  return settings.mutedClubIds.includes(clubId);
}

/** Alterna silêncio de um clube específico */
export function toggleMuteClub(clubId: string): boolean {
  const settings = getNotificationSettings();
  let updatedMuted: string[];
  const isCurrentlyMuted = settings.mutedClubIds.includes(clubId);

  if (isCurrentlyMuted) {
    updatedMuted = settings.mutedClubIds.filter((id) => id !== clubId);
  } else {
    updatedMuted = [...settings.mutedClubIds, clubId];
  }

  saveNotificationSettings({ mutedClubIds: updatedMuted });
  return !isCurrentlyMuted;
}

/** Solicita permissão de Notificações do Navegador / Telemóvel */
export async function requestBrowserNotificationPermission(sendTestNotification = true): Promise<boolean> {
  if (typeof window === "undefined" || !("Notification" in window)) {
    return false;
  }

  try {
    const perm = await Notification.requestPermission();
    const granted = perm === "granted";
    saveNotificationSettings({ browserNotifications: granted });

    if (granted && sendTestNotification) {
      sendBrowserNotification("Kuwerenga • Notificações Ativas", {
        body: "As notificações do Kuwerenga estão agora ativas no teu telemóvel!",
        link: "/home",
      });
    }

    return granted;
  } catch (err) {
    console.warn("Erro ao solicitar permissão de notificações:", err);
    return false;
  }
}

/** Envia notificação nativa para o telemóvel/browser */
export function sendBrowserNotification(title: string, options?: NotificationOptions & { link?: string }) {
  if (typeof window === "undefined" || !("Notification" in window)) return;
  if (Notification.permission !== "granted") return;

  const settings = getNotificationSettings();
  if (settings.muteAll) return;

  const payload: any = {
    icon: "/favicon.svg",
    badge: "/favicon.svg",
    vibrate: [200, 100, 200],
    data: { url: options?.link || "/" },
    ...options,
  };

  try {
    // 1. Em primeiro lugar, tenta sempre via Service Worker Registration (essencial para telemóveis Android, iOS PWA e navegadores móveis)
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.ready
        .then((reg) => {
          return reg.showNotification(title, payload);
        })
        .catch(() => {
          if (navigator.serviceWorker.controller) {
            navigator.serviceWorker.controller.postMessage({
              type: "SHOW_NOTIFICATION",
              title,
              options: payload,
            });
          }
        });
    } else {
      // 2. Fallback para desktop com construtor direto
      const notif = new Notification(title, payload);
      if (options?.link) {
        notif.onclick = () => {
          window.focus();
          window.location.href = options.link!;
        };
      }
    }
  } catch (err) {
    console.warn("Não foi possível emitir notificação nativa:", err);
  }
}

/** Carrega todas as notificações guardadas */
export function getNotifications(): AppNotification[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(NOTIFICATIONS_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

/** Guarda lista de notificações */
function saveNotificationsList(list: AppNotification[]) {
  try {
    // Guarda até no máximo 60 notificações mais recentes
    const limited = list.slice(0, 60);
    localStorage.setItem(NOTIFICATIONS_KEY, JSON.stringify(limited));
    notifyListeners(limited);
  } catch (e) {
    console.warn("Erro ao gravar notificações:", e);
  }
}

/** Adiciona uma nova notificação se permitido pelas configurações */
export function addNotification(
  item: Omit<AppNotification, "id" | "timestamp" | "read">
): AppNotification | null {
  const settings = getNotificationSettings();

  // Verifica se o modo "Silenciar Tudo" está ativo
  if (settings.muteAll) return null;

  // Validação de tipo de notificação
  if (item.type === "community_message") {
    if (!settings.communityMessages) return null;
    if (item.metadata?.clubId && isClubMuted(item.metadata.clubId)) return null;
  }
  if (item.type === "book_idle" && !settings.bookIdleReminders) {
    return null;
  }
  if (item.type === "reading_reminder" && !settings.dailyReadingReminders) {
    return null;
  }

  const current = getNotifications();

  // Evita duplicatas idênticas num curto intervalo (últimos 15 min)
  const isDuplicate = current.some((n) => {
    const isSameType = n.type === item.type;
    const isSameTitle = n.title === item.title;
    const timeDiff = Date.now() - new Date(n.timestamp).getTime();
    return isSameType && isSameTitle && timeDiff < 15 * 60 * 1000;
  });

  if (isDuplicate) return null;

  const newNotif: AppNotification = {
    ...item,
    id: `notif_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
    timestamp: new Date().toISOString(),
    read: false,
  };

  const updated = [newNotif, ...current];
  saveNotificationsList(updated);

  // Emite notificação nativa do browser / telemóvel
  sendBrowserNotification(newNotif.title, {
    body: newNotif.message,
    link: newNotif.link,
  });

  return newNotif;
}

/** Marca uma notificação como lida */
export function markNotificationAsRead(id: string) {
  const list = getNotifications();
  const updated = list.map((n) => (n.id === id ? { ...n, read: true } : n));
  saveNotificationsList(updated);
}

/** Marca todas as notificações como lidas */
export function markAllNotificationsAsRead() {
  const list = getNotifications();
  const updated = list.map((n) => ({ ...n, read: true }));
  saveNotificationsList(updated);
}

/** Apaga uma notificação */
export function deleteNotification(id: string) {
  const list = getNotifications();
  const updated = list.filter((n) => n.id !== id);
  saveNotificationsList(updated);
}

/** Limpa todas as notificações */
export function clearAllNotifications() {
  saveNotificationsList([]);
}

/** Retorna contagem de notificações não lidas */
export function getUnreadNotificationsCount(): number {
  return getNotifications().filter((n) => !n.read).length;
}

/** Subscreve a alterações na lista de notificações */
export function subscribeToNotifications(callback: NotificationListener): () => void {
  listeners.add(callback);
  callback(getNotifications());
  return () => {
    listeners.delete(callback);
  };
}

// ────────────────────────────────────────────────────────────────
// 1. VERIFICAÇÃO DE LIVROS PARADOS (+ DE 2 DIAS SEM LER)
// ────────────────────────────────────────────────────────────────

interface LastCheckMeta {
  lastIdleCheck?: number;
  lastDailyReminder?: string; // YYYY-MM-DD
  notifiedIdleBookIds?: Record<string, number>; // bookId -> timestamp da última notificação
}

function getLastChecksMeta(): LastCheckMeta {
  try {
    const raw = localStorage.getItem(LAST_CHECKS_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

function saveLastChecksMeta(meta: LastCheckMeta) {
  try {
    localStorage.setItem(LAST_CHECKS_KEY, JSON.stringify(meta));
  } catch {}
}

/**
 * Verifica se existem livros em progresso que estão há mais de 2 dias sem leitura
 * e dispara notificações automáticas encorajando o leitor a continuar.
 */
export async function checkIdleBooksNotifications(): Promise<void> {
  const settings = getNotificationSettings();
  if (settings.muteAll || !settings.bookIdleReminders) return;

  const meta = getLastChecksMeta();
  const now = Date.now();
  const TWO_DAYS_MS = 2 * 24 * 60 * 60 * 1000; // 48 horas
  const ONE_DAY_MS = 24 * 60 * 60 * 1000;

  // Evita re-verificar com frequência excessiva (máx 1 verificação a cada 4 horas)
  if (meta.lastIdleCheck && now - meta.lastIdleCheck < 4 * 60 * 60 * 1000) {
    return;
  }

  const notifiedMap = meta.notifiedIdleBookIds || {};

  try {
    interface ActiveBookCheck {
      id: string;
      title: string;
      lastReadAt: string;
      progress: number;
    }

    const booksToCheck: ActiveBookCheck[] = [];

    // A. Livros locais / modo offline
    const localBooks = getLocalCustomBooks();
    localBooks.forEach((b) => {
      if (b.status === "reading" && (b.progress || 0) < 100 && b.lastReadAt) {
        booksToCheck.push({
          id: b.bookId || b.id,
          title: b.title,
          lastReadAt: b.lastReadAt,
          progress: b.progress || 0,
        });
      }
    });

    // B. Livros do Supabase do utilizador conectado
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      const { data: userBooks } = await supabase
        .from("user_books")
        .select("book_id, status, progress, last_read_at, book:books(id, title)")
        .eq("user_id", user.id)
        .neq("status", "finished");

      if (userBooks) {
        userBooks.forEach((item: any) => {
          if (item.book && (item.progress || 0) < 100 && item.last_read_at) {
            // Evita duplicar se já foi adicionado pelo local
            if (!booksToCheck.some((b) => b.id === item.book.id)) {
              booksToCheck.push({
                id: item.book.id,
                title: item.book.title,
                lastReadAt: item.last_read_at,
                progress: item.progress || 0,
              });
            }
          }
        });
      }
    }

    // Avalia cada livro em leitura
    for (const book of booksToCheck) {
      const lastReadTime = new Date(book.lastReadAt).getTime();
      const diffMs = now - lastReadTime;

      if (diffMs >= TWO_DAYS_MS) {
        const lastNotified = notifiedMap[book.id] || 0;

        // Dispara no máximo 1 notificação a cada 24 horas por livro
        if (now - lastNotified >= ONE_DAY_MS) {
          const daysIdle = Math.floor(diffMs / (24 * 60 * 60 * 1000));

          addNotification({
            type: "book_idle",
            title: `Continua a tua leitura: "${book.title}"`,
            message: `Já passaram ${daysIdle} dias desde a tua última leitura. Que tal avançar mais algumas páginas hoje?`,
            link: `/reader?bookId=${book.id}`,
            metadata: {
              bookId: book.id,
              bookTitle: book.title,
              idleDays: daysIdle,
            },
          });

          notifiedMap[book.id] = now;
        }
      }
    }

    meta.lastIdleCheck = now;
    meta.notifiedIdleBookIds = notifiedMap;
    saveLastChecksMeta(meta);
  } catch (err) {
    console.warn("Erro ao verificar livros inativos:", err);
  }
}

// ────────────────────────────────────────────────────────────────
// 2. LEMBRETES DIÁRIOS DE LEITURA (ENTRAR NO SISTEMA)
// ────────────────────────────────────────────────────────────────

/**
 * Envia um lembrete gentil para incentivar a leitura diária e manter o hábito.
 */
export async function checkDailyReadingReminder(): Promise<void> {
  const settings = getNotificationSettings();
  if (settings.muteAll || !settings.dailyReadingReminders) return;

  const meta = getLastChecksMeta();
  const todayStr = new Date().toISOString().split("T")[0];

  // Apenas 1 lembrete diário por dia
  if (meta.lastDailyReminder === todayStr) {
    return;
  }

  // Verifica se o utilizador já leu hoje
  const localBooks = getLocalCustomBooks();
  const readToday = localBooks.some((b) => {
    if (!b.lastReadAt) return false;
    return b.lastReadAt.startsWith(todayStr);
  });

  if (!readToday) {
    const motivationalMessages = [
      "Dedica 10 minutos à tua leitura de hoje e mantém o teu hábito vivo!",
      "Uma página por dia transforma o teu conhecimento. Tens um momento para ler?",
      "O teu próximo capítulo favorito está à tua espera no Kuwerenga.",
      "Cultiva a tua mente: ler um pouco todos os dias faz toda a diferença.",
    ];

    const randomMsg = motivationalMessages[Math.floor(Math.random() * motivationalMessages.length)];

    addNotification({
      type: "reading_reminder",
      title: "Hora da Leitura • Kuwerenga",
      message: randomMsg,
      link: "/home",
    });

    meta.lastDailyReminder = todayStr;
    saveLastChecksMeta(meta);
  }
}

// ────────────────────────────────────────────────────────────────
// 3. OUVINTE EM TEMPO REAL: MENSAGENS DAS COMUNIDADES DO UTILIZADOR
// ────────────────────────────────────────────────────────────────

let globalCommunityChannel: any = null;

/**
 * Inicializa ouvinte em tempo real das comunidades em que o utilizador é membro.
 * Notifica sempre que alguém publica uma mensagem nos seus clubes.
 */
export function initCommunityNotificationsListener(): () => void {
  if (typeof window === "undefined") return () => {};

  let isCleanedUp = false;

  async function setupListener() {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      // 1. Carrega os clubes aos quais o utilizador pertence
      const { data: myMemberships } = await supabase
        .from("club_members")
        .select("club_id, club:clubs(id, name)")
        .eq("user_id", user.id);

      if (!myMemberships || myMemberships.length === 0) return;

      const userClubsMap: Record<string, string> = {};
      myMemberships.forEach((m: any) => {
        if (m.club_id) {
          userClubsMap[m.club_id] = m.club?.name || "Comunidade";
        }
      });

      const clubIds = Object.keys(userClubsMap);
      if (clubIds.length === 0) return;

      // Desconecta canal anterior se existir
      if (globalCommunityChannel) {
        supabase.removeChannel(globalCommunityChannel);
      }

      // Cria canal realtime para escutar novas mensagens em club_discussions
      globalCommunityChannel = supabase
        .channel("global_community_message_notifications")
        .on(
          "postgres_changes",
          {
            event: "INSERT",
            schema: "public",
            table: "club_discussions",
          },
          async (payload) => {
            if (isCleanedUp) return;
            const newRow: any = payload.new;
            if (!newRow) return;

            // Ignora mensagens enviadas pelo próprio utilizador
            if (newRow.user_id === user.id) return;

            // Verifica se a mensagem pertence a um dos clubes do utilizador
            const clubName = userClubsMap[newRow.club_id];
            if (!clubName) return;

            // Verifica se o clube está silenciado
            if (isClubMuted(newRow.club_id)) return;

            // Obtém nome do autor da mensagem
            let authorName = "Um membro";
            try {
              const { data: prof } = await supabase
                .from("profiles")
                .select("full_name")
                .eq("id", newRow.user_id)
                .maybeSingle();

              if (prof?.full_name) {
                authorName = prof.full_name;
              }
            } catch {}

            // Trata prévia da mensagem
            let previewText = newRow.message || "Nova mensagem partilhada";
            if (previewText.startsWith("{") && previewText.includes('"media_type"')) {
              try {
                const parsed = JSON.parse(previewText);
                if (parsed.media_type === "audio") previewText = "🎤 Mensagem de voz";
                else if (parsed.media_type === "image") previewText = "📷 Fotografia partilhada";
                else if (parsed.text) previewText = parsed.text;
              } catch {}
            }

            // Trunca se muito longa
            if (previewText.length > 90) {
              previewText = previewText.substring(0, 87) + "...";
            }

            addNotification({
              type: "community_message",
              title: `Nova mensagem em "${clubName}"`,
              message: `${authorName}: ${previewText}`,
              link: `/club/${newRow.club_id}`,
              metadata: {
                clubId: newRow.club_id,
                clubName: clubName,
                authorName: authorName,
              },
            });
          }
        )
      // 2. Se for o administrador do sistema, escuta novos livros doados pendentes de aprovação
      if (user.email === "leonardojulianoj@gmail.com") {
        supabase
          .channel("admin_book_approvals_listener")
          .on(
            "postgres_changes",
            {
              event: "INSERT",
              schema: "public",
              table: "books",
            },
            (payload) => {
              if (isCleanedUp) return;
              const newBook: any = payload.new;
              if (newBook && newBook.is_approved === false) {
                notifyAdminNewDonatedBook({
                  id: newBook.id,
                  title: newBook.title,
                  author: newBook.author,
                });
              }
            }
          )
          .subscribe();
      }
    } catch (err) {
      console.warn("Erro ao configurar ouvinte de notificações comunitárias:", err);
    }
  }

  setupListener();

  // Executa verificações de livros parados e lembretes diários
  checkIdleBooksNotifications();
  checkDailyReadingReminder();

  return () => {
    isCleanedUp = true;
    if (globalCommunityChannel) {
      supabase.removeChannel(globalCommunityChannel);
      globalCommunityChannel = null;
    }
  };
}

/**
 * Notifica o administrador quando um novo livro doado aguarda aprovação
 */
export function notifyAdminNewDonatedBook(book: { id: string; title: string; author: string }) {
  addNotification({
    type: "admin_approval",
    title: "Novo Livro Doado para Aprovação",
    message: `"${book.title}" por ${book.author} aguarda a tua aprovação para entrar no catálogo.`,
    link: "/explore?tab=admin_approvals",
    metadata: {
      bookId: book.id,
      bookTitle: book.title,
      authorName: book.author,
    },
  });
}
