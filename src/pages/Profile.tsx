import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import {
  ChevronRight,
  Settings,
  Bookmark,
  AlignLeft,
  Users,
  LogOut,
  Camera,
  MessageCircle,
  X,
  Trash2,
  ArrowRight,
  User as UserLucide
} from "lucide-react";
import BottomNav from "../components/BottomNav";
import { supabase } from "../lib/supabase";
import { isGuestMode, disableGuestMode } from "../lib/guestMode";
import GuestRestrictionModal from "../components/GuestRestrictionModal";
import {
  getAllAnnotationsOffline,
  deleteAnnotationOffline,
  type OfflineAnnotation
} from "../lib/offlineStorage";
import { loadUserBookshelf } from "../lib/bookshelfService";

interface UserClub {
  id: string;
  name: string;
  description: string;
  member_count?: number;
  cover_url?: string;
}

interface EnrichedAnnotation extends OfflineAnnotation {
  bookTitle?: string;
}

export default function Profile() {
  const [userName, setUserName] = useState<string>("Leitor");
  const [userEmail, setUserEmail] = useState<string>("");
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [isGuest, setIsGuest] = useState(false);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);

  // Sub-telas / Modais de detalhe
  const [activeView, setActiveView] = useState<"menu" | "notes" | "bookmarks" | "clubs">("menu");
  const [allNotes, setAllNotes] = useState<EnrichedAnnotation[]>([]);
  const [allBookmarks, setAllBookmarks] = useState<EnrichedAnnotation[]>([]);
  const [userClubs, setUserClubs] = useState<UserClub[]>([]);
  const [loadingData, setLoadingData] = useState(false);

  const [restrictionModal, setRestrictionModal] = useState<{
    isOpen: boolean;
    feature: "notes" | "highlights" | "bookmarks" | "community" | "donate" | "general";
  }>({
    isOpen: false,
    feature: "general"
  });

  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const navigate = useNavigate();

  // ─── 1. Carregar Perfil do Utilizador ───
  useEffect(() => {
    async function loadProfile() {
      if (isGuestMode()) {
        setIsGuest(true);
        setUserName("Leitor Convidado");
        setUserEmail("Sessão temporária no dispositivo");
        const guestAvatar = localStorage.getItem("guest_avatar_url");
        if (guestAvatar) setAvatarUrl(guestAvatar);
        setLoading(false);
        return;
      }

      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;

        setUserEmail(user.email || user.phone || "");

        const { data: profile } = await supabase
          .from("profiles")
          .select("full_name, avatar_url")
          .eq("id", user.id)
          .maybeSingle();

        if (profile) {
          if (profile.full_name) setUserName(profile.full_name);
          if (profile.avatar_url) setAvatarUrl(profile.avatar_url);
        }
      } catch (err) {
        console.error("Erro ao carregar perfil:", err);
      } finally {
        setLoading(false);
      }
    }

    loadProfile();
  }, []);

  // ─── 2. Carregar Anotações e Marcações ───
  const fetchAnnotations = async () => {
    setLoadingData(true);
    try {
      // Mapeamento de títulos de livros conhecidos
      const shelfBooks = await loadUserBookshelf();
      const bookTitleMap = new Map<string, string>();
      shelfBooks.forEach((b) => {
        if (b.bookId) bookTitleMap.set(b.bookId, b.title);
        bookTitleMap.set(b.id, b.title);
      });

      // 1. Obter do IndexedDB local
      let rawList: OfflineAnnotation[] = [];
      try {
        rawList = await getAllAnnotationsOffline();
      } catch (err) {
        console.warn("Erro ao buscar anotações offline:", err);
      }

      // 2. Obter do Supabase se autenticado
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (user) {
          const { data: supaNotes } = await supabase
            .from("annotations")
            .select(`
              id,
              book_id,
              type,
              content,
              selected_text,
              page_number,
              chapter,
              created_at,
              book:books ( id, title )
            `)
            .eq("user_id", user.id)
            .order("created_at", { ascending: false });

          if (supaNotes) {
            supaNotes.forEach((sn: any) => {
              if (sn.book?.title) {
                bookTitleMap.set(sn.book_id, sn.book.title);
              }
              if (!rawList.some((item) => item.id === sn.id)) {
                rawList.push({
                  id: sn.id,
                  bookId: sn.book_id,
                  type: sn.type as any,
                  content: sn.content || "",
                  selectedText: sn.selected_text || "",
                  pageNumber: sn.page_number || 1,
                  chapter: sn.chapter || `Página ${sn.page_number || 1}`,
                  synced: true,
                  createdAt: sn.created_at
                });
              }
            });
          }
        }
      } catch (err) {
        console.warn("Erro ao buscar anotações do Supabase:", err);
      }

      // Enriquecer com títulos de livros
      const enriched: EnrichedAnnotation[] = rawList.map((ann) => ({
        ...ann,
        bookTitle: bookTitleMap.get(ann.bookId) || "Livro na Biblioteca"
      }));

      // Separar em Anotações e Marcações
      const notes = enriched.filter((a) => a.type === "note");
      const marks = enriched.filter((a) => a.type === "highlight" || a.type === "bookmark");

      setAllNotes(notes);
      setAllBookmarks(marks);
    } catch (err) {
      console.error("Erro ao carregar anotações e marcações:", err);
    } finally {
      setLoadingData(false);
    }
  };

  // ─── 3. Carregar Apenas os Clubes em que o Utilizador está Inscrito ───
  const fetchUserClubs = async () => {
    setLoadingData(true);
    if (isGuestMode()) {
      setUserClubs([]);
      setLoadingData(false);
      return;
    }

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const clubsMap = new Map<string, UserClub>();

      // Clubes em que é membro
      const { data: memberships } = await supabase
        .from("club_members")
        .select(`
          club:clubs (
            id,
            name,
            description,
            member_count,
            cover_url
          )
        `)
        .eq("user_id", user.id);

      if (memberships) {
        memberships.forEach((m: any) => {
          if (m.club && m.club.id) {
            clubsMap.set(m.club.id, m.club);
          }
        });
      }

      // Clubes que o utilizador criou
      const { data: createdClubs } = await supabase
        .from("clubs")
        .select("id, name, description, member_count, cover_url")
        .eq("created_by", user.id);

      if (createdClubs) {
        createdClubs.forEach((c: any) => {
          if (c && c.id) {
            clubsMap.set(c.id, c);
          }
        });
      }

      setUserClubs(Array.from(clubsMap.values()));
    } catch (err) {
      console.error("Erro ao carregar clubes do utilizador:", err);
    } finally {
      setLoadingData(false);
    }
  };

  // ─── 4. Edição de Avatar (Foto de Perfil) ───
  const handleAvatarFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      alert("Por favor seleciona um ficheiro de imagem válido.");
      return;
    }

    setUploadingAvatar(true);
    try {
      // Converte imagem para base64 com compressão rápida
      const reader = new FileReader();
      reader.onload = async (event) => {
        const base64Data = event.target?.result as string;
        setAvatarUrl(base64Data);

        if (isGuestMode()) {
          localStorage.setItem("guest_avatar_url", base64Data);
          setUploadingAvatar(false);
          return;
        }

        const { data: { user } } = await supabase.auth.getUser();
        if (user) {
          // Atualiza na base de dados
          await supabase
            .from("profiles")
            .update({ avatar_url: base64Data, updated_at: new Date().toISOString() })
            .eq("id", user.id);
        }
        setUploadingAvatar(false);
      };
      reader.readAsDataURL(file);
    } catch (err) {
      console.error("Erro ao atualizar avatar:", err);
      setUploadingAvatar(false);
    }
  };

  // ─── 5. Eliminar Anotação ou Marcação ───
  const handleDeleteAnnotation = async (e: React.MouseEvent, id: string, type: "note" | "bookmark") => {
    e.stopPropagation();
    try {
      await deleteAnnotationOffline(id);

      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        await supabase.from("annotations").delete().eq("id", id).eq("user_id", user.id);
      }

      if (type === "note") {
        setAllNotes((prev) => prev.filter((n) => n.id !== id));
      } else {
        setAllBookmarks((prev) => prev.filter((b) => b.id !== id));
      }
    } catch (err) {
      console.error("Erro ao eliminar anotação:", err);
    }
  };

  // Terminar Sessão
  const handleLogout = async () => {
    try {
      if (isGuest) {
        disableGuestMode();
        navigate("/", { replace: true });
        return;
      }
      await supabase.auth.signOut();
      disableGuestMode();
      navigate("/", { replace: true });
    } catch (err) {
      console.error("Erro ao terminar sessão:", err);
    }
  };

  return (
    <div className="flex flex-col min-h-screen bg-gray-50 dark:bg-black text-black dark:text-white pb-24 md:pb-12 md:pt-16">
      
      {/* ─── Top Bar do Perfil ─── */}
      <header className="px-4 sm:px-6 pt-safe bg-white dark:bg-black border-b border-gray-100 dark:border-gray-900">
        <div className="app-container pt-6 sm:pt-8 pb-5 flex items-center justify-between">
          <div className="flex items-center gap-4">
            
            {/* Foto de Perfil com Botão de Edição */}
            <div className="relative group shrink-0">
              <div className="w-18 h-18 sm:w-20 sm:h-20 bg-gray-100 dark:bg-gray-800 rounded-full flex items-center justify-center overflow-hidden border border-gray-200 dark:border-gray-700 shadow-xs relative">
                {avatarUrl ? (
                  <img
                    src={avatarUrl}
                    alt={userName}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <UserLucide className="w-8 h-8 text-gray-400" />
                )}

                {uploadingAvatar && (
                  <div className="absolute inset-0 bg-black/60 flex items-center justify-center">
                    <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  </div>
                )}
              </div>

              {/* Botão de Alteração de Foto */}
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="absolute bottom-0 right-0 w-7 h-7 bg-black dark:bg-white text-white dark:text-black rounded-full flex items-center justify-center border-2 border-white dark:border-black shadow-xs hover:scale-105 active:scale-95 transition-all"
                title="Alterar foto de perfil"
              >
                <Camera className="w-3.5 h-3.5 stroke-[2]" />
              </button>

              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                onChange={handleAvatarFileChange}
                className="hidden"
              />
            </div>

            {/* Informações do Utilizador */}
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <h1 className="text-lg sm:text-xl font-bold truncate">
                  {loading ? "A carregar..." : userName}
                </h1>
                {isGuest && (
                  <span className="px-2 py-0.5 rounded-full bg-gray-100 dark:bg-gray-800 text-black dark:text-white text-[10px] font-bold uppercase tracking-wider border border-gray-200 dark:border-gray-700">
                    Convidado
                  </span>
                )}
              </div>
              <p className="text-xs text-gray-500 truncate mt-0.5">
                {userEmail || "Leitor Kuwerenga"}
              </p>
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="text-[11px] text-gray-500 hover:text-black dark:hover:text-white underline font-semibold mt-1 block"
              >
                Mudar foto
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* ─── Banner Convidado ─── */}
      {isGuest && (
        <div className="px-4 sm:px-6 py-3 bg-white dark:bg-black border-b border-gray-100 dark:border-gray-900">
          <div className="app-container">
            <div className="p-4 rounded-2xl bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-800 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
              <div>
                <span className="text-[10px] font-bold uppercase tracking-wider text-gray-500 block mb-1">
                  Modo Convidado Ativo
                </span>
                <p className="text-xs text-gray-600 dark:text-gray-300 max-w-md leading-relaxed">
                  Cria uma conta para sincronizar as tuas anotações, destaques e participar nos clubes de leitura com outros leitores.
                </p>
              </div>
              <button
                onClick={() => navigate("/login")}
                className="px-4 py-2 bg-black dark:bg-white text-white dark:text-black rounded-xl text-xs font-bold active:scale-95 transition-all shadow-xs flex items-center gap-1.5 shrink-0"
              >
                <span>Criar Conta</span>
                <ArrowRight className="w-3.5 h-3.5 stroke-[2.5]" />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ─── Menu Principal do Perfil ─── */}
      <main className="flex-1 py-4 app-container">
        <div className="bg-white dark:bg-black border border-gray-200 dark:border-gray-800 rounded-2xl overflow-hidden shadow-xs">
          
          {/* Botão: Anotações */}
          <button
            onClick={() => {
              if (isGuest) {
                setRestrictionModal({ isOpen: true, feature: "notes" });
                return;
              }
              fetchAnnotations();
              setActiveView("notes");
            }}
            className="w-full px-5 py-4 flex items-center justify-between border-b border-gray-100 dark:border-gray-900 hover:bg-gray-50 dark:hover:bg-gray-900 transition-colors"
          >
            <div className="flex items-center gap-3.5">
              <AlignLeft className="w-5 h-5 text-gray-500" />
              <div className="text-left">
                <span className="font-semibold text-xs sm:text-sm block">Anotações</span>
                <span className="text-[11px] text-gray-400">Ver notas salvas por página dos livros</span>
              </div>
            </div>
            <ChevronRight className="w-4 h-4 text-gray-300 dark:text-gray-700" />
          </button>

          {/* Botão: Marcações */}
          <button
            onClick={() => {
              if (isGuest) {
                setRestrictionModal({ isOpen: true, feature: "bookmarks" });
                return;
              }
              fetchAnnotations();
              setActiveView("bookmarks");
            }}
            className="w-full px-5 py-4 flex items-center justify-between border-b border-gray-100 dark:border-gray-900 hover:bg-gray-50 dark:hover:bg-gray-900 transition-colors"
          >
            <div className="flex items-center gap-3.5">
              <Bookmark className="w-5 h-5 text-gray-500" />
              <div className="text-left">
                <span className="font-semibold text-xs sm:text-sm block">Marcações</span>
                <span className="text-[11px] text-gray-400">Páginas marcadas e destaques de texto</span>
              </div>
            </div>
            <ChevronRight className="w-4 h-4 text-gray-300 dark:text-gray-700" />
          </button>

          {/* Botão: Clubes (Apenas os que estou inscrito) */}
          <button
            onClick={() => {
              if (isGuest) {
                setRestrictionModal({ isOpen: true, feature: "community" });
                return;
              }
              fetchUserClubs();
              setActiveView("clubs");
            }}
            className="w-full px-5 py-4 flex items-center justify-between border-b border-gray-100 dark:border-gray-900 hover:bg-gray-50 dark:hover:bg-gray-900 transition-colors"
          >
            <div className="flex items-center gap-3.5">
              <Users className="w-5 h-5 text-gray-500" />
              <div className="text-left">
                <span className="font-semibold text-xs sm:text-sm block">Meus Clubes</span>
                <span className="text-[11px] text-gray-400">Clubes de leitura em que participas</span>
              </div>
            </div>
            <ChevronRight className="w-4 h-4 text-gray-300 dark:text-gray-700" />
          </button>

          {/* Botão: Configurações */}
          <button
            onClick={() => navigate("/settings")}
            className="w-full px-5 py-4 flex items-center justify-between border-b border-gray-100 dark:border-gray-900 hover:bg-gray-50 dark:hover:bg-gray-900 transition-colors"
          >
            <div className="flex items-center gap-3.5">
              <Settings className="w-5 h-5 text-gray-500" />
              <div className="text-left">
                <span className="font-semibold text-xs sm:text-sm block">Configurações</span>
                <span className="text-[11px] text-gray-400">Tema, idioma e gestão da conta</span>
              </div>
            </div>
            <ChevronRight className="w-4 h-4 text-gray-300 dark:text-gray-700" />
          </button>

          {/* Botão: Suporte & Grupo do WhatsApp */}
          <button
            onClick={() => navigate("/support")}
            className="w-full px-5 py-4 flex items-center justify-between border-b border-gray-100 dark:border-gray-900 hover:bg-gray-50 dark:hover:bg-gray-900 transition-colors"
          >
            <div className="flex items-center gap-3.5">
              <MessageCircle className="w-5 h-5 text-gray-500" />
              <div className="text-left">
                <span className="font-semibold text-xs sm:text-sm block">Suporte & Ajuda</span>
                <span className="text-[11px] text-gray-400">Canal comunitário no WhatsApp</span>
              </div>
            </div>
            <ChevronRight className="w-4 h-4 text-gray-300 dark:text-gray-700" />
          </button>

          {/* Botão: Terminar Sessão */}
          <button
            onClick={handleLogout}
            className="w-full px-5 py-4 flex items-center justify-between text-black dark:text-white hover:bg-gray-50 dark:hover:bg-gray-900 transition-colors"
          >
            <div className="flex items-center gap-3.5">
              <LogOut className="w-5 h-5 text-gray-500" />
              <span className="font-semibold text-xs sm:text-sm">
                {isGuest ? "Sair do Modo Convidado" : "Terminar Sessão"}
              </span>
            </div>
            <ChevronRight className="w-4 h-4 text-gray-300 dark:text-gray-700" />
          </button>
        </div>
      </main>

      {/* ══════════════════════════════════════════════════════════ */}
      {/* 📑 MODAL / SHEET: LISTA DE ANOTAÇÕES POR LIVRO E PÁGINA   */}
      {/* ══════════════════════════════════════════════════════════ */}
      {/* ══════════════════════════════════════════════════════════ */}
      {/* 📑 MODAL: LISTA DE ANOTAÇÕES POR LIVRO E PÁGINA (CENTRALIZADO) */}
      {/* ══════════════════════════════════════════════════════════ */}
      {activeView === "notes" && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-in fade-in duration-200">
          <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 w-full max-w-xl max-h-[85vh] rounded-2xl flex flex-col shadow-2xl text-black dark:text-white animate-in zoom-in-95 duration-200 overflow-hidden">
            
            <div className="p-4 sm:p-5 border-b border-gray-200 dark:border-gray-800 flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <AlignLeft className="w-5 h-5 text-gray-500" />
                <h3 className="font-bold text-base">Minhas Anotações ({allNotes.length})</h3>
              </div>
              <button
                onClick={() => setActiveView("menu")}
                className="p-1.5 rounded-full text-gray-400 hover:text-black dark:hover:text-white transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-4 sm:p-5 overflow-y-auto space-y-3 no-scrollbar">
              {loadingData ? (
                <div className="py-12 text-center text-xs text-gray-500 dark:text-gray-400">A carregar as tuas anotações...</div>
              ) : allNotes.length === 0 ? (
                <div className="py-12 text-center text-xs text-gray-500 dark:text-gray-400 leading-relaxed">
                  Ainda não tens nenhuma anotação registada.<br />
                  Abre qualquer livro no leitor e cria anotações durante a leitura.
                </div>
              ) : (
                allNotes.map((note) => (
                  <div
                    key={note.id}
                    onClick={() => {
                      if (note.bookId) {
                        navigate(`/reader?bookId=${note.bookId}`);
                      }
                    }}
                    className="p-4 rounded-xl border border-gray-200 dark:border-gray-800 bg-gray-50/70 dark:bg-gray-800/40 hover:border-black dark:hover:border-white transition-all cursor-pointer group shadow-xs"
                  >
                    <div className="flex items-center justify-between gap-2 mb-2">
                      <div className="flex items-center gap-2 min-w-0">
                        <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded bg-black dark:bg-white text-white dark:text-black truncate">
                          {note.bookTitle}
                        </span>
                        <span className="text-xs text-gray-600 dark:text-gray-400 font-semibold truncate">
                          {note.chapter || `Pág. ${note.pageNumber}`}
                        </span>
                      </div>
                      <button
                        onClick={(e) => handleDeleteAnnotation(e, note.id, "note")}
                        className="p-1 text-gray-400 hover:text-black dark:hover:text-white transition-colors"
                        title="Eliminar anotação"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>

                    {note.selectedText && (
                      <blockquote className="text-xs text-gray-600 dark:text-gray-300 italic border-l-2 border-gray-400 dark:border-gray-600 pl-2.5 my-2">
                        "{note.selectedText}"
                      </blockquote>
                    )}

                    <p className="text-xs sm:text-sm font-medium leading-relaxed">
                      {note.content}
                    </p>

                    <div className="flex justify-between items-center text-[10px] text-gray-500 dark:text-gray-400 mt-3 pt-2 border-t border-gray-200 dark:border-gray-800">
                      <span>{new Date(note.createdAt).toLocaleDateString("pt-PT")}</span>
                      <span className="font-bold underline group-hover:text-black dark:group-hover:text-white">
                        Abrir no Leitor &rarr;
                      </span>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════ */}
      {/* 🔖 MODAL: LISTA DE MARCAÇÕES E DESTAQUES (CENTRALIZADO)    */}
      {/* ══════════════════════════════════════════════════════════ */}
      {activeView === "bookmarks" && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-in fade-in duration-200">
          <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 w-full max-w-xl max-h-[85vh] rounded-2xl flex flex-col shadow-2xl text-black dark:text-white animate-in zoom-in-95 duration-200 overflow-hidden">
            
            <div className="p-4 sm:p-5 border-b border-gray-200 dark:border-gray-800 flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <Bookmark className="w-5 h-5 text-gray-500" />
                <h3 className="font-bold text-base">Minhas Marcações ({allBookmarks.length})</h3>
              </div>
              <button
                onClick={() => setActiveView("menu")}
                className="p-1.5 rounded-full text-gray-400 hover:text-black dark:hover:text-white transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-4 sm:p-5 overflow-y-auto space-y-3 no-scrollbar">
              {loadingData ? (
                <div className="py-12 text-center text-xs text-gray-500 dark:text-gray-400">A carregar as tuas marcações...</div>
              ) : allBookmarks.length === 0 ? (
                <div className="py-12 text-center text-xs text-gray-500 dark:text-gray-400 leading-relaxed">
                  Ainda não tens nenhuma página marcada ou texto destacado.<br />
                  No leitor de livros, clica no marcador de página ou destaca textos para consultares aqui.
                </div>
              ) : (
                allBookmarks.map((mark) => (
                  <div
                    key={mark.id}
                    onClick={() => {
                      if (mark.bookId) {
                        navigate(`/reader?bookId=${mark.bookId}`);
                      }
                    }}
                    className="p-4 rounded-xl border border-gray-200 dark:border-gray-800 bg-gray-50/70 dark:bg-gray-800/40 hover:border-black dark:hover:border-white transition-all cursor-pointer group shadow-xs"
                  >
                    <div className="flex items-center justify-between gap-2 mb-2">
                      <div className="flex items-center gap-2 min-w-0">
                        <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded bg-black dark:bg-white text-white dark:text-black truncate">
                          {mark.bookTitle}
                        </span>
                        <span className="text-xs text-gray-600 dark:text-gray-400 font-semibold truncate">
                          {mark.chapter || `Pág. ${mark.pageNumber}`}
                        </span>
                        <span className="text-[9px] uppercase font-bold text-gray-500 dark:text-gray-400 px-1.5 py-0.5 rounded border border-gray-200 dark:border-gray-700">
                          {mark.type === "bookmark" ? "Marcador" : "Destaque"}
                        </span>
                      </div>
                      <button
                        onClick={(e) => handleDeleteAnnotation(e, mark.id, "bookmark")}
                        className="p-1 text-gray-400 hover:text-black dark:hover:text-white transition-colors"
                        title="Eliminar marcação"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>

                    <p className="text-xs sm:text-sm font-medium leading-relaxed">
                      {mark.content || mark.selectedText}
                    </p>

                    <div className="flex justify-between items-center text-[10px] text-gray-500 dark:text-gray-400 mt-3 pt-2 border-t border-gray-200 dark:border-gray-800">
                      <span>{new Date(mark.createdAt).toLocaleDateString("pt-PT")}</span>
                      <span className="font-bold underline group-hover:text-black dark:group-hover:text-white">
                        Ir para a Página &rarr;
                      </span>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════ */}
      {/* 👥 MODAL: APENAS OS CLUBES EM QUE ESTOU INSCRITO (CENTRALIZADO) */}
      {/* ══════════════════════════════════════════════════════════ */}
      {activeView === "clubs" && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-in fade-in duration-200">
          <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 w-full max-w-xl max-h-[85vh] rounded-2xl flex flex-col shadow-2xl text-black dark:text-white animate-in zoom-in-95 duration-200 overflow-hidden">
            
            <div className="p-4 sm:p-5 border-b border-gray-200 dark:border-gray-800 flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <Users className="w-5 h-5 text-gray-500" />
                <h3 className="font-bold text-base">Clubes em que Participo ({userClubs.length})</h3>
              </div>
              <button
                onClick={() => setActiveView("menu")}
                className="p-1.5 rounded-full text-gray-400 hover:text-black dark:hover:text-white transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-4 sm:p-5 overflow-y-auto space-y-3 no-scrollbar">
              {loadingData ? (
                <div className="py-12 text-center text-xs text-gray-500 dark:text-gray-400">A carregar os teus clubes...</div>
              ) : userClubs.length === 0 ? (
                <div className="py-10 text-center space-y-4">
                  <div className="w-12 h-12 rounded-full bg-gray-100 dark:bg-gray-800 flex items-center justify-center mx-auto text-gray-400">
                    <Users className="w-6 h-6 stroke-[1.8]" />
                  </div>
                  <div>
                    <h4 className="font-bold text-sm">Ainda não estás em nenhum clube</h4>
                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-1 max-w-xs mx-auto leading-relaxed">
                      Explora a comunidade para aderir a clubes de leitura temáticos ou debater livros com outros leitores.
                    </p>
                  </div>
                  <button
                    onClick={() => navigate("/community")}
                    className="px-5 py-2.5 bg-black dark:bg-white text-white dark:text-black rounded-xl text-xs font-bold active:scale-95 transition-all shadow-xs"
                  >
                    Explorar Clubes na Comunidade
                  </button>
                </div>
              ) : (
                userClubs.map((club) => (
                  <div
                    key={club.id}
                    onClick={() => navigate(`/club/${club.id}`)}
                    className="p-4 rounded-xl border border-gray-200 dark:border-gray-800 bg-gray-50/70 dark:bg-gray-800/40 hover:border-black dark:hover:border-white transition-all cursor-pointer flex items-center justify-between gap-3 group shadow-xs"
                  >
                    <div className="flex items-center gap-3.5 min-w-0">
                      <div className="w-12 h-12 rounded-xl bg-gray-200 dark:bg-gray-700 overflow-hidden shrink-0 flex items-center justify-center font-bold text-sm border border-gray-300 dark:border-gray-600">
                        {club.cover_url ? (
                          <img src={club.cover_url} alt={club.name} className="w-full h-full object-cover" />
                        ) : (
                          club.name.substring(0, 2).toUpperCase()
                        )}
                      </div>
                      <div className="min-w-0">
                        <h4 className="font-bold text-xs sm:text-sm truncate group-hover:underline">
                          {club.name}
                        </h4>
                        <p className="text-xs text-gray-600 dark:text-gray-400 line-clamp-1 mt-0.5">
                          {club.description || "Clube comunitário de leitura"}
                        </p>
                        <span className="text-[10px] text-gray-500 dark:text-gray-400 font-semibold block mt-1">
                          {club.member_count || 1} membros inscritos
                        </span>
                      </div>
                    </div>

                    <ChevronRight className="w-4 h-4 text-gray-400 shrink-0" />
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}

      {/* Modal de Restrições para Convidados */}
      <GuestRestrictionModal
        isOpen={restrictionModal.isOpen}
        feature={restrictionModal.feature}
        onClose={() => setRestrictionModal((prev) => ({ ...prev, isOpen: false }))}
      />

      <BottomNav />
    </div>
  );
}
