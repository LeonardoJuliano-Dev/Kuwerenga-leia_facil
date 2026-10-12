import { useState, useEffect } from "react";
import { X, Search, Check, Star, BookOpen, Smartphone, CheckCircle2, Plus } from "lucide-react";
import { supabase } from "../lib/supabase";
import { addCustomBookToShelf, markBookAsFinished } from "../lib/bookshelfService";

interface MarkBookReadModalProps {
  isOpen: boolean;
  onClose: () => void;
  onBookAdded: () => void;
}

interface CatalogBook {
  id: string;
  title: string;
  author: string;
  cover_url: string | null;
  total_pages: number;
}

export default function MarkBookReadModal({
  isOpen,
  onClose,
  onBookAdded,
}: MarkBookReadModalProps) {
  const [activeTab, setActiveTab] = useState<"search" | "custom">("search");

  // Estado da Pesquisa no Sistema
  const [searchQuery, setSearchQuery] = useState("");
  const [catalogResults, setCatalogResults] = useState<CatalogBook[]>([]);
  const [searching, setSearching] = useState(false);

  // Estado do Livro Físico / Externo
  const [customTitle, setCustomTitle] = useState("");
  const [customAuthor, setCustomAuthor] = useState("");
  const [customPages, setCustomPages] = useState("");
  const [customFormat, setCustomFormat] = useState<"physical" | "digital">("physical");
  const [customRating, setCustomRating] = useState(5);
  const [customNotes, setCustomNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [feedbackSuccess, setFeedbackSuccess] = useState(false);

  // Pesquisar livros no catálogo
  useEffect(() => {
    if (!searchQuery.trim() || activeTab !== "search") {
      setCatalogResults([]);
      return;
    }

    const timer = setTimeout(async () => {
      setSearching(true);
      try {
        const { data } = await supabase
          .from("books")
          .select("id, title, author, cover_url, total_pages")
          .or(`title.ilike.%${searchQuery.trim()}%,author.ilike.%${searchQuery.trim()}%`)
          .limit(6);

        if (data) setCatalogResults(data);
      } catch (err) {
        console.error("Erro na pesquisa:", err);
      } finally {
        setSearching(false);
      }
    }, 250);

    return () => clearTimeout(timer);
  }, [searchQuery, activeTab]);

  if (!isOpen) return null;

  // Marcar livro do catálogo do sistema como lido
  const handleMarkCatalogFinished = async (book: CatalogBook) => {
    setSubmitting(true);
    try {
      await markBookAsFinished(book.id, book.total_pages);
      setFeedbackSuccess(true);
      setTimeout(() => {
        setFeedbackSuccess(false);
        onBookAdded();
        onClose();
      }, 600);
    } catch (err) {
      console.error(err);
    } finally {
      setSubmitting(false);
    }
  };

  // Submeter Livro Físico / Externo
  const handleSaveCustomBook = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!customTitle.trim()) return;

    setSubmitting(true);
    try {
      await addCustomBookToShelf({
        title: customTitle.trim(),
        author: customAuthor.trim() || "Autor Desconhecido",
        totalPages: parseInt(customPages, 10) || 120,
        isPhysical: customFormat === "physical",
        rating: customRating,
        personalNotes: customNotes.trim(),
        status: "finished",
        finishedAt: new Date().toISOString(),
      });

      setFeedbackSuccess(true);
      setTimeout(() => {
        setFeedbackSuccess(false);
        setCustomTitle("");
        setCustomAuthor("");
        setCustomNotes("");
        setCustomPages("");
        onBookAdded();
        onClose();
      }, 600);
    } catch (err) {
      console.error(err);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-in fade-in duration-200">
      <div 
        className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-2xl max-w-md w-full p-6 shadow-2xl animate-in zoom-in-95 duration-200 text-black dark:text-white relative overflow-hidden"
        role="dialog"
      >
        {/* Cabeçalho */}
        <div className="flex items-center justify-between pb-4 border-b border-gray-100 dark:border-gray-800">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-gray-100 dark:bg-gray-800 text-black dark:text-white flex items-center justify-center">
              <Check className="w-4 h-4" />
            </div>
            <div>
              <h3 className="font-bold text-base leading-tight">Marcar Livro Lido</h3>
              <p className="text-xs text-gray-500 dark:text-gray-400">Adicionar à lista de obras lidas</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-full text-gray-400 hover:text-black dark:hover:text-white hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Abas */}
        <div className="flex gap-2 my-4 p-1 bg-gray-100 dark:bg-gray-800 rounded-xl text-xs font-semibold">
          <button
            type="button"
            onClick={() => setActiveTab("search")}
            className={`flex-1 py-2 px-3 rounded-lg transition-all text-center flex items-center justify-center gap-1.5 ${
              activeTab === "search"
                ? "bg-white dark:bg-black text-black dark:text-white shadow-xs font-bold"
                : "text-gray-500 hover:text-black dark:hover:text-white"
            }`}
          >
            <Search className="w-3.5 h-3.5" />
            <span>Catálogo Kuwerenga</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("custom")}
            className={`flex-1 py-2 px-3 rounded-lg transition-all text-center flex items-center justify-center gap-1.5 ${
              activeTab === "custom"
                ? "bg-white dark:bg-black text-black dark:text-white shadow-xs font-bold"
                : "text-gray-500 hover:text-black dark:hover:text-white"
            }`}
          >
            <BookOpen className="w-3.5 h-3.5" />
            <span>Livro Físico ou Externo</span>
          </button>
        </div>

        {feedbackSuccess ? (
          <div className="py-12 flex flex-col items-center justify-center text-center animate-in zoom-in-95 duration-200">
            <div className="w-12 h-12 rounded-full bg-gray-100 dark:bg-gray-800 text-black dark:text-white flex items-center justify-center mb-3">
              <CheckCircle2 className="w-6 h-6 stroke-[2.2]" />
            </div>
            <h4 className="font-bold text-base mb-1">Livro Registado como Lido</h4>
            <p className="text-xs text-gray-400">Adicionado com sucesso à tua biblioteca.</p>
          </div>
        ) : activeTab === "search" ? (
          <div className="space-y-4">
            {/* Campo de Pesquisa */}
            <div className="relative">
              <Search className="w-4 h-4 absolute left-3.5 top-3.5 text-gray-400" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Pesquisar por título ou autor..."
                className="w-full pl-10 pr-4 py-2.5 bg-gray-50 dark:bg-gray-800/80 border border-gray-200 dark:border-gray-700 rounded-xl text-xs sm:text-sm font-medium focus:outline-none focus:ring-2 focus:ring-black dark:focus:ring-white transition-all"
                autoFocus
              />
            </div>

            {/* Resultados da Pesquisa */}
            <div className="max-h-60 overflow-y-auto space-y-2 pr-1 no-scrollbar">
              {searching ? (
                <div className="py-8 text-center text-xs text-gray-400">A pesquisar catálogo...</div>
              ) : searchQuery && catalogResults.length === 0 ? (
                <div className="py-8 text-center text-xs text-gray-400">
                  Nenhum livro encontrado no sistema.<br />
                  <span 
                    onClick={() => {
                      setCustomTitle(searchQuery);
                      setActiveTab("custom");
                    }}
                    className="text-black dark:text-white underline font-semibold cursor-pointer mt-2 inline-block"
                  >
                    Registar como Livro Físico / Externo &rarr;
                  </span>
                </div>
              ) : catalogResults.length > 0 ? (
                catalogResults.map((b) => (
                  <div
                    key={b.id}
                    className="p-2.5 rounded-xl border border-gray-100 dark:border-gray-800 hover:border-black dark:hover:border-white transition-all flex items-center justify-between gap-3 bg-gray-50/50 dark:bg-gray-800/40"
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <div className="w-10 h-14 bg-gray-200 dark:bg-gray-700 rounded-md overflow-hidden shrink-0 flex items-center justify-center">
                        {b.cover_url ? (
                          <img src={b.cover_url} alt={b.title} className="w-full h-full object-cover" />
                        ) : (
                          <BookOpen className="w-5 h-5 text-gray-400" />
                        )}
                      </div>
                      <div className="min-w-0">
                        <h4 className="font-bold text-xs truncate">{b.title}</h4>
                        <p className="text-[11px] text-gray-400 truncate">{b.author}</p>
                      </div>
                    </div>

                    <button
                      type="button"
                      disabled={submitting}
                      onClick={() => handleMarkCatalogFinished(b)}
                      className="px-3 py-1.5 bg-black dark:bg-white text-white dark:text-black rounded-lg text-xs font-bold active:scale-95 transition-transform shrink-0 flex items-center gap-1 shadow-xs"
                    >
                      <Check className="w-3.5 h-3.5 stroke-[2.5]" />
                      <span>Marcar Lido</span>
                    </button>
                  </div>
                ))
              ) : (
                <div className="py-6 text-center text-xs text-gray-400 leading-relaxed">
                  Digita o nome da obra para procurá-la no catálogo e marcá-la como concluída.
                </div>
              )}
            </div>
          </div>
        ) : (
          /* Formulário de Livro Físico / Externo */
          <form onSubmit={handleSaveCustomBook} className="space-y-3 text-xs">
            <div>
              <label className="block text-[11px] font-bold uppercase tracking-wider text-gray-500 mb-1">
                Título da Obra *
              </label>
              <input
                type="text"
                required
                value={customTitle}
                onChange={(e) => setCustomTitle(e.target.value)}
                placeholder="Ex: Terra Sonâmbula, O Alquimista..."
                className="w-full px-3.5 py-2.5 bg-gray-50 dark:bg-gray-800/80 border border-gray-200 dark:border-gray-700 rounded-xl font-medium focus:outline-none focus:ring-2 focus:ring-black dark:focus:ring-white"
              />
            </div>

            <div className="grid grid-cols-2 gap-2.5">
              <div>
                <label className="block text-[11px] font-bold uppercase tracking-wider text-gray-500 mb-1">
                  Autor
                </label>
                <input
                  type="text"
                  value={customAuthor}
                  onChange={(e) => setCustomAuthor(e.target.value)}
                  placeholder="Nome do autor"
                  className="w-full px-3.5 py-2.5 bg-gray-50 dark:bg-gray-800/80 border border-gray-200 dark:border-gray-700 rounded-xl font-medium focus:outline-none focus:ring-2 focus:ring-black dark:focus:ring-white"
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold uppercase tracking-wider text-gray-500 mb-1">
                  Total de Páginas
                </label>
                <input
                  type="number"
                  value={customPages}
                  onChange={(e) => setCustomPages(e.target.value)}
                  placeholder="Ex: 240"
                  className="w-full px-3.5 py-2.5 bg-gray-50 dark:bg-gray-800/80 border border-gray-200 dark:border-gray-700 rounded-xl font-medium focus:outline-none focus:ring-2 focus:ring-black dark:focus:ring-white"
                />
              </div>
            </div>

            {/* Formato: Físico vs Digital */}
            <div>
              <label className="block text-[11px] font-bold uppercase tracking-wider text-gray-500 mb-1.5">
                Tipo de Leitura
              </label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setCustomFormat("physical")}
                  className={`py-2 px-3 rounded-xl border text-center font-semibold transition-all flex items-center justify-center gap-1.5 ${
                    customFormat === "physical"
                      ? "border-black dark:border-white bg-black dark:bg-white text-white dark:text-black"
                      : "border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-400"
                  }`}
                >
                  <BookOpen className="w-3.5 h-3.5" />
                  <span>Livro Físico</span>
                </button>
                <button
                  type="button"
                  onClick={() => setCustomFormat("digital")}
                  className={`py-2 px-3 rounded-xl border text-center font-semibold transition-all flex items-center justify-center gap-1.5 ${
                    customFormat === "digital"
                      ? "border-black dark:border-white bg-black dark:bg-white text-white dark:text-black"
                      : "border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-400"
                  }`}
                >
                  <Smartphone className="w-3.5 h-3.5" />
                  <span>Digital / Ebook</span>
                </button>
              </div>
            </div>

            {/* Avaliação em Estrelas Monocromática */}
            <div>
              <label className="block text-[11px] font-bold uppercase tracking-wider text-gray-500 mb-1">
                Avaliação da Obra
              </label>
              <div className="flex items-center gap-1.5 pt-0.5">
                {[1, 2, 3, 4, 5].map((star) => (
                  <button
                    key={star}
                    type="button"
                    onClick={() => setCustomRating(star)}
                    className="p-1 hover:scale-110 transition-transform"
                  >
                    <Star
                      className={`w-4 h-4 ${
                        star <= customRating
                          ? "fill-current text-black dark:text-white"
                          : "text-gray-300 dark:text-gray-700"
                      }`}
                    />
                  </button>
                ))}
                <span className="text-xs font-bold ml-2">{customRating} de 5</span>
              </div>
            </div>

            <button
              type="submit"
              disabled={submitting || !customTitle.trim()}
              className="w-full mt-2 py-3 bg-black dark:bg-white text-white dark:text-black rounded-xl font-bold text-xs shadow-sm active:scale-95 transition-transform flex items-center justify-center gap-2 disabled:opacity-50"
            >
              <Plus className="w-4 h-4 stroke-[2.5]" />
              <span>Adicionar aos Lidos</span>
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
