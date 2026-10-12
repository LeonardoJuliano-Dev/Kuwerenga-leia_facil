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

/** Carrega os dados do perfil de qualquer utilizador (próprio ou visitante) */
export async function fetchUserProfile(
  targetUserId: string,
  currentUserId?: string | null
): Promise<UserProfileData> {
  const cacheKey = `profile_detail_${targetUserId}`;
  const cached = getCached<UserProfileData>(cacheKey);

  let profileData: any = null;
  let clubsCount = 0;
  let booksCount = 0;
  let readingTime = 0;
  let sessionsCount = 0;

  // 1. Tentar ler do Supabase
  try {
    const { data, error } = await supabase
      .from("profiles")
      .select("id, full_name, username, bio, avatar_url, profile_views, favorite_books, reading_time_minutes, scheduled_delete_at")
      .eq("id", targetUserId)
      .maybeSingle();

    if (!error && data) {
      profileData = data;
    }
  } catch (err) {
    console.warn("Aviso ao ler perfil remoto:", err);
  }

  // 2. Contagem de Clubes em que o utilizador participa
  try {
    const { count } = await supabase
      .from("club_members")
      .select("*", { count: "exact", head: true })
      .eq("user_id", targetUserId);
    if (count !== null && count !== undefined) {
      clubsCount = count;
    }
  } catch {
    // Fallback local se necessário
    const localClubs = localStorage.getItem("profile_user_clubs");
    if (localClubs) {
      try {
        clubsCount = JSON.parse(localClubs).length;
      } catch {}
    }
  }

  // 3. Contagem de Livros na Estante
  try {
    const { count } = await supabase
      .from("user_books")
      .select("*", { count: "exact", head: true })
      .eq("user_id", targetUserId);
    if (count !== null && count !== undefined) {
      booksCount = count;
    }
  } catch {
    const shelfCached = getCached<any[]>("bookshelf_all_items");
    if (shelfCached) booksCount = shelfCached.length;
  }

  // 4. Se for o próprio perfil, verificar tempo de leitura guardado localmente
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
  let views = profileData?.profile_views || 0;
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

      // Tentar atualizar no Supabase com RPC ou update direto
      try {
        await supabase.rpc("increment_profile_views", { target_user_id: targetUserId });
      } catch {
        try {
          await supabase
            .from("profiles")
            .update({ profile_views: views })
            .eq("id", targetUserId);
        } catch {}
      }
    }
  }

  // 6. Livros Favoritos
  let favBooks: FavoriteBookItem[] = [];
  if (profileData?.favorite_books && Array.isArray(profileData.favorite_books)) {
    favBooks = profileData.favorite_books;
  } else {
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

    const { error } = await supabase.from("profiles").update(payload).eq("id", userId);
    if (error) {
      console.warn("Aviso na atualização remota do perfil:", error);
    }

    // Atualiza caches locais
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
