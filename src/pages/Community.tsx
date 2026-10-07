import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import {
  Users,
  Plus,
  MessageSquare,
  BookOpen,
  Check,
  X,
  UserPlus
} from "lucide-react";
import BottomNav from "../components/BottomNav";
import { supabase } from "../lib/supabase";
import { getCached, setCached } from "../lib/cache";

interface Club {
  id: string;
  name: string;
  description: string | null;
  cover_url: string | null;
  current_goal: string | null;
  member_count: number;
  created_by: string;
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

  // Estados do Modal: Criar Clube
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [clubName, setClubName] = useState("");
  const [clubDesc, setClubDesc] = useState("");
  const [clubGoal, setClubGoal] = useState("");
  const [submittingClub, setSubmittingClub] = useState(false);

  // Estados do Modal: Nova Discussão
  const [showNewDiscussionModal, setShowNewDiscussionModal] = useState(false);
  const [discussionTitle, setDiscussionTitle] = useState("");
  const [discussionContent, setDiscussionContent] = useState("");
  const [submittingDiscussion, setSubmittingDiscussion] = useState(false);

  const [currentUserId, setCurrentUserId] = useState<string | null>(null);

  // 1. Carregar Clubes e Discussões Reais do Supabase
  useEffect(() => {
    async function loadCommunityData() {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (user) setCurrentUserId(user.id);

        // Clubes públicos
        const { data: clubsData } = await supabase
          .from("clubs")
          .select("id, name, description, cover_url, current_goal, member_count, created_by")
          .order("member_count", { ascending: false });

        // Membrzias do utilizador
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

        setClubs(
          clubs.map((c) =>
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

        setClubs(
          clubs.map((c) =>
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

  // Criar Clube Real
  const handleCreateClub = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!clubName.trim() || !currentUserId) return;

    setSubmittingClub(true);
    try {
      const { data: newClub, error } = await supabase
        .from("clubs")
        .insert({
          name: clubName.trim(),
          description: clubDesc.trim() || null,
          current_goal: clubGoal.trim() || null,
          created_by: currentUserId,
          member_count: 1,
          is_public: true,
        })
        .select()
        .single();

      if (error) throw error;

      if (newClub) {
        // Regista o criador como admin
        await supabase.from("club_members").insert({
          club_id: newClub.id,
          user_id: currentUserId,
          role: "admin",
        });

        const created: Club = {
          ...newClub,
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

  const myClubs = clubs.filter((c) => myClubIds.includes(c.id));

  return (
    <div className="flex flex-col min-h-screen bg-gray-50 dark:bg-black text-black dark:text-white pb-24">
      {/* Header */}
      <header className="px-4 sm:px-6 pt-safe sticky top-0 z-10 bg-white dark:bg-black border-b border-gray-100 dark:border-gray-900">
        <div className="app-container pt-6 sm:pt-8 pb-2">
        <div className="flex items-center justify-between mb-4">
          <h1 className="text-2xl font-bold">Comunidade</h1>
          <button
            onClick={() => setShowCreateModal(true)}
            className="flex items-center gap-1.5 px-3.5 py-1.5 bg-black dark:bg-white text-white dark:text-black rounded-full text-xs font-semibold active:scale-95 transition-transform shadow-xs"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Criar Clube</span>
          </button>
        </div>

        {/* Abas */}
        <div className="flex gap-2 pb-2 text-xs">
          <button
            onClick={() => setActiveTab("clubs")}
            className={`px-4 py-2 rounded-xl font-semibold transition-all ${
              activeTab === "clubs"
                ? "bg-black dark:bg-white text-white dark:text-black shadow-xs"
                : "bg-gray-100 dark:bg-gray-900 text-gray-500 hover:text-black dark:hover:text-white"
            }`}
          >
            Clubes de Leitura
          </button>
          <button
            onClick={() => setActiveTab("my_clubs")}
            className={`px-4 py-2 rounded-xl font-semibold transition-all ${
              activeTab === "my_clubs"
                ? "bg-black dark:bg-white text-white dark:text-black shadow-xs"
                : "bg-gray-100 dark:bg-gray-900 text-gray-500 hover:text-black dark:hover:text-white"
            }`}
          >
            Os Meus Clubes ({myClubs.length})
          </button>
          <button
            onClick={() => setActiveTab("discussions")}
            className={`px-4 py-2 rounded-xl font-semibold transition-all ${
              activeTab === "discussions"
                ? "bg-black dark:bg-white text-white dark:text-black shadow-xs"
                : "bg-gray-100 dark:bg-gray-900 text-gray-500 hover:text-black dark:hover:text-white"
            }`}
          >
            Discussões
          </button>
        </div>
        </div>
      </header>

      {/* Conteúdo Principal */}
      <main className="flex-1 p-4 sm:p-6 app-container">
        {/* Banner do Chat Geral da Comunidade */}
        <div
          onClick={() => navigate("/club/geral")}
          className="p-5 rounded-3xl bg-black dark:bg-white text-white dark:text-black shadow-md cursor-pointer transition-all active:scale-[0.99] flex items-center justify-between gap-4 mb-6 hover:opacity-95"
        >
          <div className="flex items-center gap-3.5">
            <div className="w-12 h-12 rounded-2xl bg-white/10 dark:bg-black/10 flex items-center justify-center flex-shrink-0">
              <MessageSquare className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-bold text-sm sm:text-base leading-tight">Chat Geral da Comunidade</h3>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-white/20 dark:bg-black/20 uppercase tracking-wider">Aberto</span>
              </div>
              <p className="text-xs opacity-75 mt-0.5 line-clamp-1">
                Conversa livre com chat em direto: texto, fotos e notas de voz de até 30s
              </p>
            </div>
          </div>
          <button className="px-4 py-2 rounded-xl bg-white text-black dark:bg-black dark:text-white text-xs font-bold whitespace-nowrap shadow-xs">
            Abrir Chat
          </button>
        </div>

        {/* ABA 1: Todos os Clubes */}
        {activeTab === "clubs" && (
          <section className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {loading && clubs.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-20 gap-3">
                <div className="w-8 h-8 border-2 border-black dark:border-white border-t-transparent rounded-full animate-spin"></div>
                <p className="text-xs text-gray-400">A carregar clubes da comunidade...</p>
              </div>
            ) : clubs.length === 0 ? (
              <div className="bg-white dark:bg-gray-900 rounded-3xl p-8 border border-gray-100 dark:border-gray-800 text-center my-6">
                <div className="w-14 h-14 bg-gray-100 dark:bg-gray-800 text-gray-400 rounded-2xl flex items-center justify-center mx-auto mb-4">
                  <Users className="w-7 h-7" />
                </div>
                <h3 className="font-bold text-base mb-1">Nenhum clube criado ainda</h3>
                <p className="text-xs text-gray-500 mb-6 max-w-xs mx-auto">
                  Sê o pioneiro e cria o primeiro clube de leitura para debater obras com outros leitores!
                </p>
                <button
                  onClick={() => setShowCreateModal(true)}
                  className="px-5 py-3 bg-black dark:bg-white text-white dark:text-black rounded-xl text-xs font-semibold"
                >
                  Criar o Primeiro Clube
                </button>
              </div>
            ) : (
              clubs.map((club) => (
                <div
                  key={club.id}
                  onClick={() => navigate(`/club/${club.id}`)}
                  className="p-5 rounded-2xl border border-gray-100 dark:border-gray-800 bg-white dark:bg-gray-900/60 shadow-xs flex flex-col justify-between gap-4 cursor-pointer hover:border-black/30 dark:hover:border-white/30 transition-all group"
                >
                  <div>
                    <div className="flex items-center justify-between mb-1.5">
                      <h3 className="font-bold text-base leading-tight group-hover:underline">{club.name}</h3>
                      <span className="text-[11px] text-gray-400 font-medium flex items-center gap-1">
                        <Users className="w-3.5 h-3.5" />
                        {club.member_count} {club.member_count === 1 ? "membro" : "membros"}
                      </span>
                    </div>

                    {club.description && (
                      <p className="text-xs text-gray-600 dark:text-gray-400 leading-relaxed mb-3">
                        {club.description}
                      </p>
                    )}

                    {club.current_goal && (
                      <div className="p-2.5 rounded-xl bg-gray-50 dark:bg-gray-800/60 border border-gray-100 dark:border-gray-800 flex items-center gap-2 text-xs">
                        <BookOpen className="w-4 h-4 text-gray-500 flex-shrink-0" />
                        <span className="text-gray-500 truncate">
                          Leitura atual: <strong className="text-black dark:text-white">{club.current_goal}</strong>
                        </span>
                      </div>
                    )}
                  </div>

                  <div className="flex items-center justify-between pt-2 border-t border-gray-100 dark:border-gray-800">
                    <span className="text-[11px] text-gray-400">
                      {club.is_member ? "Já és membro deste clube" : "Aberto à comunidade"}
                    </span>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          navigate(`/club/${club.id}`);
                        }}
                        className="px-3.5 py-1.5 rounded-xl text-xs font-semibold bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 text-black dark:text-white transition-all flex items-center gap-1.5"
                      >
                        <MessageSquare className="w-3.5 h-3.5" />
                        <span>Entrar no Clube</span>
                      </button>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleToggleJoinClub(club.id, !!club.is_member);
                        }}
                        className={`px-3.5 py-1.5 rounded-xl text-xs font-semibold transition-all active:scale-95 ${
                          club.is_member
                            ? "bg-transparent text-gray-400 hover:text-red-500"
                            : "bg-black dark:bg-white text-white dark:text-black shadow-xs"
                        }`}
                      >
                        {club.is_member ? "Sair" : "Participar"}
                      </button>
                    </div>
                  </div>
                </div>
              ))
            )}
          </section>
        )}

        {/* ABA 2: Os Meus Clubes */}
        {activeTab === "my_clubs" && (
          <section className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {myClubs.length === 0 ? (
              <div className="bg-white dark:bg-gray-900 rounded-3xl p-8 border border-gray-100 dark:border-gray-800 text-center my-6">
                <div className="w-14 h-14 bg-gray-100 dark:bg-gray-800 text-gray-400 rounded-2xl flex items-center justify-center mx-auto mb-4">
                  <UserPlus className="w-7 h-7" />
                </div>
                <h3 className="font-bold text-base mb-1">Ainda não entraste em nenhum clube</h3>
                <p className="text-xs text-gray-500 mb-6 max-w-xs mx-auto">
                  Participa nos clubes existentes ou cria o teu próprio grupo de leitura.
                </p>
                <button
                  onClick={() => setActiveTab("clubs")}
                  className="px-5 py-2.5 bg-black dark:bg-white text-white dark:text-black rounded-xl text-xs font-semibold mr-2"
                >
                  Explorar Clubes
                </button>
              </div>
            ) : (
              myClubs.map((club) => (
                <div
                  key={club.id}
                  onClick={() => navigate(`/club/${club.id}`)}
                  className="p-5 rounded-2xl border border-gray-100 dark:border-gray-800 bg-white dark:bg-gray-900/60 shadow-xs flex flex-col justify-between gap-4 cursor-pointer hover:border-black/30 dark:hover:border-white/30 transition-all group"
                >
                  <div>
                    <div className="flex items-center justify-between mb-1.5">
                      <h3 className="font-bold text-base leading-tight group-hover:underline">{club.name}</h3>
                      <span className="text-[11px] text-emerald-500 font-medium flex items-center gap-1">
                        <Check className="w-3.5 h-3.5" />
                        Membro
                      </span>
                    </div>

                    <p className="text-xs text-gray-600 dark:text-gray-400 leading-relaxed mb-3">
                      {club.description || "Sem descrição definida."}
                    </p>

                    {club.current_goal && (
                      <div className="p-2.5 rounded-xl bg-gray-50 dark:bg-gray-800/60 border border-gray-100 dark:border-gray-800 flex items-center gap-2 text-xs mb-2">
                        <BookOpen className="w-4 h-4 text-gray-500" />
                        <span className="text-gray-500 truncate">
                          Livro em discussão: <strong className="text-black dark:text-white">{club.current_goal}</strong>
                        </span>
                      </div>
                    )}
                  </div>

                  <div className="flex items-center justify-between pt-2 border-t border-gray-100 dark:border-gray-800">
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        navigate(`/club/${club.id}`);
                      }}
                      className="flex items-center gap-1.5 px-3.5 py-1.5 bg-black dark:bg-white text-white dark:text-black rounded-xl text-xs font-semibold active:scale-95 transition-transform shadow-xs"
                    >
                      <MessageSquare className="w-3.5 h-3.5" />
                      <span>Entrar no Chat & Fórum</span>
                    </button>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleToggleJoinClub(club.id, true);
                      }}
                      className="text-xs text-red-500 hover:underline font-medium"
                    >
                      Sair do Clube
                    </button>
                  </div>
                </div>
              ))
            )}
          </section>
        )}

        {/* ABA 3: Discussões */}
        {activeTab === "discussions" && (
          <section className="space-y-4">
            <div className="flex items-center justify-between mb-2">
              <h2 className="text-sm font-bold uppercase tracking-wider text-gray-400">
                Fórum da Comunidade
              </h2>
              <button
                onClick={() => setShowNewDiscussionModal(true)}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-black dark:bg-white text-white dark:text-black rounded-xl text-xs font-semibold active:scale-95 transition-transform"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Nova Mensagem</span>
              </button>
            </div>

            {discussions.length === 0 ? (
              <div className="bg-white dark:bg-gray-900 rounded-3xl p-8 border border-gray-100 dark:border-gray-800 text-center my-6">
                <div className="w-14 h-14 bg-gray-100 dark:bg-gray-800 text-gray-400 rounded-2xl flex items-center justify-center mx-auto mb-4">
                  <MessageSquare className="w-7 h-7" />
                </div>
                <h3 className="font-bold text-base mb-1">Ainda não há discussões abertas</h3>
                <p className="text-xs text-gray-500 mb-6 max-w-xs mx-auto">
                  Inicia um debate sobre um livro, uma reflexão filosófica ou uma recomendação de leitura.
                </p>
                <button
                  onClick={() => setShowNewDiscussionModal(true)}
                  className="px-5 py-2.5 bg-black dark:bg-white text-white dark:text-black rounded-xl text-xs font-semibold"
                >
                  Iniciar Discussão
                </button>
              </div>
            ) : (
              discussions.map((disc) => (
                <div
                  key={disc.id}
                  className="p-4 rounded-2xl border border-gray-100 dark:border-gray-800 bg-white dark:bg-gray-900/60 shadow-xs"
                >
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-bold">{disc.profile?.full_name || "Leitor"}</span>
                    <span className="text-[10px] text-gray-400">
                      {new Date(disc.created_at).toLocaleDateString("pt-PT")}
                    </span>
                  </div>
                  <h4 className="font-bold text-sm mb-1.5">{disc.title}</h4>
                  <p className="text-xs text-gray-600 dark:text-gray-300 leading-relaxed whitespace-pre-line">
                    {disc.content}
                  </p>
                </div>
              ))
            )}
          </section>
        )}
      </main>

      {/* Modal: Criar Clube */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-3xl max-w-md w-full p-6 shadow-2xl animate-in zoom-in-95 duration-200 text-black dark:text-white">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-bold text-base">Criar Clube de Leitura</h3>
              <button
                onClick={() => setShowCreateModal(false)}
                className="p-1 rounded-full hover:bg-gray-100 dark:hover:bg-gray-800"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateClub} className="space-y-4">
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-gray-500 mb-1.5">
                  Nome do Clube *
                </label>
                <input
                  type="text"
                  value={clubName}
                  onChange={(e) => setClubName(e.target.value)}
                  placeholder="Ex: Leitores de Maputo, Clube de Ficção Científica"
                  className="w-full px-4 py-3 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl text-sm font-medium focus:outline-none focus:ring-2 focus:ring-black dark:focus:ring-white"
                  required
                  autoFocus
                />
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-gray-500 mb-1.5">
                  Descrição ou Objetivo
                </label>
                <textarea
                  rows={3}
                  value={clubDesc}
                  onChange={(e) => setClubDesc(e.target.value)}
                  placeholder="Explica aos leitores o propósito deste clube e que tipo de livros debatem..."
                  className="w-full p-3 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl text-sm font-medium focus:outline-none focus:ring-2 focus:ring-black dark:focus:ring-white resize-none"
                />
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-gray-500 mb-1.5">
                  Livro Atual em Foco (Opcional)
                </label>
                <input
                  type="text"
                  value={clubGoal}
                  onChange={(e) => setClubGoal(e.target.value)}
                  placeholder="Ex: Terra Sonâmbula - Mia Couto"
                  className="w-full px-4 py-3 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl text-sm font-medium focus:outline-none focus:ring-2 focus:ring-black dark:focus:ring-white"
                />
              </div>

              <div className="flex gap-2 justify-end pt-2">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="px-4 py-2.5 text-xs font-semibold text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-xl"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={submittingClub || !clubName.trim()}
                  className="px-5 py-2.5 bg-black dark:bg-white text-white dark:text-black rounded-xl text-xs font-semibold shadow-xs disabled:opacity-50"
                >
                  {submittingClub ? "A criar..." : "Criar Clube"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Nova Discussão */}
      {showNewDiscussionModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-3xl max-w-md w-full p-6 shadow-2xl animate-in zoom-in-95 duration-200 text-black dark:text-white">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-bold text-base">Iniciar Nova Discussão</h3>
              <button
                onClick={() => setShowNewDiscussionModal(false)}
                className="p-1 rounded-full hover:bg-gray-100 dark:hover:bg-gray-800"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateDiscussion} className="space-y-4">
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-gray-500 mb-1.5">
                  Título do Debate *
                </label>
                <input
                  type="text"
                  value={discussionTitle}
                  onChange={(e) => setDiscussionTitle(e.target.value)}
                  placeholder="Ex: O que acharam do final do Capítulo 4?"
                  className="w-full px-4 py-3 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl text-sm font-medium focus:outline-none focus:ring-2 focus:ring-black dark:focus:ring-white"
                  required
                  autoFocus
                />
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-gray-500 mb-1.5">
                  Mensagem / Conteúdo *
                </label>
                <textarea
                  rows={4}
                  value={discussionContent}
                  onChange={(e) => setDiscussionContent(e.target.value)}
                  placeholder="Partilha a tua reflexão, dúvida ou análise sobre a leitura..."
                  className="w-full p-3 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl text-sm font-medium focus:outline-none focus:ring-2 focus:ring-black dark:focus:ring-white resize-none"
                  required
                />
              </div>

              <div className="flex gap-2 justify-end pt-2">
                <button
                  type="button"
                  onClick={() => setShowNewDiscussionModal(false)}
                  className="px-4 py-2.5 text-xs font-semibold text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-xl"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={submittingDiscussion || !discussionTitle.trim() || !discussionContent.trim()}
                  className="px-5 py-2.5 bg-black dark:bg-white text-white dark:text-black rounded-xl text-xs font-semibold shadow-xs disabled:opacity-50"
                >
                  {submittingDiscussion ? "A publicar..." : "Publicar Mensagem"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Bottom Navigation */}
      <BottomNav />
    </div>
  );
}
