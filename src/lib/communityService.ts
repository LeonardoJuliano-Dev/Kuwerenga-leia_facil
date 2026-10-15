import { supabase } from "./supabase";

export interface ClubMemberItem {
  id: string;
  club_id: string;
  user_id: string;
  role: "admin" | "moderator" | "member";
  joined_at: string;
  full_name: string;
  avatar_url: string | null;
}

export interface JoinRequestItem {
  id: string;
  club_id: string;
  user_id: string;
  created_at: string;
  full_name: string;
  avatar_url: string | null;
}

/**
 * Determina quem é o Administrador ativo da comunidade.
 * Regra:
 * 1. O criador (club.created_by) é o administrador enquanto a sua conta existir como membro.
 * 2. Caso a conta do criador seja eliminada ou deixe de existir na comunidade,
 *    o membro mais antigo (com menor joined_at) passa a ser o Administrador ativo,
 *    e assim sucessivamente.
 */
export function determineActiveClubAdmin(
  creatorId: string | null | undefined,
  members: ClubMemberItem[]
): string | null {
  if (members.length === 0) return creatorId || null;

  // 1. Se o criador original ainda estiver na lista de membros válidos
  if (creatorId) {
    const creatorMember = members.find((m) => m.user_id === creatorId);
    if (creatorMember) {
      return creatorId;
    }
  }

  // 2. Se o criador já não existir (conta eliminada), encontra o membro mais antigo
  const sortedBySeniority = [...members].sort(
    (a, b) => new Date(a.joined_at).getTime() - new Date(b.joined_at).getTime()
  );

  return sortedBySeniority[0]?.user_id || creatorId || null;
}

/** Carrega os membros de um clube com o perfil detalhado */
export async function loadClubMembers(clubId: string): Promise<ClubMemberItem[]> {
  try {
    const { data, error } = await supabase
      .from("club_members")
      .select(`
        id,
        club_id,
        user_id,
        role,
        joined_at,
        profile:profiles (
          id,
          full_name,
          avatar_url
        )
      `)
      .eq("club_id", clubId)
      .order("joined_at", { ascending: true });

    if (error || !data) return [];

    return data.map((item: any) => ({
      id: item.id,
      club_id: item.club_id,
      user_id: item.user_id,
      role: item.role || "member",
      joined_at: item.joined_at || new Date().toISOString(),
      full_name: item.profile?.full_name || "Membro do Clube",
      avatar_url: item.profile?.avatar_url || null,
    }));
  } catch (err) {
    console.warn("Erro ao carregar membros do clube:", err);
    return [];
  }
}

/** Carrega os pedidos de adesão pendentes de um clube privado */
export async function loadClubJoinRequests(clubId: string): Promise<JoinRequestItem[]> {
  try {
    const { data, error } = await supabase
      .from("club_join_requests")
      .select(`
        id,
        club_id,
        user_id,
        created_at,
        profile:profiles (
          id,
          full_name,
          avatar_url
        )
      `)
      .eq("club_id", clubId)
      .eq("status", "pending")
      .order("created_at", { ascending: true });

    if (error || !data) {
      // Fallback local se a tabela ainda não tiver sido criada no Supabase
      const localKey = `pending_requests_${clubId}`;
      const raw = localStorage.getItem(localKey);
      return raw ? JSON.parse(raw) : [];
    }

    return data.map((item: any) => ({
      id: item.id,
      club_id: item.club_id,
      user_id: item.user_id,
      created_at: item.created_at,
      full_name: item.profile?.full_name || "Utilizador Interessado",
      avatar_url: item.profile?.avatar_url || null,
    }));
  } catch {
    const localKey = `pending_requests_${clubId}`;
    const raw = localStorage.getItem(localKey);
    return raw ? JSON.parse(raw) : [];
  }
}

/** Submete pedido de adesão para entrar numa comunidade privada */
export async function submitJoinRequest(
  clubId: string,
  userId: string,
  userName?: string
): Promise<boolean> {
  try {
    const { error } = await supabase.from("club_join_requests").insert({
      club_id: clubId,
      user_id: userId,
      status: "pending",
    });

    if (error) {
      // Grava no fallback local se a tabela remota falhar
      const localKey = `pending_requests_${clubId}`;
      const current: JoinRequestItem[] = JSON.parse(localStorage.getItem(localKey) || "[]");
      if (!current.some((r) => r.user_id === userId)) {
        current.push({
          id: `req-${Date.now()}`,
          club_id: clubId,
          user_id: userId,
          created_at: new Date().toISOString(),
          full_name: userName || "Utilizador Interessado",
          avatar_url: null,
        });
        localStorage.setItem(localKey, JSON.stringify(current));
      }
    }

    // Regista no armazenamento local do utilizador para visualização de estado pendente
    localStorage.setItem(`my_request_club_${clubId}`, "pending");
    return true;
  } catch {
    localStorage.setItem(`my_request_club_${clubId}`, "pending");
    return true;
  }
}

/** Aprova um pedido de adesão, adicionando o utilizador como membro oficial */
export async function approveJoinRequest(
  requestId: string,
  clubId: string,
  userId: string
): Promise<boolean> {
  try {
    // 1. Adiciona como membro
    await supabase.from("club_members").insert({
      club_id: clubId,
      user_id: userId,
      role: "member",
    });

    // 2. Remove ou atualiza o pedido
    await supabase.from("club_join_requests").delete().eq("id", requestId);

    // Limpa fallback local
    const localKey = `pending_requests_${clubId}`;
    const current: JoinRequestItem[] = JSON.parse(localStorage.getItem(localKey) || "[]");
    localStorage.setItem(
      localKey,
      JSON.stringify(current.filter((r) => r.id !== requestId && r.user_id !== userId))
    );
    localStorage.removeItem(`my_request_club_${clubId}`);
    return true;
  } catch (err) {
    console.error("Erro ao aprovar pedido:", err);
    return false;
  }
}

/** Rejeita um pedido de adesão */
export async function rejectJoinRequest(requestId: string, clubId?: string): Promise<boolean> {
  try {
    await supabase.from("club_join_requests").delete().eq("id", requestId);
    if (clubId) {
      const localKey = `pending_requests_${clubId}`;
      const current: JoinRequestItem[] = JSON.parse(localStorage.getItem(localKey) || "[]");
      localStorage.setItem(localKey, JSON.stringify(current.filter((r) => r.id !== requestId)));
    }
    return true;
  } catch {
    return false;
  }
}

/** Configura se a comunidade é pública ou privada */
export async function updateClubPrivacy(clubId: string, isPublic: boolean): Promise<boolean> {
  try {
    const { error } = await supabase
      .from("clubs")
      .update({ is_public: isPublic })
      .eq("id", clubId);

    if (error) {
      console.warn("Aviso ao atualizar privacidade no Supabase:", error);
    }
    return true;
  } catch (err) {
    console.error("Erro ao mudar privacidade do clube:", err);
    return false;
  }
}

/** Atualiza dados da comunidade (nome, descrição, meta, foto de perfil e fundo) */
export async function updateClubDetails(
  clubId: string,
  data: {
    name: string;
    description?: string;
    current_goal?: string;
    avatar_url?: string | null;
    cover_url?: string | null;
    is_public?: boolean;
  }
): Promise<boolean> {
  try {
    const payload: any = {
      name: data.name.trim(),
      description: data.description?.trim() || null,
      current_goal: data.current_goal?.trim() || null,
    };

    if (data.avatar_url !== undefined) payload.avatar_url = data.avatar_url;
    if (data.cover_url !== undefined) payload.cover_url = data.cover_url;
    if (data.is_public !== undefined) payload.is_public = data.is_public;

    const { error } = await supabase
      .from("clubs")
      .update(payload)
      .eq("id", clubId);

    if (error) {
      // Fallback gracioso caso a coluna avatar_url ainda não exista na base de dados
      if (error.message?.includes("avatar_url")) {
        delete payload.avatar_url;
        const { error: retryErr } = await supabase.from("clubs").update(payload).eq("id", clubId);
        if (retryErr) throw retryErr;
      } else {
        throw error;
      }
    }
    return true;
  } catch (err) {
    console.error("Erro ao atualizar clube:", err);
    return false;
  }
}

/** Remove/expulsa um membro da comunidade */
export async function removeClubMember(clubId: string, userId: string): Promise<boolean> {
  try {
    const { error } = await supabase
      .from("club_members")
      .delete()
      .eq("club_id", clubId)
      .eq("user_id", userId);

    if (error) throw error;
    return true;
  } catch (err) {
    console.error("Erro ao remover membro:", err);
    return false;
  }
}

/** Apaga uma mensagem do chat (permitido ao autor ou ao administrador do clube) */
export async function deleteClubMessage(messageId: string): Promise<boolean> {
  try {
    const { error } = await supabase
      .from("club_discussions")
      .delete()
      .eq("id", messageId);

    if (error) throw error;
    return true;
  } catch (err) {
    console.error("Erro ao apagar mensagem:", err);
    return false;
  }
}

/** Elimina uma comunidade por completo */
export async function deleteClub(clubId: string): Promise<boolean> {
  try {
    const { error } = await supabase.from("clubs").delete().eq("id", clubId);
    if (error) throw error;
    return true;
  } catch (err) {
    console.error("Erro ao apagar clube:", err);
    return false;
  }
}
