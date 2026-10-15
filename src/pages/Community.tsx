import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import {
  Users,
  Plus,
  MessageSquare,
  Search,
  X,
  Lock,
  Globe,
  Settings,
  Camera,
  Image as ImageIcon,
  ChevronRight
} from "lucide-react";
import BottomNav from "../components/BottomNav";
import { supabase } from "../lib/supabase";
import { getCached, setCached } from "../lib/cache";
import { isGuestMode } from "../lib/guestMode";
import GuestRestrictionModal from "../components/GuestRestrictionModal";
import EditCommunityModal, { type CommunityEditData } from "../components/EditCommunityModal";
import {
  getCommunityInitials,
  getCommunityColorPalette,
  uploadClubImage
} from "../lib/communityStyle";

interface Club {
  id: string;
  name: string;
  description: string | null;
  cover_url: string | null;
  avatar_url?: string | null;
  current_goal: string | null;
  member_count: number;
  created_by: string;
  is_public?: boolean;
  is_member?: boolean;
}

interface Discussion {
  id: string;
  title: string;
  content: string;
  created_at: string;
  user_id: string;
  profile: {
    full_name: string | null;
  } | null;
}

export default function Community() {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<"clubs" | "my_clubs" | "discussions">("clubs");
  const [clubs, setClubs] = useState<Club[]>(() => getCached<Club[]>("community_clubs") || []);
  const [myClubIds, setMyClubIds] = useState<string[]>(() => getCached<string[]>("my_club_ids") || []);
  const [discussions, setDiscussions] = useState<Discussion[]>(() => getCached<Discussion[]>("community_discussions") || []);
  const [loading, setLoading] = useState(() => !getCached<Club[]>("community_clubs"));
  const [searchQuery, setSearchQuery] = useState("");

  // Estados do Modal: Criar Clube (com foto e fundo opcionais)
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [clubName, setClubName] = useState("");
  const [clubDesc, setClubDesc] = useState("");
  const [clubGoal, setClubGoal] = useState("");
  const [clubIsPublic, setClubIsPublic] = useState(true);
  const [createAvatarFile, setCreateAvatarFile] = useState<File | null>(null);
  const [createAvatarPreview, setCreateAvatarPreview] = useState<string | null>(null);
  const [createCoverFile, setCreateCoverFile] = useState<File | null>(null);
  const [createCoverPreview, setCreateCoverPreview] = useState<string | null>(null);
  const [submittingClub, setSubmittingClub] = useState(false);

  // Estados do Modal: Editar Clube (Foto, Fundo, Nome, etc.)
  const [editingClub, setEditingClub] = useState<CommunityEditData | null>(null);

  // Estados do Modal: Nova Discussão
  const [showNewDiscussionModal, setShowNewDiscussionModal] = useState(false);
  const [discussionTitle, setDiscussionTitle] = useState("");
  const [discussionContent, setDiscussionContent] = useState("");
  const [submittingDiscussion, setSubmittingDiscussion] = useState(false);

  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [currentUserEmail, setCurrentUserEmail] = useState<string | null>(null);
  const [showGuestRestriction, setShowGuestRestriction] = useState(false);

  const createAvatarInputRef = useRef<HTMLInputElement>(null);
  const createCoverInputRef = useRef<HTMLInputElement>(null);

  // 1. Carregar Clubes e Discussões Reais do Supabase
  useEffect(() => {
    async function loadCommunityData() {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (user) {
          setCurrentUserId(user.id);
          setCurrentUserEmail(user.email || null);
        }

        // Clubes públicos e privados
        const { data: clubsData } = await supabase
          .from("clubs")
          .select("id, name, description, cover_url, avatar_url, current_goal, member_count, created_by, is_public")
          .order("member_count", { ascending: false });

        // Membresias do utilizador
        let userMemberships: string[] = [];
        if (user) {
          const { data: memberData } = await supabase
            .from("club_members")
            .select("club_id")
            .eq("user_id", user.id);

          if (memberData) {
            userMemberships = memberData.map((m) => m.club_id);
            setMyClubIds(userMemberships);
            setCached("my_club_ids", userMemberships);
          }
        }

        if (clubsData) {
          const enrichedClubs = clubsData.map((c) => ({
            ...c,
            is_member: userMemberships.includes(c.id),
          }));
          setClubs(enrichedClubs);
          setCached("community_clubs", enrichedClubs);
        }

        // Discussões
        const { data: discData } = await supabase
          .from("club_discussions")
          .select(`
            id,
            title,
            content,
            created_at,
            user_id,
            profile:profiles(full_name)
          `)
          .order("created_at", { ascending: false })
          .limit(20);

        if (discData) {
          const formatted: Discussion[] = discData.map((d: any) => ({
            id: d.id,
            title: d.title,
            content: d.content,
            created_at: d.created_at,
            user_id: d.user_id,
            profile: d.profile,
          }));
          setDiscussions(formatted);
          setCached("community_discussions", formatted);
        }
      } catch (err) {
        console.error("Erro ao carregar comunidade:", err);
      } finally {
        setLoading(false);
      }
    }

    loadCommunityData();
  }, []);

  // Entrar / Sair de um Clube
  const handleToggleJoinClub = async (clubId: string, isMember: boolean) => {
    if (isGuestMode()) {
      setShowGuestRestriction(true);
      return;
    }
    if (!currentUserId) return;

    try {
      if (isMember) {
        // Sair
        await supabase
          .from("club_members")
          .delete()
          .eq("club_id", clubId)
          .eq("user_id", currentUserId);

        const updatedIds = myClubIds.filter((id) => id !== clubId);
        setMyClubIds(updatedIds);
        setCached("my_club_ids", updatedIds);

        setClubs((prev) =>
          prev.map((c) =>
            c.id === clubId
              ? { ...c, is_member: false, member_count: Math.max(1, c.member_count - 1) }
              : c
          )
        );
      } else {
        // Entrar
        await supabase.from("club_members").insert({
          club_id: clubId,
          user_id: currentUserId,
          role: "member",
        });

        const updatedIds = [...myClubIds, clubId];
        setMyClubIds(updatedIds);
        setCached("my_club_ids", updatedIds);

        setClubs((prev) =>
          prev.map((c) =>
            c.id === clubId
              ? { ...c, is_member: true, member_count: c.member_count + 1 }
              : c
          )
        );
      }
    } catch (e) {
      console.error("Erro ao alternar clube:", e);
    }
  };

  // Criar Clube com Foto e Fundo opcionais
  const handleCreateClub = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!clubName.trim() || !currentUserId) return;

    setSubmittingClub(true);
    try {
      // 1. Inserir clube inicial
      const payload: any = {
        name: clubName.trim(),
        description: clubDesc.trim() || null,
        current_goal: clubGoal.trim() || null,
        created_by: currentUserId,
        member_count: 1,
        is_public: clubIsPublic,
      };

      const { data: newClub, error } = await supabase
        .from("clubs")
        .insert(payload)
        .select()
        .single();

      if (error) throw error;

      if (newClub) {
        let finalAvatarUrl: string | null = null;
        let finalCoverUrl: string | null = null;

        // 2. Upload da Foto de Perfil se selecionada
        if (createAvatarFile) {
          finalAvatarUrl = await uploadClubImage(newClub.id, createAvatarFile, "avatar");
        }

        // 3. Upload da Imagem de Fundo se selecionada
        if (createCoverFile) {
          finalCoverUrl = await uploadClubImage(newClub.id, createCoverFile, "cover");
        }

        // 4. Atualizar com as URLs de avatar e cover se existirem
        if (finalAvatarUrl || finalCoverUrl) {
          try {
            await supabase
              .from("clubs")
              .update({
                avatar_url: finalAvatarUrl,
                cover_url: finalCoverUrl,
              })
              .eq("id", newClub.id);
          } catch {}
        }

        // 5. Registar criador como admin
        await supabase.from("club_members").insert({
          club_id: newClub.id,
          user_id: currentUserId,
          role: "admin",
        });

        const created: Club = {
          ...newClub,
          avatar_url: finalAvatarUrl,
          cover_url: finalCoverUrl,
          is_member: true,
        };

        const updatedClubs = [created, ...clubs];
        const updatedMyIds = [...myClubIds, newClub.id];

        setClubs(updatedClubs);
        setMyClubIds(updatedMyIds);
        setCached("community_clubs", updatedClubs);
        setCached("my_club_ids", updatedMyIds);

        setClubName("");
        setClubDesc("");
        setClubGoal("");
        setCreateAvatarFile(null);
        setCreateAvatarPreview(null);
        setCreateCoverFile(null);
        setCreateCoverPreview(null);
        setShowCreateModal(false);
      }
    } catch (err) {
      console.error("Erro ao criar clube:", err);
    } finally {
      setSubmittingClub(false);
    }
  };

  // Criar Nova Discussão
  const handleCreateDiscussion = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!discussionTitle.trim() || !discussionContent.trim() || !currentUserId) return;

    setSubmittingDiscussion(true);
    try {
      const { data: newDisc, error } = await supabase
        .from("club_discussions")
        .insert({
          title: discussionTitle.trim(),
          content: discussionContent.trim(),
          user_id: currentUserId,
        })
        .select(`
          id,
          title,
          content,
          created_at,
          user_id,
          profile:profiles(full_name)
        `)
        .single();

      if (error) throw error;

      if (newDisc) {
        const formatted: Discussion = {
          id: newDisc.id,
          title: newDisc.title,
          content: newDisc.content,
          created_at: newDisc.created_at,
          user_id: newDisc.user_id,
          profile: newDisc.profile as any,
        };

        const updated = [formatted, ...discussions];
        setDiscussions(updated);
        setCached("community_discussions", updated);

        setDiscussionTitle("");
        setDiscussionContent("");
        setShowNewDiscussionModal(false);
      }
    } catch (err) {
      console.error("Erro ao publicar discussão:", err);
    } finally {
      setSubmittingDiscussion(false);
    }
  };

  // Atualização em tempo real após salvar no modal de edição
  const handleClubSaved = (updated: CommunityEditData) => {
    setClubs((prev) =>
      prev.map((c) =>
        c.id === updated.id
          ? {
              ...c,
              name: updated.name,
              description: updated.description,
              current_goal: updated.current_goal,
              avatar_url: updated.avatar_url ?? null,
              cover_url: updated.cover_url ?? null,
              is_public: updated.is_public !== false,
            }
          : c
      )
    );
  };

  const isClubAdmin = (club: Club) => {
    return (
      (currentUserId && club.created_by === currentUserId) ||
      currentUserEmail === "leonardojulianoj@gmail.com"
    );
  };

  // Filtragem dos clubes
  const myClubs = clubs.filter((c) => myClubIds.includes(c.id));
  const activeClubsList = activeTab === "my_clubs" ? myClubs : clubs;

  const filteredClubs = activeClubsList.filter((c) => {
    if (!searchQuery.trim()) return true;
    const term = searchQuery.toLowerCase();
    return (
      c.name.toLowerCase().includes(term) ||
      (c.description && c.description.toLowerCase().includes(term)) ||
      (c.current_goal && c.current_goal.toLowerCase().includes(term))
    );
  });

  return (
    <div className="flex flex-col min-h-screen bg-gray-50 dark:bg-black text-black dark:text-white pb-24 md:pb-12 md:pt-16">
      
      {/* Header Responsivo */}
      <header className="px-3 sm:px-6 pt-safe sticky top-0 md:static z-10 bg-white dark:bg-black border-b border-gray-100 dark:border-gray-900">
        <div className="app-container pt-5 sm:pt-7 pb-3">
          <div className="flex items-center justify-between gap-3 mb-3">
            <div>
              <h1 className="text-xl sm:text-2xl font-bold tracking-tight">Comunidades</h1>
              <p className="text-xs text-gray-500 hidden sm:block">
                Canais de leitura coletiva e grupos de debate literário
              </p>
            </div>

            <button
              onClick={() => {
                if (isGuestMode()) {
                  setShowGuestRestriction(true);
                } else {
                  setShowCreateModal(true);
                }
              }}
              className="flex items-center gap-1.5 px-4 py-2 bg-black dark:bg-white text-white dark:text-black rounded-full text-xs font-bold active:scale-95 transition-transform shadow-xs"
            >
              <Plus className="w-3.5 h-3.5 stroke-[2.5]" />
              <span>Criar Grupo</span>
            </button>
          </div>

          {/* Barra de Pesquisa de Canais e Grupos (Telegram Style) */}
          <div className="relative mb-3">
            <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Pesquisar grupos e canais..."
              className="w-full pl-10 pr-4 py-2 bg-gray-100 dark:bg-gray-900 border border-transparent focus:border-gray-300 dark:focus:border-gray-700 rounded-2xl text-xs sm:text-sm font-medium focus:outline-none transition-all"
            />
          </div>

          {/* Abas */}
          <div className="flex gap-1.5 text-xs overflow-x-auto no-scrollbar py-0.5">
            <button
              onClick={() => setActiveTab("clubs")}
              className={`px-4 py-1.5 rounded-xl font-bold whitespace-nowrap transition-all ${
                activeTab === "clubs"
                  ? "bg-black dark:bg-white text-white dark:text-black shadow-xs scale-[1.02]"
                  : "bg-gray-100 dark:bg-gray-900 text-gray-500 hover:text-black dark:hover:text-white"
              }`}
            >
              Todos os Grupos ({clubs.length})
            </button>
            <button
              onClick={() => setActiveTab("my_clubs")}
              className={`px-4 py-1.5 rounded-xl font-bold whitespace-nowrap transition-all ${
                activeTab === "my_clubs"
                  ? "bg-black dark:bg-white text-white dark:text-black shadow-xs scale-[1.02]"
                  : "bg-gray-100 dark:bg-gray-900 text-gray-500 hover:text-black dark:hover:text-white"
              }`}
            >
              Os Meus Grupos ({myClubs.length})
            </button>
            <button
              onClick={() => setActiveTab("discussions")}
              className={`px-4 py-1.5 rounded-xl font-bold whitespace-nowrap transition-all ${
                activeTab === "discussions"
                  ? "bg-black dark:bg-white text-white dark:text-black shadow-xs scale-[1.02]"
                  : "bg-gray-100 dark:bg-gray-900 text-gray-500 hover:text-black dark:hover:text-white"
              }`}
            >
              Fórum & Discussões
            </button>
          </div>
        </div>
      </header>

      {/* Conteúdo Principal */}
      <main className="flex-1 p-3 sm:p-6 app-container">
        
        {/* ─── Supergrupo Oficial: Chat Geral da Comunidade (Pinned no Topo) ─── */}
        <div
          onClick={() => navigate("/club/geral")}
          className="p-4 sm:p-5 rounded-3xl bg-gradient-to-r from-blue-600 via-indigo-600 to-sky-600 text-white shadow-md cursor-pointer transition-all active:scale-[0.99] flex items-center justify-between gap-3.5 mb-5 hover:opacity-95"
        >
          <div className="flex items-center gap-3.5 min-w-0">
            <div className="w-13 h-13 rounded-full bg-white/20 backdrop-blur-md flex items-center justify-center shrink-0 shadow-xs border border-white/30">
              <MessageSquare className="w-6 h-6 text-white" />
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2 flex-wrap">
                <h3 className="font-bold text-sm sm:text-base leading-tight truncate">
                  Chat Geral da Comunidade
                </h3>
                <span className="px-2 py-0.5 rounded-full text-[9px] font-extrabold bg-white/25 uppercase tracking-wider">
                  Supergrupo Oficial
                </span>
              </div>
              <p className="text-xs text-white/80 mt-0.5 line-clamp-1 leading-relaxed">
                Canal aberto para todos os leitores • Voz, imagens e mensagens ao vivo
              </p>
              <span className="text-[11px] text-white/70 font-medium flex items-center gap-1 mt-1">
                <Users className="w-3.5 h-3.5" />
                <span>Todos os utilizadores do Kuwerenga</span>
              </span>
            </div>
          </div>

          <div className="flex items-center gap-1 shrink-0">
            <button className="px-3.5 sm:px-4 py-2 rounded-xl bg-white text-black text-xs font-bold whitespace-nowrap shadow-xs hover:bg-gray-100 transition-colors">
              Abrir
            </button>
          </div>
        </div>

        {/* ─── ABA 1 & ABA 2: Listagem de Grupos Estilo Telegram ─── */}
        {(activeTab === "clubs" || activeTab === "my_clubs") && (
          <section>
            {loading && clubs.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-20 gap-3">
                <div className="w-8 h-8 border-2 border-black dark:border-white border-t-transparent rounded-full animate-spin"></div>
                <p className="text-xs text-gray-400">A carregar canais e grupos da comunidade...</p>
              </div>
            ) : filteredClubs.length === 0 ? (
              <div className="bg-white dark:bg-gray-900 rounded-3xl p-8 border border-gray-100 dark:border-gray-800 text-center my-4 shadow-xs">
                <div className="w-14 h-14 bg-gray-100 dark:bg-gray-800 text-gray-400 rounded-2xl flex items-center justify-center mx-auto mb-4">
                  <Users className="w-7 h-7" />
                </div>
                <h3 className="font-bold text-base mb-1">
                  {searchQuery ? "Nenhum grupo encontrado" : "Nenhum grupo criado ainda"}
                </h3>
                <p className="text-xs text-gray-500 mb-6 max-w-xs mx-auto leading-relaxed">
                  {searchQuery
                    ? "Tenta pesquisar por outro termo ou nome de comunidade."
                    : activeTab === "my_clubs"
                    ? "Ainda não participas em nenhum clube. Explora a lista de grupos para participar!"
                    : "Sê o primeiro a criar um clube de leitura para debater obras com a comunidade!"}
                </p>
                <button
                  onClick={() => setShowCreateModal(true)}
                  className="px-5 py-3 bg-black dark:bg-white text-white dark:text-black rounded-xl text-xs font-bold shadow-xs active:scale-95 transition-transform"
                >
                  Criar Novo Grupo
                </button>
              </div>
            ) : (
              <div className="bg-white dark:bg-gray-900 rounded-3xl border border-gray-100 dark:border-gray-800 shadow-xs divide-y divide-gray-100 dark:divide-gray-800/80 overflow-hidden">
                {filteredClubs.map((club) => {
                  const palette = getCommunityColorPalette(club.name);
                  const initials = getCommunityInitials(club.name);
                  const isAdminOfClub = isClubAdmin(club);

                  return (
                    <div
                      key={club.id}
                      onClick={() => navigate(`/club/${club.id}`)}
                      className="p-3.5 sm:p-4 hover:bg-gray-50 dark:hover:bg-gray-800/60 transition-colors cursor-pointer flex items-center gap-3.5 group select-none"
                    >
                      {/* 1. Foto de Perfil do Grupo (Avatar Redondo ou Padrão Sólido Telegram) */}
                      <div className="relative shrink-0">
                        <div
                          className={`w-13 h-13 rounded-full overflow-hidden flex items-center justify-center shadow-xs transition-transform group-hover:scale-105 ${
                            club.avatar_url
                              ? "bg-gray-100 dark:bg-gray-800"
                              : `bg-gradient-to-tr ${palette.gradient}`
                          }`}
                        >
                          {club.avatar_url ? (
                            <img
                              src={club.avatar_url}
                              alt={club.name}
                              className="w-full h-full object-cover"
                            />
                          ) : (
                            <span className="font-bold text-white text-base tracking-wider">
                              {initials}
                            </span>
                          )}
                        </div>

                        {/* Indicador de Tipo de Grupo (Público / Privado) */}
                        <div className="absolute -bottom-0.5 -right-0.5 w-5 h-5 rounded-full bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 flex items-center justify-center">
                          {club.is_public !== false ? (
                            <Globe className="w-2.5 h-2.5 text-gray-500 dark:text-gray-400" />
                          ) : (
                            <Lock className="w-2.5 h-2.5 text-amber-500" />
                          )}
                        </div>
                      </div>

                      {/* 2. Informações Centrais da Comunidade */}
                      <div className="flex-1 min-w-0 py-0.5">
                        <div className="flex items-center gap-2 mb-0.5">
                          <h3 className="font-bold text-sm sm:text-base leading-tight group-hover:underline truncate text-black dark:text-white">
                            {club.name}
                          </h3>

                          {isAdminOfClub && (
                            <span className="shrink-0 px-2 py-0.5 rounded-full text-[9px] font-bold bg-black dark:bg-white text-white dark:text-black">
                              Admin
                            </span>
                          )}

                          {club.is_member && !isAdminOfClub && (
                            <span className="shrink-0 px-2 py-0.5 rounded-full text-[9px] font-bold bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300">
                              Membro
                            </span>
                          )}
                        </div>

                        {/* Descrição / Meta do Grupo */}
                        <p className="text-xs sm:text-[13px] text-gray-500 dark:text-gray-400 line-clamp-1 leading-snug">
                          {club.description || club.current_goal || "Comunidade de leitura aberta para partilha e debates."}
                        </p>

                        {/* Contagem de Pessoas no Grupo */}
                        <div className="flex items-center gap-3 mt-1 text-[11px] text-gray-400 dark:text-gray-500 font-medium">
                          <span className="flex items-center gap-1">
                            <Users className="w-3.5 h-3.5 shrink-0" />
                            <span>
                              {club.member_count} {club.member_count === 1 ? "pessoa" : "pessoas"}
                            </span>
                          </span>

                          {club.current_goal && (
                            <span className="hidden sm:inline-block truncate max-w-[240px] text-gray-400">
                              • Meta: {club.current_goal}
                            </span>
                          )}
                        </div>
                      </div>

                      {/* 3. Ações no Lado Direito */}
                      <div
                        className="flex items-center gap-1.5 shrink-0"
                        onClick={(e) => e.stopPropagation()}
                      >
                        {/* Botão de Edição de Foto e Fundo para Administrador */}
                        {isAdminOfClub && (
                          <button
                            type="button"
                            onClick={() =>
                              setEditingClub({
                                id: club.id,
                                name: club.name,
                                description: club.description,
                                current_goal: club.current_goal,
                                avatar_url: club.avatar_url,
                                cover_url: club.cover_url,
                                is_public: club.is_public !== false,
                              })
                            }
                            className="p-2 rounded-xl text-gray-400 hover:text-black dark:hover:text-white hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
                            title="Editar foto, fundo e detalhes do grupo"
                            aria-label="Editar comunidade"
                          >
                            <Settings className="w-4 h-4" />
                          </button>
                        )}

                        {/* Botão Entrar / Participar */}
                        {club.is_member ? (
                          <button
                            type="button"
                            onClick={() => navigate(`/club/${club.id}`)}
                            className="px-3.5 py-1.5 rounded-xl text-xs font-bold bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 text-black dark:text-white transition-all flex items-center gap-1 shadow-xs"
                          >
                            <span>Abrir</span>
                            <ChevronRight className="w-3.5 h-3.5" />
                          </button>
                        ) : (
                          <button
                            type="button"
                            onClick={() => {
                              if (club.is_public === false) {
                                navigate(`/club/${club.id}`);
                              } else {
                                handleToggleJoinClub(club.id, false);
                              }
                            }}
                            className="px-3.5 py-1.5 rounded-xl text-xs font-bold bg-black dark:bg-white text-white dark:text-black shadow-xs active:scale-95 transition-transform"
                          >
                            {club.is_public !== false ? "Entrar" : "Pedir Acesso"}
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </section>
        )}

        {/* ─── ABA 3: Discussões e Fórum ─── */}
        {activeTab === "discussions" && (
          <section className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-bold text-gray-500 uppercase tracking-wider">
                Tópicos do Fórum Literário
              </h2>
              <button
                onClick={() => {
                  if (isGuestMode()) {
                    setShowGuestRestriction(true);
                  } else {
                    setShowNewDiscussionModal(true);
                  }
                }}
                className="flex items-center gap-1.5 px-3.5 py-1.5 bg-black dark:bg-white text-white dark:text-black rounded-full text-xs font-bold shadow-xs active:scale-95 transition-transform"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Novo Tópico</span>
              </button>
            </div>

            {discussions.length === 0 ? (
              <div className="bg-white dark:bg-gray-900 rounded-3xl p-8 border border-gray-100 dark:border-gray-800 text-center my-4 shadow-xs">
                <MessageSquare className="w-10 h-10 text-gray-400 mx-auto mb-3" />
                <h3 className="font-bold text-base mb-1">Nenhum tópico publicado</h3>
                <p className="text-xs text-gray-500 mb-4 max-w-xs mx-auto leading-relaxed">
                  Inicia uma nova conversa sobre autores, livros favoritos ou reflexões literárias!
                </p>
                <button
                  onClick={() => setShowNewDiscussionModal(true)}
                  className="px-5 py-2.5 bg-black dark:bg-white text-white dark:text-black rounded-xl text-xs font-bold"
                >
                  Criar Primeiro Tópico
                </button>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
                {discussions.map((disc) => (
                  <div
                    key={disc.id}
                    className="p-5 rounded-2xl border border-gray-100 dark:border-gray-800 bg-white dark:bg-gray-900 shadow-xs flex flex-col justify-between"
                  >
                    <div>
                      <h3 className="font-bold text-base leading-snug mb-2">{disc.title}</h3>
                      <p className="text-xs text-gray-600 dark:text-gray-400 leading-relaxed whitespace-pre-wrap line-clamp-3">
                        {disc.content}
                      </p>
                    </div>

                    <div className="flex items-center justify-between pt-3 mt-3 border-t border-gray-100 dark:border-gray-800 text-[11px] text-gray-400">
                      <span>Por: {disc.profile?.full_name || "Membro da Comunidade"}</span>
                      <span>
                        {new Date(disc.created_at).toLocaleDateString("pt-PT", {
                          day: "2-digit",
                          month: "short",
                        })}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>
        )}
      </main>

      {/* ─── Modal de Criação de Clube (com Foto e Fundo opcionais) ─── */}
      {showCreateModal && (
        <div
          onClick={() => setShowCreateModal(false)}
          className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-200"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-lg bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh] text-black dark:text-white animate-in zoom-in-95 duration-200"
          >
            <div className="px-5 py-4 border-b border-gray-100 dark:border-gray-800 flex items-center justify-between shrink-0">
              <h2 className="font-bold text-base">Criar Novo Grupo</h2>
              <button
                onClick={() => setShowCreateModal(false)}
                className="p-2 rounded-xl text-gray-500 hover:text-black dark:hover:text-white hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateClub} className="overflow-y-auto flex-1 p-5 space-y-5">
              {/* Pré-visualização da Aparência (Foto e Fundo Sólido Padrão) */}
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-gray-500 mb-2">
                  Aparência do Grupo (Foto e Fundo)
                </label>

                <div className="relative rounded-2xl overflow-hidden border border-gray-200 dark:border-gray-800 shadow-xs">
                  {/* Fundo */}
                  <div
                    className={`w-full h-28 relative flex items-center justify-end p-3 ${
                      createCoverPreview
                        ? "bg-black"
                        : `bg-gradient-to-r ${getCommunityColorPalette(clubName || "Novo Grupo").coverGradient}`
                    }`}
                  >
                    {createCoverPreview ? (
                      <img
                        src={createCoverPreview}
                        alt="Fundo"
                        className="absolute inset-0 w-full h-full object-cover"
                      />
                    ) : (
                      <span className="text-[10px] uppercase font-bold tracking-widest text-white/40">
                        Fundo Sólido Padrão
                      </span>
                    )}

                    <button
                      type="button"
                      onClick={() => createCoverInputRef.current?.click()}
                      className="relative z-10 flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-black/60 hover:bg-black text-white backdrop-blur-md text-xs font-semibold"
                    >
                      <ImageIcon className="w-3.5 h-3.5" />
                      <span>{createCoverPreview ? "Alterar Fundo" : "Adicionar Fundo"}</span>
                    </button>
                    <input
                      ref={createCoverInputRef}
                      type="file"
                      accept="image/*"
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) {
                          setCreateCoverFile(file);
                          setCreateCoverPreview(URL.createObjectURL(file));
                        }
                      }}
                      className="hidden"
                    />
                  </div>

                  {/* Foto de Perfil */}
                  <div className="px-4 pb-3 pt-0 bg-white dark:bg-gray-900 flex items-end justify-between -mt-8 relative z-10">
                    <div className="flex items-end gap-3">
                      <div
                        className={`w-16 h-16 rounded-full ring-4 ring-white dark:ring-gray-900 shadow-md overflow-hidden flex items-center justify-center relative group cursor-pointer ${
                          createAvatarPreview
                            ? "bg-black"
                            : `bg-gradient-to-tr ${getCommunityColorPalette(clubName || "Novo Grupo").gradient}`
                        }`}
                        onClick={() => createAvatarInputRef.current?.click()}
                      >
                        {createAvatarPreview ? (
                          <img
                            src={createAvatarPreview}
                            alt="Foto"
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          <span className="text-lg font-bold text-white">
                            {getCommunityInitials(clubName || "Novo Grupo")}
                          </span>
                        )}
                        <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center text-white transition-opacity">
                          <Camera className="w-4 h-4" />
                        </div>
                      </div>

                      <div className="pb-1">
                        <span className="text-xs font-bold block truncate max-w-[180px]">
                          {clubName || "Nome do Grupo"}
                        </span>
                        <span className="text-[10px] text-gray-400">
                          {createAvatarPreview ? "Foto personalizada" : "Vem com imagem sólida padrão"}
                        </span>
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={() => createAvatarInputRef.current?.click()}
                      className="px-3 py-1.5 rounded-xl border border-gray-200 dark:border-gray-800 text-xs font-semibold hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors mb-1"
                    >
                      Foto do Grupo
                    </button>
                    <input
                      ref={createAvatarInputRef}
                      type="file"
                      accept="image/*"
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) {
                          setCreateAvatarFile(file);
                          setCreateAvatarPreview(URL.createObjectURL(file));
                        }
                      }}
                      className="hidden"
                    />
                  </div>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-gray-500 mb-2">
                  Nome do Grupo *
                </label>
                <input
                  type="text"
                  value={clubName}
                  onChange={(e) => setClubName(e.target.value)}
                  placeholder="Ex: Leitores de Ficção & Fantasia"
                  className="w-full px-4 py-3 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-black dark:focus:ring-white transition-all"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-gray-500 mb-2">
                  Descrição
                </label>
                <textarea
                  rows={2}
                  value={clubDesc}
                  onChange={(e) => setClubDesc(e.target.value)}
                  placeholder="Qual é o foco das leituras e debates deste grupo?"
                  className="w-full p-3 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl text-sm font-medium focus:outline-none focus:ring-2 focus:ring-black dark:focus:ring-white transition-all resize-none"
                />
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-gray-500 mb-2">
                  Meta ou Livro Atual
                </label>
                <input
                  type="text"
                  value={clubGoal}
                  onChange={(e) => setClubGoal(e.target.value)}
                  placeholder="Ex: Ler os primeiros 5 capítulos esta semana"
                  className="w-full px-4 py-3 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl text-sm font-medium focus:outline-none focus:ring-2 focus:ring-black dark:focus:ring-white transition-all"
                />
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-gray-500 mb-2">
                  Privacidade
                </label>
                <div className="grid grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() => setClubIsPublic(true)}
                    className={`p-3 rounded-2xl border text-left flex items-start gap-2.5 transition-all ${
                      clubIsPublic
                        ? "border-black dark:border-white bg-black/5 dark:bg-white/10"
                        : "border-gray-200 dark:border-gray-800"
                    }`}
                  >
                    <Globe className="w-4 h-4 text-black dark:text-white shrink-0 mt-0.5" />
                    <div>
                      <span className="font-bold text-xs block">Público</span>
                      <span className="text-[10px] text-gray-400">Qualquer leitor pode entrar</span>
                    </div>
                  </button>

                  <button
                    type="button"
                    onClick={() => setClubIsPublic(false)}
                    className={`p-3 rounded-2xl border text-left flex items-start gap-2.5 transition-all ${
                      !clubIsPublic
                        ? "border-black dark:border-white bg-black/5 dark:bg-white/10"
                        : "border-gray-200 dark:border-gray-800"
                    }`}
                  >
                    <Lock className="w-4 h-4 text-black dark:text-white shrink-0 mt-0.5" />
                    <div>
                      <span className="font-bold text-xs block">Privado</span>
                      <span className="text-[10px] text-gray-400">Requer aprovação</span>
                    </div>
                  </button>
                </div>
              </div>

              <div className="pt-2 flex justify-end gap-2.5">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="px-4 py-2.5 rounded-xl border border-gray-200 dark:border-gray-800 text-xs font-semibold"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={submittingClub || !clubName.trim()}
                  className="px-6 py-2.5 rounded-xl bg-black dark:bg-white text-white dark:text-black text-xs font-bold shadow-md active:scale-95 transition-transform disabled:opacity-50"
                >
                  {submittingClub ? "A criar..." : "Criar Grupo"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ─── Modal de Edição de Comunidade ─── */}
      {editingClub && (
        <EditCommunityModal
          isOpen={Boolean(editingClub)}
          onClose={() => setEditingClub(null)}
          club={editingClub}
          onSaved={handleClubSaved}
        />
      )}

      {/* ─── Modal de Nova Discussão ─── */}
      {showNewDiscussionModal && (
        <div
          onClick={() => setShowNewDiscussionModal(false)}
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-200"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-lg bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-3xl p-6 shadow-2xl text-black dark:text-white animate-in zoom-in-95 duration-200"
          >
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-bold text-base">Novo Tópico de Discussão</h2>
              <button
                onClick={() => setShowNewDiscussionModal(false)}
                className="p-1 rounded-full text-gray-500 hover:text-black dark:hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateDiscussion} className="space-y-4">
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-gray-500 mb-1">
                  Título do Tópico *
                </label>
                <input
                  type="text"
                  value={discussionTitle}
                  onChange={(e) => setDiscussionTitle(e.target.value)}
                  placeholder="Ex: O que acharam do final do capítulo 4?"
                  className="w-full px-4 py-3 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-black dark:focus:ring-white transition-all"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-gray-500 mb-1">
                  Conteúdo da Discussão *
                </label>
                <textarea
                  rows={4}
                  value={discussionContent}
                  onChange={(e) => setDiscussionContent(e.target.value)}
                  placeholder="Partilha a tua perspetiva ou coloca uma questão à comunidade..."
                  className="w-full p-4 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl text-sm font-medium focus:outline-none focus:ring-2 focus:ring-black dark:focus:ring-white transition-all resize-none"
                  required
                />
              </div>

              <div className="pt-2 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowNewDiscussionModal(false)}
                  className="px-4 py-2.5 rounded-xl border border-gray-200 dark:border-gray-800 text-xs font-semibold"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={submittingDiscussion || !discussionTitle.trim() || !discussionContent.trim()}
                  className="px-5 py-2.5 rounded-xl bg-black dark:bg-white text-white dark:text-black text-xs font-bold shadow-md active:scale-95 transition-transform disabled:opacity-50"
                >
                  {submittingDiscussion ? "A publicar..." : "Publicar Tópico"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal de Restrição para Convidados */}
      <GuestRestrictionModal
        isOpen={showGuestRestriction}
        feature="community"
        onClose={() => setShowGuestRestriction(false)}
      />

      {/* Navegação Inferior */}
      <BottomNav />
    </div>
  );
}
