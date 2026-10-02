import { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Search, BookHeart, Users, MoreHorizontal, Bell, BookOpen, Plus } from "lucide-react";
import BottomNav from "../components/BottomNav";
import { supabase } from "../lib/supabase";
import { getCached, setCached } from "../lib/cache";

interface Book {
  id: string;
  title: string;
  author: string;
  cover_url: string | null;
  file_type: string;
  total_pages: number;
}

interface CurrentReading {
  bookId: string;
  title: string;
  author: string;
  cover_url: string | null;
  currentPage: number;
  totalPages: number;
  progress: number;
}

export default function Home() {
  const [currentReading, setCurrentReading] = useState<CurrentReading | null>(() => getCached<CurrentReading>("home_current_reading"));
  const [featuredBooks, setFeaturedBooks] = useState<Book[]>(() => getCached<Book[]>("home_featured_books") || []);
  const [searchQuery, setSearchQuery] = useState("");
  const [loading, setLoading] = useState(() => !getCached<Book[]>("home_featured_books"));
  const navigate = useNavigate();

  useEffect(() => {
    async function loadHomeData() {
      // Se não temos cache, mostra loading, senão atualiza em background silenciosamente
      try {
        const { data: { user } } = await supabase.auth.getUser();

        // 1. Livro atualmente em leitura pelo utilizador
        if (user) {
          const { data: userBook } = await supabase
            .from("user_books")
            .select(`
              current_page,
              progress,
              book:books (
                id,
                title,
                author,
                cover_url,
                total_pages
              )
            `)
            .eq("user_id", user.id)
            .order("last_read_at", { ascending: false, nullsFirst: false })
            .limit(1)
            .maybeSingle();

          if (userBook?.book) {
            const b: any = userBook.book;
            const readingData: CurrentReading = {
              bookId: b.id,
              title: b.title,
              author: b.author,
              cover_url: b.cover_url,
              currentPage: userBook.current_page || 1,
              totalPages: b.total_pages || 1,
              progress: userBook.progress || 0
            };
            setCurrentReading(readingData);
            setCached("home_current_reading", readingData);
          } else {
            setCurrentReading(null);
            setCached("home_current_reading", null);
          }
        }

        // 2. Livros em destaque reais
        const { data: books } = await supabase
          .from("books")
          .select("id, title, author, cover_url, file_type, total_pages")
          .order("created_at", { ascending: false })
          .limit(8);

        if (books) {
          setFeaturedBooks(books as Book[]);
          setCached("home_featured_books", books);
        }
      } catch (err) {
        console.error("Erro ao carregar dados da Home:", err);
      } finally {
        setLoading(false);
      }
    }

    loadHomeData();
  }, []);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchQuery.trim()) {
      navigate(`/explore?q=${encodeURIComponent(searchQuery.trim())}`);
    } else {
      navigate("/explore");
    }
  };

  return (
    <div className="flex flex-col min-h-screen bg-gray-50 dark:bg-black text-black dark:text-white pb-20">
      
      {/* Header */}
      <header className="px-6 pt-12 pb-4 bg-white dark:bg-black sticky top-0 z-10 flex items-center justify-between border-b border-gray-100 dark:border-gray-900">
        <h1 className="text-2xl font-bold">Início</h1>
        <button className="w-10 h-10 flex items-center justify-center rounded-full bg-gray-100 dark:bg-gray-900 text-gray-600 dark:text-gray-300">
          <Bell className="w-5 h-5" />
        </button>
      </header>

      {/* Main Content */}
      <main className="flex-1">
        
        {/* Barra de Pesquisa */}
        <form onSubmit={handleSearchSubmit} className="px-6 my-6">
          <div className="relative">
            <Search className="w-5 h-5 absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Pesquisar livros, autores..."
              className="w-full pl-12 pr-4 py-3.5 bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-800 rounded-2xl focus:outline-none text-sm font-medium shadow-xs"
            />
          </div>
        </form>

        {/* Continuar a ler (Real) */}
        <section className="px-6 mb-8">
          <h2 className="text-lg font-bold mb-4">Continuar a ler</h2>
          {currentReading ? (
            <div className="bg-white dark:bg-gray-900 p-4 rounded-2xl shadow-xs border border-gray-100 dark:border-gray-800">
              <div className="flex gap-4">
                <div className="w-20 h-28 bg-gray-100 dark:bg-gray-800 rounded-xl overflow-hidden flex-shrink-0 flex items-center justify-center border border-gray-200 dark:border-gray-700">
                  {currentReading.cover_url ? (
                    <img
                      src={currentReading.cover_url}
                      alt={currentReading.title}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <div className="w-full h-full p-2 flex flex-col justify-between bg-black text-white text-center">
                      <span className="text-[7px] uppercase tracking-widest text-gray-400">Livro</span>
                      <span className="font-serif text-[10px] font-bold line-clamp-3 leading-tight">
                        {currentReading.title}
                      </span>
                      <span className="text-[6px] text-gray-400 truncate">{currentReading.author}</span>
                    </div>
                  )}
                </div>

                <div className="flex-1 flex flex-col justify-center">
                  <h3 className="font-bold text-sm leading-tight mb-1 truncate">{currentReading.title}</h3>
                  <p className="text-xs text-gray-500 mb-2 truncate">{currentReading.author}</p>
                  <p className="text-xs text-gray-400 mb-3">
                    Página {currentReading.currentPage} • {Math.round(currentReading.progress)}%
                  </p>

                  <div className="w-full h-1 bg-gray-200 dark:bg-gray-800 rounded-full mb-3 overflow-hidden">
                    <div
                      className="h-full bg-black dark:bg-white rounded-full transition-all duration-300"
                      style={{ width: `${Math.max(5, currentReading.progress)}%` }}
                    />
                  </div>
                </div>
              </div>

              <Link
                to={`/reader?bookId=${currentReading.bookId}`}
                className="w-full mt-3 bg-black dark:bg-white text-white dark:text-black py-3 rounded-xl text-sm font-semibold flex items-center justify-center active:scale-95 transition-transform"
              >
                Continuar a Leitura
              </Link>
            </div>
          ) : (
            <div className="bg-white dark:bg-gray-900 p-6 rounded-2xl shadow-xs border border-gray-100 dark:border-gray-800 text-center">
              <div className="w-12 h-12 bg-gray-100 dark:bg-gray-800 rounded-full flex items-center justify-center mx-auto mb-3 text-gray-400">
                <BookOpen className="w-6 h-6" />
              </div>
              <h3 className="font-bold text-sm mb-1">Nenhum livro em leitura</h3>
              <p className="text-xs text-gray-500 mb-4 max-w-xs mx-auto">
                Escolhe um livro do catálogo comunitário ou doa um novo para começares a tua jornada de leitura.
              </p>
              <div className="flex gap-2 justify-center">
                <Link
                  to="/explore"
                  className="px-4 py-2 bg-black dark:bg-white text-white dark:text-black rounded-xl text-xs font-semibold"
                >
                  Explorar Livros
                </Link>
                <Link
                  to="/donate-book"
                  className="px-4 py-2 border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 rounded-xl text-xs font-semibold"
                >
                  Doar Livro
                </Link>
              </div>
            </div>
          )}
        </section>

        {/* Quick Actions (Round Buttons) */}
        <section className="px-6 mb-10 flex justify-between">
          <Link to="/explore" className="flex flex-col items-center gap-2 cursor-pointer group">
            <div className="w-14 h-14 bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-800 rounded-full flex items-center justify-center shadow-xs group-hover:scale-105 transition-transform">
              <Search className="w-6 h-6" />
            </div>
            <span className="text-xs font-medium">Pesquisar</span>
          </Link>
          <Link to="/donate-book" className="flex flex-col items-center gap-2 cursor-pointer group">
            <div className="w-14 h-14 bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-800 rounded-full flex items-center justify-center shadow-xs group-hover:scale-105 transition-transform">
              <BookHeart className="w-6 h-6" />
            </div>
            <span className="text-xs font-medium">Doar livro</span>
          </Link>
          <div className="flex flex-col items-center gap-2 cursor-pointer group opacity-60">
            <div className="w-14 h-14 bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-800 rounded-full flex items-center justify-center shadow-xs">
              <Users className="w-6 h-6" />
            </div>
            <span className="text-xs font-medium">Clubes</span>
          </div>
          <div className="flex flex-col items-center gap-2 cursor-pointer group opacity-60">
            <div className="w-14 h-14 bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-800 rounded-full flex items-center justify-center shadow-xs">
              <MoreHorizontal className="w-6 h-6" />
            </div>
            <span className="text-xs font-medium">Mais</span>
          </div>
        </section>

        {/* Em Destaque (Real) */}
        <section className="px-6 mb-8">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-bold">Em destaque</h2>
            <Link to="/explore" className="text-xs text-gray-500 font-medium hover:underline">
              Ver todos ({featuredBooks.length})
            </Link>
          </div>

          {loading ? (
            <div className="flex items-center justify-center py-10">
              <div className="w-6 h-6 border-2 border-black dark:border-white border-t-transparent rounded-full animate-spin"></div>
            </div>
          ) : featuredBooks.length === 0 ? (
            <div className="bg-white dark:bg-gray-900 rounded-2xl p-6 border border-gray-100 dark:border-gray-800 text-center">
              <p className="text-xs text-gray-500 mb-3">Ainda não foram adicionados livros à plataforma.</p>
              <Link
                to="/donate-book"
                className="inline-flex items-center gap-1.5 px-4 py-2 bg-black dark:bg-white text-white dark:text-black rounded-xl text-xs font-semibold"
              >
                <Plus className="w-4 h-4" />
                <span>Doar o Primeiro Livro</span>
              </Link>
            </div>
          ) : (
            <div className="flex gap-4 overflow-x-auto pb-4 snap-x no-scrollbar">
              {featuredBooks.map((book) => (
                <Link
                  key={book.id}
                  to={`/book/${book.id}`}
                  className="w-28 flex-shrink-0 snap-start group"
                >
                  <div className="w-full h-40 bg-gray-100 dark:bg-gray-800 rounded-xl mb-2 overflow-hidden flex flex-col items-center justify-center border border-gray-200 dark:border-gray-700 shadow-xs relative">
                    {book.cover_url ? (
                      <img
                        src={book.cover_url}
                        alt={book.title}
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform"
                      />
                    ) : (
                      <div className="w-full h-full p-2 flex flex-col justify-between bg-black text-white text-center">
                        <span className="text-[7px] uppercase tracking-widest text-gray-400">
                          {book.file_type}
                        </span>
                        <span className="font-serif text-[10px] font-bold line-clamp-3 leading-tight">
                          {book.title}
                        </span>
                        <span className="text-[7px] text-gray-400 truncate">{book.author}</span>
                      </div>
                    )}
                  </div>
                  <h4 className="text-xs font-bold leading-tight line-clamp-1 group-hover:underline">
                    {book.title}
                  </h4>
                  <p className="text-[10px] text-gray-500 truncate">{book.author}</p>
                </Link>
              ))}
            </div>
          )}
        </section>
      </main>

      {/* Bottom Navigation */}
      <BottomNav />
    </div>
  );
}
