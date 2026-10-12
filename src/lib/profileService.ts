import { supabase } from "./supabase";
import { getCached, setCached } from "./cache";

export interface FavoriteBookItem {
  id: string;
  title: string;
  author: string;
  cover_url?: string | null;
}

export interface UserProfileData {
  id: string;
  full_name: string;
  username: string;
  bio: string;
  avatar_url: string | null;
  email?: string;
  views_count: number;
  clubs_count: number;
  books_count: number;
  reading_time_minutes: number;
  sessions_count: number;
  favorite_books: FavoriteBookItem[];
  scheduled_delete_at?: string | null;
}

/** Gera um username amigável padrão baseado no nome ou email */
export function generateDefaultUsername(fullName: string, email?: string): string {
  if (email && email.includes("@")) {
    const handle = email.split("@")[0].toLowerCase().replace(/[^a-z0-9._]/g, "");
    if (handle) return `@${handle}`;
  }
  const clean = fullName
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]/g, ".");
  return `@${clean || "leitor"}`;
}

/** Formata minutos para exibição agradável (ex: '45min', '2h 15min') */
export function formatReadingTime(totalMinutes: number): string {
  if (!totalMinutes || totalMinutes <= 0) return "0min";
  if (totalMinutes < 60) return `${totalMinutes}min`;
  const hours = Math.floor(totalMinutes / 60);
  const mins = totalMinutes % 60;
  return mins > 0 ? `${hours}h ${mins}min` : `${hours}h`;
}

/** Recupera imediatamente os dados do perfil em cache sem atraso de rede (0ms) */
export function getCachedUserProfile(targetUserId: string): UserProfileData | null {
  const cacheKey = `profile_detail_${targetUserId}`;
  const directCached = getCached<UserProfileData>(cacheKey);
  if (directCached) return directCached;

  // Fallback: verificar cache de dados do utilizador
  const oldCached = getCached<any>("profile_user_data");
  if (oldCached && (!targetUserId || targetUserId === "current" || targetUserId === oldCached.id)) {
    let favBooks: FavoriteBookItem[] = [];
    try {
      const saved = localStorage.getItem(`profile_fav_books_${targetUserId}`);
      if (saved) favBooks = JSON.parse(saved);
    } catch {}

    const views = parseInt(localStorage.getItem(`profile_views_${targetUserId}`) || "0", 10);
    const clubs = getCached<any[]>("profile_user_clubs")?.length || 0;
    const books = getCached<any[]>("bookshelf_all_items")?.length || 0;
    const timeMins = parseInt(localStorage.getItem(`reading_time_mins_${targetUserId}`) || "0", 10);
    const sessions = parseInt(localStorage.getItem(`reading_sessions_${targetUserId}`) || "0", 10) || Math.max(books, Math.ceil(timeMins / 25));

    return {
      id: targetUserId,
      full_name: oldCached.fullName || "Leitor",
      username: generateDefaultUsername(oldCached.fullName || "Leitor", oldCached.email),
      bio: "Apaixonado pela descoberta e pelo poder dos livros.",
      avatar_url: oldCached.avatarUrl || null,
      email: oldCached.email,
      views_count: views,
      clubs_count: clubs,
      books_count: books,
      reading_time_minutes: timeMins,
      sessions_count: sessions,
      favorite_books: favBooks,
    };
  }

  return null;
}

/** Promessa com timeout para evitar esperas infinitas na rede */
function withTimeout<T>(query: PromiseLike<T>, ms: number, defaultValue: T): Promise<T> {
  return Promise.race([
    Promise.resolve(query).catch(() => defaultValue),
    new Promise<T>((resolve) => setTimeout(() => resolve(defaultValue), ms)),
  ]);
}

/** Carrega os dados do perfil em segundo plano com chamadas paralelas (ultra rápido) */
export async function fetchUserProfile(
  targetUserId: string,
  currentUserId?: string | null
): Promise<UserProfileData> {
  const cacheKey = `profile_detail_${targetUserId}`;
  const cached = getCached<UserProfileData>(cacheKey);

  let profileData: any = null;
  let clubsCount = cached?.clubs_count || 0;
  let booksCount = cached?.books_count || 0;
  let readingTime = cached?.reading_time_minutes || 0;
  let sessionsCount = cached?.sessions_count || 0;

  // Executa todas as consultas ao Supabase em PARALELO com timeout de 2.5s
  const [profileRes, clubsRes, booksRes] = await Promise.allSettled([
    withTimeout(
      supabase
        .from("profiles")
        .select("id, full_name, username, bio, avatar_url, profile_views, favorite_books, reading_time_minutes, scheduled_delete_at")
        .eq("id", targetUserId)
        .maybeSingle(),
      2500,
      { data: null, error: null } as any
    ),
    withTimeout(
      supabase
        .from("club_members")
        .select("*", { count: "exact", head: true })
        .eq("user_id", targetUserId),
      2500,
      { count: null } as any
    ),
    withTimeout(
      supabase
        .from("user_books")
        .select("*", { count: "exact", head: true })
        .eq("user_id", targetUserId),
      2500,
      { count: null } as any
    ),
  ]);

  if (profileRes.status === "fulfilled" && (profileRes.value as any)?.data) {
    profileData = (profileRes.value as any).data;
  }

  if (clubsRes.status === "fulfilled" && (clubsRes.value as any)?.count !== null && (clubsRes.value as any)?.count !== undefined) {
    clubsCount = (clubsRes.value as any).count;
  } else if (!clubsCount) {
    const localClubs = localStorage.getItem("profile_user_clubs");
    if (localClubs) {
      try {
        clubsCount = JSON.parse(localClubs).length;
      } catch {}
    }
  }

  if (booksRes.status === "fulfilled" && (booksRes.value as any)?.count !== null && (booksRes.value as any)?.count !== undefined) {
    booksCount = (booksRes.value as any).count;
  } else if (!booksCount) {
    const shelfCached = getCached<any[]>("bookshelf_all_items");
    if (shelfCached) booksCount = shelfCached.length;
  }

  // 4. Tempo de leitura e sessões
  const isMe = currentUserId === targetUserId;
  const localTime = localStorage.getItem(`reading_time_mins_${targetUserId}`);
  if (localTime) {
    readingTime = parseInt(localTime, 10) || 0;
  } else if (profileData?.reading_time_minutes) {
    readingTime = profileData.reading_time_minutes;
  }

  const localSessions = localStorage.getItem(`reading_sessions_${targetUserId}`);
  if (localSessions) {
    sessionsCount = parseInt(localSessions, 10) || 0;
  } else {
    sessionsCount = Math.max(booksCount, Math.ceil(readingTime / 25));
  }

  // 5. Visualizações de Perfil
  let views = profileData?.profile_views || cached?.views_count || 0;
  const localViewsKey = `profile_views_${targetUserId}`;
  const localViews = localStorage.getItem(localViewsKey);
  if (localViews) {
    views = Math.max(views, parseInt(localViews, 10) || 0);
  }

  // Se outro leitor estiver a visitar pela primeira vez nesta sessão, incrementar visualização
  if (currentUserId && !isMe) {
    const sessionVisitedKey = `session_visited_profile_${targetUserId}`;
    if (typeof window !== "undefined" && !sessionStorage.getItem(sessionVisitedKey)) {
      sessionStorage.setItem(sessionVisitedKey, "1");
      views += 1;
      localStorage.setItem(localViewsKey, String(views));

      // Atualização em background (não bloqueia nada)
      Promise.resolve(supabase.rpc("increment_profile_views", { target_user_id: targetUserId }))
        .catch(() => {
          Promise.resolve(supabase.from("profiles").update({ profile_views: views }).eq("id", targetUserId)).catch(() => {});
        });
    }
  }

  // 6. Livros Favoritos
  let favBooks: FavoriteBookItem[] = cached?.favorite_books || [];
  if (profileData?.favorite_books && Array.isArray(profileData.favorite_books) && profileData.favorite_books.length > 0) {
    favBooks = profileData.favorite_books;
  } else if (favBooks.length === 0) {
    const localFavs = localStorage.getItem(`profile_fav_books_${targetUserId}`);
    if (localFavs) {
      try {
        favBooks = JSON.parse(localFavs);
      } catch {}
    }
  }

  const fullName = profileData?.full_name || cached?.full_name || "Leitor Kuwerenga";
  const username = profileData?.username || cached?.username || generateDefaultUsername(fullName);
  const bio = profileData?.bio || cached?.bio || "Apaixonado pela descoberta e pelo poder dos livros.";
  const avatarUrl = profileData?.avatar_url || cached?.avatar_url || null;

  const result: UserProfileData = {
    id: targetUserId,
    full_name: fullName,
    username,
    bio,
    avatar_url: avatarUrl,
    views_count: views,
    clubs_count: clubsCount,
    books_count: booksCount,
    reading_time_minutes: readingTime,
    sessions_count: sessionsCount,
    favorite_books: favBooks,
    scheduled_delete_at: profileData?.scheduled_delete_at || null,
  };

  setCached(cacheKey, result);
  return result;
}

/** Atualiza dados editáveis do perfil (Nome, Username, Bio, Avatar, etc.) */
export async function updateUserProfile(
  userId: string,
  data: Partial<UserProfileData>
): Promise<boolean> {
  try {
    const payload: any = {
      updated_at: new Date().toISOString(),
    };
    if (data.full_name !== undefined) payload.full_name = data.full_name;
    if (data.username !== undefined) payload.username = data.username;
    if (data.bio !== undefined) payload.bio = data.bio;
    if (data.avatar_url !== undefined) payload.avatar_url = data.avatar_url;
    if (data.favorite_books !== undefined) payload.favorite_books = data.favorite_books;

    // Atualização remota assíncrona
    Promise.resolve(supabase.from("profiles").update(payload).eq("id", userId)).catch((err: unknown) => {
      console.warn("Aviso na atualização remota do perfil:", err);
    });

    // Atualiza caches locais imediatamente (0ms)
    if (data.favorite_books) {
      localStorage.setItem(`profile_fav_books_${userId}`, JSON.stringify(data.favorite_books));
    }
    const cached = getCached<UserProfileData>(`profile_detail_${userId}`);
    if (cached) {
      setCached(`profile_detail_${userId}`, { ...cached, ...data });
    }
    return true;
  } catch (err) {
    console.error("Erro ao atualizar perfil:", err);
    return false;
  }
}
