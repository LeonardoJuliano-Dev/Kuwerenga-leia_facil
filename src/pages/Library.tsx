import { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  Plus,
  BookOpen,
  Trash2,
  CheckCircle2,
  LayoutGrid,
  Columns,
  Star,
  BookCheck,
  RotateCcw
} from "lucide-react";
import BottomNav from "../components/BottomNav";
import MarkBookReadModal from "../components/MarkBookReadModal";
import {
  loadUserBookshelf,
  updateShelfBookStatus,
  removeBookFromShelf,
  type BookshelfItem
} from "../lib/bookshelfService";

export default function Library() {
  const [items, setItems] = useState<BookshelfItem[]>([]);
  const [activeTab, setActiveTab] = useState<"all" | "reading" | "finished" | "saved">("all");
  const [viewMode, setViewMode] = useState<"shelf" | "grid">("shelf");
  const [loading, setLoading] = useState(true);
  const [showAddReadModal, setShowAddReadModal] = useState(false);
  const navigate = useNavigate();

  // Carregar estante completa
  const fetchShelf = async () => {
    try {
      const data = await loadUserBookshelf();
      setItems(data);
    } catch (err) {
      console.error("Erro ao carregar biblioteca:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchShelf();
  }, []);

  // Remover livro da biblioteca
  const handleRemove = async (e: React.MouseEvent, item: BookshelfItem) => {
    e.stopPropagation();
    if (!confirm(`Remover "${item.title}" da tua biblioteca?`)) return;
    await removeBookFromShelf(item);
    setItems((prev) => prev.filter((i) => i.id !== item.id && i.bookId !== item.bookId));
  };

  // Alternar status do livro (ex: marcar como lido ou voltar a ler)
  const handleToggleStatus = async (
    e: React.MouseEvent,
    item: BookshelfItem,
    newStatus: "reading" | "finished" | "saved"
  ) => {
    e.stopPropagation();
    await updateShelfBookStatus(item, newStatus);
    fetchShelf();
  };

  // Filtros de exibição
  const readingBooks = items.filter((i) => (i.status === "reading" || i.status === "to_read") && (i.progress || 0) < 100);
  const finishedBooks = items.filter((i) => i.status === "finished" || (i.progress || 0) >= 100);
  const savedBooks = items.filter((i) => i.status === "saved");

  const displayedItems =
    activeTab === "all"
      ? items
      : activeTab === "reading"
      ? readingBooks
      : activeTab === "finished"
      ? finishedBooks
      : savedBooks;

  return (
    <div className="flex flex-col min-h-screen bg-white dark:bg-black text-black dark:text-white pb-28 md:pb-12 md:pt-16 relative select-none">
      
      {/* ─── Top Bar com Controles da Biblioteca ─── */}
      <header className="px-4 sm:px-6 pt-safe sticky top-0 md:static z-20 bg-white/95 dark:bg-black/95 backdrop-blur-md border-b border-gray-100 dark:border-gray-900">
        <div className="app-container pt-5 sm:pt-7 pb-3">
          
          <div className="flex items-center justify-between mb-4">
            <div>
              <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight flex items-center gap-2">
                <span>Biblioteca</span>
                <span className="text-xs px-2.5 py-0.5 rounded-full bg-gray-100 dark:bg-gray-800 text-black dark:text-white font-bold border border-gray-200 dark:border-gray-700">
                  {items.length} obras
                </span>
              </h1>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                Livros em leitura, concluídos e guardados
              </p>
            </div>

            {/* Ações de Topo */}
            <div className="flex items-center gap-2">
              {/* Alternador de Visualização: Prateleira vs Grade */}
              <div className="flex items-center bg-gray-100 dark:bg-gray-900 p-1 rounded-2xl border border-gray-200 dark:border-gray-800">
                <button
                  onClick={() => setViewMode("shelf")}
                  className={`p-1.5 rounded-xl transition-all ${
                    viewMode === "shelf"
                      ? "bg-white dark:bg-black text-black dark:text-white shadow-xs font-bold"
                      : "text-gray-400 hover:text-black dark:hover:text-white"
                  }`}
                  title="Visualização em Prateleira de Biblioteca"
                >
                  <Columns className="w-4 h-4" />
                </button>
                <button
                  onClick={() => setViewMode("grid")}
                  className={`p-1.5 rounded-xl transition-all ${
                    viewMode === "grid"
                      ? "bg-white dark:bg-black text-black dark:text-white shadow-xs font-bold"
                      : "text-gray-400 hover:text-black dark:hover:text-white"
                  }`}
                  title="Visualização em Grade / Lista"
                >
                  <LayoutGrid className="w-4 h-4" />
                </button>
              </div>

              {/* Botão Principal: Registar Livro Lido */}
              <button
                onClick={() => setShowAddReadModal(true)}
                className="flex items-center gap-1.5 px-3.5 py-2 bg-black dark:bg-white text-white dark:text-black rounded-2xl text-xs font-bold active:scale-95 transition-transform shadow-xs"
              >
                <Plus className="w-3.5 h-3.5 stroke-[2.5]" />
                <span className="hidden sm:inline">Registar</span>
                <span>Lido</span>
              </button>
            </div>
          </div>

          {/* Cartão de Resumo de Leitura (Monocromático) */}
          <div className="grid grid-cols-3 gap-2 p-3 bg-gray-50 dark:bg-gray-900/60 rounded-2xl border border-gray-200 dark:border-gray-800 mb-3 text-center shadow-xs">
            <div 
              onClick={() => setActiveTab("reading")}
              className={`cursor-pointer transition-opacity ${activeTab === "reading" ? "opacity-100 font-bold" : "opacity-80 hover:opacity-100"}`}
            >
              <span className="block text-lg font-black">{readingBooks.length}</span>
              <span className="text-[10px] uppercase tracking-wider text-gray-600 dark:text-gray-400 font-bold">A Ler</span>
            </div>
            <div 
              onClick={() => setActiveTab("finished")}
              className={`cursor-pointer transition-opacity border-x border-gray-200 dark:border-gray-800 ${activeTab === "finished" ? "opacity-100 font-bold" : "opacity-80 hover:opacity-100"}`}
            >
              <span className="block text-lg font-black text-black dark:text-white">
                {finishedBooks.length}
              </span>
              <span className="text-[10px] uppercase tracking-wider text-gray-600 dark:text-gray-400 font-bold">
                Lidos
              </span>
            </div>
            <div 
              onClick={() => setActiveTab("saved")}
              className={`cursor-pointer transition-opacity ${activeTab === "saved" ? "opacity-100 font-bold" : "opacity-80 hover:opacity-100"}`}
            >
              <span className="block text-lg font-black">{savedBooks.length}</span>
              <span className="text-[10px] uppercase tracking-wider text-gray-600 dark:text-gray-400 font-bold">Salvos</span>
            </div>
          </div>

          {/* Abas de Navegação na Biblioteca (Sem Emojis) */}
          <div className="flex gap-2 overflow-x-auto no-scrollbar pb-1 text-xs">
            <button
              onClick={() => setActiveTab("all")}
              className={`px-3.5 py-1.5 rounded-xl font-bold whitespace-nowrap transition-all ${
                activeTab === "all"
                  ? "bg-black dark:bg-white text-white dark:text-black shadow-xs"
                  : "bg-gray-100 dark:bg-gray-900 border border-gray-200 dark:border-gray-800 text-gray-700 dark:text-gray-300 hover:text-black dark:hover:text-white"
              }`}
            >
              Todos ({items.length})
            </button>
            <button
              onClick={() => setActiveTab("reading")}
              className={`px-3.5 py-1.5 rounded-xl font-bold whitespace-nowrap transition-all ${
                activeTab === "reading"
                  ? "bg-black dark:bg-white text-white dark:text-black shadow-xs"
                  : "bg-gray-100 dark:bg-gray-900 border border-gray-200 dark:border-gray-800 text-gray-700 dark:text-gray-300 hover:text-black dark:hover:text-white"
              }`}
            >
              A Ler ({readingBooks.length})
            </button>
            <button
              onClick={() => setActiveTab("finished")}
              className={`px-3.5 py-1.5 rounded-xl font-bold whitespace-nowrap transition-all ${
                activeTab === "finished"
                  ? "bg-black dark:bg-white text-white dark:text-black shadow-xs"
                  : "bg-gray-100 dark:bg-gray-900 border border-gray-200 dark:border-gray-800 text-gray-700 dark:text-gray-300 hover:text-black dark:hover:text-white"
              }`}
            >
              Lidos ({finishedBooks.length})
            </button>
            <button
              onClick={() => setActiveTab("saved")}
              className={`px-3.5 py-1.5 rounded-xl font-bold whitespace-nowrap transition-all ${
                activeTab === "saved"
                  ? "bg-black dark:bg-white text-white dark:text-black shadow-xs"
                  : "bg-gray-100 dark:bg-gray-900 border border-gray-200 dark:border-gray-800 text-gray-700 dark:text-gray-300 hover:text-black dark:hover:text-white"
              }`}
            >
              Salvos ({savedBooks.length})
            </button>
          </div>
        </div>
      </header>

      {/* ─── Conteúdo Principal: Estante ou Lista ─── */}
      <main className="flex-1 px-4 sm:px-6 pt-6 app-container">
        {loading ? (
          <div className="flex flex-col items-center justify-center py-24 gap-3">
            <div className="w-8 h-8 border-2 border-black dark:border-white border-t-transparent dark:border-t-transparent rounded-full animate-spin"></div>
            <p className="text-xs text-gray-400">A carregar a tua biblioteca...</p>
          </div>
        ) : displayedItems.length === 0 ? (
          /* Estado Vazio Monocromático */
          <div className="bg-gray-50 dark:bg-gray-900/60 rounded-3xl p-8 sm:p-12 border border-gray-100 dark:border-gray-800 text-center my-8 shadow-xs">
            <div className="w-16 h-16 bg-white dark:bg-gray-800 text-black dark:text-white rounded-3xl flex items-center justify-center mx-auto mb-4 border border-gray-100 dark:border-gray-700 shadow-xs">
              <BookOpen className="w-8 h-8 stroke-[1.8]" />
            </div>
            <h3 className="font-extrabold text-lg mb-1.5">
              {activeTab === "finished"
                ? "Nenhum livro marcado como lido ainda"
                : activeTab === "reading"
                ? "Nenhum livro em leitura no momento"
                : "A tua biblioteca está à espera de livros"}
            </h3>
            <p className="text-xs text-gray-500 dark:text-gray-400 mb-6 leading-relaxed max-w-sm mx-auto">
              {activeTab === "finished"
                ? "Termina um livro no leitor digital ou regista qualquer livro físico que tenhas lido para preencher a tua prateleira de obras lidas."
                : "Explora o catálogo ou regista livros físicos da tua estante pessoal."}
            </p>
            <div className="flex flex-col sm:flex-row gap-2.5 justify-center">
              <button
                onClick={() => setShowAddReadModal(true)}
                className="px-5 py-3 bg-black dark:bg-white text-white dark:text-black rounded-2xl text-xs font-bold shadow-xs active:scale-95 transition-transform inline-flex items-center justify-center gap-1.5"
              >
                <Plus className="w-4 h-4 stroke-[2.5]" />
                <span>Registar Livro Lido</span>
              </button>
              <Link
                to="/explore"
                className="px-5 py-3 border border-gray-200 dark:border-gray-700 bg-white dark:bg-black rounded-2xl text-xs font-bold active:scale-95 transition-transform inline-flex items-center justify-center gap-1.5"
              >
                <span>Explorar Catálogo</span>
              </Link>
            </div>
          </div>
        ) : viewMode === "shelf" ? (
          /* ══════════════════════════════════════════════════════════ */
          /* VISTA 1: PRATELEIRA DE BIBLIOTECA RESPONSIVA              */
          /* ══════════════════════════════════════════════════════════ */
          <div className="py-4">
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-x-4 sm:gap-x-6 gap-y-10 sm:gap-y-12 items-end">
              {displayedItems.map((book) => {
                const isFinished = book.status === "finished" || (book.progress || 0) >= 100;
                const isReading = (book.status === "reading" || book.status === "to_read") && !isFinished;

                return (
                  <div
                    key={book.id}
                    onClick={() => {
                      if (book.source === "system" && book.bookId) {
                        navigate(`/reader?bookId=${book.bookId}`);
                      }
                    }}
                    className="flex flex-col items-center group cursor-pointer w-full"
                  >
                    {/* Efeito 3D do Livro com Lombada e Sombra */}
                    <div className="relative w-full max-w-[130px] sm:max-w-[150px] aspect-[2/3] rounded-r-lg rounded-l-xs overflow-hidden shadow-lg border-l-[5px] border-l-black/30 dark:border-l-white/20 transition-all duration-300 group-hover:-translate-y-2 group-hover:shadow-xl bg-zinc-900">
                      
                      {book.coverUrl ? (
                        <img
                          src={book.coverUrl}
                          alt={book.title}
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        /* Capa Estilizada Minimalista Monocromática */
                        <div className="w-full h-full p-2.5 flex flex-col justify-between bg-black text-white text-left">
                          <span className="text-[8px] uppercase tracking-widest text-zinc-400 font-bold">
                            {book.isPhysical ? "Físico" : book.fileType || "Kuwerenga"}
                          </span>
                          <div>
                            <h4 className="font-serif text-[11px] font-bold line-clamp-3 leading-tight text-white/95">
                              {book.title}
                            </h4>
                            <span className="text-[8px] text-zinc-400 truncate block mt-1">
                              {book.author}
                            </span>
                          </div>
                          <div className="flex items-center justify-between text-[7px] text-zinc-400">
                            <span>{book.totalPages ? `${book.totalPages}p` : ""}</span>
                            {book.rating && (
                              <span className="text-white font-bold flex items-center gap-0.5">
                                <Star className="w-2.5 h-2.5 fill-white text-white" />
                                {book.rating}
                              </span>
                            )}
                          </div>
                        </div>
                      )}

                      {/* Selo / Badge no Topo do Livro */}
                      {isFinished && (
                        <div className="absolute top-1.5 right-1.5 px-1.5 py-0.5 rounded-md bg-black text-white dark:bg-white dark:text-black text-[9px] font-extrabold flex items-center gap-0.5 shadow-md">
                          <CheckCircle2 className="w-2.5 h-2.5" />
                          <span>Lido</span>
                        </div>
                      )}

                      {book.isPhysical && !isFinished && (
                        <div className="absolute top-1.5 right-1.5 px-1.5 py-0.5 rounded-md bg-zinc-800 text-white text-[9px] font-bold shadow-md flex items-center gap-0.5 border border-zinc-700">
                          <BookOpen className="w-2.5 h-2.5" />
                          <span>Físico</span>
                        </div>
                      )}

                      {/* Barra de Progresso no Fundo da Capa para Livros a Ler */}
                      {isReading && (
                        <div className="absolute bottom-0 inset-x-0 bg-black/80 backdrop-blur-xs py-1 px-1.5 text-[9px] font-bold text-white flex items-center justify-between">
                          <span>Progresso</span>
                          <span>{Math.round(book.progress)}%</span>
                        </div>
                      )}
                    </div>

                    {/* ─── Tábua da Prateleira Sob Cada Livro (Alinhamento Perfeito e Responsivo) ─── */}
                    <div className="bookshelf-shelf w-full h-3.5 sm:h-4 mt-2.5 rounded-xs relative z-0">
                      <div className="absolute -top-0.5 inset-x-0 h-0.5 bg-black/10 dark:bg-white/10" />
                    </div>

                    {/* Metadados Abaixo da Prateleira */}
                    <div className="mt-2 w-full text-center px-1">
                      <h4 className="text-[11px] sm:text-xs font-bold truncate leading-tight group-hover:underline">
                        {book.title}
                      </h4>
                      <p className="text-[10px] text-gray-500 dark:text-gray-400 truncate">
                        {book.author}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        ) : (
          /* ══════════════════════════════════════════════════════════ */
          /* VISTA 2: LISTA / GRADE DETALHADA                           */
          /* ══════════════════════════════════════════════════════════ */
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3.5">
            {displayedItems.map((item) => (
              <div
                key={item.id}
                onClick={() => {
                  if (item.source === "system" && item.bookId) {
                    navigate(`/reader?bookId=${item.bookId}`);
                  }
                }}
                className="p-3.5 rounded-2xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900/40 hover:border-black dark:hover:border-white transition-all flex items-center gap-3.5 cursor-pointer group shadow-xs"
              >
                {/* Capa */}
                <div className="w-16 h-24 rounded-xl overflow-hidden bg-gray-200 dark:bg-gray-800 shrink-0 flex items-center justify-center border border-gray-200 dark:border-gray-700 relative">
                  {item.coverUrl ? (
                    <img src={item.coverUrl} alt={item.title} className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full p-2 flex flex-col justify-between bg-black text-white text-left">
                      <span className="text-[7px] text-zinc-400 uppercase font-bold">
                        {item.isPhysical ? "Físico" : "Kuwerenga"}
                      </span>
                      <span className="text-[9px] font-bold line-clamp-3 leading-tight">{item.title}</span>
                      <span className="text-[7px] text-gray-400 truncate">{item.author}</span>
                    </div>
                  )}
                  {item.status === "finished" && (
                    <div className="absolute top-1 right-1 w-5 h-5 rounded-full bg-black text-white dark:bg-white dark:text-black flex items-center justify-center shadow-xs">
                      <CheckCircle2 className="w-3 h-3 stroke-[2.5]" />
                    </div>
                  )}
                </div>

                {/* Detalhes */}
                <div className="flex-1 min-w-0 py-0.5">
                  <div className="flex items-center gap-1.5 mb-1">
                    <span className="text-[9px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-md bg-gray-100 dark:bg-gray-800 text-black dark:text-white border border-gray-200 dark:border-gray-700">
                      {item.status === "finished" ? "Lido" : item.status === "reading" ? "A Ler" : "Salvo"}
                    </span>
                    {item.isPhysical && (
                      <span className="text-[9px] text-gray-600 dark:text-gray-400 font-bold">
                        • Físico
                      </span>
                    )}
                  </div>

                  <h4 className="font-bold text-xs sm:text-sm truncate leading-tight group-hover:underline">
                    {item.title}
                  </h4>
                  <p className="text-[11px] text-gray-600 dark:text-gray-400 truncate mb-2">
                    {item.author}
                  </p>

                  {/* Progresso ou Avaliação */}
                  {item.status === "finished" ? (
                    <div className="flex items-center gap-1 text-black dark:text-white text-xs">
                      {[1, 2, 3, 4, 5].map((s) => (
                        <Star
                          key={s}
                          className={`w-3.5 h-3.5 ${
                            s <= (item.rating || 5)
                              ? "fill-current text-black dark:text-white"
                              : "text-gray-300 dark:text-gray-700"
                          }`}
                        />
                      ))}
                    </div>
                  ) : (
                    <div className="w-full">
                      <div className="flex justify-between text-[10px] text-gray-400 mb-1">
                        <span>Pág. {item.currentPage || 1} {item.totalPages ? `de ${item.totalPages}` : ""}</span>
                        <span className="font-bold">{Math.round(item.progress)}%</span>
                      </div>
                      <div className="w-full h-1 bg-gray-200 dark:bg-gray-800 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-black dark:bg-white rounded-full transition-all duration-300"
                          style={{ width: `${Math.max(5, item.progress)}%` }}
                        />
                      </div>
                    </div>
                  )}
                </div>

                {/* Ações Rápidas */}
                <div className="flex flex-col gap-1 items-end">
                  {item.status !== "finished" ? (
                    <button
                      onClick={(e) => handleToggleStatus(e, item, "finished")}
                      className="p-1.5 rounded-lg text-gray-400 hover:text-black dark:hover:text-white hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
                      title="Marcar como Lido"
                    >
                      <BookCheck className="w-4 h-4" />
                    </button>
                  ) : (
                    <button
                      onClick={(e) => handleToggleStatus(e, item, "reading")}
                      className="p-1.5 rounded-lg text-gray-400 hover:text-black dark:hover:text-white hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
                      title="Voltar a Ler"
                    >
                      <RotateCcw className="w-4 h-4" />
                    </button>
                  )}

                  <button
                    onClick={(e) => handleRemove(e, item)}
                    className="p-1.5 rounded-lg text-gray-400 hover:text-black dark:hover:text-white hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
                    title="Remover da Biblioteca"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </main>

      {/* Modal para Registar Livro Lido (Pesquisa no Catálogo ou Físico) */}
      <MarkBookReadModal
        isOpen={showAddReadModal}
        onClose={() => setShowAddReadModal(false)}
        onBookAdded={fetchShelf}
      />

      <BottomNav />
    </div>
  );
}
