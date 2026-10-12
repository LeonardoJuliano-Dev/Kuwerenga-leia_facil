import { useState, useEffect, useRef } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Search, Compass, Users, Library, Bell, BookOpen, Plus, ChevronLeft, ChevronRight } from "lucide-react";
import BottomNav from "../components/BottomNav";
import { supabase } from "../lib/supabase";
import { getCached, setCached } from "../lib/cache";
import { getLocalCustomBooks } from "../lib/bookshelfService";

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
  const [readingList, setReadingList] = useState<CurrentReading[]>(() => getCached<CurrentReading[]>("home_reading_list") || []);
  const [featuredBooks, setFeaturedBooks] = useState<Book[]>(() => getCached<Book[]>("home_featured_books") || []);
  const [searchQuery, setSearchQuery] = useState("");
  const [loading, setLoading] = useState(() => !getCached<Book[]>("home_featured_books"));
  const sliderRef = useRef<HTMLDivElement | null>(null);
  const navigate = useNavigate();

  useEffect(() => {
    async function loadHomeData() {
      try {
        const { data: { user } } = await supabase.auth.getUser();

        // 1. Livros atualmente em leitura (exclui concluídos / lidos)
        if (user) {
          const { data: userBooks } = await supabase
            .from("user_books")
            .select(`
              current_page,
              progress,
              status,
              last_read_at,
              book:books (
                id,
                title,
                author,
                cover_url,
                total_pages
              )
            `)
            .eq("user_id", user.id)
            .neq("status", "finished")
            .order("last_read_at", { ascending: false, nullsFirst: false });

          if (userBooks) {
            const activeItems: CurrentReading[] = userBooks
              .filter((item: any) => item.book && item.status !== "finished" && (item.progress || 0) < 100)
              .map((item: any) => ({
                bookId: item.book.id,
                title: item.book.title,
                author: item.book.author,
                cover_url: item.book.cover_url,
                currentPage: item.current_page || 1,
                totalPages: item.book.total_pages || 1,
                progress: item.progress || 0,
              }));

            setReadingList(activeItems);
            setCached("home_reading_list", activeItems);
          } else {
            setReadingList([]);
            setCached("home_reading_list", []);
          }
        } else {
          // Modo convidado / offline: carregar da estante local
          const local = getLocalCustomBooks();
          const activeItems: CurrentReading[] = local
            .filter((item) => (item.status === "reading" || item.status === "to_read") && (item.progress || 0) < 100)
            .sort((a, b) => new Date(b.lastReadAt || 0).getTime() - new Date(a.lastReadAt || 0).getTime())
            .map((item) => ({
              bookId: item.bookId || item.id,
              title: item.title,
              author: item.author,
              cover_url: item.coverUrl || null,
              currentPage: item.currentPage || 1,
              totalPages: item.totalPages || 100,
              progress: item.progress || 0,
            }));

          setReadingList(activeItems);
          setCached("home_reading_list", activeItems);
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
    <div className="flex flex-col min-h-screen bg-gray-50 dark:bg-black text-black dark:text-white pb-20 md:pb-12 md:pt-16">
      
      {/* Header Mobile (oculto em desktop pois o BottomNav já tem o Top Navbar) */}
      <header className="md:hidden px-4 sm:px-6 pt-safe sticky top-0 z-10 bg-white dark:bg-black border-b border-gray-100 dark:border-gray-900">
        <div className="app-container pt-6 sm:pt-8 pb-4 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <img src="/favicon.svg" alt="KUWERENGA" className="w-8 h-8 rounded-xl shadow-xs" />
            <div>
              <h1 className="text-xl font-bold leading-none tracking-tight">KUWERENGA+</h1>
              <span className="text-[10px] uppercase tracking-wider text-gray-400 font-semibold block mt-0.5">Leia Fácil</span>
            </div>
          </div>
          <button className="w-10 h-10 flex items-center justify-center rounded-full bg-gray-100 dark:bg-gray-900 text-gray-600 dark:text-gray-300 touch-target">
            <Bell className="w-5 h-5" />
          </button>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1">
        
        {/* Barra de Pesquisa */}
        <form onSubmit={handleSearchSubmit} className="px-4 sm:px-6 my-4 sm:my-6 app-container">
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

        {/* Continuar a ler: Slide / Pilha Horizontal Deslizante */}
        <section className="px-4 sm:px-6 mb-8 app-container">
          <div className="flex items-center justify-between mb-3">
            <div>
              <h2 className="text-lg font-bold">Continuar a ler</h2>
              {readingList.length > 1 && (
                <span className="text-[11px] text-gray-400 font-semibold block">
                  {readingList.length} em andamento • desliza para navegar
                </span>
              )}
            </div>
            {readingList.length > 1 && (
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => {
                    if (sliderRef.current) {
                      sliderRef.current.scrollBy({ left: -320, behavior: "smooth" });
                    }
                  }}
                  className="w-8 h-8 rounded-full bg-gray-100 dark:bg-gray-800 text-black dark:text-white flex items-center justify-center hover:bg-gray-200 dark:hover:bg-gray-700 active:scale-95 transition-all"
                  aria-label="Deslizar para a esquerda"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>
                <button
                  type="button"
                  onClick={() => {
                    if (sliderRef.current) {
                      sliderRef.current.scrollBy({ left: 320, behavior: "smooth" });
                    }
                  }}
                  className="w-8 h-8 rounded-full bg-gray-100 dark:bg-gray-800 text-black dark:text-white flex items-center justify-center hover:bg-gray-200 dark:hover:bg-gray-700 active:scale-95 transition-all"
                  aria-label="Deslizar para a direita"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            )}
          </div>

          {readingList.length > 0 ? (
            <div
              ref={sliderRef}
              className="flex gap-3.5 overflow-x-auto no-scrollbar snap-x snap-mandatory scroll-smooth pb-2 -mx-4 px-4 sm:mx-0 sm:px-0"
            >
              {readingList.map((reading, index) => (
                <div
                  key={reading.bookId}
                  className="min-w-[280px] sm:min-w-[340px] max-w-[380px] flex-shrink-0 snap-center bg-white dark:bg-gray-900 p-4 rounded-2xl shadow-xs border border-gray-100 dark:border-gray-800 flex flex-col justify-between transition-all"
                >
                  <div className="flex gap-3.5 mb-3">
                    {/* Capa */}
                    <div className="w-18 h-26 bg-gray-100 dark:bg-gray-800 rounded-xl overflow-hidden flex-shrink-0 flex items-center justify-center border border-gray-200 dark:border-gray-700">
                      {reading.cover_url ? (
                        <img
                          src={reading.cover_url}
                          alt={reading.title}
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <div className="w-full h-full p-2 flex flex-col justify-between bg-black text-white text-center">
                          <span className="text-[7px] uppercase tracking-widest text-gray-400">Livro</span>
                          <span className="font-serif text-[10px] font-bold line-clamp-3 leading-tight">
                            {reading.title}
                          </span>
                          <span className="text-[6px] text-gray-400 truncate">{reading.author}</span>
                        </div>
                      )}
                    </div>

                    {/* Detalhes do Livro */}
                    <div className="flex-1 min-w-0 flex flex-col justify-center">
                      <div className="flex items-center gap-1.5 mb-1">
                        {index === 0 && (
                          <span className="text-[9px] font-bold uppercase tracking-wider px-2 py-0.5 rounded bg-black dark:bg-white text-white dark:text-black">
                            Mais Recente
                          </span>
                        )}
                        <span className="text-[10px] text-gray-400 truncate">
                          Pág. {reading.currentPage} de {reading.totalPages}
                        </span>
                      </div>

                      <h3 className="font-bold text-sm leading-tight mb-0.5 truncate">{reading.title}</h3>
                      <p className="text-xs text-gray-500 mb-2 truncate">{reading.author}</p>

                      <div className="w-full">
                        <div className="flex justify-between text-[10px] text-gray-400 mb-1">
                          <span>Progresso</span>
                          <span className="font-bold">{Math.round(reading.progress)}%</span>
                        </div>
                        <div className="w-full h-1 bg-gray-200 dark:bg-gray-800 rounded-full overflow-hidden">
                          <div
                            className="h-full bg-black dark:bg-white rounded-full transition-all duration-300"
                            style={{ width: `${Math.max(5, reading.progress)}%` }}
                          />
                        </div>
                      </div>
                    </div>
                  </div>

                  <Link
                    to={`/reader?bookId=${reading.bookId}`}
                    className="w-full bg-black dark:bg-white text-white dark:text-black py-2.5 rounded-xl text-xs font-semibold flex items-center justify-center active:scale-95 transition-transform shadow-xs"
                  >
                    Continuar a Leitura
                  </Link>
                </div>
              ))}
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
        <section className="px-4 sm:px-6 mb-10 app-container flex justify-between sm:justify-start sm:gap-8">
          <Link to="/explore" className="flex flex-col items-center gap-2 cursor-pointer group">
            <div className="w-14 h-14 bg-white dark:bg-gray-900 border border-gray-200/60 dark:border-gray-800/80 rounded-2xl flex items-center justify-center shadow-xs group-hover:scale-105 active:scale-95 transition-all">
              <Compass className="w-6 h-6 stroke-[1.8] group-hover:stroke-[2.2] transition-all text-black dark:text-white" />
            </div>
            <span className="text-xs font-medium">Explorar</span>
          </Link>
          <Link to="/donate-book" className="flex flex-col items-center gap-2 cursor-pointer group">
            <div className="w-14 h-14 bg-white dark:bg-gray-900 border border-gray-200/60 dark:border-gray-800/80 rounded-2xl flex items-center justify-center shadow-xs group-hover:scale-105 active:scale-95 transition-all">
              <Plus className="w-6 h-6 stroke-[2] group-hover:stroke-[2.4] transition-all text-black dark:text-white" />
            </div>
            <span className="text-xs font-medium">Doar Livro</span>
          </Link>
          <Link to="/community" className="flex flex-col items-center gap-2 cursor-pointer group">
            <div className="w-14 h-14 bg-white dark:bg-gray-900 border border-gray-200/60 dark:border-gray-800/80 rounded-2xl flex items-center justify-center shadow-xs group-hover:scale-105 active:scale-95 transition-all">
              <Users className="w-6 h-6 stroke-[1.8] group-hover:stroke-[2.2] transition-all text-black dark:text-white" />
            </div>
            <span className="text-xs font-medium">Clubes</span>
          </Link>
          <Link to="/library" className="flex flex-col items-center gap-2 cursor-pointer group">
            <div className="w-14 h-14 bg-white dark:bg-gray-900 border border-gray-200/60 dark:border-gray-800/80 rounded-2xl flex items-center justify-center shadow-xs group-hover:scale-105 active:scale-95 transition-all">
              <Library className="w-6 h-6 stroke-[1.8] group-hover:stroke-[2.2] transition-all text-black dark:text-white" />
            </div>
            <span className="text-xs font-medium">Biblioteca</span>
          </Link>
        </section>

        {/* Em Destaque (Real) */}
        <section className="px-4 sm:px-6 mb-8 app-container">
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
            <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 gap-3 sm:gap-4">
              {featuredBooks.map((book) => (
                <Link
                  key={book.id}
                  to={`/book/${book.id}`}
                  className="group"
                >
                  <div className="w-full aspect-[2/3] bg-gray-100 dark:bg-gray-800 rounded-xl mb-2 overflow-hidden flex flex-col items-center justify-center border border-gray-200 dark:border-gray-700 shadow-xs relative">
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
