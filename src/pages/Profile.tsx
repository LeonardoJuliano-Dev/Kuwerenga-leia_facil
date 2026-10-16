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
  AlertTriangle,
  Copy,
  Download,
  Link as LinkIcon
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
  getCachedUserProfile,
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

// ─── Gerador de Imagem PNG do Cartão de Perfil (Canvas Retina 2x) ───
// ─── Ícones Vetoriais em Canvas 2D ───
function drawCanvasBookIcon(ctx: CanvasRenderingContext2D, x: number, y: number, size: number) {
  ctx.save();
  ctx.strokeStyle = "#FAF7F2";
  ctx.lineWidth = 1.8;
  ctx.lineCap = "round";
  ctx.lineJoin = "round";

  const cx = x + size / 2;
  const cy = y + size / 2;
  const w = size * 0.68;
  const h = size * 0.52;

  // Página esquerda
  ctx.beginPath();
  ctx.moveTo(cx, cy + h / 2);
  ctx.quadraticCurveTo(cx - w / 4, cy + h / 2 - 2, cx - w / 2, cy + h / 2 + 1);
  ctx.lineTo(cx - w / 2, cy - h / 2 + 1);
  ctx.quadraticCurveTo(cx - w / 4, cy - h / 2 - 2, cx, cy - h / 2);
  ctx.closePath();
  ctx.stroke();

  // Página direita
  ctx.beginPath();
  ctx.moveTo(cx, cy + h / 2);
  ctx.quadraticCurveTo(cx + w / 4, cy + h / 2 - 2, cx + w / 2, cy + h / 2 + 1);
  ctx.lineTo(cx + w / 2, cy - h / 2 + 1);
  ctx.quadraticCurveTo(cx + w / 4, cy - h / 2 - 2, cx, cy - h / 2);
  ctx.closePath();
  ctx.stroke();

  // Lombada central
  ctx.beginPath();
  ctx.moveTo(cx, cy - h / 2);
  ctx.lineTo(cx, cy + h / 2);
  ctx.stroke();

  ctx.restore();
}

function drawCanvasLinkIcon(ctx: CanvasRenderingContext2D, x: number, y: number, size: number) {
  ctx.save();
  ctx.strokeStyle = "#A89A8C";
  ctx.lineWidth = 1.8;
  ctx.lineCap = "round";
  ctx.lineJoin = "round";

  const cx = x + size / 2;
  const cy = y + size / 2;
  const r = size * 0.28;

  ctx.save();
  ctx.translate(cx - 3, cy + 3);
  ctx.rotate(-Math.PI / 4);
  ctx.beginPath();
  ctx.ellipse(0, 0, r * 1.3, r * 0.72, 0, 0, Math.PI * 2);
  ctx.stroke();
  ctx.restore();

  ctx.save();
  ctx.translate(cx + 3, cy - 3);
  ctx.rotate(-Math.PI / 4);
  ctx.beginPath();
  ctx.ellipse(0, 0, r * 1.3, r * 0.72, 0, 0, Math.PI * 2);
  ctx.stroke();
  ctx.restore();

  ctx.restore();
}

// ─── Gerador de Imagem PNG do Cartão de Perfil (Canvas Retina 2x) ───
async function generateCardCanvasBlob(
  profile: UserProfileData,
  userClubsCount: number,
  shareUrl: string,
  getInitials: (name: string) => string
): Promise<Blob | null> {
  const canvas = document.createElement("canvas");
  const scale = 2;
  const width = 500;
  const hasFavs = Boolean(profile.favorite_books && profile.favorite_books.length > 0);
  const height = hasFavs ? 880 : 750;

  canvas.width = width * scale;
  canvas.height = height * scale;
  const ctx = canvas.getContext("2d");
  if (!ctx) return null;

  ctx.scale(scale, scale);

  const roundRect = (x: number, y: number, w: number, h: number, radius: number) => {
    ctx.beginPath();
    ctx.moveTo(x + radius, y);
    ctx.arcTo(x + w, y, x + w, y + h, radius);
    ctx.arcTo(x + w, y + h, x, y + h, radius);
    ctx.arcTo(x, y + h, x, y, radius);
    ctx.arcTo(x, y, x + w, y, radius);
    ctx.closePath();
  };

  // 1. Fundo do canvas (escuro neutro)
  ctx.fillStyle = "#120F0D";
  ctx.fillRect(0, 0, width, height);

  // 2. Cartão principal (fundo #1A1613, cantos arredondados e borda sutil)
  const pad = 16;
  const cardW = width - pad * 2;
  const cardH = height - pad * 2;
  roundRect(pad, pad, cardW, cardH, 32);
  ctx.fillStyle = "#1A1613";
  ctx.fill();
  ctx.strokeStyle = "#2E2520";
  ctx.lineWidth = 1.5;
  ctx.stroke();

  // 3. Topo: Logo à esquerda e Perfil Literário à direita
  const topY = 44;
  roundRect(42, topY, 40, 40, 12);
  ctx.fillStyle = "#241E1A";
  ctx.fill();
  ctx.strokeStyle = "#382E28";
  ctx.lineWidth = 1;
  ctx.stroke();
  drawCanvasBookIcon(ctx, 42, topY, 40);

  ctx.fillStyle = "#FAF7F2";
  ctx.font = "bold 19px Georgia, serif";
  ctx.textAlign = "left";
  ctx.textBaseline = "alphabetic";
  ctx.fillText("Kuwerenga", 92, topY + 20);

  ctx.fillStyle = "#A89887";
  ctx.font = "bold 9px sans-serif";
  ctx.fillText("LEIA FÁCIL", 92, topY + 34);

  ctx.fillStyle = "#C9BDB0";
  ctx.font = "bold 10px sans-serif";
  ctx.textAlign = "right";
  ctx.fillText("PERFIL LITERÁRIO", width - 42, topY + 25);

  // 4. Avatar do Leitor
  const avatarCenterX = width / 2;
  const avatarCenterY = 175;
  const avatarRadius = 56;

  ctx.save();
  ctx.beginPath();
  ctx.arc(avatarCenterX, avatarCenterY, avatarRadius, 0, Math.PI * 2);
  ctx.closePath();
  ctx.clip();

  let avatarDrawn = false;
  if (profile.avatar_url) {
    try {
      const img = new Image();
      img.crossOrigin = "anonymous";
      img.src = profile.avatar_url;
      await new Promise<void>((resolve, reject) => {
        img.onload = () => resolve();
        img.onerror = () => reject();
        setTimeout(() => reject(), 1200);
      });
      ctx.drawImage(
        img,
        avatarCenterX - avatarRadius,
        avatarCenterY - avatarRadius,
        avatarRadius * 2,
        avatarRadius * 2
      );
      avatarDrawn = true;
    } catch {
      avatarDrawn = false;
    }
  }

  if (!avatarDrawn) {
    ctx.fillStyle = "#261F1A";
    ctx.fillRect(
      avatarCenterX - avatarRadius,
      avatarCenterY - avatarRadius,
      avatarRadius * 2,
      avatarRadius * 2
    );
    ctx.fillStyle = "#FAF7F2";
    ctx.font = "bold 32px Georgia, serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(getInitials(profile.full_name), avatarCenterX, avatarCenterY);
  }
  ctx.restore();

  // Anel sutil do avatar
  ctx.beginPath();
  ctx.arc(avatarCenterX, avatarCenterY, avatarRadius, 0, Math.PI * 2);
  ctx.strokeStyle = "#3A3029";
  ctx.lineWidth = 4;
  ctx.stroke();

  // 5. Nome Completo e Username
  ctx.fillStyle = "#FAF7F2";
  ctx.font = "bold 23px Georgia, serif";
  ctx.textAlign = "center";
  ctx.textBaseline = "alphabetic";

  // Se o nome for longo, divide em duas linhas
  const rawFullName = profile.full_name?.trim() || "Leitor Kuwerenga";
  let nameLines: string[] = [];
  if (rawFullName.length > 22 && rawFullName.includes(" ")) {
    const parts = rawFullName.split(" ");
    const mid = Math.ceil(parts.length / 2);
    nameLines = [parts.slice(0, mid).join(" "), parts.slice(mid).join(" ")];
  } else {
    nameLines = [rawFullName];
  }

  let curY = 264;
  for (const nl of nameLines) {
    ctx.fillText(nl, width / 2, curY);
    curY += 26;
  }

  // Username
  const cleanUsername = profile.username?.trim()
    ? (profile.username.startsWith("@") ? profile.username : `@${profile.username}`)
    : "@leitor";
  ctx.fillStyle = "#9C8E80";
  ctx.font = "12px sans-serif";
  ctx.fillText(cleanUsername, width / 2, curY + 2);

  // 6. Citação / Bio em caixa estilizada
  const rawBio = profile.bio?.trim()
    ? `“${profile.bio}”`
    : "“A existência em si é um mistério...”";

  ctx.font = "italic 13px Georgia, serif";
  const bioWords = rawBio.split(" ");
  const bioLines: string[] = [];
  let bioCurLine = "";
  for (let n = 0; n < bioWords.length; n++) {
    const testLine = bioCurLine + bioWords[n] + " ";
    const metrics = ctx.measureText(testLine);
    if (metrics.width > width - 130 && n > 0) {
      bioLines.push(bioCurLine.trim());
      bioCurLine = bioWords[n] + " ";
      if (bioLines.length >= 2) break;
    } else {
      bioCurLine = testLine;
    }
  }
  if (bioCurLine.trim()) bioLines.push(bioCurLine.trim());

  const bioBoxH = bioLines.length * 20 + 16;
  const bioBoxY = curY + 22;
  roundRect(42, bioBoxY, width - 84, bioBoxH, 16);
  ctx.fillStyle = "#231D19";
  ctx.fill();
  ctx.strokeStyle = "#362C26";
  ctx.lineWidth = 1;
  ctx.stroke();

  ctx.fillStyle = "#D1C3B4";
  ctx.font = "italic 13px Georgia, serif";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  for (let i = 0; i < bioLines.length; i++) {
    const lineY = bioBoxY + (bioBoxH / (bioLines.length + 1)) * (i + 1);
    ctx.fillText(bioLines[i], width / 2, lineY);
  }

  // 7. Grelha de Estatísticas: 3 Caixas Individuais
  const statsY = bioBoxY + bioBoxH + 20;
  const statsTotalW = width - 84;
  const statBoxW = (statsTotalW - 16) / 3;

  const stats = [
    { value: String(profile.views_count || 0), label: "VISUALIZAÇÕES" },
    { value: String(userClubsCount), label: "CLUBES" },
    { value: String(profile.favorite_books?.length || 0), label: "FAVORITOS" }
  ];

  stats.forEach((st, idx) => {
    const boxX = 42 + idx * (statBoxW + 8);
    roundRect(boxX, statsY, statBoxW, 72, 18);
    ctx.fillStyle = "#211B17";
    ctx.fill();
    ctx.strokeStyle = "#332A24";
    ctx.lineWidth = 1;
    ctx.stroke();

    ctx.fillStyle = "#FAF7F2";
    ctx.font = "bold 20px monospace";
    ctx.textAlign = "center";
    ctx.textBaseline = "alphabetic";
    ctx.fillText(st.value, boxX + statBoxW / 2, statsY + 34);

    ctx.fillStyle = "#A89A8C";
    ctx.font = "bold 9.5px sans-serif";
    ctx.fillText(st.label, boxX + statBoxW / 2, statsY + 54);
  });

  // 8. Livros Favoritos em Destaque (se existirem)
  if (hasFavs && profile.favorite_books) {
    let favSectionY = statsY + 92;
    ctx.fillStyle = "#C9BDB0";
    ctx.font = "bold 10px sans-serif";
    ctx.textAlign = "center";
    ctx.fillText("LIVROS EM DESTAQUE", width / 2, favSectionY);

    favSectionY += 14;
    const favList = profile.favorite_books.slice(0, 3);
    const itemW = 72;
    const itemH = 104;
    const gap = 14;
    const totalFavW = favList.length * itemW + (favList.length - 1) * gap;
    let startX = (width - totalFavW) / 2;

    for (const fb of favList) {
      roundRect(startX, favSectionY, itemW, itemH, 12);
      ctx.save();
      ctx.clip();

      let bookCoverDrawn = false;
      if (fb.cover_url) {
        try {
          const bImg = new Image();
          bImg.crossOrigin = "anonymous";
          bImg.src = fb.cover_url;
          await new Promise<void>((res, rej) => {
            bImg.onload = () => res();
            bImg.onerror = () => rej();
            setTimeout(() => rej(), 1200);
          });
          ctx.drawImage(bImg, startX, favSectionY, itemW, itemH);
          bookCoverDrawn = true;
        } catch {
          bookCoverDrawn = false;
        }
      }

      if (!bookCoverDrawn) {
        ctx.fillStyle = "#241E1A";
        ctx.fillRect(startX, favSectionY, itemW, itemH);
        drawCanvasBookIcon(ctx, startX + (itemW - 32) / 2, favSectionY + 24, 32);
        ctx.fillStyle = "#A89A8C";
        ctx.font = "bold 9px sans-serif";
        ctx.textAlign = "center";
        const titleSnippet = fb.title.split(" ").slice(0, 3).join(" ");
        ctx.fillText(titleSnippet, startX + itemW / 2, favSectionY + 74);
      }
      ctx.restore();

      ctx.strokeStyle = "#382E28";
      ctx.lineWidth = 1;
      roundRect(startX, favSectionY, itemW, itemH, 12);
      ctx.stroke();

      startX += itemW + gap;
    }
  }

  // 9. Rodapé Pílula do Cartão com Link e Botão ACEDER
  const footerY = height - 90;
  const pillW = width - 84;
  roundRect(42, footerY, pillW, 54, 27);
  ctx.fillStyle = "#1F1916";
  ctx.fill();
  ctx.strokeStyle = "#362D27";
  ctx.lineWidth = 1.2;
  ctx.stroke();

  // Ícone de link
  drawCanvasLinkIcon(ctx, 56, footerY + 16, 22);

  // Link abreviado
  let cleanDomain = shareUrl.replace(/^https?:\/\//, "");
  if (cleanDomain.length > 20) {
    cleanDomain = cleanDomain.substring(0, 17) + "...";
  }
  ctx.fillStyle = "#FAF7F2";
  ctx.font = "bold 13px monospace";
  ctx.textAlign = "left";
  ctx.textBaseline = "middle";
  ctx.fillText(cleanDomain, 88, footerY + 28);

  // Botão preto tipo pílula ACEDER
  const btnW = 92;
  const btnH = 38;
  const btnX = 42 + pillW - btnW - 8;
  const btnY = footerY + 8;
  roundRect(btnX, btnY, btnW, btnH, 19);
  ctx.fillStyle = "#000000";
  ctx.fill();

  ctx.fillStyle = "#FFFFFF";
  ctx.font = "bold 11px sans-serif";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText("ACEDER", btnX + btnW / 2, btnY + btnH / 2);

  return new Promise((resolve) => {
    canvas.toBlob((blob) => resolve(blob), "image/png");
  });
}

export default function Profile() {
  const { userId: routeUserId } = useParams<{ userId?: string }>();
  const navigate = useNavigate();
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // Utilizador logado
  const [currentUserId, setCurrentUserId] = useState<string | null>(() => {
    if (typeof window !== "undefined") {
      return localStorage.getItem("last_active_user_id") || null;
    }
    return null;
  });
  const [currentUserEmail, setCurrentUserEmail] = useState<string>("");
  const [isGuest, setIsGuest] = useState(() => isGuestMode());

  // Estado do Perfil Carregado (Instantâneo a partir do Cache 0ms)
  const initialProfile = getCachedUserProfile(routeUserId || (typeof window !== "undefined" ? localStorage.getItem("last_active_user_id") || "current" : "current"));
  const [profile, setProfile] = useState<UserProfileData | null>(initialProfile);
  const [loading, setLoading] = useState(!initialProfile && !isGuestMode());
  const [uploadingAvatar, setUploadingAvatar] = useState(false);

  // Navegação por abas superiores (estilo captura enviada)
  const [activeTab, setActiveTab] = useState<"profile" | "notes" | "bookmarks" | "clubs">("profile");

  // Menu de Opções do Cartão de Perfil (...)
  const [showCardOptionsMenu, setShowCardOptionsMenu] = useState(false);
  const cardMenuRef = useRef<HTMLDivElement | null>(null);
  const [showSharePreviewModal, setShowSharePreviewModal] = useState(false);
  const [shareCopyFeedback, setShareCopyFeedback] = useState(false);
  const [generatingCard, setGeneratingCard] = useState(false);
  const [downloadFeedback, setDownloadFeedback] = useState(false);

  // Fecha o menu de opções ao clicar em qualquer outra parte do ecrã ou pressionar Escape
  useEffect(() => {
    function handleClickOutside(event: MouseEvent | TouchEvent) {
      const target = event.target as Node;
      if (cardMenuRef.current && !cardMenuRef.current.contains(target)) {
        setShowCardOptionsMenu(false);
      }
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setShowCardOptionsMenu(false);
      }
    }

    if (showCardOptionsMenu) {
      document.addEventListener("mousedown", handleClickOutside);
      document.addEventListener("touchstart", handleClickOutside);
      document.addEventListener("keydown", handleKeyDown);
    }

    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("touchstart", handleClickOutside);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [showCardOptionsMenu]);

  // Modal: Editar Perfil
  const [showEditProfileModal, setShowEditProfileModal] = useState(false);
  const [editFullName, setEditFullName] = useState(initialProfile?.full_name || "");
  const [editUsername, setEditUsername] = useState(initialProfile?.username || "");
  const [editBio, setEditBio] = useState(initialProfile?.bio || "");
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
  const [scheduledDeleteAt, setScheduledDeleteAt] = useState<string | null>(initialProfile?.scheduled_delete_at || null);
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

  // ─── 1. Carregar Sessão e Dados Iniciais (com Stale-While-Revalidate) ───
  useEffect(() => {
    let isMounted = true;

    async function init() {
      // Se não houver nada em cache, mostra o indicador
      if (!profile) {
        setLoading(true);
      }

      let myId: string | null = null;
      let targetIdToFetch = routeUserId || null;

      if (isGuestMode()) {
        setIsGuest(true);
        setCurrentUserId("guest");
        setCurrentUserEmail("Modo Convidado");
        if (!routeUserId) targetIdToFetch = "guest";
      } else {
        const { data: { user } } = await supabase.auth.getUser();
        if (user) {
          myId = user.id;
          if (isMounted) {
            setCurrentUserId(user.id);
            setCurrentUserEmail(user.email || user.phone || "");
            localStorage.setItem("last_active_user_id", user.id);
          }
          if (!targetIdToFetch) targetIdToFetch = user.id;
        }
      }

      if (targetIdToFetch === "guest") {
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
        return;
      }

      if (targetIdToFetch) {
        try {
          const data = await fetchUserProfile(targetIdToFetch, myId);
          if (isMounted) {
            setProfile(data);
            setEditFullName(data.full_name);
            setEditUsername(data.username);
            setEditBio(data.bio);
            setScheduledDeleteAt(data.scheduled_delete_at || localStorage.getItem(`scheduled_delete_${data.id}`) || null);
          }
        } catch (err) {
          console.warn("Aviso ao sincronizar perfil em segundo plano:", err);
        } finally {
          if (isMounted) setLoading(false);
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

  // ─── 7. Partilhar Perfil com Pré-visualização ───
  const profileShareUrl = typeof window !== "undefined" && profile
    ? `${window.location.origin}/profile/${profile.id}`
    : "";

  const handleOpenShareModal = () => {
    setShowCardOptionsMenu(false);
    setShowSharePreviewModal(true);
  };

  const handleCopyShareLink = async () => {
    if (!profileShareUrl) return;
    try {
      await navigator.clipboard.writeText(profileShareUrl);
      setShareCopyFeedback(true);
      setTimeout(() => setShareCopyFeedback(false), 2000);
    } catch (err) {
      console.error("Erro ao copiar link:", err);
    }
  };

  const handleNativeShare = async () => {
    if (!profile || typeof navigator === "undefined" || !navigator.share) return;
    try {
      await navigator.share({
        title: `Perfil de ${profile.full_name} | Kuwerenga`,
        text: `Espreita o perfil literário de ${profile.full_name} na plataforma Kuwerenga.`,
        url: profileShareUrl,
      });
    } catch {
      // Utilizador cancelou a partilha nativa
    }
  };

  // Partilhar Cartão com Link Anexado
  const handleShareCardWithLink = async () => {
    if (!profile) return;
    setGeneratingCard(true);
    try {
      const blob = await generateCardCanvasBlob(
        profile,
        userClubs.length,
        profileShareUrl,
        getInitials
      );

      if (!blob) {
        await handleNativeShare();
        return;
      }

      const cardFileName = `cartao-perfil-${profile.username || "leitor"}.png`;
      const cardFile = new File([blob], cardFileName, { type: "image/png" });

      if (typeof navigator !== "undefined" && navigator.canShare && navigator.canShare({ files: [cardFile] })) {
        await navigator.share({
          files: [cardFile],
          title: `Perfil de ${profile.full_name} | Kuwerenga`,
          text: `Espreita o meu perfil literário no Kuwerenga: ${profileShareUrl}`,
          url: profileShareUrl,
        });
      } else if (typeof navigator !== "undefined" && navigator.share) {
        await navigator.share({
          title: `Perfil de ${profile.full_name} | Kuwerenga`,
          text: `Espreita o perfil literário de ${profile.full_name} na plataforma Kuwerenga: ${profileShareUrl}`,
          url: profileShareUrl,
        });
      } else {
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = cardFileName;
        a.click();
        URL.revokeObjectURL(url);
        await handleCopyShareLink();
        setDownloadFeedback(true);
        setTimeout(() => setDownloadFeedback(false), 2500);
      }
    } catch (err) {
      console.error("Erro ao partilhar cartão:", err);
    } finally {
      setGeneratingCard(false);
    }
  };

  // Descarregar Imagem do Cartão
  const handleDownloadCardImage = async () => {
    if (!profile) return;
    setGeneratingCard(true);
    try {
      const blob = await generateCardCanvasBlob(
        profile,
        userClubs.length,
        profileShareUrl,
        getInitials
      );
      if (!blob) return;

      const cardFileName = `cartao-perfil-${profile.username || "leitor"}.png`;
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = cardFileName;
      a.click();
      URL.revokeObjectURL(url);
      setDownloadFeedback(true);
      setTimeout(() => setDownloadFeedback(false), 2500);
    } catch (err) {
      console.error("Erro ao descarregar cartão:", err);
    } finally {
      setGeneratingCard(false);
    }
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
    <div className="flex flex-col min-h-screen bg-gray-50 dark:bg-black text-black dark:text-white pb-24 md:pb-12 md:pt-16 select-none">
      {/* Backdrop transparente para fechar o menu de opções ao clicar em qualquer outra parte */}
      {showCardOptionsMenu && (
        <div
          className="fixed inset-0 z-40 bg-transparent"
          onClick={() => setShowCardOptionsMenu(false)}
          aria-hidden="true"
        />
      )}
      
      {/* ─── Top Header da Página (Título e Abas) ─── */}
      <header className="px-4 sm:px-6 pt-safe bg-gray-50 dark:bg-black border-b border-gray-200/80 dark:border-gray-900 sticky top-0 z-30">
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
              
              {/* Botão e Menu de 3 Pontinhos no topo direito do cartão */}
              <div className="flex justify-end relative" ref={cardMenuRef}>
                <button
                  type="button"
                  onClick={() => setShowCardOptionsMenu((prev) => !prev)}
                  className="p-1 rounded-full text-gray-500 hover:text-black dark:hover:text-white transition-colors"
                  title="Opções do perfil"
                  aria-label="Abrir opções do perfil"
                >
                  <MoreHorizontal className="w-5 h-5" />
                </button>

                {/* Popover Dropdown de Opções do Cartão */}
                {showCardOptionsMenu && (
                  <div className="absolute right-0 top-8 w-48 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-2xl shadow-xl py-1 z-50 text-xs animate-in zoom-in-95 duration-150">
                    {isOwnProfile && (
                      <button
                        type="button"
                        onClick={() => {
                          setShowCardOptionsMenu(false);
                          setShowEditProfileModal(true);
                        }}
                        className="w-full px-4 py-2.5 text-left flex items-center gap-2.5 hover:bg-gray-50 dark:hover:bg-gray-800 font-semibold text-black dark:text-white"
                      >
                        <Edit3 className="w-3.5 h-3.5" />
                        <span>Editar Perfil</span>
                      </button>
                    )}

                    <button
                      type="button"
                      onClick={handleOpenShareModal}
                      className="w-full px-4 py-2.5 text-left flex items-center gap-2.5 hover:bg-gray-50 dark:hover:bg-gray-800 font-semibold text-black dark:text-white"
                    >
                      <Share2 className="w-3.5 h-3.5" />
                      <span>Partilhar Perfil</span>
                    </button>

                    {isOwnProfile && (
                      <button
                        type="button"
                        onClick={() => {
                          setShowCardOptionsMenu(false);
                          navigate("/settings");
                        }}
                        className="w-full px-4 py-2.5 text-left flex items-center gap-2.5 hover:bg-gray-50 dark:hover:bg-gray-800 font-semibold border-t border-gray-100 dark:border-gray-800 text-black dark:text-white"
                      >
                        <SettingsIcon className="w-3.5 h-3.5" />
                        <span>Configurações</span>
                      </button>
                    )}
                  </div>
                )}
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

      {/* ══════════════════════════════════════════════════════════ */}
      {/* MODAL: PRÉ-VISUALIZAÇÃO E PARTILHA DE PERFIL (RESPONSIVO)   */}
      {/* ══════════════════════════════════════════════════════════ */}
      {showSharePreviewModal && profile && (
        <div
          className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center p-2.5 sm:p-4 z-50 animate-in fade-in duration-200 overflow-y-auto overscroll-contain"
          onClick={(e) => {
            if (e.target === e.currentTarget) setShowSharePreviewModal(false);
          }}
        >
          <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-2xl sm:rounded-3xl max-w-md w-full max-h-[92dvh] flex flex-col shadow-2xl animate-in zoom-in-95 duration-200 text-black dark:text-white my-auto overflow-hidden">
            
            {/* Cabeçalho do Modal Fixo */}
            <div className="flex items-center justify-between px-4 sm:px-6 py-3.5 sm:py-4 border-b border-gray-100 dark:border-gray-800 shrink-0 bg-white dark:bg-gray-900">
              <div>
                <h3 className="font-bold text-sm sm:text-base leading-tight">Partilhar Perfil</h3>
                <span className="text-[11px] text-gray-500 dark:text-gray-400 block mt-0.5">Pré-visualização do teu cartão de leitor</span>
              </div>
              <button
                type="button"
                onClick={() => setShowSharePreviewModal(false)}
                className="p-1.5 rounded-full text-gray-400 hover:text-black dark:hover:text-white hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors shrink-0"
                aria-label="Fechar"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Conteúdo com Scroll Suave, Barra Elegante e Responsivo */}
            <div className="flex-1 min-h-0 overflow-y-auto p-3.5 sm:p-5 space-y-3.5 sm:space-y-4 custom-scrollbar">
              
              {/* Cartão de Pré-visualização Proporcional e Fiel ao Canvas */}
              <div className="bg-[#1A1613] border border-[#2F2620] rounded-2xl sm:rounded-[28px] p-3.5 sm:p-5 shadow-xl relative overflow-hidden space-y-3 sm:space-y-3.5 text-[#FAF7F2] max-w-sm w-full mx-auto">
                {/* Linha Superior: Logo Oficial & Perfil Literário */}
                <div className="flex items-center justify-between pb-0.5">
                  <div className="flex items-center gap-2">
                    <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-lg bg-[#241E1A] border border-[#382E28] flex items-center justify-center shadow-xs shrink-0 text-[#FAF7F2]">
                      <BookOpen className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                    </div>
                    <div>
                      <span className="font-serif text-sm sm:text-base font-bold tracking-tight block leading-tight text-[#FAF7F2]">
                        Kuwerenga
                      </span>
                      <span className="text-[8px] uppercase tracking-[0.2em] text-[#A89887] font-bold block">
                        Leia Fácil
                      </span>
                    </div>
                  </div>
                  <span className="text-[9px] font-bold uppercase tracking-[0.18em] text-[#C9BDB0]">
                    Perfil Literário
                  </span>
                </div>

                {/* Secção Central: Avatar, Nome, Username e Citação */}
                <div className="flex flex-col items-center text-center pt-1">
                  <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-full ring-3 sm:ring-4 ring-[#3A3029] shadow-lg overflow-hidden bg-[#241E1A] flex items-center justify-center mb-2 shrink-0">
                    {profile.avatar_url ? (
                      <img
                        src={profile.avatar_url}
                        alt={profile.full_name}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <span className="font-serif font-bold text-xl sm:text-2xl text-[#FAF7F2]">
                        {getInitials(profile.full_name)}
                      </span>
                    )}
                  </div>

                  <h4 className="font-serif text-base sm:text-xl font-bold tracking-tight leading-snug mb-0.5 text-[#FAF7F2] max-w-xs px-1">
                    {profile.full_name}
                  </h4>
                  <div className="text-[11px] sm:text-xs font-mono text-[#9C8E80] mb-2">
                    {profile.username ? (profile.username.startsWith("@") ? profile.username : `@${profile.username}`) : "@leitor"}
                  </div>

                  {/* Bio / Citação */}
                  <div className="bg-[#231D19] rounded-xl sm:rounded-2xl px-3 py-2 sm:px-4 sm:py-2.5 border border-[#362C26] text-center text-xs sm:text-sm text-[#D1C3B4] italic w-full leading-relaxed shadow-xs line-clamp-3">
                    &ldquo;{profile.bio?.trim() ? profile.bio : "A existência em si é um mistério..."}&rdquo;
                  </div>
                </div>

                {/* Grelha de Estatísticas: 3 Caixas Individuais */}
                <div className="grid grid-cols-3 gap-1.5 sm:gap-2 text-center pt-0.5">
                  <div className="bg-[#211B17] rounded-xl sm:rounded-2xl p-2 sm:p-2.5 border border-[#332A24] shadow-xs">
                    <span className="block text-base sm:text-lg font-bold font-mono text-[#FAF7F2]">
                      {profile.views_count || 0}
                    </span>
                    <span className="text-[8px] sm:text-[9px] font-bold text-[#A89A8C] uppercase tracking-wider block mt-0.5">
                      Visualizações
                    </span>
                  </div>
                  <div className="bg-[#211B17] rounded-xl sm:rounded-2xl p-2 sm:p-2.5 border border-[#332A24] shadow-xs">
                    <span className="block text-base sm:text-lg font-bold font-mono text-[#FAF7F2]">
                      {userClubs.length}
                    </span>
                    <span className="text-[8px] sm:text-[9px] font-bold text-[#A89A8C] uppercase tracking-wider block mt-0.5">
                      Clubes
                    </span>
                  </div>
                  <div className="bg-[#211B17] rounded-xl sm:rounded-2xl p-2 sm:p-2.5 border border-[#332A24] shadow-xs">
                    <span className="block text-base sm:text-lg font-bold font-mono text-[#FAF7F2]">
                      {profile.favorite_books?.length || 0}
                    </span>
                    <span className="text-[8px] sm:text-[9px] font-bold text-[#A89A8C] uppercase tracking-wider block mt-0.5">
                      Favoritos
                    </span>
                  </div>
                </div>

                {/* Livros Favoritos em Destaque */}
                {profile.favorite_books && profile.favorite_books.length > 0 && (
                  <div className="space-y-1.5 pt-0.5 pb-0.5">
                    <span className="text-[9px] sm:text-[10px] font-bold uppercase tracking-[0.18em] text-[#C9BDB0] block text-center">
                      Livros em Destaque
                    </span>
                    <div className="flex justify-center items-center gap-2 sm:gap-3">
                      {profile.favorite_books.slice(0, 3).map((fb, idx) => (
                        <div
                          key={idx}
                          className="w-12 sm:w-14 aspect-[2/3] rounded-lg sm:rounded-xl bg-[#231D19] border border-[#382E28] overflow-hidden shadow-md shrink-0 group relative"
                          title={fb.title}
                        >
                          {fb.cover_url ? (
                            <img
                              src={fb.cover_url}
                              alt={fb.title}
                              className="w-full h-full object-cover"
                            />
                          ) : (
                            <div className="w-full h-full flex flex-col items-center justify-center p-1 text-[7px] text-center font-bold text-[#A89A8C]">
                              <BookOpen className="w-3 h-3 mb-0.5 opacity-70" />
                              <span className="line-clamp-2 leading-tight">{fb.title}</span>
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Rodapé Pílula do Cartão com Link e Botão Aceder */}
                <div className="bg-[#1F1916] rounded-full p-1.5 sm:p-2 pl-3 sm:pl-3.5 border border-[#362D27] flex items-center justify-between gap-2 shadow-xs">
                  <div className="flex items-center gap-2 min-w-0">
                    <LinkIcon className="w-3.5 h-3.5 text-[#A89A8C] shrink-0" />
                    <span className="text-[11px] sm:text-xs font-mono font-medium text-[#FAF7F2] truncate">
                      {profileShareUrl.replace(/^https?:\/\//, "").length > 22
                        ? profileShareUrl.replace(/^https?:\/\//, "").substring(0, 19) + "..."
                        : profileShareUrl.replace(/^https?:\/\//, "")}
                    </span>
                  </div>
                  <span className="text-[10px] sm:text-[11px] font-bold uppercase tracking-wider px-3 sm:px-4 py-1 sm:py-1.5 rounded-full bg-black text-white shrink-0">
                    Aceder
                  </span>
                </div>
              </div>

              {/* Botão de Destaque: Partilhar Cartão com Link */}
              <div className="space-y-2 pt-1">
                <button
                  type="button"
                  onClick={handleShareCardWithLink}
                  disabled={generatingCard}
                  className="w-full py-2.5 sm:py-3 px-4 rounded-xl sm:rounded-2xl bg-black dark:bg-white text-white dark:text-black text-xs sm:text-sm font-bold flex items-center justify-center gap-2 transition-all active:scale-98 shadow-sm hover:opacity-90 disabled:opacity-50"
                >
                  {generatingCard ? (
                    <div className="w-4 h-4 border-2 border-white dark:border-black border-t-transparent rounded-full animate-spin" />
                  ) : (
                    <Share2 className="w-4 h-4" />
                  )}
                  <span>
                    {generatingCard ? "A processar cartão com link..." : "Partilhar Cartão com Link"}
                  </span>
                </button>

                {/* Ações Secundárias em Grelha */}
                <div className="grid grid-cols-2 gap-2">
                  {/* Descarregar Imagem do Cartão */}
                  <button
                    type="button"
                    onClick={handleDownloadCardImage}
                    disabled={generatingCard}
                    className="py-2 sm:py-2.5 px-3 rounded-xl border border-gray-200 dark:border-gray-800 hover:bg-gray-50 dark:hover:bg-gray-800 text-xs font-semibold flex items-center justify-center gap-1.5 sm:gap-2 transition-colors text-black dark:text-white"
                  >
                    {downloadFeedback ? (
                      <>
                        <Check className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                        <span>Descarregado!</span>
                      </>
                    ) : (
                      <>
                        <Download className="w-3.5 h-3.5" />
                        <span>Guardar Cartão</span>
                      </>
                    )}
                  </button>

                  {/* Partilhar no WhatsApp com Link */}
                  <a
                    href={`https://api.whatsapp.com/send?text=${encodeURIComponent(
                      `Espreita o meu perfil literário no Kuwerenga:\n${profileShareUrl}`
                    )}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="py-2 sm:py-2.5 px-3 rounded-xl border border-gray-200 dark:border-gray-800 hover:bg-gray-50 dark:hover:bg-gray-800 text-xs font-semibold flex items-center justify-center gap-1.5 sm:gap-2 transition-colors text-black dark:text-white"
                  >
                    <MessageCircle className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                    <span>WhatsApp</span>
                  </a>
                </div>
              </div>

              {/* Bloco de Copiar Link Manual */}
              <div className="space-y-1.5 pt-1">
                <label className="text-[10px] sm:text-[11px] font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider block">
                  Link Direto
                </label>
                <div className="flex items-center gap-2">
                  <div className="flex-1 min-w-0 bg-gray-100 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl px-3 py-2 text-xs text-gray-600 dark:text-gray-300 truncate select-all">
                    {profileShareUrl}
                  </div>
                  <button
                    type="button"
                    onClick={handleCopyShareLink}
                    className="px-3.5 sm:px-4 py-2 bg-black dark:bg-white text-white dark:text-black rounded-xl text-xs font-semibold shrink-0 active:scale-95 transition-all flex items-center gap-1.5 shadow-xs"
                  >
                    {shareCopyFeedback ? (
                      <>
                        <Check className="w-3.5 h-3.5" />
                        <span>Copiado!</span>
                      </>
                    ) : (
                      <>
                        <Copy className="w-3.5 h-3.5" />
                        <span>Copiar</span>
                      </>
                    )}
                  </button>
                </div>
              </div>
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
