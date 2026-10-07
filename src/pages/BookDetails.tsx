import { useState, useEffect } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import {
  ArrowLeft,
  Star,
  BookOpen,
  Bookmark,
  BookmarkCheck,
  Send,
  Trash2
} from "lucide-react";
import { supabase } from "../lib/supabase";

interface BookData {
  id: string;
  title: string;
  author: string;
  description: string | null;
  cover_url: string | null;
  file_url: string;
  file_type: "pdf" | "epub";
  total_pages: number;
  avg_rating: number;
  total_ratings: number;
  category: { name: string } | null;
  created_at: string;
}

interface Review {
  id: string;
  rating: number;
  comment: string;
  created_at: string;
  user_id: string;
  profile: {
    full_name: string | null;
    avatar_url: string | null;
  } | null;
}

export default function BookDetails() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const [book, setBook] = useState<BookData | null>(null);
  const [reviews, setReviews] = useState<Review[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [isInLibrary, setIsInLibrary] = useState(false);

  // Estados do formulário de avaliação
  const [userRating, setUserRating] = useState<number>(5);
  const [userComment, setUserComment] = useState("");
  const [submittingReview, setSubmittingReview] = useState(false);
  const [myExistingReview, setMyExistingReview] = useState<Review | null>(null);

  useEffect(() => {
    if (!id) return;

    async function loadBookAndReviews() {
      setLoading(true);
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (user) setCurrentUserId(user.id);

        // 1. Carregar Detalhes do Livro
        const { data: bookRecord, error: bookErr } = await supabase
          .from("books")
          .select(`
            id,
            title,
            author,
            description,
            cover_url,
            file_url,
            file_type,
            total_pages,
            avg_rating,
            total_ratings,
            created_at,
            category:categories(name)
          `)
          .eq("id", id)
          .single();

        if (bookErr) throw bookErr;
        setBook(bookRecord as any);

        // 2. Verificar se está na biblioteca do utilizador
        if (user) {
          const { data: userBook } = await supabase
            .from("user_books")
            .select("id")
            .eq("user_id", user.id)
            .eq("book_id", id)
            .maybeSingle();

          setIsInLibrary(!!userBook);
        }

        // 3. Carregar Reviews com Perfil do utilizador
        const { data: reviewsData } = await supabase
          .from("reviews")
          .select(`
            id,
            rating,
            comment,
            created_at,
            user_id,
            profile:profiles(full_name, avatar_url)
          `)
          .eq("book_id", id)
          .order("created_at", { ascending: false });

        if (reviewsData) {
          const formattedReviews: Review[] = reviewsData.map((r: any) => ({
            id: r.id,
            rating: r.rating,
            comment: r.comment,
            created_at: r.created_at,
            user_id: r.user_id,
            profile: r.profile
          }));

          setReviews(formattedReviews);

          // Verifica se o próprio utilizador já tem review
          if (user) {
            const mine = formattedReviews.find((r) => r.user_id === user.id);
            if (mine) {
              setMyExistingReview(mine);
              setUserRating(mine.rating);
              setUserComment(mine.comment || "");
            }
          }
        }
      } catch (err) {
        console.error("Erro ao carregar detalhes do livro:", err);
      } finally {
        setLoading(false);
      }
    }

    loadBookAndReviews();
  }, [id]);

  // Alternar livro na biblioteca
  const toggleLibrary = async () => {
    if (!currentUserId || !book) return;
    try {
      if (isInLibrary) {
        await supabase
          .from("user_books")
          .delete()
          .eq("user_id", currentUserId)
          .eq("book_id", book.id);
        setIsInLibrary(false);
      } else {
        await supabase
          .from("user_books")
          .insert({
            user_id: currentUserId,
            book_id: book.id,
            status: "to_read"
          });
        setIsInLibrary(true);
      }
    } catch (e) {
      console.error(e);
    }
  };

  // Enviar Avaliação (Criar ou Atualizar)
  const handleSubmitReview = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentUserId || !book) return;

    setSubmittingReview(true);
    try {
      const reviewPayload = {
        user_id: currentUserId,
        book_id: book.id,
        rating: userRating,
        comment: userComment.trim() || null,
        updated_at: new Date().toISOString()
      };

      const { data: savedReview, error } = await supabase
        .from("reviews")
        .upsert(reviewPayload, { onConflict: "user_id,book_id" })
        .select(`
          id,
          rating,
          comment,
          created_at,
          user_id,
          profile:profiles(full_name, avatar_url)
        `)
        .single();

      if (error) throw error;

      if (savedReview) {
        const updatedReviews = [
          savedReview as any,
          ...reviews.filter((r) => r.user_id !== currentUserId)
        ];
        setReviews(updatedReviews);
        setMyExistingReview(savedReview as any);
      }

      // Recarrega estatísticas do livro para atualizar a média
      const { data: updatedBook } = await supabase
        .from("books")
        .select("avg_rating, total_ratings")
        .eq("id", book.id)
        .single();

      if (updatedBook) {
        setBook({
          ...book,
          avg_rating: updatedBook.avg_rating,
          total_ratings: updatedBook.total_ratings
        });
      }
    } catch (err) {
      console.error("Erro ao guardar avaliação:", err);
    } finally {
      setSubmittingReview(false);
    }
  };

  // Eliminar Avaliação
  const handleDeleteReview = async (reviewId: string) => {
    try {
      await supabase.from("reviews").delete().eq("id", reviewId);
      setReviews(reviews.filter((r) => r.id !== reviewId));
      if (myExistingReview?.id === reviewId) {
        setMyExistingReview(null);
        setUserComment("");
        setUserRating(5);
      }
    } catch (err) {
      console.error("Erro ao eliminar avaliação:", err);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-white dark:bg-black">
        <div className="w-8 h-8 border-2 border-black dark:border-white border-t-transparent dark:border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  if (!book) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen p-6 text-center bg-white dark:bg-black text-black dark:text-white">
        <BookOpen className="w-12 h-12 text-gray-400 mb-4" />
        <h2 className="text-xl font-bold mb-2">Livro não encontrado</h2>
        <p className="text-sm text-gray-500 mb-6">O livro que procuras não existe ou foi removido.</p>
        <Link to="/explore" className="px-5 py-2.5 bg-black dark:bg-white text-white dark:text-black rounded-xl text-xs font-semibold">
          Explorar Outros Livros
        </Link>
      </div>
    );
  }

  return (
    <div className="flex flex-col min-h-screen bg-white dark:bg-black text-black dark:text-white pb-16">
      
      {/* Top Header */}
      <header className="px-4 sm:px-6 pt-safe flex items-center justify-between sticky top-0 bg-white/90 dark:bg-black/90 backdrop-blur-md z-10 border-b border-gray-100 dark:border-gray-900">
        <div className="app-container pt-6 sm:pt-8 pb-4 flex items-center justify-between w-full">
        <button
          onClick={() => navigate(-1)}
          className="p-2 -ml-2 rounded-full hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
        >
          <ArrowLeft className="w-5 h-5" />
        </button>

        <div className="flex items-center gap-2">
          <button
            onClick={toggleLibrary}
            className={`p-2 rounded-full transition-colors ${
              isInLibrary
                ? "text-black dark:text-white"
                : "text-gray-400 hover:text-black dark:hover:text-white"
            }`}
            title={isInLibrary ? "Remover da Biblioteca" : "Guardar na Biblioteca"}
          >
            {isInLibrary ? <BookmarkCheck className="w-5 h-5 fill-current" /> : <Bookmark className="w-5 h-5" />}
          </button>
        </div>
        </div>
      </header>

      {/* Livro Hero */}
      <main className="flex-1 app-container px-4 sm:px-6 pt-6 pb-6">
        
        {/* Capa e Título */}
        <div className="flex flex-col items-center text-center mb-8">
          <div className="w-36 h-52 bg-gray-100 dark:bg-gray-800 rounded-2xl shadow-xl overflow-hidden mb-6 flex items-center justify-center border border-gray-200 dark:border-gray-700 relative">
            {book.cover_url ? (
              <img src={book.cover_url} alt={book.title} className="w-full h-full object-cover" />
            ) : (
              <div className="w-full h-full p-4 flex flex-col justify-between bg-black text-white text-center">
                <span className="text-[9px] uppercase tracking-widest text-gray-400">
                  {book.file_type}
                </span>
                <span className="font-serif text-sm font-bold line-clamp-3 leading-tight">
                  {book.title}
                </span>
                <span className="text-[10px] text-gray-400 truncate">{book.author}</span>
              </div>
            )}
          </div>

          <span className="inline-block uppercase tracking-wider text-[10px] font-bold px-3 py-1 rounded-full bg-gray-100 dark:bg-gray-900 text-gray-600 dark:text-gray-300 mb-2">
            {book.category?.name || book.file_type.toUpperCase()}
          </span>

          <h1 className="text-2xl font-bold tracking-tight mb-1">{book.title}</h1>
          <p className="text-sm text-gray-500 mb-4">{book.author}</p>

          {/* Rating Badge */}
          <div className="flex items-center gap-2 mb-6">
            <div className="flex text-amber-500">
              {[1, 2, 3, 4, 5].map((star) => (
                <Star
                  key={star}
                  className={`w-4 h-4 ${
                    star <= Math.round(book.avg_rating || 0) ? "fill-amber-500" : "text-gray-300 dark:text-gray-700"
                  }`}
                />
              ))}
            </div>
            <span className="font-bold text-sm">
              {book.avg_rating > 0 ? Number(book.avg_rating).toFixed(1) : "Sem notas"}
            </span>
            <span className="text-xs text-gray-400">({book.total_ratings} avaliações)</span>
          </div>

          {/* Botão de Leitura Direta */}
          <Link
            to={`/reader?bookId=${book.id}`}
            className="w-full bg-black dark:bg-white text-white dark:text-black py-4 rounded-2xl font-bold text-sm shadow-md active:scale-95 transition-transform flex items-center justify-center gap-2"
          >
            <BookOpen className="w-5 h-5" />
            <span>Começar a Ler Agora</span>
          </Link>
        </div>

        {/* Sinopse */}
        <section className="mb-10 pb-8 border-b border-gray-100 dark:border-gray-900">
          <h2 className="text-sm font-bold uppercase tracking-wider text-gray-400 mb-3">Sinopse</h2>
          <p className="text-sm text-gray-700 dark:text-gray-300 leading-relaxed whitespace-pre-line">
            {book.description || "Nenhuma sinopse disponível para este livro."}
          </p>
        </section>

        {/* Secção de Avaliações & Comentários */}
        <section className="mb-12">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-lg font-bold">Comentários e Avaliações ({reviews.length})</h2>
          </div>

          {/* Formulário: Deixar Avaliação */}
          <form
            onSubmit={handleSubmitReview}
            className="p-5 rounded-2xl border border-gray-200 dark:border-gray-800 bg-gray-50/50 dark:bg-gray-900/40 mb-8"
          >
            <h3 className="text-xs font-bold uppercase tracking-wider text-gray-500 mb-3">
              {myExistingReview ? "Atualizar a tua avaliação" : "O que achaste deste livro?"}
            </h3>

            {/* Estrelas Interativas */}
            <div className="flex items-center gap-2 mb-4">
              {[1, 2, 3, 4, 5].map((star) => (
                <button
                  type="button"
                  key={star}
                  onClick={() => setUserRating(star)}
                  className="p-1 text-amber-500 hover:scale-110 active:scale-95 transition-transform"
                >
                  <Star
                    className={`w-6 h-6 ${
                      star <= userRating ? "fill-amber-500" : "text-gray-300 dark:text-gray-700"
                    }`}
                  />
                </button>
              ))}
              <span className="text-xs font-bold ml-2 text-gray-500">{userRating} de 5</span>
            </div>

            <textarea
              rows={3}
              value={userComment}
              onChange={(e) => setUserComment(e.target.value)}
              placeholder="Escreve uma reflexão, recomendação ou comentário sincero sobre a leitura..."
              className="w-full bg-white dark:bg-black border border-gray-200 dark:border-gray-800 rounded-xl p-3 text-sm focus:outline-none focus:ring-2 focus:ring-black dark:focus:ring-white mb-3 resize-none transition-all"
            />

            <div className="flex justify-end">
              <button
                type="submit"
                disabled={submittingReview}
                className="px-5 py-2.5 bg-black dark:bg-white text-white dark:text-black rounded-xl text-xs font-semibold shadow-xs active:scale-95 transition-transform flex items-center gap-1.5 disabled:opacity-50"
              >
                <Send className="w-3.5 h-3.5" />
                <span>{submittingReview ? "A publicar..." : myExistingReview ? "Guardar Alteração" : "Publicar Comentário"}</span>
              </button>
            </div>
          </form>

          {/* Lista de Reviews dos Leitores */}
          {reviews.length === 0 ? (
            <div className="text-center py-10 text-gray-400 text-xs">
              Ainda não existem comentários para esta obra. Sê o primeiro a partilhar a tua opinião!
            </div>
          ) : (
            <div className="space-y-4">
              {reviews.map((rev) => {
                const isMe = rev.user_id === currentUserId;
                const authorName = rev.profile?.full_name || "Leitor Anónimo";

                return (
                  <div
                    key={rev.id}
                    className="p-4 rounded-2xl border border-gray-100 dark:border-gray-800 bg-white dark:bg-gray-900/60 shadow-xs"
                  >
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2.5">
                        <div className="w-8 h-8 rounded-full bg-gray-200 dark:bg-gray-800 flex items-center justify-center font-bold text-xs uppercase">
                          {authorName.charAt(0)}
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-bold">{authorName}</span>
                            {isMe && (
                              <span className="text-[10px] bg-gray-100 dark:bg-gray-800 px-1.5 py-0.5 rounded text-gray-500">
                                Tu
                              </span>
                            )}
                          </div>
                          <div className="flex text-amber-500 mt-0.5">
                            {[1, 2, 3, 4, 5].map((s) => (
                              <Star
                                key={s}
                                className={`w-3 h-3 ${
                                  s <= rev.rating ? "fill-amber-500" : "text-gray-200 dark:text-gray-800"
                                }`}
                              />
                            ))}
                          </div>
                        </div>
                      </div>

                      {isMe && (
                        <button
                          onClick={() => handleDeleteReview(rev.id)}
                          className="p-1.5 text-gray-400 hover:text-red-500 transition-colors"
                          title="Eliminar o teu comentário"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>

                    {rev.comment && (
                      <p className="text-xs text-gray-700 dark:text-gray-300 leading-relaxed mt-2 pl-10">
                        {rev.comment}
                      </p>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </section>
      </main>
    </div>
  );
}
