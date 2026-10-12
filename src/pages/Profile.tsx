import { useState, useEffect, useRef } from "react";
import { useNavigate, useParams, Link } from "react-router-dom";
import {
  ChevronRight,
  Settings as SettingsIcon,
  Bookmark,
  AlignLeft,
  Users,
  LogOut,
  Camera,
  MessageCircle,
  X,
  Trash2,
  User as UserLucide,
  MoreHorizontal,
  Share2,
  BookOpen,
  Plus,
  ArrowLeft,
  Edit3,
  Check,
  Moon,
  AlertTriangle
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
import { loadUserBookshelf, type BookshelfItem } from "../lib/bookshelfService";
import { getCached, setCached } from "../lib/cache";
import {
  fetchUserProfile,
  updateUserProfile,
  formatReadingTime,
  type UserProfileData,
  type FavoriteBookItem
} from "../lib/profileService";
import { applyTheme, getStoredTheme, type AppTheme } from "../lib/theme";

interface UserClub {
  id: string;
  name: string;
  description: string;
  member_count?: number;
  cover_url?: string;
  is_public?: boolean;
}

interface EnrichedAnnotation extends OfflineAnnotation {
  bookTitle?: string;
}

export default function Profile() {
  const { userId: routeUserId } = useParams<{ userId?: string }>();
  const navigate = useNavigate();
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // Utilizador logado
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [currentUserEmail, setCurrentUserEmail] = useState<string>("");
  const [isGuest, setIsGuest] = useState(false);

  // Estado do Perfil Carregado
  const [profile, setProfile] = useState<UserProfileData | null>(null);
  const [loading, setLoading] = useState(true);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);

  // Navegação por abas superiores (estilo captura enviada)
  const [activeTab, setActiveTab] = useState<"profile" | "notes" | "bookmarks" | "clubs">("profile");

  // Menu de 3 Pontinhos (...)
  const [showOptionsMenu, setShowOptionsMenu] = useState(false);
  const [copyFeedback, setCopyFeedback] = useState(false);

  // Modal: Editar Perfil
  const [showEditProfileModal, setShowEditProfileModal] = useState(false);
  const [editFullName, setEditFullName] = useState("");
  const [editUsername, setEditUsername] = useState("");
  const [editBio, setEditBio] = useState("");
  const [savingProfile, setSavingProfile] = useState(false);

  // Modal: Selecionar Livro Favorito
  const [showAddFavModal, setShowAddFavModal] = useState(false);
  const [selectedSlotIndex, setSelectedSlotIndex] = useState<number | null>(null);
  const [availableBooks, setAvailableBooks] = useState<BookshelfItem[]>([]);
  const [loadingBooks, setLoadingBooks] = useState(false);

  // Dados auxiliares (Anotações, Marcações, Clubes)
  const [allNotes, setAllNotes] = useState<EnrichedAnnotation[]>(() => getCached<EnrichedAnnotation[]>("profile_user_notes") || []);
  const [allBookmarks, setAllBookmarks] = useState<EnrichedAnnotation[]>(() => getCached<EnrichedAnnotation[]>("profile_user_bookmarks") || []);
  const [userClubs, setUserClubs] = useState<UserClub[]>(() => getCached<UserClub[]>("profile_user_clubs") || []);
  const [loadingAuxData, setLoadingAuxData] = useState(false);

  // Configurações e Tema
  const [currentTheme, setCurrentTheme] = useState<AppTheme>(getStoredTheme);
  const isDarkMode = currentTheme === "dark" || (currentTheme === "system" && typeof window !== "undefined" && window.matchMedia("(prefers-color-scheme: dark)").matches);

  // Eliminação de Conta Agendada (7 dias)
  const [scheduledDeleteAt, setScheduledDeleteAt] = useState<string | null>(null);
  const [showConfirmDeleteModal, setShowConfirmDeleteModal] = useState(false);
  const [processingDelete, setProcessingDelete] = useState(false);

  const [restrictionModal, setRestrictionModal] = useState<{
    isOpen: boolean;
    feature: "notes" | "highlights" | "bookmarks" | "community" | "donate" | "general";
  }>({
    isOpen: false,
    feature: "general"
  });

  // Determinar se estamos a visualizar o próprio perfil ou o perfil de outro leitor
  const isOwnProfile = !routeUserId || (currentUserId && routeUserId === currentUserId);

  // ─── 1. Carregar Sessão e Dados Iniciais ───
  useEffect(() => {
    let isMounted = true;

    async function init() {
      setLoading(true);

      if (isGuestMode()) {
        setIsGuest(true);
        setCurrentUserId("guest");
        setCurrentUserEmail("Modo Convidado");
      } else {
        const { data: { user } } = await supabase.auth.getUser();
        if (user) {
          if (isMounted) {
            setCurrentUserId(user.id);
            setCurrentUserEmail(user.email || user.phone || "");
          }
        }
      }

      // ID a carregar
      const idToFetch = routeUserId || (await supabase.auth.getUser()).data.user?.id || (isGuestMode() ? "guest" : null);

      if (idToFetch) {
        if (idToFetch === "guest") {
          const guestAvatar = localStorage.getItem("guest_avatar_url");
          const guestProfile: UserProfileData = {
            id: "guest",
            full_name: "Leitor Convidado",
            username: "@convidado",
            bio: "Leitor em sessão temporária no dispositivo.",
            avatar_url: guestAvatar,
            views_count: 1,
            clubs_count: 0,
            books_count: 0,
            reading_time_minutes: 0,
            sessions_count: 0,
            favorite_books: [],
          };
          if (isMounted) {
            setProfile(guestProfile);
            setLoading(false);
          }
        } else {
          try {
            const myId = (await supabase.auth.getUser()).data.user?.id || null;
            const data = await fetchUserProfile(idToFetch, myId);
            if (isMounted) {
              setProfile(data);
              setEditFullName(data.full_name);
              setEditUsername(data.username);
              setEditBio(data.bio);
              setScheduledDeleteAt(data.scheduled_delete_at || localStorage.getItem(`scheduled_delete_${data.id}`) || null);
            }
          } catch (err) {
            console.error("Erro ao carregar perfil:", err);
          } finally {
            if (isMounted) setLoading(false);
          }
        }
      } else {
        if (isMounted) setLoading(false);
      }
    }

    init();

    return () => {
      isMounted = false;
    };
  }, [routeUserId]);

  // Se for o próprio perfil, carregar anotações e clubes em background
  useEffect(() => {
    if (isOwnProfile && currentUserId && currentUserId !== "guest") {
      fetchAnnotations();
      fetchUserClubs();
    } else if (routeUserId && !isOwnProfile) {
      // Carregar os clubes públicos do utilizador visitado
      fetchVisitorClubs(routeUserId);
    }
  }, [isOwnProfile, currentUserId, routeUserId]);

  // ─── 2. Carregar Anotações e Marcações Pessoais ───
  const fetchAnnotations = async () => {
    if (allNotes.length === 0 && allBookmarks.length === 0) {
      setLoadingAuxData(true);
    }

    try {
      let shelfBooks = getCached<BookshelfItem[]>("bookshelf_all_items") || [];
      if (shelfBooks.length === 0 && typeof navigator !== "undefined" && navigator.onLine) {
        try {
          shelfBooks = await loadUserBookshelf();
        } catch {}
      }

      const bookTitleMap = new Map<string, string>();
      shelfBooks.forEach((b) => {
        bookTitleMap.set(b.id, b.title);
        if (b.bookId) bookTitleMap.set(b.bookId, b.title);
      });

      const offlineList = await getAllAnnotationsOffline();
      let rawNotes = offlineList.filter((a) => a.type === "note");
      let rawBookmarks = offlineList.filter((a) => a.type === "bookmark" || a.type === "highlight");

      const { data: { user } } = await supabase.auth.getUser();
      if (user && typeof navigator !== "undefined" && navigator.onLine) {
        const { data: dbData } = await supabase
          .from("annotations")
          .select("id, book_id, type, content, selected_text, page_number, chapter, created_at, book:books (title)")
          .eq("user_id", user.id)
          .order("created_at", { ascending: false });

        if (dbData && dbData.length > 0) {
          const remoteNotes: EnrichedAnnotation[] = [];
          const remoteBookmarks: EnrichedAnnotation[] = [];

          dbData.forEach((row: any) => {
            const item: EnrichedAnnotation = {
              id: row.id,
              bookId: row.book_id,
              bookTitle: row.book?.title || bookTitleMap.get(row.book_id) || "Livro",
              type: row.type,
              content: row.content || "",
              selectedText: row.selected_text || undefined,
              pageNumber: row.page_number || 1,
              chapter: row.chapter || undefined,
              createdAt: row.created_at,
              synced: true,
            };

            if (row.type === "note") {
              remoteNotes.push(item);
            } else {
              remoteBookmarks.push(item);
            }
          });

          setAllNotes(remoteNotes);
          setAllBookmarks(remoteBookmarks);
          setCached("profile_user_notes", remoteNotes);
          setCached("profile_user_bookmarks", remoteBookmarks);
          return;
        }
      }

      const enrichedNotes: EnrichedAnnotation[] = rawNotes.map((n) => ({
        ...n,
        bookTitle: bookTitleMap.get(n.bookId) || "Livro",
      }));
      const enrichedBookmarks: EnrichedAnnotation[] = rawBookmarks.map((b) => ({
        ...b,
        bookTitle: bookTitleMap.get(b.bookId) || "Livro",
      }));

      setAllNotes(enrichedNotes);
      setAllBookmarks(enrichedBookmarks);
      setCached("profile_user_notes", enrichedNotes);
      setCached("profile_user_bookmarks", enrichedBookmarks);
    } catch (err) {
      console.warn("Erro ao carregar anotações:", err);
    } finally {
      setLoadingAuxData(false);
    }
  };

  // ─── 3. Carregar Clubes em que o Próprio Utilizador Participa ───
  const fetchUserClubs = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data: memberships } = await supabase
        .from("club_members")
        .select(`
          club_id,
          role,
          club:clubs (
            id,
            name,
            description,
            member_count,
            cover_url,
            is_public
          )
        `)
        .eq("user_id", user.id);

      const clubsMap = new Map<string, UserClub>();

      if (memberships) {
        memberships.forEach((m: any) => {
          if (m.club) clubsMap.set(m.club.id, m.club);
        });
      }

      const { data: createdClubs } = await supabase
        .from("clubs")
        .select("id, name, description, member_count, cover_url, is_public")
        .eq("created_by", user.id);

      if (createdClubs) {
        createdClubs.forEach((c: any) => clubsMap.set(c.id, c));
      }

      const clubsList = Array.from(clubsMap.values());
      setUserClubs(clubsList);
      setCached("profile_user_clubs", clubsList);
      if (profile) setProfile({ ...profile, clubs_count: clubsList.length });
    } catch (err) {
      console.warn("Erro ao carregar clubes:", err);
    }
  };

  // Carregar Clubes de outro leitor visitado
  const fetchVisitorClubs = async (userId: string) => {
    try {
      const { data: memberships } = await supabase
        .from("club_members")
        .select(`
          club_id,
          club:clubs (
            id,
            name,
            description,
            member_count,
            cover_url,
            is_public
          )
        `)
        .eq("user_id", userId);

      const clubsMap = new Map<string, UserClub>();
      if (memberships) {
        memberships.forEach((m: any) => {
          if (m.club) clubsMap.set(m.club.id, m.club);
        });
      }

      const clubsList = Array.from(clubsMap.values());
      setUserClubs(clubsList);
    } catch (e) {
      console.warn("Erro ao carregar clubes do leitor:", e);
    }
  };

  // ─── 4. Upload de Foto de Perfil ───
  const handleAvatarFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 5 * 1024 * 1024) {
      alert("A imagem selecionada é demasiado grande. Escolhe um ficheiro até 5MB.");
      return;
    }

    setUploadingAvatar(true);
    const reader = new FileReader();
    reader.onload = async (event) => {
      const base64Data = event.target?.result as string;
      if (profile) {
        setProfile({ ...profile, avatar_url: base64Data });
      }

      if (isGuestMode()) {
        localStorage.setItem("guest_avatar_url", base64Data);
        setUploadingAvatar(false);
        return;
      }

      if (currentUserId) {
        await updateUserProfile(currentUserId, { avatar_url: base64Data });
      }
      setUploadingAvatar(false);
    };
    reader.readAsDataURL(file);
  };

  // ─── 5. Salvar Edição do Perfil ───
  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!profile || !currentUserId) return;

    setSavingProfile(true);
    try {
      const formattedUsername = editUsername.startsWith("@") ? editUsername.trim() : `@${editUsername.trim()}`;

      const updated = {
        full_name: editFullName.trim(),
        username: formattedUsername,
        bio: editBio.trim(),
      };

      await updateUserProfile(currentUserId, updated);
      setProfile({
        ...profile,
        ...updated,
      });
      setShowEditProfileModal(false);
    } catch (err) {
      console.error("Erro ao guardar perfil:", err);
    } finally {
      setSavingProfile(false);
    }
  };

  // ─── 6. Gestão de Livros Favoritos (3 Slots na Prateleira) ───
  const handleOpenAddFavModal = async (slotIndex: number) => {
    if (!isOwnProfile) return;
    setSelectedSlotIndex(slotIndex);
    setShowAddFavModal(true);
    setLoadingBooks(true);

    try {
      const shelf = await loadUserBookshelf();
      setAvailableBooks(shelf);
    } catch (e) {
      console.warn("Erro ao carregar estante:", e);
    } finally {
      setLoadingBooks(false);
    }
  };

  const handleSelectFavBook = async (book: BookshelfItem) => {
    if (selectedSlotIndex === null || !profile || !currentUserId) return;

    const currentFavs = [...(profile.favorite_books || [])];
    const newFavItem: FavoriteBookItem = {
      id: book.bookId || book.id,
      title: book.title,
      author: book.author,
      cover_url: book.coverUrl || null,
    };

    // Preenche ou substitui no slot selecionado
    if (selectedSlotIndex < currentFavs.length) {
      currentFavs[selectedSlotIndex] = newFavItem;
    } else {
      currentFavs.push(newFavItem);
    }

    const trimmedFavs = currentFavs.slice(0, 3);
    const updated = { ...profile, favorite_books: trimmedFavs };
    setProfile(updated);
    setShowAddFavModal(false);
    setSelectedSlotIndex(null);

    await updateUserProfile(currentUserId, { favorite_books: trimmedFavs });
  };

  const handleRemoveFavBook = async (e: React.MouseEvent, indexToRemove: number) => {
    e.stopPropagation();
    if (!isOwnProfile || !profile || !currentUserId) return;

    const updatedFavs = (profile.favorite_books || []).filter((_, i) => i !== indexToRemove);
    const updated = { ...profile, favorite_books: updatedFavs };
    setProfile(updated);

    await updateUserProfile(currentUserId, { favorite_books: updatedFavs });
  };

  // ─── 7. Partilhar Perfil ───
  const handleShareProfile = async () => {
    if (!profile) return;
    const profileUrl = `${window.location.origin}/profile/${profile.id}`;

    if (navigator.share) {
      try {
        await navigator.share({
          title: `Perfil de ${profile.full_name} | Kuwerenga`,
          text: `Espreita o perfil literário de ${profile.full_name} na aplicação Kuwerenga.`,
          url: profileUrl,
        });
        setShowOptionsMenu(false);
        return;
      } catch {}
    }

    // Fallback: Copiar para área de transferência
    try {
      await navigator.clipboard.writeText(profileUrl);
      setCopyFeedback(true);
      setTimeout(() => {
        setCopyFeedback(false);
        setShowOptionsMenu(false);
      }, 1500);
    } catch {}
  };

  // ─── 8. Eliminar Anotações ───
  const handleDeleteAnnotation = async (e: React.MouseEvent, id: string, type: "note" | "bookmark") => {
    e.stopPropagation();
    try {
      await deleteAnnotationOffline(id);
      if (currentUserId && currentUserId !== "guest") {
        await supabase.from("annotations").delete().eq("id", id).eq("user_id", currentUserId);
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

  // Alternar Tema Escuro / Claro
  const handleToggleTheme = () => {
    const nextTheme: AppTheme = isDarkMode ? "light" : "dark";
    setCurrentTheme(nextTheme);
    applyTheme(nextTheme);
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

  // Agendar eliminação de conta (7 dias)
  const handleScheduleDelete = async () => {
    setProcessingDelete(true);
    try {
      const targetDate = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
      if (currentUserId && currentUserId !== "guest") {
        localStorage.setItem(`scheduled_delete_${currentUserId}`, targetDate);
        await supabase.from("profiles").update({ scheduled_delete_at: targetDate }).eq("id", currentUserId);
      }
      setScheduledDeleteAt(targetDate);
      setShowConfirmDeleteModal(false);
    } catch (err) {
      console.error("Erro ao agendar eliminação:", err);
    } finally {
      setProcessingDelete(false);
    }
  };

  // Cancelar eliminação
  const handleCancelDelete = async () => {
    setProcessingDelete(true);
    try {
      if (currentUserId && currentUserId !== "guest") {
        localStorage.removeItem(`scheduled_delete_${currentUserId}`);
        await supabase.from("profiles").update({ scheduled_delete_at: null }).eq("id", currentUserId);
      }
      setScheduledDeleteAt(null);
    } catch (err) {
      console.error("Erro ao cancelar eliminação:", err);
    } finally {
      setProcessingDelete(false);
    }
  };

  // Iniciais do Nome
  const getInitials = (name: string) => {
    const parts = name.trim().split(" ");
    if (parts.length === 1) return parts[0].substring(0, 2).toUpperCase();
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  };

  if (loading && !profile) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-white dark:bg-black">
        <div className="w-8 h-8 border-2 border-black dark:border-white border-t-transparent dark:border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  const favBooks = profile?.favorite_books || [];

  return (
    <div className="flex flex-col min-h-screen bg-[#fcfbfa] dark:bg-black text-black dark:text-white pb-24 md:pb-12 md:pt-16 select-none">
      
      {/* ─── Top Header da Página (Título e Abas) ─── */}
      <header className="px-4 sm:px-6 pt-safe bg-[#fcfbfa] dark:bg-black border-b border-gray-200/80 dark:border-gray-900 sticky top-0 z-30">
        <div className="app-container pt-4 pb-2">
          
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              {!isOwnProfile && (
                <button
                  type="button"
                  onClick={() => navigate(-1)}
                  className="p-1.5 -ml-1.5 rounded-full hover:bg-gray-200/60 dark:hover:bg-gray-800 transition-colors"
                  title="Voltar"
                >
                  <ArrowLeft className="w-5 h-5" />
                </button>
              )}
              <h1 className="font-serif text-2xl font-bold tracking-tight">Perfil</h1>
            </div>

            {/* Menu de Opções Rápido */}
            <div className="relative">
              <button
                type="button"
                onClick={() => setShowOptionsMenu(!showOptionsMenu)}
                className="p-2 rounded-full hover:bg-gray-200/60 dark:hover:bg-gray-800 transition-colors"
                title="Mais opções"
              >
                <MoreHorizontal className="w-5 h-5" />
              </button>

              {/* Popover Dropdown de Opções */}
              {showOptionsMenu && (
                <div className="absolute right-0 top-10 w-48 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-2xl shadow-xl py-1 z-50 text-xs animate-in zoom-in-95 duration-150">
                  {isOwnProfile && (
                    <button
                      type="button"
                      onClick={() => {
                        setShowOptionsMenu(false);
                        setShowEditProfileModal(true);
                      }}
                      className="w-full px-4 py-2.5 text-left flex items-center gap-2.5 hover:bg-gray-50 dark:hover:bg-gray-800 font-semibold"
                    >
                      <Edit3 className="w-3.5 h-3.5" />
                      <span>Editar Perfil</span>
                    </button>
                  )}

                  <button
                    type="button"
                    onClick={handleShareProfile}
                    className="w-full px-4 py-2.5 text-left flex items-center gap-2.5 hover:bg-gray-50 dark:hover:bg-gray-800 font-semibold"
                  >
                    {copyFeedback ? <Check className="w-3.5 h-3.5" /> : <Share2 className="w-3.5 h-3.5" />}
                    <span>{copyFeedback ? "Link Copiado!" : "Partilhar Perfil"}</span>
                  </button>

                  {isOwnProfile && (
                    <button
                      type="button"
                      onClick={() => {
                        setShowOptionsMenu(false);
                        navigate("/settings");
                      }}
                      className="w-full px-4 py-2.5 text-left flex items-center gap-2.5 hover:bg-gray-50 dark:hover:bg-gray-800 font-semibold border-t border-gray-100 dark:border-gray-800"
                    >
                      <SettingsIcon className="w-3.5 h-3.5" />
                      <span>Configurações</span>
                    </button>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Abas Horizontais (Inspiradas na captura: Você | Anotações | Marcações | Clubes) */}
          <nav className="flex items-center gap-6 text-sm font-semibold border-b border-transparent">
            <button
              type="button"
              onClick={() => setActiveTab("profile")}
              className={`pb-2.5 transition-all relative ${
                activeTab === "profile"
                  ? "text-black dark:text-white font-bold"
                  : "text-gray-400 hover:text-gray-600 dark:hover:text-gray-200"
              }`}
            >
              <span>{isOwnProfile ? "Você" : "Perfil"}</span>
              {activeTab === "profile" && (
                <div className="absolute bottom-0 left-0 right-0 h-0.75 bg-black dark:bg-white rounded-full" />
              )}
            </button>

            {/* Anotações e Marcações aparecem apenas para o dono do perfil */}
            {isOwnProfile && (
              <>
                <button
                  type="button"
                  onClick={() => {
                    if (isGuest) {
                      setRestrictionModal({ isOpen: true, feature: "notes" });
                      return;
                    }
                    setActiveTab("notes");
                    fetchAnnotations();
                  }}
                  className={`pb-2.5 transition-all relative ${
                    activeTab === "notes"
                      ? "text-black dark:text-white font-bold"
                      : "text-gray-400 hover:text-gray-600 dark:hover:text-gray-200"
                  }`}
                >
                  <span>Anotações</span>
                  {activeTab === "notes" && (
                    <div className="absolute bottom-0 left-0 right-0 h-0.75 bg-black dark:bg-white rounded-full" />
                  )}
                </button>

                <button
                  type="button"
                  onClick={() => {
                    if (isGuest) {
                      setRestrictionModal({ isOpen: true, feature: "bookmarks" });
                      return;
                    }
                    setActiveTab("bookmarks");
                    fetchAnnotations();
                  }}
                  className={`pb-2.5 transition-all relative ${
                    activeTab === "bookmarks"
                      ? "text-black dark:text-white font-bold"
                      : "text-gray-400 hover:text-gray-600 dark:hover:text-gray-200"
                  }`}
                >
                  <span>Marcações</span>
                  {activeTab === "bookmarks" && (
                    <div className="absolute bottom-0 left-0 right-0 h-0.75 bg-black dark:bg-white rounded-full" />
                  )}
                </button>
              </>
            )}

            <button
              type="button"
              onClick={() => setActiveTab("clubs")}
              className={`pb-2.5 transition-all relative ${
                activeTab === "clubs"
                  ? "text-black dark:text-white font-bold"
                  : "text-gray-400 hover:text-gray-600 dark:hover:text-gray-200"
              }`}
            >
              <span>Clubes ({userClubs.length})</span>
              {activeTab === "clubs" && (
                <div className="absolute bottom-0 left-0 right-0 h-0.75 bg-black dark:bg-white rounded-full" />
              )}
            </button>
          </nav>
        </div>
      </header>

      {/* ─── CONTEÚDO PRINCIPAL ─── */}
      <main className="flex-1 py-4 sm:py-6 app-container space-y-6">
        
        {/* ══════════════════════════════════════════════════════════ */}
        {/* ABA 1: PERFIL PRINCIPAL COM O GRANDE CARD E ESTANTE       */}
        {/* ══════════════════════════════════════════════════════════ */}
        {activeTab === "profile" && profile && (
          <div className="space-y-6 animate-in fade-in duration-200">
            
            {/* O Grande Cartão de Perfil (Fiel à captura 1) */}
            <div className="bg-[#f5f0eb] dark:bg-gray-900/80 border border-[#e8dfd5] dark:border-gray-800 rounded-3xl p-5 sm:p-6 shadow-xs relative">
              
              {/* Botão de 3 Pontinhos no topo direito do cartão */}
              <div className="flex justify-end">
                <button
                  type="button"
                  onClick={() => setShowOptionsMenu(!showOptionsMenu)}
                  className="p-1 rounded-full text-gray-500 hover:text-black dark:hover:text-white transition-colors"
                  title="Opções do perfil"
                >
                  <MoreHorizontal className="w-5 h-5" />
                </button>
              </div>

              {/* Linha Superior: Visualizações | Avatar Central | Clubes */}
              <div className="grid grid-cols-3 items-center mb-4">
                
                {/* Coluna 1: Visualizações do Perfil */}
                <div className="text-center">
                  <span className="block text-xl sm:text-2xl font-bold leading-tight">
                    {profile.views_count}
                  </span>
                  <span className="text-[11px] sm:text-xs text-gray-500 dark:text-gray-400 font-medium">
                    Visualizações
                  </span>
                </div>

                {/* Coluna 2: Avatar Proeminente */}
                <div className="flex justify-center">
                  <div className="relative group">
                    <div className="w-20 h-20 sm:w-22 sm:h-22 rounded-full overflow-hidden bg-[#e0d6cb] dark:bg-gray-800 flex items-center justify-center border-2 border-white dark:border-gray-800 shadow-xs relative">
                      {profile.avatar_url ? (
                        <img
                          src={profile.avatar_url}
                          alt={profile.full_name}
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <span className="font-serif text-xl sm:text-2xl font-bold text-gray-700 dark:text-gray-300">
                          {getInitials(profile.full_name)}
                        </span>
                      )}

                      {uploadingAvatar && (
                        <div className="absolute inset-0 bg-black/60 flex items-center justify-center">
                          <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                        </div>
                      )}
                    </div>

                    {/* Botão de Alterar Foto se for o próprio perfil */}
                    {isOwnProfile && (
                      <button
                        type="button"
                        onClick={() => fileInputRef.current?.click()}
                        className="absolute bottom-0 right-0 w-7 h-7 bg-black dark:bg-white text-white dark:text-black rounded-full flex items-center justify-center border-2 border-white dark:border-black shadow-xs hover:scale-105 active:scale-95 transition-transform"
                        title="Alterar foto de perfil"
                      >
                        <Camera className="w-3.5 h-3.5 stroke-[2]" />
                      </button>
                    )}

                    <input
                      ref={fileInputRef}
                      type="file"
                      accept="image/*"
                      onChange={handleAvatarFileChange}
                      className="hidden"
                    />
                  </div>
                </div>

                {/* Coluna 3: Clubes de Leitura */}
                <div className="text-center">
                  <span className="block text-xl sm:text-2xl font-bold leading-tight">
                    {userClubs.length}
                  </span>
                  <span className="text-[11px] sm:text-xs text-gray-500 dark:text-gray-400 font-medium">
                    Clubes
                  </span>
                </div>
              </div>

              {/* Informações Centrais: Nome, Username e Bio */}
              <div className="text-center max-w-sm mx-auto mb-6">
                <h2 className="text-lg sm:text-xl font-bold leading-snug">
                  {profile.full_name}
                </h2>
                <span className="text-xs text-gray-500 dark:text-gray-400 block font-medium mt-0.5">
                  {profile.username}
                </span>
                {profile.bio && (
                  <p className="text-xs text-gray-600 dark:text-gray-300 mt-2 leading-relaxed whitespace-pre-line px-2">
                    {profile.bio}
                  </p>
                )}
              </div>

              {/* Linha Inferior de Estatísticas (Livros, Tempo de Leitura, Sessões) */}
              <div className="grid grid-cols-3 divide-x divide-gray-300/70 dark:divide-gray-800 pt-4 border-t border-gray-300/60 dark:border-gray-800 text-center">
                <div className="px-1">
                  <span className="block text-base sm:text-lg font-bold">
                    {profile.books_count}
                  </span>
                  <span className="text-[10px] sm:text-xs text-gray-500 dark:text-gray-400">
                    Livros
                  </span>
                </div>

                <div className="px-1">
                  <span className="block text-base sm:text-lg font-bold">
                    {formatReadingTime(profile.reading_time_minutes)}
                  </span>
                  <span className="text-[10px] sm:text-xs text-gray-500 dark:text-gray-400">
                    Tempo de leitura
                  </span>
                </div>

                <div className="px-1">
                  <span className="block text-base sm:text-lg font-bold">
                    {profile.sessions_count}
                  </span>
                  <span className="text-[10px] sm:text-xs text-gray-500 dark:text-gray-400">
                    Sessões
                  </span>
                </div>
              </div>
            </div>

            {/* ─── PRATELEIRA DE LIVROS FAVORITOS (Inspirada na captura 1) ─── */}
            <section className="pt-2">
              <h3 className="text-[11px] font-bold uppercase tracking-widest text-gray-500 dark:text-gray-400 text-center mb-4">
                Livros Favoritos
              </h3>

              {/* 3 Slots de Livros em Proporção Vertical */}
              <div className="grid grid-cols-3 gap-3 sm:gap-4 max-w-sm sm:max-w-md mx-auto mb-2 px-2">
                {[0, 1, 2].map((slotIdx) => {
                  const favBook = favBooks[slotIdx];

                  return (
                    <div key={slotIdx} className="flex flex-col items-center">
                      {favBook ? (
                        <div
                          onClick={() => {
                            if (favBook.id) navigate(`/book/${favBook.id}`);
                          }}
                          className="w-full aspect-[2/3] rounded-xl overflow-hidden border border-gray-300 dark:border-gray-700 bg-gray-100 dark:bg-gray-800 shadow-md relative group cursor-pointer"
                        >
                          {favBook.cover_url ? (
                            <img
                              src={favBook.cover_url}
                              alt={favBook.title}
                              className="w-full h-full object-cover group-hover:scale-105 transition-transform"
                            />
                          ) : (
                            <div className="w-full h-full p-2 flex flex-col justify-center items-center text-center bg-gray-200 dark:bg-gray-800">
                              <BookOpen className="w-6 h-6 text-gray-400 mb-1" />
                              <span className="text-[10px] font-bold line-clamp-2">{favBook.title}</span>
                            </div>
                          )}

                          {/* Botão de Remover se for o dono */}
                          {isOwnProfile && (
                            <button
                              type="button"
                              onClick={(e) => handleRemoveFavBook(e, slotIdx)}
                              className="absolute top-1 right-1 p-1 rounded-full bg-black/70 text-white hover:bg-black transition-colors"
                              title="Remover favorito"
                            >
                              <X className="w-3 h-3" />
                            </button>
                          )}
                        </div>
                      ) : (
                        <button
                          type="button"
                          disabled={!isOwnProfile}
                          onClick={() => handleOpenAddFavModal(slotIdx)}
                          className={`w-full aspect-[2/3] rounded-xl border-2 border-dashed border-gray-300 dark:border-gray-700 bg-[#f5f0eb]/60 dark:bg-gray-900/40 flex flex-col items-center justify-center gap-1.5 transition-all ${
                            isOwnProfile
                              ? "hover:border-black dark:hover:border-white cursor-pointer active:scale-95"
                              : "opacity-40 cursor-default"
                          }`}
                        >
                          <Plus className="w-5 h-5 text-gray-500" />
                          <span className="text-[10px] font-bold text-gray-500">Adicionar</span>
                        </button>
                      )}

                      {/* Legenda do Livro */}
                      <span className="text-[10px] font-medium text-gray-600 dark:text-gray-400 truncate w-full text-center mt-1.5 px-0.5">
                        {favBook ? favBook.title : `Slot ${slotIdx + 1}`}
                      </span>
                    </div>
                  );
                })}
              </div>

              {/* Ripa / Suporte de Madeira Estilizado para a Prateleira */}
              <div className="max-w-sm sm:max-w-md mx-auto px-1">
                <div className="h-2.5 bg-[#422a1d] dark:bg-[#2c1d14] rounded-sm shadow-md relative">
                  {/* Suportes triangulares sob a prateleira */}
                  <div className="absolute -bottom-2 left-4 w-0 h-0 border-l-[6px] border-l-transparent border-r-[6px] border-r-transparent border-t-[8px] border-t-[#422a1d] dark:border-t-[#2c1d14]" />
                  <div className="absolute -bottom-2 right-4 w-0 h-0 border-l-[6px] border-l-transparent border-r-[6px] border-r-transparent border-t-[8px] border-t-[#422a1d] dark:border-t-[#2c1d14]" />
                </div>
              </div>
            </section>

            {/* ─── SECÇÃO DE CONFIGURAÇÕES & CONTA (Inspirada na captura 2) ─── */}
            {isOwnProfile && (
              <section className="pt-6 space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-xs font-bold uppercase tracking-wider text-gray-500">
                    Conta & Definições
                  </h3>
                  <button
                    type="button"
                    onClick={() => setShowEditProfileModal(true)}
                    className="text-xs font-semibold underline text-gray-500 hover:text-black dark:hover:text-white"
                  >
                    Editar Dados
                  </button>
                </div>

                {/* Cartão de Detalhes da Conta */}
                <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-2xl overflow-hidden shadow-xs divide-y divide-gray-100 dark:divide-gray-800 text-xs sm:text-sm">
                  
                  {/* Item: Foto de Perfil */}
                  <div
                    onClick={() => fileInputRef.current?.click()}
                    className="p-4 flex items-center justify-between hover:bg-gray-50 dark:hover:bg-gray-800/50 cursor-pointer transition-colors"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-gray-100 dark:bg-gray-800 overflow-hidden flex items-center justify-center border border-gray-200 dark:border-gray-700">
                        {profile.avatar_url ? (
                          <img src={profile.avatar_url} alt="Foto" className="w-full h-full object-cover" />
                        ) : (
                          <UserLucide className="w-5 h-5 text-gray-400" />
                        )}
                      </div>
                      <div>
                        <span className="font-bold block">Foto de perfil</span>
                        <span className="text-[11px] text-gray-400">Alterar imagem</span>
                      </div>
                    </div>
                    <ChevronRight className="w-4 h-4 text-gray-300 dark:text-gray-700" />
                  </div>

                  {/* Item: Nome */}
                  <div
                    onClick={() => setShowEditProfileModal(true)}
                    className="p-4 flex items-center justify-between hover:bg-gray-50 dark:hover:bg-gray-800/50 cursor-pointer transition-colors"
                  >
                    <div>
                      <span className="text-[11px] text-gray-400 block font-semibold">Nome</span>
                      <span className="font-bold">{profile.full_name}</span>
                    </div>
                    <ChevronRight className="w-4 h-4 text-gray-300 dark:text-gray-700" />
                  </div>

                  {/* Item: Username */}
                  <div
                    onClick={() => setShowEditProfileModal(true)}
                    className="p-4 flex items-center justify-between hover:bg-gray-50 dark:hover:bg-gray-800/50 cursor-pointer transition-colors"
                  >
                    <div>
                      <span className="text-[11px] text-gray-400 block font-semibold">Username</span>
                      <span className="font-bold">{profile.username}</span>
                    </div>
                    <ChevronRight className="w-4 h-4 text-gray-300 dark:text-gray-700" />
                  </div>

                  {/* Item: Email */}
                  <div className="p-4 flex items-center justify-between">
                    <div>
                      <span className="text-[11px] text-gray-400 block font-semibold">Email</span>
                      <span className="font-medium text-gray-600 dark:text-gray-300">{currentUserEmail || "Não definido"}</span>
                    </div>
                  </div>
                </div>

                {/* Cartão de Preferências do Sistema */}
                <h3 className="text-xs font-bold uppercase tracking-wider text-gray-500 pt-2">
                  Preferências
                </h3>

                <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-2xl overflow-hidden shadow-xs divide-y divide-gray-100 dark:divide-gray-800 text-xs sm:text-sm">
                  
                  {/* Interruptor: Tema Escuro / Claro */}
                  <div className="p-4 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <Moon className="w-5 h-5 text-gray-500" />
                      <div>
                        <span className="font-bold block">Tema escuro</span>
                        <span className="text-[11px] text-gray-400">
                          {isDarkMode ? "Modo escuro ativo" : "Modo claro ativo"}
                        </span>
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={handleToggleTheme}
                      className={`w-12 h-6.5 rounded-full p-0.5 transition-colors relative ${
                        isDarkMode ? "bg-black dark:bg-white" : "bg-gray-300"
                      }`}
                      title="Alternar tema"
                    >
                      <div
                        className={`w-5.5 h-5.5 rounded-full bg-white dark:bg-black transition-transform shadow-xs ${
                          isDarkMode ? "translate-x-5.5" : "translate-x-0"
                        }`}
                      />
                    </button>
                  </div>

                  {/* Suporte WhatsApp */}
                  <button
                    type="button"
                    onClick={() => navigate("/support")}
                    className="w-full p-4 flex items-center justify-between hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors text-left"
                  >
                    <div className="flex items-center gap-3">
                      <MessageCircle className="w-5 h-5 text-gray-500" />
                      <div>
                        <span className="font-bold block">Suporte & Comunidade WhatsApp</span>
                        <span className="text-[11px] text-gray-400">Tira dúvidas e partilha sugestões</span>
                      </div>
                    </div>
                    <ChevronRight className="w-4 h-4 text-gray-300 dark:text-gray-700" />
                  </button>

                  {/* Eliminação de Conta (7 dias) */}
                  <div className="p-4 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <Trash2 className="w-5 h-5 text-gray-500" />
                      <div>
                        <span className="font-bold block">Eliminar conta</span>
                        <span className="text-[11px] text-gray-400">
                          {scheduledDeleteAt
                            ? "Eliminação agendada ativa"
                            : "Permanente após 7 dias de aviso"}
                        </span>
                      </div>
                    </div>

                    {scheduledDeleteAt ? (
                      <button
                        type="button"
                        onClick={handleCancelDelete}
                        disabled={processingDelete}
                        className="px-3 py-1.5 rounded-xl bg-gray-100 dark:bg-gray-800 text-xs font-bold hover:bg-gray-200 transition-colors"
                      >
                        Cancelar
                      </button>
                    ) : (
                      <button
                        type="button"
                        onClick={() => setShowConfirmDeleteModal(true)}
                        className="px-3 py-1.5 rounded-xl text-xs font-bold text-gray-500 hover:text-black dark:hover:text-white"
                      >
                        Configurar
                      </button>
                    )}
                  </div>

                  {/* Terminar Sessão */}
                  <button
                    type="button"
                    onClick={handleLogout}
                    className="w-full p-4 flex items-center justify-between hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors text-left font-bold"
                  >
                    <div className="flex items-center gap-3">
                      <LogOut className="w-5 h-5 text-gray-500" />
                      <span>{isGuest ? "Sair do Modo Convidado" : "Terminar Sessão"}</span>
                    </div>
                    <ChevronRight className="w-4 h-4 text-gray-300 dark:text-gray-700" />
                  </button>
                </div>
              </section>
            )}
          </div>
        )}

        {/* ══════════════════════════════════════════════════════════ */}
        {/* ABA 2: ANOTAÇÕES DO LEITOR (Visível apenas para o dono)   */}
        {/* ══════════════════════════════════════════════════════════ */}
        {activeTab === "notes" && isOwnProfile && (
          <div className="space-y-4 animate-in fade-in duration-200">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-bold uppercase tracking-wider text-gray-400">
                Minhas Anotações ({allNotes.length})
              </h2>
            </div>

            {loadingAuxData ? (
              <div className="py-20 text-center text-xs text-gray-500">A carregar as tuas anotações...</div>
            ) : allNotes.length === 0 ? (
              <div className="bg-white dark:bg-gray-900 rounded-3xl p-8 border border-gray-200 dark:border-gray-800 text-center my-6">
                <AlignLeft className="w-10 h-10 text-gray-400 mx-auto mb-3" />
                <h3 className="font-bold text-base mb-1">Ainda não tens anotações</h3>
                <p className="text-xs text-gray-500 max-w-xs mx-auto mb-4">
                  Abre qualquer livro no leitor e cria anotações durante a leitura para consulta rápida.
                </p>
                <Link
                  to="/library"
                  className="inline-block px-5 py-2.5 bg-black dark:bg-white text-white dark:text-black rounded-xl text-xs font-semibold"
                >
                  Abrir Biblioteca
                </Link>
              </div>
            ) : (
              allNotes.map((note) => (
                <div
                  key={note.id}
                  onClick={() => {
                    if (note.bookId) navigate(`/reader?bookId=${note.bookId}`);
                  }}
                  className="p-4 rounded-2xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900/60 shadow-xs cursor-pointer group hover:border-black dark:hover:border-white transition-all"
                >
                  <div className="flex items-center justify-between gap-2 mb-2">
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded bg-black dark:bg-white text-white dark:text-black truncate">
                        {note.bookTitle}
                      </span>
                      <span className="text-xs text-gray-500 font-semibold truncate">
                        {note.chapter || `Pág. ${note.pageNumber}`}
                      </span>
                    </div>
                    <button
                      type="button"
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

                  <div className="flex justify-between items-center text-[10px] text-gray-400 mt-3 pt-2 border-t border-gray-100 dark:border-gray-800">
                    <span>{new Date(note.createdAt).toLocaleDateString("pt-PT")}</span>
                    <span className="font-bold underline group-hover:text-black dark:group-hover:text-white">
                      Abrir no Leitor &rarr;
                    </span>
                  </div>
                </div>
              ))
            )}
          </div>
        )}

        {/* ══════════════════════════════════════════════════════════ */}
        {/* ABA 3: MARCAÇÕES E DESTAQUES (Visível apenas para o dono) */}
        {/* ══════════════════════════════════════════════════════════ */}
        {activeTab === "bookmarks" && isOwnProfile && (
          <div className="space-y-4 animate-in fade-in duration-200">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-bold uppercase tracking-wider text-gray-400">
                Minhas Marcações ({allBookmarks.length})
              </h2>
            </div>

            {loadingAuxData ? (
              <div className="py-20 text-center text-xs text-gray-500">A carregar as tuas marcações...</div>
            ) : allBookmarks.length === 0 ? (
              <div className="bg-white dark:bg-gray-900 rounded-3xl p-8 border border-gray-200 dark:border-gray-800 text-center my-6">
                <Bookmark className="w-10 h-10 text-gray-400 mx-auto mb-3" />
                <h3 className="font-bold text-base mb-1">Sem marcações guardadas</h3>
                <p className="text-xs text-gray-500 max-w-xs mx-auto mb-4">
                  No leitor de livros, clica no marcador de página ou destaca textos para consultares aqui.
                </p>
                <Link
                  to="/library"
                  className="inline-block px-5 py-2.5 bg-black dark:bg-white text-white dark:text-black rounded-xl text-xs font-semibold"
                >
                  Abrir Biblioteca
                </Link>
              </div>
            ) : (
              allBookmarks.map((mark) => (
                <div
                  key={mark.id}
                  onClick={() => {
                    if (mark.bookId) navigate(`/reader?bookId=${mark.bookId}`);
                  }}
                  className="p-4 rounded-2xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900/60 shadow-xs cursor-pointer group hover:border-black dark:hover:border-white transition-all"
                >
                  <div className="flex items-center justify-between gap-2 mb-2">
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded bg-black dark:bg-white text-white dark:text-black truncate">
                        {mark.bookTitle}
                      </span>
                      <span className="text-xs text-gray-500 font-semibold truncate">
                        {mark.chapter || `Pág. ${mark.pageNumber}`}
                      </span>
                      <span className="text-[9px] uppercase font-bold text-gray-500 px-1.5 py-0.5 rounded border border-gray-200 dark:border-gray-800">
                        {mark.type === "bookmark" ? "Marcador" : "Destaque"}
                      </span>
                    </div>
                    <button
                      type="button"
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

                  <div className="flex justify-between items-center text-[10px] text-gray-400 mt-3 pt-2 border-t border-gray-100 dark:border-gray-800">
                    <span>{new Date(mark.createdAt).toLocaleDateString("pt-PT")}</span>
                    <span className="font-bold underline group-hover:text-black dark:group-hover:text-white">
                      Ir para a Página &rarr;
                    </span>
                  </div>
                </div>
              ))
            )}
          </div>
        )}

        {/* ══════════════════════════════════════════════════════════ */}
        {/* ABA 4: CLUBES DE LEITURA DO UTILIZADOR                   */}
        {/* ══════════════════════════════════════════════════════════ */}
        {activeTab === "clubs" && (
          <div className="space-y-4 animate-in fade-in duration-200">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-bold uppercase tracking-wider text-gray-400">
                {isOwnProfile ? "Clubes em que Participo" : `Clubes de ${profile?.full_name}`} ({userClubs.length})
              </h2>
            </div>

            {userClubs.length === 0 ? (
              <div className="bg-white dark:bg-gray-900 rounded-3xl p-8 border border-gray-200 dark:border-gray-800 text-center my-6">
                <Users className="w-10 h-10 text-gray-400 mx-auto mb-3" />
                <h3 className="font-bold text-base mb-1">Nenhum clube associado</h3>
                <p className="text-xs text-gray-500 max-w-xs mx-auto mb-4">
                  {isOwnProfile
                    ? "Explora as comunidades de leitores e junta-te a debates literários."
                    : "Este utilizador ainda não participa em nenhum clube de leitura público."}
                </p>
                {isOwnProfile && (
                  <Link
                    to="/community"
                    className="inline-block px-5 py-2.5 bg-black dark:bg-white text-white dark:text-black rounded-xl text-xs font-semibold"
                  >
                    Ver Comunidades
                  </Link>
                )}
              </div>
            ) : (
              userClubs.map((club) => (
                <div
                  key={club.id}
                  onClick={() => navigate(`/club/${club.id}`)}
                  className="p-4 sm:p-5 rounded-2xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900/60 shadow-xs flex items-center justify-between cursor-pointer hover:border-black dark:hover:border-white transition-all group"
                >
                  <div className="min-w-0 pr-4">
                    <div className="flex items-center gap-2 mb-1">
                      <h4 className="font-bold text-sm truncate">{club.name}</h4>
                      {club.is_public === false && (
                        <span className="text-[9px] uppercase font-bold px-1.5 py-0.5 rounded bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300">
                          Privado
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-gray-500 line-clamp-2 leading-relaxed">
                      {club.description || "Comunidade de leitura e debate."}
                    </p>
                    <span className="text-[10px] text-gray-400 block mt-2">
                      {club.member_count || 1} {club.member_count === 1 ? "membro" : "membros"}
                    </span>
                  </div>

                  <div className="w-8 h-8 rounded-full bg-gray-100 dark:bg-gray-800 flex items-center justify-center shrink-0 group-hover:bg-black group-hover:text-white dark:group-hover:bg-white dark:group-hover:text-black transition-colors">
                    <ChevronRight className="w-4 h-4" />
                  </div>
                </div>
              ))
            )}
          </div>
        )}
      </main>

      {/* ══════════════════════════════════════════════════════════ */}
      {/* MODAL: EDITAR PERFIL (Nome, Username, Bio)                 */}
      {/* ══════════════════════════════════════════════════════════ */}
      {showEditProfileModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-in fade-in duration-200">
          <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-3xl max-w-md w-full p-6 shadow-2xl animate-in zoom-in-95 duration-200 text-black dark:text-white">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-bold text-base">Editar Perfil</h3>
              <button
                type="button"
                onClick={() => setShowEditProfileModal(false)}
                className="p-1 rounded-full hover:bg-gray-100 dark:hover:bg-gray-800"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveProfile} className="space-y-4">
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-gray-500 mb-1.5">
                  Nome Completo
                </label>
                <input
                  type="text"
                  value={editFullName}
                  onChange={(e) => setEditFullName(e.target.value)}
                  placeholder="Ex: Leonardo Juliano"
                  className="w-full px-4 py-3 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl text-sm font-medium focus:outline-none focus:ring-2 focus:ring-black dark:focus:ring-white"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-gray-500 mb-1.5">
                  Username (@identificador)
                </label>
                <input
                  type="text"
                  value={editUsername}
                  onChange={(e) => setEditUsername(e.target.value)}
                  placeholder="Ex: @leonardo.juliano"
                  className="w-full px-4 py-3 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl text-sm font-medium focus:outline-none focus:ring-2 focus:ring-black dark:focus:ring-white"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-gray-500 mb-1.5">
                  Biografia do Leitor
                </label>
                <textarea
                  rows={3}
                  value={editBio}
                  onChange={(e) => setEditBio(e.target.value)}
                  placeholder="Partilha os teus géneros favoritos ou uma frase de leitura..."
                  className="w-full p-3 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl text-sm font-medium focus:outline-none focus:ring-2 focus:ring-black dark:focus:ring-white resize-none"
                />
              </div>

              <div className="flex gap-2 justify-end pt-2">
                <button
                  type="button"
                  onClick={() => setShowEditProfileModal(false)}
                  className="px-4 py-2.5 text-xs font-semibold text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-xl"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={savingProfile || !editFullName.trim()}
                  className="px-5 py-2.5 bg-black dark:bg-white text-white dark:text-black rounded-xl text-xs font-semibold shadow-xs disabled:opacity-50"
                >
                  {savingProfile ? "A guardar..." : "Guardar Alterações"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════ */}
      {/* MODAL: SELECIONAR LIVRO PARA A PRATELEIRA DE FAVORITOS     */}
      {/* ══════════════════════════════════════════════════════════ */}
      {showAddFavModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-in fade-in duration-200">
          <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-3xl max-w-md w-full max-h-[80vh] flex flex-col p-6 shadow-2xl animate-in zoom-in-95 duration-200 text-black dark:text-white">
            <div className="flex items-center justify-between pb-3 border-b border-gray-200 dark:border-gray-800 mb-3">
              <div>
                <h3 className="font-bold text-base">Escolher Livro Favorito</h3>
                <span className="text-[11px] text-gray-400">Seleciona um livro da tua biblioteca</span>
              </div>
              <button
                type="button"
                onClick={() => setShowAddFavModal(false)}
                className="p-1 rounded-full hover:bg-gray-100 dark:hover:bg-gray-800"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto space-y-2 py-2 no-scrollbar">
              {loadingBooks ? (
                <div className="py-12 text-center text-xs text-gray-500">A carregar a tua estante...</div>
              ) : availableBooks.length === 0 ? (
                <div className="py-12 text-center text-xs text-gray-500">
                  Ainda não tens livros adicionados à biblioteca.<br />
                  Visita a secção Biblioteca ou Explorar para adicionar obras.
                </div>
              ) : (
                availableBooks.map((b) => (
                  <div
                    key={b.id}
                    onClick={() => handleSelectFavBook(b)}
                    className="p-3 rounded-2xl border border-gray-200 dark:border-gray-800 hover:border-black dark:hover:border-white transition-all flex items-center gap-3 cursor-pointer group"
                  >
                    <div className="w-12 h-16 rounded-lg bg-gray-100 dark:bg-gray-800 overflow-hidden shrink-0 border border-gray-200 dark:border-gray-700">
                      {b.coverUrl ? (
                        <img src={b.coverUrl} alt={b.title} className="w-full h-full object-cover" />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center">
                          <BookOpen className="w-5 h-5 text-gray-400" />
                        </div>
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      <h4 className="font-bold text-xs truncate group-hover:underline">{b.title}</h4>
                      <p className="text-[11px] text-gray-500 truncate">{b.author}</p>
                    </div>
                    <Plus className="w-4 h-4 text-gray-400 group-hover:text-black dark:group-hover:text-white shrink-0" />
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════ */}
      {/* MODAL: CONFIRMAR ELIMINAÇÃO DE CONTA (7 DIAS)             */}
      {/* ══════════════════════════════════════════════════════════ */}
      {showConfirmDeleteModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-in fade-in duration-200">
          <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-3xl max-w-md w-full p-6 shadow-2xl animate-in zoom-in-95 duration-200 text-black dark:text-white">
            <div className="w-12 h-12 rounded-2xl bg-gray-100 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 flex items-center justify-center mb-4">
              <AlertTriangle className="w-6 h-6 text-black dark:text-white" />
            </div>

            <h3 className="font-bold text-base mb-2">Eliminar Conta</h3>
            <p className="text-xs text-gray-600 dark:text-gray-300 leading-relaxed mb-6">
              A eliminação só se tornará definitiva após <strong>7 dias</strong>. Durante esse período, basta iniciares sessão novamente na tua conta para anular o cancelamento e recuperares todos os teus dados de leitura.
            </p>

            <div className="flex gap-2 justify-end">
              <button
                type="button"
                onClick={() => setShowConfirmDeleteModal(false)}
                className="px-4 py-2.5 text-xs font-semibold text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-xl"
              >
                Voltar
              </button>
              <button
                type="button"
                onClick={handleScheduleDelete}
                disabled={processingDelete}
                className="px-5 py-2.5 bg-black dark:bg-white text-white dark:text-black rounded-xl text-xs font-bold active:scale-95 transition-all shadow-xs"
              >
                {processingDelete ? "A agendar..." : "Confirmar Eliminação (7 dias)"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal de Restrições para Convidados */}
      <GuestRestrictionModal
        isOpen={restrictionModal.isOpen}
        onClose={() => setRestrictionModal({ isOpen: false, feature: "general" })}
        feature={restrictionModal.feature}
      />

      {/* Navegação Inferior */}
      <BottomNav />
    </div>
  );
}
