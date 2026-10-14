import { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  Search,
  BookOpen,
  Plus,
  ShoppingBag,
  Phone,
  Edit3,
  Trash2,
  Shield,
  Tag,
  ChevronDown,
  Check,
  X,
  Clock
} from "lucide-react";
import BottomNav from "../components/BottomNav";
import AdminBookSaleModal from "../components/AdminBookSaleModal";
import { supabase } from "../lib/supabase";
import { getCached, setCached } from "../lib/cache";
import { EXPANDED_CATEGORIES, loadAndSyncCategories, type AppCategory } from "../lib/categoryData";
import {
  checkIsAdmin,
  fetchBooksForSale,
  buildWhatsAppLink,
  deleteBookAsAdmin,
  type BookSaleItem
} from "../lib/storeService";

interface Book {
  id: string;
  title: string;
  author: string;
  description: string | null;
  cover_url: string | null;
  file_url: string;
  file_type: "pdf" | "epub" | "physical";
  total_pages?: number;
  category_id: string | null;
  avg_rating?: number;
  total_ratings?: number;
  created_at: string;
  // Moderação
  is_approved?: boolean;
  // Campos de venda
  is_for_sale?: boolean;
  price?: number;
  currency?: string;
  stock_status?: "available" | "out_of_stock";
  seller_whatsapp?: string;
  uploaded_by?: string;
}

export default function Explore() {
  const [books, setBooks] = useState<Book[]>(() => getCached<Book[]>("explore_books") || []);
  const [storeBooks, setStoreBooks] = useState<BookSaleItem[]>([]);
  const [categories, setCategories] = useState<AppCategory[]>(() => getCached<AppCategory[]>("explore_categories") || EXPANDED_CATEGORIES);
  const [selectedCategory, setSelectedCategory] = useState<string>("all");
  const [isCategoryDropdownOpen, setIsCategoryDropdownOpen] = useState(false);
  const [categorySearchQuery, setCategorySearchQuery] = useState("");
  
  // Filtro de Formato / Catálogo
  const [catalogFilter, setCatalogFilter] = useState<"all" | "free" | "store" | "pdf" | "epub" | "pending_approval">("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [loading, setLoading] = useState(() => !getCached<Book[]>("explore_books"));
  const [isAdmin, setIsAdmin] = useState(false);

  // Estados do Modal de Venda de Livros (Admin)
  const [showSaleModal, setShowSaleModal] = useState(false);
  const [editingBook, setEditingBook] = useState<BookSaleItem | null>(null);

  const navigate = useNavigate();

  // Verifica se a URL solicita a aba de aprovações
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get("tab") === "admin_approvals") {
      setCatalogFilter("pending_approval");
    }
  }, []);

  // Carregar dados reais do Supabase & Livros para Venda
  useEffect(() => {
    async function loadData() {
      try {
        // 1. Verifica se é administrador
        const adminStatus = await checkIsAdmin();
        setIsAdmin(adminStatus);

        // 2. Categorias: Carrega as 24 categorias literárias sincronizadas
        const mergedCategories = await loadAndSyncCategories();
        setCategories(mergedCategories);
        setCached("explore_categories", mergedCategories);

        // 3. Livros digitais gratuitos / doados (incluindo status de aprovação)
        const { data: bookList, error } = await supabase
          .from("books")
          .select("id, title, author, description, cover_url, file_url, file_type, total_pages, category_id, avg_rating, total_ratings, created_at, is_for_sale, price, currency, stock_status, seller_whatsapp, uploaded_by, is_approved")
          .order("created_at", { ascending: false });

        if (!error && bookList) {
          setBooks(bookList as Book[]);
          setCached("explore_books", bookList);
        }

        // 4. Livros à venda
        const saleItems = await fetchBooksForSale();
        setStoreBooks(saleItems);
      } catch (err) {
        console.error("Erro ao carregar catálogo:", err);
      } finally {
        setLoading(false);
      }
    }

    loadData();
  }, []);

  // Mescla livros digitais com livros de loja garantindo sem duplicados
  const allCombinedBooks: Book[] = (() => {
    const map = new Map<string, Book>();

    books.forEach((b) => {
      map.set(b.id, b);
    });

    storeBooks.forEach((sb) => {
      map.set(sb.id, {
        id: sb.id,
        title: sb.title,
        author: sb.author,
        description: sb.description,
        cover_url: sb.cover_url,
        file_url: sb.file_url || "",
        file_type: sb.file_type || "physical",
        total_pages: sb.total_pages || 0,
        category_id: sb.category_id || null,
        created_at: sb.created_at,
        is_for_sale: true,
        price: sb.price,
        currency: sb.currency || "MT",
        stock_status: sb.stock_status,
        seller_whatsapp: sb.seller_whatsapp,
        uploaded_by: sb.uploaded_by,
        is_approved: true, // Livros da loja adicionados pelo admin são aprovados
      });
    });

    return Array.from(map.values()).sort(
      (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    );
  })();

  // Contagem de livros pendentes de aprovação
  const pendingCount = books.filter((b) => b.is_approved === false).length;

  // Filtragem dos livros
  const filteredBooks = allCombinedBooks.filter((b) => {
    const matchesSearch =
      b.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      b.author.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (b.description && b.description.toLowerCase().includes(searchQuery.toLowerCase()));

    const matchesCategory = selectedCategory === "all" || b.category_id === selectedCategory;

    // 1. Se estiver na aba de moderação (Admin), mostra apenas pendentes
    if (catalogFilter === "pending_approval") {
      return matchesSearch && matchesCategory && b.is_approved === false;
    }

    // 2. Se o utilizador NÃO for admin, oculta qualquer livro doado pendente de moderação
    if (!isAdmin && b.is_approved === false) {
      return false;
    }

    let matchesFilter = true;
    if (catalogFilter === "free") matchesFilter = !b.is_for_sale && b.is_approved !== false;
    else if (catalogFilter === "store") matchesFilter = Boolean(b.is_for_sale);
    else if (catalogFilter === "pdf") matchesFilter = b.file_type === "pdf" && !b.is_for_sale && b.is_approved !== false;
    else if (catalogFilter === "epub") matchesFilter = b.file_type === "epub" && !b.is_for_sale && b.is_approved !== false;

    return matchesSearch && matchesCategory && matchesFilter;
  });

  // Ações de Administrador: Aprovar Livro Doado
  const handleApproveBook = async (e: React.MouseEvent, book: Book) => {
    e.stopPropagation();
    try {
      const { error } = await supabase
        .from("books")
        .update({ is_approved: true })
        .eq("id", book.id);

      if (error) throw error;

      setBooks((prev) =>
        prev.map((b) => (b.id === book.id ? { ...b, is_approved: true } : b))
      );
    } catch (err) {
      console.error("Erro ao aprovar livro:", err);
      alert("Não foi possível aprovar o livro. Tenta novamente.");
    }
  };

  // Ações de Administrador: Editar Livro à Venda
  const handleEditSaleBook = (e: React.MouseEvent, book: Book) => {
    e.stopPropagation();
    const item: BookSaleItem = {
      id: book.id,
      title: book.title,
      author: book.author,
      description: book.description,
      cover_url: book.cover_url,
      file_url: book.file_url,
      file_type: book.file_type,
      total_pages: book.total_pages,
      category_id: book.category_id,
      is_for_sale: true,
      price: book.price || 0,
      currency: book.currency || "MT",
      stock_status: book.stock_status || "available",
      seller_whatsapp: book.seller_whatsapp || "",
      created_at: book.created_at,
    };
    setEditingBook(item);
    setShowSaleModal(true);
  };

  // Ações de Administrador: Eliminar Livro (qualquer livro do sistema)
  const handleDeleteBook = async (e: React.MouseEvent, book: Book) => {
    e.stopPropagation();
    const isSale = Boolean(book.is_for_sale);
    const tipo = isSale ? "à venda" : "doado";

    if (!confirm(`Tens a certeza de que desejas remover o livro "${book.title}" (${tipo}) do sistema?`)) {
      return;
    }

    try {
      await deleteBookAsAdmin(book.id);
      setBooks((prev) => prev.filter((b) => b.id !== book.id));
      setStoreBooks((prev) => prev.filter((b) => b.id !== book.id));
    } catch (err) {
      console.error("Erro ao apagar livro:", err);
      alert("Não foi possível apagar o livro.");
    }
  };

  // Abrir Página de Detalhes ou Leitura
  const handleCardClick = (book: Book) => {
    if (book.is_for_sale) {
      // Se for livro à venda, abre link do WhatsApp diretamente
      handleBuyViaWhatsApp(book);
    } else {
      navigate(`/book/${book.id}`);
    }
  };

  // Ação de Compra / Reserva via WhatsApp
  const handleBuyViaWhatsApp = (book: Book) => {
    const link = buildWhatsAppLink({
      title: book.title,
      price: book.price,
      currency: book.currency,
      seller_whatsapp: book.seller_whatsapp || "258840000000",
      stock_status: book.stock_status || "available",
    });
    window.open(link, "_blank", "noopener,noreferrer");
  };

  // Callback após guardar livro no modal
  const handleBookSaved = (saved: BookSaleItem) => {
    setStoreBooks((prev) => {
      const idx = prev.findIndex((b) => b.id === saved.id);
      if (idx >= 0) {
        const copy = [...prev];
        copy[idx] = saved;
        return copy;
      }
      return [saved, ...prev];
    });
  };

  const storeCount = allCombinedBooks.filter((b) => b.is_for_sale).length;
  const freeCount = allCombinedBooks.filter((b) => !b.is_for_sale).length;
  const currentCategoryName = categories.find((c) => c.id === selectedCategory)?.name || "Todas as Categorias";

  // Categorias filtradas pela barra de pesquisa interna do seletor
  const filteredCategoryList = categories.filter((c) =>
    c.name.toLowerCase().includes(categorySearchQuery.toLowerCase())
  );

  return (
    <div className="flex flex-col min-h-screen bg-gray-50 dark:bg-black text-black dark:text-white pb-24 md:pb-12 md:pt-16">
      
      {/* Header Responsivo */}
      <header className="px-3 sm:px-6 pt-safe sticky top-0 md:static z-10 bg-white dark:bg-black border-b border-gray-100 dark:border-gray-900">
        <div className="app-container pt-4 sm:pt-7 pb-3.5 sm:pb-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-3 sm:mb-4">
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h1 className="text-xl sm:text-2xl font-bold tracking-tight">Explorar Catálogo</h1>
                {isAdmin && (
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-black dark:bg-white text-white dark:text-black flex items-center gap-1 shadow-xs">
                    <Shield className="w-3 h-3 stroke-[2.5]" />
                    Admin
                  </span>
                )}
              </div>
              <span className="text-[11px] sm:text-xs text-gray-500 dark:text-gray-400 block mt-0.5">
                {catalogFilter === "store"
                  ? "Livraria Kuwerenga • Livros impressos e encomendas via WhatsApp"
                  : "Livros digitais gratuitos e livros impressos à venda"}
              </span>
            </div>

            {/* Ações de Topo (Responsivas com quebra harmoniosa) */}
            <div className="flex items-center gap-2 flex-wrap">
              {/* Botão de Administrador: Cadastrar Livro para Vender */}
              {isAdmin && (
                <button
                  type="button"
                  onClick={() => {
                    setEditingBook(null);
                    setShowSaleModal(true);
                  }}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-full text-xs font-bold active:scale-95 transition-transform shadow-xs"
                  title="Cadastrar Livro para Vender (Admin)"
                >
                  <ShoppingBag className="w-3.5 h-3.5 stroke-[2.5]" />
                  <span>+ Vender Livro</span>
                </button>
              )}

              {/* Botão de Doar Livro (NÃO É PERMITIDO na aba de livros à venda) */}
              {catalogFilter !== "store" && (
                <Link
                  to="/donate-book"
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-black dark:bg-white text-white dark:text-black rounded-full text-xs font-semibold active:scale-95 transition-transform shadow-xs"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Doar Livro</span>
                </Link>
              )}
            </div>
          </div>

          {/* Barra de Pesquisa */}
          <div className="relative">
            <Search className="w-4.5 h-4.5 absolute left-3.5 sm:left-4 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Pesquisar livros, autores, preços ou temas..."
              className="w-full pl-10 sm:pl-12 pr-4 py-2.5 sm:py-3 bg-gray-100 dark:bg-gray-900 rounded-2xl focus:outline-none text-xs sm:text-sm font-medium transition-all"
            />
          </div>
        </div>
      </header>

      <main className="flex-1">
        {/* ─── Barra de Filtros e Dropdown de Categorias Responsiva ─── */}
        <div className="px-3 sm:px-6 py-3 app-container flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
          {/* Abas de Formato/Modo com scroll suave em mobile */}
          <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar py-0.5 w-full sm:w-auto -mx-1 px-1">
            <button
              onClick={() => setCatalogFilter("all")}
              className={`px-3 sm:px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all whitespace-nowrap flex items-center gap-1.5 shrink-0 ${
                catalogFilter === "all"
                  ? "bg-black dark:bg-white text-white dark:text-black shadow-xs scale-[1.02]"
                  : "bg-white dark:bg-gray-900 text-gray-600 dark:text-gray-400 border border-gray-200 dark:border-gray-800 hover:border-gray-300 dark:hover:border-gray-700"
              }`}
            >
              <span>Todo o Catálogo</span>
              <span className="text-[10px] opacity-75">({allCombinedBooks.length})</span>
            </button>

            <button
              onClick={() => setCatalogFilter("store")}
              className={`px-3 sm:px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all whitespace-nowrap flex items-center gap-1.5 shrink-0 ${
                catalogFilter === "store"
                  ? "bg-emerald-600 text-white shadow-xs scale-[1.02]"
                  : "bg-white dark:bg-gray-900 text-emerald-600 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-900/60 hover:bg-emerald-50 dark:hover:bg-emerald-950/30"
              }`}
            >
              <ShoppingBag className="w-3.5 h-3.5" />
              <span>Livros à Venda</span>
              {storeCount > 0 && <span className="text-[10px] opacity-90">({storeCount})</span>}
            </button>

            <button
              onClick={() => setCatalogFilter("free")}
              className={`px-3 sm:px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all whitespace-nowrap flex items-center gap-1.5 shrink-0 ${
                catalogFilter === "free"
                  ? "bg-black dark:bg-white text-white dark:text-black shadow-xs scale-[1.02]"
                  : "bg-white dark:bg-gray-900 text-gray-600 dark:text-gray-400 border border-gray-200 dark:border-gray-800 hover:border-gray-300 dark:hover:border-gray-700"
              }`}
            >
              <BookOpen className="w-3.5 h-3.5" />
              <span>Leitura Grátis</span>
              {freeCount > 0 && <span className="text-[10px] opacity-75">({freeCount})</span>}
            </button>

            {catalogFilter !== "store" && (
              <>
                <button
                  onClick={() => setCatalogFilter("pdf")}
                  className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-colors whitespace-nowrap shrink-0 ${
                    catalogFilter === "pdf"
                      ? "bg-black dark:bg-white text-white dark:text-black"
                      : "bg-white dark:bg-gray-900 text-gray-600 dark:text-gray-400 border border-gray-200 dark:border-gray-800"
                  }`}
                >
                  PDF
                </button>

                <button
                  onClick={() => setCatalogFilter("epub")}
                  className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-colors whitespace-nowrap shrink-0 ${
                    catalogFilter === "epub"
                      ? "bg-black dark:bg-white text-white dark:text-black"
                      : "bg-white dark:bg-gray-900 text-gray-600 dark:text-gray-400 border border-gray-200 dark:border-gray-800"
                  }`}
                >
                  ePub
                </button>
              </>
            )}

            {/* Aba de Moderação exclusiva para o Administrador */}
            {isAdmin && (
              <button
                onClick={() => setCatalogFilter("pending_approval")}
                className={`px-3 sm:px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all whitespace-nowrap flex items-center gap-1.5 shrink-0 ${
                  catalogFilter === "pending_approval"
                    ? "bg-amber-600 text-white shadow-xs scale-[1.02]"
                    : "bg-white dark:bg-gray-900 text-amber-600 dark:text-amber-400 border border-amber-200 dark:border-amber-900/60 hover:bg-amber-50 dark:hover:bg-amber-950/30"
                }`}
              >
                <Clock className="w-3.5 h-3.5" />
                <span>Moderação</span>
                {pendingCount > 0 && (
                  <span className="px-1.5 py-0.2 rounded-full bg-amber-500 text-white text-[10px] font-bold">
                    {pendingCount}
                  </span>
                )}
              </button>
            )}
          </div>

          {/* ─── Botão do Seletor de Categorias Aumentado e Mais Visível ─── */}
          <div className="self-start sm:self-auto shrink-0 w-full sm:w-auto">
            <button
              type="button"
              onClick={() => {
                setCategorySearchQuery("");
                setIsCategoryDropdownOpen(true);
              }}
              className={`w-full sm:w-auto flex items-center justify-between sm:justify-start gap-2.5 px-3.5 py-2 rounded-xl text-xs font-semibold border transition-all ${
                selectedCategory !== "all"
                  ? "bg-black dark:bg-white text-white dark:text-black border-black dark:border-white shadow-xs font-bold"
                  : "bg-white dark:bg-gray-900 border-gray-200 dark:border-gray-800 text-gray-700 dark:text-gray-300 hover:border-gray-400 dark:hover:border-gray-600"
              }`}
              title="Filtrar por Categoria"
              aria-expanded={isCategoryDropdownOpen}
            >
              <div className="flex items-center gap-2 truncate">
                <Tag className="w-3.5 h-3.5 shrink-0" />
                <span className="truncate">
                  {selectedCategory === "all" ? "Todas as Categorias" : currentCategoryName}
                </span>
              </div>
              <ChevronDown className="w-3.5 h-3.5 shrink-0" />
            </button>
          </div>
        </div>

        {/* ─── Banner Informativo para a Seção de Moderação (Admin) ─── */}
        {catalogFilter === "pending_approval" && (
          <div className="px-3 sm:px-6 my-2 app-container">
            <div className="p-3.5 sm:p-4 rounded-2xl border border-amber-200 dark:border-amber-900/60 bg-amber-50/70 dark:bg-amber-950/30 flex items-start gap-3">
              <div className="w-8 h-8 rounded-xl bg-amber-500 text-white flex items-center justify-center shrink-0">
                <Clock className="w-4 h-4" />
              </div>
              <div className="flex-1">
                <h3 className="font-bold text-xs sm:text-sm text-amber-900 dark:text-amber-300">
                  Moderação de Livros Doados ({pendingCount} pendente{pendingCount === 1 ? "" : "s"})
                </h3>
                <p className="text-[11px] text-amber-800/80 dark:text-amber-400/80 mt-0.5 leading-relaxed">
                  Estes livros foram enviados pela comunidade e aguardam a tua aprovação. Clica em "Aprovar" para que fiquem disponíveis para todos os leitores do Kuwerenga.
                </p>
              </div>
            </div>
          </div>
        )}

        {/* ─── Banner Informativo para a Seção de Livros à Venda ─── */}
        {catalogFilter === "store" && (
          <div className="px-3 sm:px-6 my-2 app-container">
            <div className="p-3.5 sm:p-4 rounded-2xl border border-emerald-200 dark:border-emerald-900/60 bg-emerald-50/70 dark:bg-emerald-950/30 flex items-start gap-3">
              <div className="w-8 h-8 rounded-xl bg-emerald-600 text-white flex items-center justify-center shrink-0">
                <ShoppingBag className="w-4 h-4" />
              </div>
              <div className="flex-1">
                <h3 className="font-bold text-xs sm:text-sm text-emerald-900 dark:text-emerald-300">
                  Livraria Direta Kuwerenga
                </h3>
                <p className="text-[11px] text-emerald-800/80 dark:text-emerald-400/80 mt-0.5 leading-relaxed">
                  Adquire livros físicos e obras exclusivas diretamente pelo WhatsApp. Se o livro estiver em stock, a tua encomenda é combinada na hora. Se estiver esgotado, podes solicitar reserva imediata!
                </p>
              </div>
            </div>
          </div>
        )}

        {/* ─── Lista de Livros ─── */}
        <section className="px-3 sm:px-6 pb-6 pt-2 app-container">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-base sm:text-lg font-bold">
              {catalogFilter === "store"
                ? "Livros para Compra & Encomenda"
                : catalogFilter === "free"
                ? "Livros Digitais para Ler Grátis"
                : "Catálogo Disponível"}
              {" "}
              <span className="text-xs text-gray-400 font-normal">
                ({filteredBooks.length} {filteredBooks.length === 1 ? "livro" : "livros"})
              </span>
            </h2>
          </div>

          {loading ? (
            <div className="flex flex-col items-center justify-center py-20 gap-3">
              <div className="w-8 h-8 border-2 border-black dark:border-white border-t-transparent dark:border-t-transparent rounded-full animate-spin"></div>
              <p className="text-xs text-gray-400">A carregar catálogo de livros...</p>
            </div>
          ) : filteredBooks.length === 0 ? (
            <div className="bg-white dark:bg-gray-900 rounded-3xl p-8 border border-gray-100 dark:border-gray-800 text-center my-6 shadow-xs">
              <div className="w-14 h-14 bg-gray-100 dark:bg-gray-800 text-gray-400 rounded-2xl flex items-center justify-center mx-auto mb-4">
                <BookOpen className="w-7 h-7" />
              </div>
              <h3 className="font-bold text-base mb-1">Nenhum livro encontrado</h3>
              <p className="text-xs text-gray-500 mb-6 leading-relaxed max-w-xs mx-auto">
                {searchQuery || selectedCategory !== "all"
                  ? "Tenta pesquisar por outro termo ou remover os filtros de pesquisa."
                  : catalogFilter === "pending_approval"
                  ? "Não existem livros pendentes de moderação neste momento. Todas as doações estão revistas e aprovadas."
                  : catalogFilter === "store"
                  ? isAdmin
                    ? "Ainda não existem livros cadastrados para venda. Como administrador, podes adicionar o primeiro livro!"
                    : "Ainda não existem livros físicos disponíveis para venda de momento. Volta a consultar em breve!"
                  : "Ainda não existem livros neste catálogo. Sê o primeiro a doar uma obra para a comunidade!"}
              </p>
              
              {catalogFilter === "pending_approval" ? null : catalogFilter === "store" ? (
                isAdmin && (
                  <button
                    onClick={() => setShowSaleModal(true)}
                    className="inline-flex items-center gap-2 px-5 py-3 bg-emerald-600 text-white rounded-xl text-xs font-semibold shadow-sm active:scale-95 transition-transform"
                  >
                    <ShoppingBag className="w-4 h-4" />
                    <span>Cadastrar Primeiro Livro para Vender</span>
                  </button>
                )
              ) : (
                <Link
                  to="/donate-book"
                  className="inline-flex items-center gap-2 px-5 py-3 bg-black dark:bg-white text-white dark:text-black rounded-xl text-xs font-semibold shadow-sm active:scale-95 transition-transform"
                >
                  <Plus className="w-4 h-4" />
                  <span>Doar o Primeiro Livro</span>
                </Link>
              )}
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3.5 sm:gap-4">
              {filteredBooks.map((book) => {
                const isSale = Boolean(book.is_for_sale);
                const isOutOfStock = book.stock_status === "out_of_stock";

                return (
                  <div
                    key={book.id}
                    onClick={() => handleCardClick(book)}
                    className={`bg-white dark:bg-gray-900 border rounded-2xl p-3 sm:p-4 flex gap-3 sm:gap-4 transition-all cursor-pointer group shadow-xs relative ${
                      isSale
                        ? "border-emerald-200/80 dark:border-emerald-900/50 hover:border-emerald-600 dark:hover:border-emerald-500"
                        : "border-gray-100 dark:border-gray-800 hover:border-black dark:hover:border-white"
                    }`}
                  >
                    {/* Capa */}
                    <div className="w-20 h-28 sm:w-22 sm:h-32 bg-gray-100 dark:bg-gray-800 rounded-xl overflow-hidden flex-shrink-0 flex items-center justify-center relative border border-gray-200 dark:border-gray-700 shadow-xs">
                      {book.cover_url ? (
                        <img
                          src={book.cover_url}
                          alt={book.title}
                          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                        />
                      ) : (
                        <div className="w-full h-full p-2 flex flex-col justify-between bg-black text-white text-center">
                          <span className="text-[8px] uppercase tracking-widest text-gray-400">
                            {book.file_type}
                          </span>
                          <span className="font-serif text-[10px] font-bold line-clamp-3 leading-tight">
                            {book.title}
                          </span>
                          <span className="text-[7px] text-gray-400 truncate">
                            {book.author}
                          </span>
                        </div>
                      )}

                      {/* Badge sobre a capa para livros à venda */}
                      {isSale && (
                        <div className="absolute top-1 left-1 sm:top-1.5 sm:left-1.5">
                          <span className="px-1.5 py-0.5 rounded-md text-[9px] font-extrabold uppercase tracking-wider bg-black/85 text-white backdrop-blur-xs flex items-center gap-1 shadow-xs">
                            <Tag className="w-2.5 h-2.5 text-emerald-400" />
                            {book.price ? `${book.price} ${book.currency || "MT"}` : "À Venda"}
                          </span>
                        </div>
                      )}
                    </div>

                    {/* Informações */}
                    <div className="flex-1 flex flex-col justify-between py-0.5 min-w-0">
                      <div>
                        {/* Tags e Estado do Livro (Zero Emojis - Ícones / Pontos SVG) */}
                        <div className="flex items-center gap-1.5 mb-1 sm:mb-1.5 flex-wrap">
                          {isSale ? (
                            <>
                              <span
                                className={`text-[9px] font-bold uppercase px-2 py-0.5 rounded-md flex items-center gap-1.5 ${
                                  isOutOfStock
                                    ? "bg-red-100 dark:bg-red-950/60 text-red-600 dark:text-red-400 border border-red-200 dark:border-red-900"
                                    : "bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800"
                                }`}
                              >
                                <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${isOutOfStock ? "bg-red-500" : "bg-emerald-500"}`} />
                                <span>{isOutOfStock ? "Esgotado" : "Em Stock"}</span>
                              </span>
                              <span className="text-[9px] font-bold uppercase px-1.5 py-0.5 rounded bg-gray-100 dark:bg-gray-800 text-gray-500">
                                {book.file_type === "physical" ? "Físico" : book.file_type}
                              </span>
                            </>
                          ) : book.is_approved === false ? (
                            <span className="text-[9px] font-bold uppercase px-2 py-0.5 rounded-md flex items-center gap-1.5 bg-amber-100 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-900">
                              <span className="w-1.5 h-1.5 rounded-full bg-amber-500 shrink-0" />
                              <span>Aguardando Aprovação</span>
                            </span>
                          ) : (
                            <span className="inline-block uppercase tracking-wider text-[9px] font-bold px-2 py-0.5 rounded bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300">
                              {book.file_type} • Grátis
                            </span>
                          )}
                        </div>

                        <h3 className="font-bold text-xs sm:text-sm leading-tight mb-1 line-clamp-2 group-hover:underline">
                          {book.title}
                        </h3>
                        <p className="text-[11px] sm:text-xs text-gray-500 truncate mb-1">
                          {book.author}
                        </p>

                        {book.description && (
                          <p className="text-[10px] sm:text-[11px] text-gray-500 dark:text-gray-400 line-clamp-2 leading-relaxed">
                            {book.description}
                          </p>
                        )}
                      </div>

                      {/* Rodapé do Card Responsivo: WhatsApp + Ações de Admin */}
                      <div className="pt-2 border-t border-gray-100 dark:border-gray-800 flex flex-wrap items-center justify-between gap-1.5 mt-2">
                        {isSale ? (
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleBuyViaWhatsApp(book);
                            }}
                            className={`flex items-center justify-center gap-1.5 px-2.5 sm:px-3 py-1.5 rounded-xl text-[11px] sm:text-xs font-bold transition-all shadow-xs active:scale-95 flex-1 sm:flex-initial min-w-[120px] ${
                              isOutOfStock
                                ? "bg-amber-600 hover:bg-amber-700 text-white"
                                : "bg-emerald-600 hover:bg-emerald-700 text-white"
                            }`}
                          >
                            <Phone className="w-3.5 h-3.5 fill-current shrink-0" />
                            <span className="truncate">{isOutOfStock ? "Pedir Reserva no WhatsApp" : "Comprar no WhatsApp"}</span>
                          </button>
                        ) : (
                          <div className="flex items-center justify-between flex-1 text-xs">
                            <span className="text-gray-400 font-medium text-[11px]">
                              {book.total_pages ? `${book.total_pages} págs.` : "Disponível"}
                            </span>
                            <span className="font-semibold text-black dark:text-white flex items-center gap-1 group-hover:translate-x-1 transition-transform text-[11px]">
                              Ler agora →
                            </span>
                          </div>
                        )}

                        {/* Botões de Ação para o Administrador (Sempre alinhados à direita) */}
                        {isAdmin && (
                          <div className="flex items-center gap-1.5 shrink-0 ml-auto" onClick={(e) => e.stopPropagation()}>
                            {/* Botão de Aprovação Imediata se estiver pendente */}
                            {book.is_approved === false && (
                              <button
                                type="button"
                                onClick={(e) => handleApproveBook(e, book)}
                                className="flex items-center gap-1 px-2.5 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-[11px] font-bold transition-all shadow-xs active:scale-95"
                                title="Aprovar livro para o catálogo público"
                                aria-label="Aprovar livro"
                              >
                                <Check className="w-3.5 h-3.5" />
                                <span>Aprovar</span>
                              </button>
                            )}

                            {isSale && (
                              <button
                                type="button"
                                onClick={(e) => handleEditSaleBook(e, book)}
                                className="p-1.5 rounded-lg bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:text-black dark:hover:text-white transition-colors"
                                title="Editar livro para venda"
                                aria-label="Editar livro"
                              >
                                <Edit3 className="w-3.5 h-3.5" />
                              </button>
                            )}

                            <button
                              type="button"
                              onClick={(e) => handleDeleteBook(e, book)}
                              className="p-1.5 rounded-lg bg-red-50 dark:bg-red-950/40 text-red-600 dark:text-red-400 hover:bg-red-100 transition-colors"
                              title={book.is_approved === false ? "Rejeitar e remover livro" : "Eliminar livro (Admin)"}
                              aria-label="Eliminar livro"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </section>
      </main>

      {/* ─── Modal / Dialog de Seleção de Categorias Completo (NUNCA É CORTADO) ─── */}
      {isCategoryDropdownOpen && (
        <div
          className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-200"
          onClick={() => setIsCategoryDropdownOpen(false)}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-lg bg-white dark:bg-gray-900 border-t sm:border border-gray-200 dark:border-gray-800 rounded-t-3xl sm:rounded-3xl shadow-2xl max-h-[85vh] sm:max-h-[80vh] flex flex-col overflow-hidden text-black dark:text-white animate-in slide-in-from-bottom-8 sm:zoom-in-95 duration-200"
          >
            {/* Header do Seletor */}
            <div className="px-5 py-4 border-b border-gray-100 dark:border-gray-800 flex items-center justify-between shrink-0 bg-white/80 dark:bg-gray-900/80 backdrop-blur-md">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-black dark:bg-white text-white dark:text-black flex items-center justify-center">
                  <Tag className="w-4 h-4 stroke-[2.2]" />
                </div>
                <div>
                  <h3 className="font-bold text-sm leading-tight">Filtrar por Categoria</h3>
                  <span className="text-[10px] text-gray-500 dark:text-gray-400">
                    {categories.length} categorias disponíveis
                  </span>
                </div>
              </div>

              <div className="flex items-center gap-1.5">
                {selectedCategory !== "all" && (
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedCategory("all");
                      setIsCategoryDropdownOpen(false);
                    }}
                    className="text-xs font-semibold text-amber-600 dark:text-amber-400 px-2 py-1 rounded-lg hover:bg-amber-50 dark:hover:bg-amber-950/40 transition-colors"
                  >
                    Limpar
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => setIsCategoryDropdownOpen(false)}
                  className="p-1.5 rounded-xl text-gray-500 hover:text-black dark:hover:text-white hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
                  aria-label="Fechar seletor de categorias"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Barra de Pesquisa de Categorias */}
            <div className="p-3.5 border-b border-gray-100 dark:border-gray-800 bg-gray-50/50 dark:bg-gray-800/30">
              <div className="relative">
                <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                <input
                  type="text"
                  value={categorySearchQuery}
                  onChange={(e) => setCategorySearchQuery(e.target.value)}
                  placeholder="Pesquisar entre as categorias..."
                  className="w-full pl-9 pr-4 py-2 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl text-xs font-medium focus:outline-none focus:border-black dark:focus:border-white transition-all"
                  autoFocus
                />
              </div>
            </div>

            {/* Lista com Scroll Suave das Categorias Expandidas */}
            <div className="flex-1 overflow-y-auto p-3 space-y-1">
              {/* Opção "Todas as Categorias" */}
              <button
                type="button"
                onClick={() => {
                  setSelectedCategory("all");
                  setIsCategoryDropdownOpen(false);
                }}
                className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl text-xs font-medium transition-all text-left ${
                  selectedCategory === "all"
                    ? "bg-black text-white dark:bg-white dark:text-black font-bold shadow-xs scale-[1.01]"
                    : "text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800"
                }`}
              >
                <span>Todas as Categorias</span>
                <div className="flex items-center gap-1.5">
                  <span className={`text-[10px] px-2 py-0.5 rounded-md font-semibold ${
                    selectedCategory === "all" ? "bg-white/20 dark:bg-black/20" : "bg-gray-100 dark:bg-gray-800 text-gray-400"
                  }`}>
                    {allCombinedBooks.length}
                  </span>
                  {selectedCategory === "all" && <Check className="w-4 h-4 stroke-[2.5]" />}
                </div>
              </button>

              {/* Categorias Expandidas com Contagem de Livros */}
              {filteredCategoryList.map((cat) => {
                const isSelected = selectedCategory === cat.id;
                const catBookCount = allCombinedBooks.filter(
                  (b) => b.category_id === cat.id
                ).length;

                return (
                  <button
                    key={cat.id}
                    type="button"
                    onClick={() => {
                      setSelectedCategory(cat.id);
                      setIsCategoryDropdownOpen(false);
                    }}
                    className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl text-xs font-medium transition-all text-left ${
                      isSelected
                        ? "bg-black text-white dark:bg-white dark:text-black font-bold shadow-xs scale-[1.01]"
                        : "text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800"
                    }`}
                  >
                    <span className="truncate pr-2">{cat.name}</span>
                    <div className="flex items-center gap-1.5 shrink-0">
                      {catBookCount > 0 && (
                        <span className={`text-[10px] px-2 py-0.5 rounded-md font-semibold ${
                          isSelected ? "bg-white/20 dark:bg-black/20" : "bg-gray-100 dark:bg-gray-800 text-gray-400"
                        }`}>
                          {catBookCount}
                        </span>
                      )}
                      {isSelected && <Check className="w-4 h-4 stroke-[2.5]" />}
                    </div>
                  </button>
                );
              })}

              {filteredCategoryList.length === 0 && (
                <div className="py-8 text-center text-gray-400 text-xs">
                  Nenhuma categoria encontrada para "{categorySearchQuery}".
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Modal de Gestão de Venda de Livros (Admin) */}
      <AdminBookSaleModal
        isOpen={showSaleModal}
        onClose={() => {
          setShowSaleModal(false);
          setEditingBook(null);
        }}
        bookToEdit={editingBook}
        onSaved={handleBookSaved}
        categories={categories}
      />

      <BottomNav />
    </div>
  );
}
