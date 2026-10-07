import { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Plus, BookOpen, Trash2 } from "lucide-react";
import BottomNav from "../components/BottomNav";
import { supabase } from "../lib/supabase";
import { getCached, setCached } from "../lib/cache";

interface UserBookItem {
  id: string;
  status: "reading" | "to_read" | "finished" | "saved";
  current_page: number;
  progress: number;
  last_read_at: string | null;
  book: {
    id: string;
    title: string;
    author: string;
    cover_url: string | null;
    total_pages: number;
    file_type: string;
  };
}

export default function Library() {
  const [items, setItems] = useState<UserBookItem[]>(() => getCached<UserBookItem[]>("library_items") || []);
  const [activeTab, setActiveTab] = useState<"reading" | "saved" | "finished" | "all">("all");
  const [loading, setLoading] = useState(() => !getCached<UserBookItem[]>("library_items"));
  const navigate = useNavigate();

  useEffect(() => {
    async function loadLibrary() {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;

        // Busca os livros da biblioteca do utilizador com os dados do livro
        const { data, error } = await supabase
          .from("user_books")
          .select(`
            id,
            status,
            current_page,
            progress,
            last_read_at,
            book:books (
              id,
              title,
              author,
              cover_url,
              total_pages,
              file_type
            )
          `)
          .eq("user_id", user.id)
          .order("last_read_at", { ascending: false, nullsFirst: false });

        if (!error && data) {
          // Normaliza itens onde o livro existe
          const validItems = data
            .filter((item: any) => item.book)
            .map((item: any) => ({
              id: item.id,
              status: item.status,
              current_page: item.current_page || 1,
              progress: item.progress || 0,
              last_read_at: item.last_read_at,
              book: item.book
            }));

          setItems(validItems);
          setCached("library_items", validItems);
        }
      } catch (err) {
        console.error("Erro ao carregar biblioteca:", err);
      } finally {
        setLoading(false);
      }
    }

    loadLibrary();
  }, []);

  // Remover livro da biblioteca
  const handleRemoveFromLibrary = async (e: React.MouseEvent, bookId: string) => {
    e.stopPropagation();
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      await supabase
        .from("user_books")
        .delete()
        .eq("user_id", user.id)
        .eq("book_id", bookId);

      setItems(items.filter((i) => i.book.id !== bookId));
    } catch (err) {
      console.error(err);
    }
  };

  // Filtros
  const filteredItems = items.filter((item) => {
    if (activeTab === "all") return true;
    if (activeTab === "reading") return item.status === "reading" || item.status === "to_read";
    return item.status === activeTab;
  });

  const countReading = items.filter((i) => i.status === "reading" || i.status === "to_read").length;
  const countFinished = items.filter((i) => i.status === "finished").length;
  const countSaved = items.filter((i) => i.status === "saved").length;

  return (
    <div className="flex flex-col min-h-screen bg-white dark:bg-black text-black dark:text-white pb-24 relative">
      {/* Header com Abas Reais */}
      <header className="px-4 sm:px-6 pt-safe sticky top-0 z-10 bg-white dark:bg-black border-b border-gray-100 dark:border-gray-900">
        <div className="app-container pt-6 sm:pt-8 pb-2">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-2xl font-bold">Minha Biblioteca</h1>
          <Link
            to="/donate-book"
            className="flex items-center gap-1.5 px-3 py-1.5 bg-black dark:bg-white text-white dark:text-black rounded-full text-xs font-semibold active:scale-95 transition-transform"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Doar Livro</span>
          </Link>
        </div>

        {/* Abas com Contadores Reais */}
        <div className="flex justify-between items-end pb-3 text-xs">
          <button
            onClick={() => setActiveTab("all")}
            className={`flex flex-col items-center transition-colors ${
              activeTab === "all" ? "text-black dark:text-white font-bold" : "text-gray-400"
            }`}
          >
            <span className="text-sm">{items.length}</span>
            <span className="text-[11px] mt-0.5">Todos</span>
            {activeTab === "all" && <div className="w-6 h-0.5 bg-black dark:bg-white mt-1.5 rounded-full" />}
          </button>

          <button
            onClick={() => setActiveTab("reading")}
            className={`flex flex-col items-center transition-colors ${
              activeTab === "reading" ? "text-black dark:text-white font-bold" : "text-gray-400"
            }`}
          >
            <span className="text-sm">{countReading}</span>
            <span className="text-[11px] mt-0.5">A Ler</span>
            {activeTab === "reading" && <div className="w-6 h-0.5 bg-black dark:bg-white mt-1.5 rounded-full" />}
          </button>

          <button
            onClick={() => setActiveTab("saved")}
            className={`flex flex-col items-center transition-colors ${
              activeTab === "saved" ? "text-black dark:text-white font-bold" : "text-gray-400"
            }`}
          >
            <span className="text-sm">{countSaved}</span>
            <span className="text-[11px] mt-0.5">Salvos</span>
            {activeTab === "saved" && <div className="w-6 h-0.5 bg-black dark:bg-white mt-1.5 rounded-full" />}
          </button>

          <button
            onClick={() => setActiveTab("finished")}
            className={`flex flex-col items-center transition-colors ${
              activeTab === "finished" ? "text-black dark:text-white font-bold" : "text-gray-400"
            }`}
          >
            <span className="text-sm">{countFinished}</span>
            <span className="text-[11px] mt-0.5">Lidos</span>
            {activeTab === "finished" && <div className="w-6 h-0.5 bg-black dark:bg-white mt-1.5 rounded-full" />}
          </button>
        </div>
        </div>
      </header>

      {/* Conteúdo Principal */}
      <main className="flex-1 px-4 sm:px-6 pt-6 app-container space-y-4">
        {loading ? (
          <div className="flex flex-col items-center justify-center py-20 gap-3">
            <div className="w-8 h-8 border-2 border-black dark:border-white border-t-transparent dark:border-t-transparent rounded-full animate-spin"></div>
            <p className="text-xs text-gray-400">A carregar a tua biblioteca...</p>
          </div>
        ) : filteredItems.length === 0 ? (
          <div className="bg-gray-50 dark:bg-gray-900 rounded-3xl p-8 border border-gray-100 dark:border-gray-800 text-center my-8 shadow-xs">
            <div className="w-14 h-14 bg-white dark:bg-gray-800 text-gray-400 rounded-2xl flex items-center justify-center mx-auto mb-4 border border-gray-100 dark:border-gray-700">
              <BookOpen className="w-7 h-7" />
            </div>
            <h3 className="font-bold text-base mb-1">
              {activeTab === "all" ? "A tua biblioteca está vazia" : "Nenhum livro nesta secção"}
            </h3>
            <p className="text-xs text-gray-500 mb-6 leading-relaxed max-w-xs mx-auto">
              Explora os livros disponíveis na comunidade ou faz a doação de uma obra em PDF/ePub para começares a ler.
            </p>
            <div className="flex flex-col sm:flex-row gap-2 justify-center">
              <Link
                to="/explore"
                className="px-5 py-3 bg-black dark:bg-white text-white dark:text-black rounded-xl text-xs font-semibold shadow-xs active:scale-95 transition-transform inline-flex items-center justify-center gap-1.5"
              >
                <span>Explorar Catálogo</span>
              </Link>
              <Link
                to="/donate-book"
                className="px-5 py-3 border border-gray-200 dark:border-gray-700 bg-white dark:bg-black rounded-xl text-xs font-semibold active:scale-95 transition-transform inline-flex items-center justify-center gap-1.5"
              >
                <Plus className="w-4 h-4" />
                <span>Doar Livro</span>
              </Link>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {filteredItems.map(({ id, book, current_page, progress }) => (
              <div
                key={id}
                onClick={() => navigate(`/reader?bookId=${book.id}`)}
                className="flex gap-4 items-center p-3 rounded-2xl border border-gray-100 dark:border-gray-800 hover:border-black dark:hover:border-white transition-all cursor-pointer group bg-gray-50/50 dark:bg-gray-900/40"
              >
                {/* Capa */}
                <div className="w-16 h-24 bg-gray-100 dark:bg-gray-800 rounded-xl overflow-hidden flex-shrink-0 flex items-center justify-center border border-gray-200 dark:border-gray-700 relative">
                  {book.cover_url ? (
                    <img src={book.cover_url} alt={book.title} className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full p-2 flex flex-col justify-between bg-black text-white text-center">
                      <span className="text-[7px] uppercase tracking-widest text-gray-400">
                        {book.file_type}
                      </span>
                      <span className="font-serif text-[9px] font-bold line-clamp-3 leading-tight">
                        {book.title}
                      </span>
                      <span className="text-[6px] text-gray-400 truncate">{book.author}</span>
                    </div>
                  )}
                </div>

                {/* Detalhes */}
                <div className="flex-1 min-w-0 py-1">
                  <h3 className="font-bold text-sm leading-tight mb-1 truncate group-hover:underline">
                    {book.title}
                  </h3>
                  <p className="text-xs text-gray-500 truncate mb-3">{book.author}</p>

                  <div className="w-full">
                    <div className="flex justify-between text-[10px] text-gray-400 mb-1 font-medium">
                      <span>Pág. {current_page} {book.total_pages ? `de ${book.total_pages}` : ""}</span>
                      <span>{Math.round(progress)}%</span>
                    </div>
                    <div className="w-full h-1 bg-gray-200 dark:bg-gray-800 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-black dark:bg-white rounded-full transition-all duration-300"
                        style={{ width: `${Math.max(5, progress)}%` }}
                      />
                    </div>
                  </div>
                </div>

                {/* Botão Remover */}
                <button
                  onClick={(e) => handleRemoveFromLibrary(e, book.id)}
                  className="p-2 text-gray-400 hover:text-red-500 transition-colors"
                  title="Remover da Biblioteca"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            ))}
          </div>
        )}
      </main>

      {/* Floating Action Button para Doar */}
      <Link
        to="/donate-book"
        className="fixed bottom-24 right-6 w-14 h-14 bg-black dark:bg-white text-white dark:text-black rounded-full flex items-center justify-center shadow-lg hover:scale-105 active:scale-95 transition-transform z-20"
        title="Doar um Livro"
      >
        <Plus className="w-6 h-6" />
      </Link>

      <BottomNav />
    </div>
  );
}
