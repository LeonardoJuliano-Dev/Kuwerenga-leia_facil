import { useState } from "react";
import {
  X,
  Star,
  Phone,
  MapPin,
  Truck,
  Building2,
  UserCheck,
  ShoppingBag,
  BookOpen,
  Check,
  AlertCircle,
  Edit3
} from "lucide-react";
import {
  type BookSaleItem,
  buildWhatsAppLink,
  rateBookPurchase
} from "../lib/storeService";

interface BookSalePreviewModalProps {
  isOpen: boolean;
  onClose: () => void;
  book: BookSaleItem | null;
  onEdit?: (book: BookSaleItem) => void;
  isAdmin?: boolean;
}

export default function BookSalePreviewModal({
  isOpen,
  onClose,
  book,
  onEdit,
  isAdmin = false
}: BookSalePreviewModalProps) {
  if (!isOpen || !book) return null;

  const [rating, setRating] = useState<number>(book.purchase_rating || 5);
  const [hoverRating, setHoverRating] = useState<number | null>(null);
  const [comment, setComment] = useState<string>(book.rating_comment || "");
  const [savingRating, setSavingRating] = useState(false);
  const [ratingSavedFeedback, setRatingSavedFeedback] = useState(false);

  const priceFormatted = book.price ? `${book.price} ${book.currency || "MT"}` : "Sob Consulta";
  const isOutOfStock = book.stock_status === "out_of_stock";
  const isBookstore = book.seller_type === "bookstore";

  const handleSaveRating = async () => {
    setSavingRating(true);
    try {
      await rateBookPurchase(book.id, rating, comment.trim());
      setRatingSavedFeedback(true);
      setTimeout(() => setRatingSavedFeedback(false), 2500);
    } catch (err) {
      console.error("Erro ao guardar classificação:", err);
    } finally {
      setSavingRating(false);
    }
  };

  const handleWhatsAppRedirect = () => {
    const link = buildWhatsAppLink({
      title: book.title,
      price: book.price,
      currency: book.currency,
      seller_whatsapp: book.seller_whatsapp || "258840000000",
      stock_status: book.stock_status || "available"
    });
    window.open(link, "_blank", "noopener,noreferrer");
  };

  return (
    <div
      onClick={onClose}
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 md:p-6 bg-black/65 backdrop-blur-xs animate-in fade-in duration-200"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-xl bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-2xl sm:rounded-3xl shadow-2xl max-h-[92vh] flex flex-col overflow-hidden text-black dark:text-white animate-in zoom-in-95 duration-200"
      >
        {/* Cabeçalho do Modal */}
        <div className="px-4 py-3.5 sm:px-6 sm:py-4 border-b border-gray-100 dark:border-gray-800 flex items-center justify-between shrink-0 bg-white/90 dark:bg-gray-900/90 backdrop-blur-md">
          <div className="flex items-center gap-2.5 min-w-0 pr-2">
            <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-xl bg-emerald-600 text-white flex items-center justify-center shadow-xs shrink-0">
              <ShoppingBag className="w-4 h-4 sm:w-5 sm:h-5" />
            </div>
            <div className="min-w-0">
              <h2 className="font-bold text-sm sm:text-base leading-tight truncate">
                Pré-visualização do Livro à Venda
              </h2>
              <span className="text-[10px] sm:text-[11px] text-gray-500 dark:text-gray-400 block truncate mt-0.5">
                Catálogo de Venda & Encomenda • Kuwerenga
              </span>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 sm:p-2 rounded-xl text-gray-500 hover:text-black dark:hover:text-white hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors shrink-0"
            aria-label="Fechar"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Conteúdo com Scroll Suave */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-4 sm:space-y-5 no-scrollbar">
          
          {/* Banner de Estado da Obra */}
          <div className="p-3 sm:p-3.5 rounded-2xl bg-amber-50/80 dark:bg-amber-950/30 border border-amber-200/80 dark:border-amber-900/50 flex items-start gap-2.5">
            <AlertCircle className="w-4 h-4 text-amber-700 dark:text-amber-400 shrink-0 mt-0.5" />
            <div className="text-xs text-amber-900 dark:text-amber-300 leading-relaxed">
              <span className="font-bold block">No momento não disponível para leitura digital imediata</span>
              <span>
                Esta obra faz parte do catálogo de venda e encomenda física ou digital direta. A aquisição e entrega são acordadas diretamente com o vendedor.
              </span>
            </div>
          </div>

          {/* Cartão de Apresentação da Obra */}
          <div className="bg-gray-50/70 dark:bg-gray-800/40 border border-gray-200 dark:border-gray-800 rounded-3xl p-4 sm:p-5 flex flex-col sm:flex-row gap-4 sm:gap-5 items-center sm:items-start shadow-xs">
            {/* Capa */}
            <div className="w-28 sm:w-32 aspect-[2/3] rounded-2xl overflow-hidden border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 shadow-md shrink-0 relative flex items-center justify-center">
              {book.cover_url ? (
                <img
                  src={book.cover_url}
                  alt={book.title}
                  className="w-full h-full object-cover"
                />
              ) : (
                <div className="p-2 text-center text-gray-400">
                  <BookOpen className="w-8 h-8 mx-auto mb-1 opacity-50" />
                  <span className="text-[10px] font-bold">Sem capa</span>
                </div>
              )}
              {isOutOfStock && (
                <div className="absolute top-2 right-2 px-2 py-0.5 rounded-md bg-red-600 text-white text-[9px] font-bold uppercase tracking-wider shadow-xs">
                  Esgotado
                </div>
              )}
            </div>

            {/* Informações Centrais */}
            <div className="flex-1 min-w-0 space-y-2.5 text-center sm:text-left w-full">
              <div>
                <span className="text-[10px] font-bold uppercase tracking-wider px-2.5 py-0.5 rounded-full bg-black/5 dark:bg-white/10 text-gray-600 dark:text-gray-300 inline-block mb-1.5">
                  {book.file_type === "physical"
                    ? "Livro Físico (Impresso)"
                    : book.file_type === "pdf"
                    ? "Ficheiro PDF"
                    : "Ficheiro ePub"}
                </span>
                <h3 className="font-serif text-lg sm:text-xl font-bold tracking-tight leading-snug text-black dark:text-white">
                  {book.title}
                </h3>
                <p className="text-xs sm:text-sm text-gray-500 dark:text-gray-400 font-medium">
                  de {book.author}
                </p>
              </div>

              {/* Preço e Disponibilidade */}
              <div className="flex items-center justify-center sm:justify-start gap-3 pt-1">
                <div className="text-xl sm:text-2xl font-bold font-mono text-emerald-600 dark:text-emerald-400 leading-none">
                  {priceFormatted}
                </div>
                <div className="text-[11px] font-medium">
                  {isOutOfStock ? (
                    <span className="text-red-600 dark:text-red-400 font-bold flex items-center gap-1">
                      <span className="w-1.5 h-1.5 rounded-full bg-red-600 dark:bg-red-400" />
                      Esgotado (Reserva)
                    </span>
                  ) : (
                    <span className="text-emerald-700 dark:text-emerald-300 font-bold flex items-center gap-1">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-600 dark:bg-emerald-400" />
                      Em Stock ({book.stock_quantity || 1} disp.)
                    </span>
                  )}
                </div>
              </div>

              {/* Condição e Formato */}
              <div className="flex flex-wrap items-center justify-center sm:justify-start gap-2 pt-1 text-[11px]">
                <span className="px-2.5 py-1 rounded-xl bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-300">
                  Estado: <strong>{book.physical_condition || "Novo"}</strong>
                </span>
                {book.location && (
                  <span className="px-2.5 py-1 rounded-xl bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-300 flex items-center gap-1">
                    <MapPin className="w-3 h-3 text-gray-400" />
                    <span>{book.location}</span>
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* Dados do Vendedor e Localização */}
          <div className="p-4 sm:p-5 rounded-3xl bg-white dark:bg-gray-850 border border-gray-200 dark:border-gray-800 space-y-3 shadow-xs">
            <span className="text-[11px] font-bold uppercase tracking-wider text-gray-400 dark:text-gray-500 block">
              Informações do Vendedor & Entrega
            </span>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {/* Nome e Tipo do Vendedor */}
              <div className="p-3 rounded-2xl bg-gray-50 dark:bg-gray-800/60 border border-gray-100 dark:border-gray-750 flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-black dark:bg-white text-white dark:text-black flex items-center justify-center shrink-0">
                  {isBookstore ? <Building2 className="w-4 h-4" /> : <UserCheck className="w-4 h-4" />}
                </div>
                <div className="min-w-0">
                  <span className="text-[10px] uppercase font-bold text-gray-400 block leading-tight">
                    {isBookstore ? "Livraria Parceira" : "Vendedor Independente"}
                  </span>
                  <span className="text-xs font-bold truncate block text-black dark:text-white">
                    {book.seller_name || (isBookstore ? "Livraria Kuwerenga" : "Vendedor Autorizado")}
                  </span>
                </div>
              </div>

              {/* Localização do Vendedor */}
              <div className="p-3 rounded-2xl bg-gray-50 dark:bg-gray-800/60 border border-gray-100 dark:border-gray-750 flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-200 flex items-center justify-center shrink-0">
                  <MapPin className="w-4 h-4" />
                </div>
                <div className="min-w-0">
                  <span className="text-[10px] uppercase font-bold text-gray-400 block leading-tight">
                    Localização
                  </span>
                  <span className="text-xs font-semibold truncate block text-black dark:text-white">
                    {book.location || "Disponível para entrega em Moçambique"}
                  </span>
                </div>
              </div>

              {/* Opções de Envio */}
              <div className="p-3 rounded-2xl bg-gray-50 dark:bg-gray-800/60 border border-gray-100 dark:border-gray-750 flex items-center gap-2.5 sm:col-span-2">
                <div className="w-9 h-9 rounded-xl bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-200 flex items-center justify-center shrink-0">
                  <Truck className="w-4 h-4" />
                </div>
                <div className="min-w-0">
                  <span className="text-[10px] uppercase font-bold text-gray-400 block leading-tight">
                    Opções de Entrega
                  </span>
                  <span className="text-xs font-medium text-gray-700 dark:text-gray-300">
                    {book.delivery_options || "Levantamento no local ou entrega combinada via WhatsApp."}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Sinopse da Obra */}
          <div className="p-4 sm:p-5 rounded-3xl bg-white dark:bg-gray-850 border border-gray-200 dark:border-gray-800 space-y-2 shadow-xs">
            <span className="text-[11px] font-bold uppercase tracking-wider text-gray-400 dark:text-gray-500 block">
              Sinopse & Descrição da Obra
            </span>
            <div className="text-xs sm:text-sm text-gray-700 dark:text-gray-300 leading-relaxed whitespace-pre-line">
              {book.description?.trim()
                ? book.description
                : "Sem descrição adicional registada para este exemplar."}
            </div>
          </div>

          {/* Classificação da Compra ("classificao da compara") */}
          <div className="p-4 sm:p-5 rounded-3xl bg-[#f5f0eb] dark:bg-gray-850/80 border border-[#e8dfd5] dark:border-gray-750 space-y-3 shadow-xs">
            <div className="flex items-center justify-between">
              <div>
                <span className="text-xs font-bold block text-black dark:text-white">
                  Classificação da Compra
                </span>
                <span className="text-[10px] text-gray-500 dark:text-gray-400">
                  Avalia a qualidade, preço ou interesse nesta oportunidade de compra
                </span>
              </div>
              <div className="text-sm font-bold font-mono text-amber-600 dark:text-amber-400">
                {rating}.0 / 5.0
              </div>
            </div>

            {/* Estrelas Interativas */}
            <div className="flex items-center gap-1.5 py-1">
              {[1, 2, 3, 4, 5].map((star) => {
                const isFilled = (hoverRating !== null ? hoverRating : rating) >= star;
                return (
                  <button
                    key={star}
                    type="button"
                    onMouseEnter={() => setHoverRating(star)}
                    onMouseLeave={() => setHoverRating(null)}
                    onClick={() => setRating(star)}
                    className="p-1 rounded-lg text-amber-500 hover:scale-110 active:scale-95 transition-all"
                    title={`Classificar com ${star} estrelas`}
                  >
                    <Star
                      className={`w-6 h-6 ${
                        isFilled
                          ? "fill-amber-500 stroke-amber-500"
                          : "text-gray-300 dark:text-gray-600 stroke-1"
                      }`}
                    />
                  </button>
                );
              })}
            </div>

            {/* Comentário Opcional de Avaliação */}
            <div className="space-y-1.5">
              <input
                type="text"
                value={comment}
                onChange={(e) => setComment(e.target.value)}
                placeholder="Ex: Livro raro em excelente estado, recomendo a compra..."
                className="w-full px-3.5 py-2.5 rounded-xl border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 text-xs text-black dark:text-white focus:outline-none focus:border-black dark:focus:border-white"
              />
              <div className="flex justify-end pt-1">
                <button
                  type="button"
                  onClick={handleSaveRating}
                  disabled={savingRating}
                  className="px-4 py-2 rounded-xl bg-black dark:bg-white text-white dark:text-black text-xs font-bold flex items-center gap-1.5 active:scale-95 transition-all shadow-xs disabled:opacity-50"
                >
                  {savingRating ? (
                    <span>A guardar...</span>
                  ) : ratingSavedFeedback ? (
                    <>
                      <Check className="w-3.5 h-3.5 text-emerald-500" />
                      <span>Classificação Registada!</span>
                    </>
                  ) : (
                    <span>Guardar Classificação</span>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Rodapé com Ações */}
        <div className="p-4 sm:p-5 border-t border-gray-100 dark:border-gray-800 bg-white/95 dark:bg-gray-900/95 flex flex-col sm:flex-row gap-2.5 items-center justify-between shrink-0">
          <div className="flex items-center gap-2 w-full sm:w-auto">
            {isAdmin && onEdit && (
              <button
                type="button"
                onClick={() => {
                  onClose();
                  onEdit(book);
                }}
                className="py-2.5 px-4 rounded-xl border border-gray-200 dark:border-gray-800 hover:bg-gray-100 dark:hover:bg-gray-800 text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors w-full sm:w-auto"
              >
                <Edit3 className="w-3.5 h-3.5" />
                <span>Editar Livro</span>
              </button>
            )}
            <button
              type="button"
              onClick={onClose}
              className="py-2.5 px-4 rounded-xl border border-gray-200 dark:border-gray-800 hover:bg-gray-100 dark:hover:bg-gray-800 text-xs font-semibold transition-colors w-full sm:w-auto"
            >
              Fechar
            </button>
          </div>

          {/* Botão Principal: WhatsApp */}
          <button
            type="button"
            onClick={handleWhatsAppRedirect}
            className="w-full sm:w-auto px-5 py-3 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold flex items-center justify-center gap-2 shadow-sm active:scale-95 transition-all"
          >
            <Phone className="w-4 h-4" />
            <span>
              {isOutOfStock ? "Reservar via WhatsApp" : "Comprar / Negociar via WhatsApp"}
            </span>
          </button>
        </div>
      </div>
    </div>
  );
}
