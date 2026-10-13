import { useState, useEffect, useRef } from "react";
import {
  X,
  Upload,
  Image as ImageIcon,
  DollarSign,
  Phone,
  Sparkles,
  CheckCircle,
  AlertCircle,
  BookOpen
} from "lucide-react";
import { supabase } from "../lib/supabase";
import { extractCoverFromFile } from "../lib/coverExtractor";
import {
  upsertBookForSale,
  formatWhatsAppNumber,
  type BookSaleItem
} from "../lib/storeService";

interface AdminBookSaleModalProps {
  isOpen: boolean;
  onClose: () => void;
  bookToEdit?: BookSaleItem | null;
  onSaved: (book: BookSaleItem) => void;
  categories: { id: string; name: string }[];
}

export default function AdminBookSaleModal({
  isOpen,
  onClose,
  bookToEdit,
  onSaved,
  categories,
}: AdminBookSaleModalProps) {
  const [title, setTitle] = useState("");
  const [author, setAuthor] = useState("");
  const [description, setDescription] = useState("");
  const [price, setPrice] = useState("");
  const [currency, setCurrency] = useState("MT");
  const [stockStatus, setStockStatus] = useState<"available" | "out_of_stock">("available");
  const [sellerWhatsApp, setSellerWhatsApp] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [bookType, setBookType] = useState<"physical" | "pdf" | "epub">("physical");

  // Capa e ficheiros
  const [coverFile, setCoverFile] = useState<File | null>(null);
  const [coverPreview, setCoverPreview] = useState<string | null>(null);
  const [bookFile, setBookFile] = useState<File | null>(null);
  const [extractingCover, setExtractingCover] = useState(false);
  const [extractedNotice, setExtractedNotice] = useState(false);

  // Estados de envio
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const coverInputRef = useRef<HTMLInputElement>(null);
  const bookInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (bookToEdit) {
      setTitle(bookToEdit.title || "");
      setAuthor(bookToEdit.author || "");
      setDescription(bookToEdit.description || "");
      setPrice(bookToEdit.price ? String(bookToEdit.price) : "");
      setCurrency(bookToEdit.currency || "MT");
      setStockStatus(bookToEdit.stock_status || "available");
      setSellerWhatsApp(bookToEdit.seller_whatsapp || "");
      setCategoryId(bookToEdit.category_id || (categories[0]?.id || ""));
      setBookType((bookToEdit.file_type as any) || "physical");
      setCoverPreview(bookToEdit.cover_url || null);
      setCoverFile(null);
      setBookFile(null);
      setExtractedNotice(false);
    } else {
      setTitle("");
      setAuthor("");
      setDescription("");
      setPrice("");
      setCurrency("MT");
      setStockStatus("available");
      setSellerWhatsApp("");
      setCategoryId(categories[0]?.id || "");
      setBookType("physical");
      setCoverPreview(null);
      setCoverFile(null);
      setBookFile(null);
      setExtractedNotice(false);
    }
    setError("");
  }, [bookToEdit, isOpen, categories]);

  if (!isOpen) return null;

  // Ao selecionar um ficheiro de livro (PDF ou EPUB)
  const handleBookFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setBookFile(file);
    const ext = file.name.split(".").pop()?.toLowerCase();
    if (ext === "pdf") setBookType("pdf");
    else if (ext === "epub") setBookType("epub");

    // Sugere o título a partir do ficheiro se estiver vazio
    if (!title.trim()) {
      const cleanName = file.name.replace(/\.[^/.]+$/, "").replace(/[_-]/g, " ");
      setTitle(cleanName.charAt(0).toUpperCase() + cleanName.slice(1));
    }

    // Extrai automaticamente a primeira página como imagem de capa
    setExtractingCover(true);
    setExtractedNotice(false);
    try {
      const result = await extractCoverFromFile(file);
      if (result) {
        setCoverFile(result.file);
        setCoverPreview(result.previewUrl);
        setExtractedNotice(true);
      }
    } catch (err) {
      console.warn("Falha ao extrair capa automática:", err);
    } finally {
      setExtractingCover(false);
    }
  };

  // Ao selecionar uma imagem de capa manualmente (substituição)
  const handleCoverFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      setError("Por favor, seleciona uma imagem válida para a capa.");
      return;
    }

    setCoverFile(file);
    setCoverPreview(URL.createObjectURL(file));
    setExtractedNotice(false);
    setError("");
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !author.trim()) {
      setError("Por favor, preenche o título e o autor do livro.");
      return;
    }

    if (!sellerWhatsApp.trim()) {
      setError("Por favor, introduz o número de WhatsApp do vendedor.");
      return;
    }

    setLoading(true);
    setError("");

    try {
      let finalCoverUrl = coverPreview || "";

      // 1. Se foi carregado um novo ficheiro de imagem de capa, faz upload para o Storage
      if (coverFile) {
        try {
          const fileExt = coverFile.name.split(".").pop() || "jpg";
          const coverPath = `store_${Date.now()}_${Math.random().toString(36).substring(7)}.${fileExt}`;

          const { error: uploadErr } = await supabase.storage
            .from("covers")
            .upload(coverPath, coverFile, { upsert: true });

          if (!uploadErr) {
            const { data: pubData } = supabase.storage.from("covers").getPublicUrl(coverPath);
            finalCoverUrl = pubData.publicUrl;
          } else {
            // Se falhar o bucket, converte para base64 como fallback seguro
            const reader = new FileReader();
            finalCoverUrl = await new Promise<string>((resolve) => {
              reader.onloadend = () => resolve(reader.result as string);
              reader.readAsDataURL(coverFile);
            });
          }
        } catch {
          // Fallback silencioso
        }
      }

      // 2. Grava ou atualiza os dados do livro
      const saved = await upsertBookForSale({
        id: bookToEdit?.id,
        title: title.trim(),
        author: author.trim(),
        description: description.trim() || null,
        price: parseFloat(price) || 0,
        currency: currency || "MT",
        stock_status: stockStatus,
        seller_whatsapp: formatWhatsAppNumber(sellerWhatsApp),
        category_id: categoryId || null,
        cover_url: finalCoverUrl || null,
        file_type: bookType,
        is_for_sale: true,
      });

      onSaved(saved);
      onClose();
    } catch (err: any) {
      console.error("Erro ao guardar livro à venda:", err);
      setError(err?.message || "Ocorreu um erro ao guardar o livro.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      onClick={onClose}
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-black/60 backdrop-blur-xs animate-in fade-in duration-200"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-lg bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-3xl shadow-2xl max-h-[90vh] flex flex-col overflow-hidden text-black dark:text-white animate-in zoom-in-95 duration-200"
      >
        {/* Header */}
        <div className="px-6 py-4.5 border-b border-gray-100 dark:border-gray-800 flex items-center justify-between shrink-0 bg-white/80 dark:bg-gray-900/80 backdrop-blur-md">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-black dark:bg-white text-white dark:text-black flex items-center justify-center shadow-xs">
              <DollarSign className="w-5 h-5 stroke-[2.5]" />
            </div>
            <div>
              <h2 className="font-bold text-base leading-tight">
                {bookToEdit ? "Editar Livro para Venda" : "Cadastrar Livro para Venda"}
              </h2>
              <span className="text-[11px] text-gray-500 dark:text-gray-400 block mt-0.5">
                Painel do Administrador • Vendas via WhatsApp
              </span>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-xl text-gray-500 hover:text-black dark:hover:text-white hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Formulário com scroll */}
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-6 space-y-5">
          {error && (
            <div className="p-3.5 rounded-xl bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900 text-red-600 dark:text-red-400 text-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {/* ─── Secção da Capa e Ficheiro ─── */}
          <div className="p-4 rounded-2xl bg-gray-50 dark:bg-gray-800/40 border border-gray-200 dark:border-gray-800 space-y-3">
            <span className="text-xs font-bold uppercase tracking-wider text-gray-500 block">
              Capa & Arquivo do Livro
            </span>

            <div className="flex gap-4 items-start">
              {/* Preview da Capa */}
              <div className="w-24 h-32 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 flex flex-col items-center justify-center overflow-hidden shrink-0 relative shadow-xs">
                {coverPreview ? (
                  <img
                    src={coverPreview}
                    alt="Capa do Livro"
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div className="flex flex-col items-center p-2 text-center text-gray-400">
                    <ImageIcon className="w-6 h-6 mb-1 opacity-60" />
                    <span className="text-[9px] font-semibold">Sem capa</span>
                  </div>
                )}
                {extractingCover && (
                  <div className="absolute inset-0 bg-black/60 flex items-center justify-center">
                    <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  </div>
                )}
              </div>

              {/* Botões de Ação para Capa */}
              <div className="flex-1 space-y-2">
                {extractedNotice && (
                  <div className="flex items-center gap-1.5 text-[11px] font-medium text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/40 px-2.5 py-1.5 rounded-lg border border-emerald-200 dark:border-emerald-800">
                    <Sparkles className="w-3.5 h-3.5 shrink-0" />
                    <span>Capa extraída da 1ª página com sucesso!</span>
                  </div>
                )}

                {/* Botão de anexar ficheiro (extrai a capa automaticamente) */}
                <div>
                  <input
                    ref={bookInputRef}
                    type="file"
                    accept=".pdf,.epub,application/pdf,application/epub+zip"
                    onChange={handleBookFileChange}
                    className="hidden"
                  />
                  <button
                    type="button"
                    onClick={() => bookInputRef.current?.click()}
                    className="w-full py-2 px-3 rounded-xl border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 text-xs font-semibold flex items-center justify-center gap-1.5 hover:border-black dark:hover:border-white transition-all shadow-xs"
                  >
                    <BookOpen className="w-3.5 h-3.5" />
                    <span>{bookFile ? "Trocar Ficheiro (PDF/EPUB)" : "Anexar PDF / EPUB (Extrai Capa)"}</span>
                  </button>
                </div>

                {/* Botão para carregar/substituir imagem de capa */}
                <div>
                  <input
                    ref={coverInputRef}
                    type="file"
                    accept="image/*"
                    onChange={handleCoverFileChange}
                    className="hidden"
                  />
                  <button
                    type="button"
                    onClick={() => coverInputRef.current?.click()}
                    className="w-full py-2 px-3 rounded-xl bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 text-xs font-medium flex items-center justify-center gap-1.5 hover:text-black dark:hover:text-white transition-colors"
                  >
                    <Upload className="w-3.5 h-3.5" />
                    <span>{coverPreview ? "Alterar Capa Manualmente" : "Carregar Foto da Capa"}</span>
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* Título */}
          <div>
            <label className="text-xs font-bold text-gray-700 dark:text-gray-300 block mb-1.5">
              Título da Obra *
            </label>
            <input
              type="text"
              required
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Ex: O Alquimista"
              className="w-full px-4 py-2.5 rounded-xl border border-gray-200 dark:border-gray-800 bg-gray-50/50 dark:bg-gray-900 text-xs font-medium focus:outline-none focus:border-black dark:focus:border-white"
            />
          </div>

          {/* Autor */}
          <div>
            <label className="text-xs font-bold text-gray-700 dark:text-gray-300 block mb-1.5">
              Autor(a) *
            </label>
            <input
              type="text"
              required
              value={author}
              onChange={(e) => setAuthor(e.target.value)}
              placeholder="Ex: Paulo Coelho"
              className="w-full px-4 py-2.5 rounded-xl border border-gray-200 dark:border-gray-800 bg-gray-50/50 dark:bg-gray-900 text-xs font-medium focus:outline-none focus:border-black dark:focus:border-white"
            />
          </div>

          {/* Preço e Moeda */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-bold text-gray-700 dark:text-gray-300 block mb-1.5">
                Preço de Venda *
              </label>
              <div className="relative">
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  required
                  value={price}
                  onChange={(e) => setPrice(e.target.value)}
                  placeholder="Ex: 500"
                  className="w-full pl-3 pr-12 py-2.5 rounded-xl border border-gray-200 dark:border-gray-800 bg-gray-50/50 dark:bg-gray-900 text-xs font-semibold focus:outline-none focus:border-black dark:focus:border-white"
                />
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-bold text-gray-500">
                  {currency}
                </span>
              </div>
            </div>

            {/* Estado do Stock */}
            <div>
              <label className="text-xs font-bold text-gray-700 dark:text-gray-300 block mb-1.5">
                Estado do Stock *
              </label>
              <select
                value={stockStatus}
                onChange={(e) => setStockStatus(e.target.value as any)}
                className="w-full px-3 py-2.5 rounded-xl border border-gray-200 dark:border-gray-800 bg-gray-50/50 dark:bg-gray-900 text-xs font-semibold focus:outline-none focus:border-black dark:focus:border-white"
              >
                <option value="available">🟢 Disponível / Em Stock</option>
                <option value="out_of_stock">🔴 Esgotado (Aceita Reservas)</option>
              </select>
            </div>
          </div>

          {/* WhatsApp do Vendedor */}
          <div>
            <label className="text-xs font-bold text-gray-700 dark:text-gray-300 block mb-1.5">
              WhatsApp do Vendedor (com indicativo) *
            </label>
            <div className="relative">
              <Phone className="w-4 h-4 text-emerald-600 dark:text-emerald-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                required
                value={sellerWhatsApp}
                onChange={(e) => setSellerWhatsApp(e.target.value)}
                placeholder="Ex: +258 84 123 4567 ou 258841234567"
                className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-gray-200 dark:border-gray-800 bg-gray-50/50 dark:bg-gray-900 text-xs font-medium focus:outline-none focus:border-black dark:focus:border-white"
              />
            </div>
            <span className="text-[10px] text-gray-500 block mt-1">
              Ao clicar em comprar, o cliente será redirecionado para este WhatsApp com mensagem automática pronta.
            </span>
          </div>

          {/* Categoria e Formato */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-bold text-gray-700 dark:text-gray-300 block mb-1.5">
                Categoria
              </label>
              <select
                value={categoryId}
                onChange={(e) => setCategoryId(e.target.value)}
                className="w-full px-3 py-2.5 rounded-xl border border-gray-200 dark:border-gray-800 bg-gray-50/50 dark:bg-gray-900 text-xs font-medium focus:outline-none focus:border-black dark:focus:border-white"
              >
                {categories.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="text-xs font-bold text-gray-700 dark:text-gray-300 block mb-1.5">
                Formato do Livro
              </label>
              <select
                value={bookType}
                onChange={(e) => setBookType(e.target.value as any)}
                className="w-full px-3 py-2.5 rounded-xl border border-gray-200 dark:border-gray-800 bg-gray-50/50 dark:bg-gray-900 text-xs font-medium focus:outline-none focus:border-black dark:focus:border-white"
              >
                <option value="physical">📖 Livro Físico (Impresso)</option>
                <option value="pdf">📄 Ficheiro PDF</option>
                <option value="epub">📱 Ficheiro ePub</option>
              </select>
            </div>
          </div>

          {/* Sinopse / Resumo */}
          <div>
            <label className="text-xs font-bold text-gray-700 dark:text-gray-300 block mb-1.5">
              Sinopse / Resumo do Livro
            </label>
            <textarea
              rows={3}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Descreve brevemente o livro, edição, estado de conservação..."
              className="w-full px-4 py-2.5 rounded-xl border border-gray-200 dark:border-gray-800 bg-gray-50/50 dark:bg-gray-900 text-xs font-medium focus:outline-none focus:border-black dark:focus:border-white resize-none"
            />
          </div>

          {/* Botões de Ação */}
          <div className="pt-2 flex gap-3">
            <button
              type="button"
              onClick={onClose}
              disabled={loading}
              className="flex-1 py-3 rounded-xl border border-gray-200 dark:border-gray-800 text-xs font-semibold hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={loading}
              className="flex-1 py-3 rounded-xl bg-black dark:bg-white text-white dark:text-black text-xs font-bold active:scale-95 transition-all shadow-xs flex items-center justify-center gap-2 disabled:opacity-50"
            >
              {loading ? (
                <>
                  <div className="w-3.5 h-3.5 border-2 border-white dark:border-black border-t-transparent rounded-full animate-spin" />
                  <span>A guardar...</span>
                </>
              ) : (
                <>
                  <CheckCircle className="w-4 h-4 stroke-[2]" />
                  <span>{bookToEdit ? "Atualizar Livro" : "Publicar Livro"}</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
