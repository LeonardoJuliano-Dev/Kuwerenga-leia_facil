import { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Search, BookOpen, Plus } from "lucide-react";
import BottomNav from "../components/BottomNav";
import { supabase } from "../lib/supabase";

interface Book {
  id: string;
  title: string;
  author: string;
  description: string | null;
  cover_url: string | null;
  file_url: string;
  file_type: "pdf" | "epub";
  total_pages: number;
  category_id: string | null;
  avg_rating: number;
  total_ratings: number;
  created_at: string;
}

interface Category {
  id: string;
  name: string;
}

export default function Explore() {
  const [books, setBooks] = useState<Book[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<string>("all");
  const [fileTypeFilter, setFileTypeFilter] = useState<"all" | "pdf" | "epub">("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  // Carregar dados reais do Supabase
  useEffect(() => {
    async function loadData() {
      setLoading(true);
      try {
        // 1. Categorias reais
        const { data: cats } = await supabase.from("categories").select("id, name").order("name");
        if (cats) setCategories(cats);

        // 2. Livros reais aprovados
        const { data: bookList, error } = await supabase
          .from("books")
          .select("*")
          .order("created_at", { ascending: false });

        if (!error && bookList) {
          setBooks(bookList);
        }
      } catch (err) {
        console.error("Erro ao carregar catálogo:", err);
      } finally {
        setLoading(false);
      }
    }

    loadData();
  }, []);

  // Filtragem
  const filteredBooks = books.filter((b) => {
    const matchesSearch =
      b.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      b.author.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (b.description && b.description.toLowerCase().includes(searchQuery.toLowerCase()));

    const matchesCategory = selectedCategory === "all" || b.category_id === selectedCategory;
    const matchesType = fileTypeFilter === "all" || b.file_type === fileTypeFilter;

    return matchesSearch && matchesCategory && matchesType;
  });

  // Abrir Livro e adicionar à biblioteca do utilizador
  const handleOpenBook = async (book: Book) => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        // Regista na biblioteca se ainda não estiver
        await supabase.from("user_books").upsert(
          {
            user_id: user.id,
            book_id: book.id,
            status: "reading",
            last_read_at: new Date().toISOString()
          },
          { onConflict: "user_id,book_id" }
        );
      }
    } catch (e) {
      console.error(e);
    }
    navigate(`/reader?bookId=${book.id}`);
  };

  return (
    <div className="flex flex-col min-h-screen bg-gray-50 dark:bg-black text-black dark:text-white pb-24">
      {/* Header */}
      <header className="px-6 pt-12 pb-4 bg-white dark:bg-black sticky top-0 z-10 border-b border-gray-100 dark:border-gray-900">
        <div className="flex items-center justify-between mb-4">
          <h1 className="text-2xl font-bold">Explorar</h1>
          <Link
            to="/donate-book"
            className="flex items-center gap-1.5 px-3 py-1.5 bg-black dark:bg-white text-white dark:text-black rounded-full text-xs font-semibold active:scale-95 transition-transform"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Doar Livro</span>
          </Link>
        </div>

        {/* Barra de Pesquisa Real */}
        <div className="relative">
          <Search className="w-5 h-5 absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Pesquisar livros, autores..."
            className="w-full pl-12 pr-4 py-3 bg-gray-100 dark:bg-gray-900 rounded-2xl focus:outline-none text-sm font-medium transition-all"
          />
        </div>
      </header>

      <main className="flex-1">
        {/* Filtros de Tipo de Ficheiro */}
        <div className="px-6 py-4 flex gap-2 overflow-x-auto no-scrollbar">
          <button
            onClick={() => setFileTypeFilter("all")}
            className={`px-4 py-1.5 rounded-full text-xs font-semibold transition-colors whitespace-nowrap ${
              fileTypeFilter === "all"
                ? "bg-black dark:bg-white text-white dark:text-black"
                : "bg-white dark:bg-gray-900 text-gray-600 dark:text-gray-400 border border-gray-200 dark:border-gray-800"
            }`}
          >
            Todos os Formatos
          </button>
          <button
            onClick={() => setFileTypeFilter("pdf")}
            className={`px-4 py-1.5 rounded-full text-xs font-semibold transition-colors whitespace-nowrap ${
              fileTypeFilter === "pdf"
                ? "bg-black dark:bg-white text-white dark:text-black"
                : "bg-white dark:bg-gray-900 text-gray-600 dark:text-gray-400 border border-gray-200 dark:border-gray-800"
            }`}
          >
            Apenas PDF
          </button>
          <button
            onClick={() => setFileTypeFilter("epub")}
            className={`px-4 py-1.5 rounded-full text-xs font-semibold transition-colors whitespace-nowrap ${
              fileTypeFilter === "epub"
                ? "bg-black dark:bg-white text-white dark:text-black"
                : "bg-white dark:bg-gray-900 text-gray-600 dark:text-gray-400 border border-gray-200 dark:border-gray-800"
            }`}
          >
            Apenas EPUB
          </button>
        </div>

        {/* Categorias Reais */}
        {categories.length > 0 && (
          <section className="px-6 mb-6">
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-sm font-bold uppercase tracking-wider text-gray-400">Categorias</h2>
              {selectedCategory !== "all" && (
                <button
                  onClick={() => setSelectedCategory("all")}
                  className="text-xs font-semibold text-gray-500 hover:text-black dark:hover:text-white"
                >
                  Limpar filtro
                </button>
              )}
            </div>
            <div className="flex gap-2 overflow-x-auto no-scrollbar pb-2">
              <button
                onClick={() => setSelectedCategory("all")}
                className={`px-3.5 py-2 rounded-xl text-xs font-semibold whitespace-nowrap border transition-all ${
                  selectedCategory === "all"
                    ? "border-black dark:border-white bg-black dark:bg-white text-white dark:text-black"
                    : "border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 text-gray-700 dark:text-gray-300"
                }`}
              >
                Todas
              </button>
              {categories.map((cat) => (
                <button
                  key={cat.id}
                  onClick={() => setSelectedCategory(cat.id)}
                  className={`px-3.5 py-2 rounded-xl text-xs font-semibold whitespace-nowrap border transition-all ${
                    selectedCategory === cat.id
                      ? "border-black dark:border-white bg-black dark:bg-white text-white dark:text-black"
                      : "border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 text-gray-700 dark:text-gray-300"
                  }`}
                >
                  {cat.name}
                </button>
              ))}
            </div>
          </section>
        )}

        {/* Lista de Livros Reais */}
        <section className="px-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-bold">
              Catálogo Disponível ({filteredBooks.length})
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
                  ? "Tenta pesquisar por outro termo ou remover os filtros."
                  : "Ainda não existem livros neste catálogo. Sê o primeiro a doar uma obra para a comunidade!"}
              </p>
              <Link
                to="/donate-book"
                className="inline-flex items-center gap-2 px-5 py-3 bg-black dark:bg-white text-white dark:text-black rounded-xl text-xs font-semibold shadow-sm active:scale-95 transition-transform"
              >
                <Plus className="w-4 h-4" />
                <span>Doar o Primeiro Livro</span>
              </Link>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {filteredBooks.map((book) => (
                <div
                  key={book.id}
                  onClick={() => handleOpenBook(book)}
                  className="bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-800 rounded-2xl p-4 flex gap-4 hover:border-black dark:hover:border-white transition-all cursor-pointer group shadow-xs"
                >
                  {/* Capa */}
                  <div className="w-20 h-28 bg-gray-100 dark:bg-gray-800 rounded-xl overflow-hidden flex-shrink-0 flex items-center justify-center relative border border-gray-200 dark:border-gray-700">
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
                  </div>

                  {/* Informações */}
                  <div className="flex-1 flex flex-col justify-between py-1 min-w-0">
                    <div>
                      <span className="inline-block uppercase tracking-wider text-[9px] font-bold px-2 py-0.5 rounded bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300 mb-1.5">
                        {book.file_type}
                      </span>
                      <h3 className="font-bold text-sm leading-tight mb-1 truncate group-hover:underline">
                        {book.title}
                      </h3>
                      <p className="text-xs text-gray-500 truncate mb-2">
                        {book.author}
                      </p>
                    </div>

                    <div className="flex items-center justify-between pt-2 border-t border-gray-100 dark:border-gray-800 text-xs">
                      <span className="text-gray-400 font-medium">
                        {book.total_pages ? `${book.total_pages} págs.` : "Disponível"}
                      </span>
                      <span className="font-semibold text-black dark:text-white flex items-center gap-1 group-hover:translate-x-1 transition-transform">
                        Ler agora →
                      </span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      </main>

      <BottomNav />
    </div>
  );
}
