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
  BookOpen,
  Building2,
  UserCheck,
  MapPin,
  Truck,
  Eye
} from "lucide-react";
import { supabase } from "../lib/supabase";
import { extractCoverFromFile } from "../lib/coverExtractor";
import {
  upsertBookForSale,
  formatWhatsAppNumber,
  type BookSaleItem
} from "../lib/storeService";
import { analyzeBookWithAI } from "../lib/aiBookAnalyzer";
import { parseFileNameTitleAndAuthor } from "../lib/bookSearchService";
import BookSalePreviewModal from "./BookSalePreviewModal";

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
  // Informações da Obra
  const [title, setTitle] = useState("");
  const [author, setAuthor] = useState("");
  const [description, setDescription] = useState("");
  const [price, setPrice] = useState("");
  const [currency, setCurrency] = useState("MT");
  const [stockStatus, setStockStatus] = useState<"available" | "out_of_stock">("available");
  const [physicalCondition, setPhysicalCondition] = useState("Novo");
  const [sellerWhatsApp, setSellerWhatsApp] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [bookType, setBookType] = useState<"physical" | "pdf" | "epub">("physical");

  // Vendedor e Localização
  const [sellerType, setSellerType] = useState<"bookstore" | "independent">("independent");
  const [sellerName, setSellerName] = useState("");
  const [location, setLocation] = useState("");
  const [deliveryOptions, setDeliveryOptions] = useState("");

  // Capa e ficheiros
  const [coverFile, setCoverFile] = useState<File | null>(null);
  const [coverPreview, setCoverPreview] = useState<string | null>(null);
  const [bookFile, setBookFile] = useState<File | null>(null);
  const [extractingCover, setExtractingCover] = useState(false);
  const [extractedNotice, setExtractedNotice] = useState(false);

  // Estados de envio e pré-visualização
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [showPreviewModal, setShowPreviewModal] = useState(false);
  const [savedPreviewBook, setSavedPreviewBook] = useState<BookSaleItem | null>(null);
  const [isNewlySaved, setIsNewlySaved] = useState(false);

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
      setPhysicalCondition(bookToEdit.physical_condition || "Novo");
      setSellerWhatsApp(bookToEdit.seller_whatsapp || "");
      setCategoryId(bookToEdit.category_id || (categories[0]?.id || ""));
      setBookType((bookToEdit.file_type as any) || "physical");
      setSellerType(bookToEdit.seller_type || "independent");
      setSellerName(bookToEdit.seller_name || "");
      setLocation(bookToEdit.location || "");
      setDeliveryOptions(bookToEdit.delivery_options || "");
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
      setPhysicalCondition("Novo");
      setSellerWhatsApp("");
      setCategoryId(categories[0]?.id || "");
      setBookType("physical");
      setSellerType("independent");
      setSellerName("");
      setLocation("");
      setDeliveryOptions("");
      setCoverPreview(null);
      setCoverFile(null);
      setBookFile(null);
      setExtractedNotice(false);
    }
    setError("");
    setShowPreviewModal(false);
    setSavedPreviewBook(null);
    setIsNewlySaved(false);
  }, [bookToEdit, isOpen, categories]);

  if (!isOpen) return null;

  // Monta objeto de pré-visualização com dados atuais
  const buildCurrentPreviewItem = (): BookSaleItem => {
    return {
      id: bookToEdit?.id || "preview-sale-id",
      title: title.trim() || "Título de Exemplo",
      author: author.trim() || "Autor da Obra",
      description: description.trim() || null,
      cover_url: coverPreview || null,
      file_type: bookType,
      is_for_sale: true,
      price: parseFloat(price) || 0,
      currency: currency || "MT",
      stock_status: stockStatus,
      physical_condition: physicalCondition,
      seller_whatsapp: sellerWhatsApp.trim() || "258840000000",
      seller_name: sellerName.trim() || (sellerType === "bookstore" ? "Livraria Parceira" : "Vendedor Independente"),
      seller_type: sellerType,
      location: location.trim() || "Moçambique",
      delivery_options: deliveryOptions.trim() || "A combinar diretamente via WhatsApp.",
      category_id: categoryId || null,
      purchase_rating: bookToEdit?.purchase_rating || 5,
      rating_comment: bookToEdit?.rating_comment,
      created_at: bookToEdit?.created_at || new Date().toISOString(),
    };
  };

  const handleOpenPreview = () => {
    if (!title.trim() && !author.trim()) {
      setError("Por favor, preenche pelo menos o título e autor antes de abrir a pré-visualização.");
      return;
    }
    setError("");
    setIsNewlySaved(false);
    setSavedPreviewBook(buildCurrentPreviewItem());
    setShowPreviewModal(true);
  };

  // Ao selecionar um ficheiro de livro (PDF ou EPUB)
  const handleBookFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setBookFile(file);
    const ext = file.name.split(".").pop()?.toLowerCase();
    if (ext === "pdf") setBookType("pdf");
    else if (ext === "epub") setBookType("epub");

    // Sugere título e autor inteligentemente a partir do nome do ficheiro
    const parsed = parseFileNameTitleAndAuthor(file.name);
    if (!title.trim() && parsed.title) {
      setTitle(parsed.title);
    }
    if (!author.trim() && parsed.author) {
      setAuthor(parsed.author);
    }

    // Extrai automaticamente a primeira página como imagem de capa
    setExtractingCover(true);
    setExtractedNotice(false);
    extractCoverFromFile(file)
      .then((result) => {
        if (result) {
          setCoverFile(result.file);
          setCoverPreview(result.previewUrl);
          setExtractedNotice(true);
        }
      })
      .catch((err) => {
        console.warn("Falha ao extrair capa automática:", err);
      })
      .finally(() => {
        setExtractingCover(false);
      });

    // Análise Inteligente de Metadados e Sinopse por IA
    analyzeBookWithAI(file, categories as any)
      .then((aiResult) => {
        if (aiResult.title && !title.trim()) setTitle(aiResult.title);
        if (aiResult.author && !author.trim()) setAuthor(aiResult.author);
        if (aiResult.synopsis && !description.trim()) setDescription(aiResult.synopsis);
        if (aiResult.suggestedCategoryId && !categoryId) setCategoryId(aiResult.suggestedCategoryId);
      })
      .catch((err) => {
        console.warn("Falha ao analisar metadados com IA:", err);
      });
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

      // 2. Grava ou atualiza os dados completos do livro
      const saved = await upsertBookForSale({
        id: bookToEdit?.id,
        title: title.trim(),
        author: author.trim(),
        description: description.trim() || null,
        price: parseFloat(price) || 0,
        currency: currency || "MT",
        stock_status: stockStatus,
        physical_condition: physicalCondition,
        seller_whatsapp: formatWhatsAppNumber(sellerWhatsApp),
        category_id: categoryId || null,
        cover_url: finalCoverUrl || null,
        file_type: bookType,
        is_for_sale: true,
        seller_name: sellerName.trim() || undefined,
        seller_type: sellerType,
        location: location.trim() || undefined,
        delivery_options: deliveryOptions.trim() || undefined,
      });

      onSaved(saved);
      // Abre imediatamente a pré-visualização do livro salvo
      setSavedPreviewBook(saved);
      setIsNewlySaved(true);
      setShowPreviewModal(true);
    } catch (err: any) {
      console.error("Erro ao guardar livro à venda:", err);
      setError(err?.message || "Ocorreu um erro ao guardar o livro.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <div
        onClick={onClose}
        className="fixed inset-0 z-[100] flex items-center justify-center p-0 sm:p-4 md:p-6 bg-black/70 backdrop-blur-xs animate-in fade-in duration-200"
      >
        <div
          onClick={(e) => e.stopPropagation()}
          className="w-full max-w-2xl bg-white dark:bg-gray-900 border-0 sm:border border-gray-200 dark:border-gray-800 rounded-none sm:rounded-3xl shadow-2xl h-full sm:h-auto max-h-[100dvh] sm:max-h-[92vh] flex flex-col overflow-hidden text-black dark:text-white animate-in zoom-in-95 duration-200"
        >
          {/* Header Fixo */}
          <div className="px-4 py-3 sm:px-6 sm:py-3.5 border-b border-gray-100 dark:border-gray-800 flex items-center justify-between shrink-0 bg-white/95 dark:bg-gray-900/95 backdrop-blur-md pt-[max(0.75rem,env(safe-area-inset-top))]">
            <div className="flex items-center gap-2.5 min-w-0 pr-2">
              <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-xl bg-black dark:bg-white text-white dark:text-black flex items-center justify-center shadow-xs shrink-0">
                <DollarSign className="w-4 h-4 sm:w-5 sm:h-5 stroke-[2.5]" />
              </div>
              <div className="min-w-0">
                <h2 className="font-bold text-sm sm:text-base leading-tight truncate">
                  {bookToEdit ? "Editar Livro para Venda" : "Cadastrar Livro para Venda"}
                </h2>
                <span className="text-[10px] sm:text-[11px] text-gray-500 dark:text-gray-400 block truncate mt-0.5">
                  Painel do Administrador • Gestão de Catálogo Comercial
                </span>
              </div>
            </div>
            <div className="flex items-center gap-1.5 shrink-0">
              <button
                onClick={onClose}
                className="p-1.5 sm:p-2 rounded-xl text-gray-500 hover:text-black dark:hover:text-white hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
                aria-label="Fechar"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>

          {/* Form com Área Scrollável e Barra de Ações Fixa no Rodapé */}
          <form onSubmit={handleSubmit} className="flex flex-col flex-1 min-h-0 overflow-hidden">
            {/* Conteúdo com Scroll Próprio */}
            <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-4 sm:space-y-5 overscroll-contain">
              {error && (
                <div className="p-3 sm:p-3.5 rounded-xl bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900 text-red-600 dark:text-red-400 text-xs flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>{error}</span>
                </div>
              )}

            {/* Secção da Capa e Ficheiro */}
            <div className="p-3.5 sm:p-4 rounded-2xl bg-gray-50 dark:bg-gray-800/40 border border-gray-200 dark:border-gray-800 space-y-3">
              <span className="text-[11px] sm:text-xs font-bold uppercase tracking-wider text-gray-500 block">
                Capa & Arquivo da Obra
              </span>

              <div className="flex flex-col sm:flex-row gap-3.5 sm:gap-4 items-center sm:items-start">
                {/* Preview da Capa */}
                <div className="w-24 h-32 sm:w-28 sm:h-36 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 flex flex-col items-center justify-center overflow-hidden shrink-0 relative shadow-xs">
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
                <div className="flex-1 w-full space-y-2">
                  {extractedNotice && (
                    <div className="flex items-center gap-1.5 text-[11px] font-medium text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/40 px-2.5 py-1.5 rounded-lg border border-emerald-200 dark:border-emerald-800">
                      <Sparkles className="w-3.5 h-3.5 shrink-0" />
                      <span>Capa extraída da 1ª página com sucesso</span>
                    </div>
                  )}

                  {/* Anexar ficheiro */}
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
                      className="w-full py-2.5 px-3 rounded-xl border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 text-xs font-semibold flex items-center justify-center gap-1.5 hover:border-black dark:hover:border-white transition-all shadow-xs"
                    >
                      <BookOpen className="w-3.5 h-3.5 shrink-0" />
                      <span className="truncate">{bookFile ? "Trocar Ficheiro (PDF/ePub)" : "Anexar PDF / ePub (Extrai Capa)"}</span>
                    </button>
                  </div>

                  {/* Carregar imagem */}
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
                      className="w-full py-2.5 px-3 rounded-xl bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 text-xs font-medium flex items-center justify-center gap-1.5 hover:text-black dark:hover:text-white transition-colors"
                    >
                      <Upload className="w-3.5 h-3.5 shrink-0" />
                      <span className="truncate">{coverPreview ? "Substituir Capa Manualmente" : "Carregar Imagem de Capa"}</span>
                    </button>
                  </div>
                </div>
              </div>
            </div>

            {/* Secção: Identificação da Obra */}
            <div className="space-y-3">
              <span className="text-[11px] font-bold uppercase tracking-wider text-gray-500 block">
                Detalhes da Obra
              </span>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {/* Título */}
                <div className="sm:col-span-2">
                  <label className="text-xs font-bold text-gray-700 dark:text-gray-300 block mb-1.5">
                    Título da Obra *
                  </label>
                  <input
                    type="text"
                    required
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    placeholder="Ex: Terra Sonâmbula"
                    className="w-full px-3.5 py-2.5 rounded-xl border border-gray-200 dark:border-gray-800 bg-gray-50/50 dark:bg-gray-900 text-xs font-medium focus:outline-none focus:border-black dark:focus:border-white"
                  />
                </div>

                {/* Autor */}
                <div className="sm:col-span-2">
                  <label className="text-xs font-bold text-gray-700 dark:text-gray-300 block mb-1.5">
                    Autor(a) *
                  </label>
                  <input
                    type="text"
                    required
                    value={author}
                    onChange={(e) => setAuthor(e.target.value)}
                    placeholder="Ex: Mia Couto"
                    className="w-full px-3.5 py-2.5 rounded-xl border border-gray-200 dark:border-gray-800 bg-gray-50/50 dark:bg-gray-900 text-xs font-medium focus:outline-none focus:border-black dark:focus:border-white"
                  />
                </div>

                {/* Categoria */}
                <div>
                  <label className="text-xs font-bold text-gray-700 dark:text-gray-300 block mb-1.5">
                    Género / Categoria Literária
                  </label>
                  <select
                    value={categoryId}
                    onChange={(e) => setCategoryId(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-gray-200 dark:border-gray-800 bg-gray-50/50 dark:bg-gray-900 text-xs font-medium focus:outline-none focus:border-black dark:focus:border-white"
                  >
                    {categories.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Formato */}
                <div>
                  <label className="text-xs font-bold text-gray-700 dark:text-gray-300 block mb-1.5">
                    Formato da Obra
                  </label>
                  <select
                    value={bookType}
                    onChange={(e) => setBookType(e.target.value as any)}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-gray-200 dark:border-gray-800 bg-gray-50/50 dark:bg-gray-900 text-xs font-medium focus:outline-none focus:border-black dark:focus:border-white"
                  >
                    <option value="physical">Livro Físico (Impresso)</option>
                    <option value="pdf">Ficheiro PDF</option>
                    <option value="epub">Ficheiro ePub</option>
                  </select>
                </div>
              </div>
            </div>

            {/* Secção Expandida: Vendedor & Localização */}
            <div className="p-3.5 sm:p-4 rounded-2xl bg-gray-50 dark:bg-gray-800/40 border border-gray-200 dark:border-gray-800 space-y-3.5">
              <span className="text-[11px] font-bold uppercase tracking-wider text-gray-500 block">
                Identificação do Vendedor & Localização
              </span>

              {/* Tipo de Vendedor (Livraria vs Vendedor Independente) */}
              <div>
                <label className="text-xs font-bold text-gray-700 dark:text-gray-300 block mb-1.5">
                  Tipo de Vendedor *
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setSellerType("bookstore")}
                    className={`py-2 px-3 rounded-xl border text-xs font-semibold flex items-center justify-center gap-1.5 transition-all ${
                      sellerType === "bookstore"
                        ? "border-black dark:border-white bg-black dark:bg-white text-white dark:text-black shadow-xs"
                        : "border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 text-gray-600 dark:text-gray-300"
                    }`}
                  >
                    <Building2 className="w-3.5 h-3.5" />
                    <span>Livraria / Loja</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setSellerType("independent")}
                    className={`py-2 px-3 rounded-xl border text-xs font-semibold flex items-center justify-center gap-1.5 transition-all ${
                      sellerType === "independent"
                        ? "border-black dark:border-white bg-black dark:bg-white text-white dark:text-black shadow-xs"
                        : "border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 text-gray-600 dark:text-gray-300"
                    }`}
                  >
                    <UserCheck className="w-3.5 h-3.5" />
                    <span>Vendedor Independente</span>
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {/* Nome do Vendedor / Livraria */}
                <div>
                  <label className="text-xs font-bold text-gray-700 dark:text-gray-300 block mb-1.5">
                    {sellerType === "bookstore" ? "Nome da Livraria / Loja" : "Nome do Vendedor"}
                  </label>
                  <div className="relative">
                    {sellerType === "bookstore" ? (
                      <Building2 className="w-3.5 h-3.5 text-gray-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                    ) : (
                      <UserCheck className="w-3.5 h-3.5 text-gray-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                    )}
                    <input
                      type="text"
                      value={sellerName}
                      onChange={(e) => setSellerName(e.target.value)}
                      placeholder={sellerType === "bookstore" ? "Ex: Livraria Minerva" : "Ex: Leonardo Juliano"}
                      className="w-full pl-9 pr-3.5 py-2.5 rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 text-xs font-medium focus:outline-none focus:border-black dark:focus:border-white"
                    />
                  </div>
                </div>

                {/* Localização */}
                <div>
                  <label className="text-xs font-bold text-gray-700 dark:text-gray-300 block mb-1.5">
                    Localização (Cidade / Bairro)
                  </label>
                  <div className="relative">
                    <MapPin className="w-3.5 h-3.5 text-gray-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                    <input
                      type="text"
                      value={location}
                      onChange={(e) => setLocation(e.target.value)}
                      placeholder="Ex: Maputo (Baixa / Polana)"
                      className="w-full pl-9 pr-3.5 py-2.5 rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 text-xs font-medium focus:outline-none focus:border-black dark:focus:border-white"
                    />
                  </div>
                </div>

                {/* WhatsApp */}
                <div className="sm:col-span-2">
                  <label className="text-xs font-bold text-gray-700 dark:text-gray-300 block mb-1.5">
                    WhatsApp para Pedidos & Contacto *
                  </label>
                  <div className="relative">
                    <Phone className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                    <input
                      type="text"
                      required
                      value={sellerWhatsApp}
                      onChange={(e) => setSellerWhatsApp(e.target.value)}
                      placeholder="Ex: 841234567 ou +258 84 123 4567"
                      className="w-full pl-9 pr-3.5 py-2.5 rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 text-xs font-medium focus:outline-none focus:border-black dark:focus:border-white"
                    />
                  </div>
                  <span className="text-[10px] text-gray-500 block mt-1">
                    Os clientes iniciarão uma conversa direta neste número com a mensagem pré-formatada do livro.
                  </span>
                </div>

                {/* Opções de Entrega */}
                <div className="sm:col-span-2">
                  <label className="text-xs font-bold text-gray-700 dark:text-gray-300 block mb-1.5">
                    Opções de Entrega / Envio
                  </label>
                  <div className="relative">
                    <Truck className="w-3.5 h-3.5 text-gray-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                    <input
                      type="text"
                      value={deliveryOptions}
                      onChange={(e) => setDeliveryOptions(e.target.value)}
                      placeholder="Ex: Entrega ao domicílio em Maputo, envio por transportadora ou levantamento no local"
                      className="w-full pl-9 pr-3.5 py-2.5 rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 text-xs font-medium focus:outline-none focus:border-black dark:focus:border-white"
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* Secção: Preço, Stock & Condição */}
            <div className="space-y-3">
              <span className="text-[11px] font-bold uppercase tracking-wider text-gray-500 block">
                Preço, Stock & Condição
              </span>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                {/* Preço */}
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
                      className="w-full pl-3.5 pr-12 py-2.5 rounded-xl border border-gray-200 dark:border-gray-800 bg-gray-50/50 dark:bg-gray-900 text-xs font-semibold focus:outline-none focus:border-black dark:focus:border-white"
                    />
                    <span className="absolute right-3.5 top-1/2 -translate-y-1/2 text-xs font-bold text-gray-500">
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
                    className="w-full px-3.5 py-2.5 rounded-xl border border-gray-200 dark:border-gray-800 bg-gray-50/50 dark:bg-gray-900 text-xs font-semibold focus:outline-none focus:border-black dark:focus:border-white"
                  >
                    <option value="available">Disponível (Em Stock)</option>
                    <option value="out_of_stock">Esgotado (Aceita Reserva)</option>
                  </select>
                </div>

                {/* Condição Física */}
                <div>
                  <label className="text-xs font-bold text-gray-700 dark:text-gray-300 block mb-1.5">
                    Estado Físico / Conservação
                  </label>
                  <select
                    value={physicalCondition}
                    onChange={(e) => setPhysicalCondition(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-gray-200 dark:border-gray-800 bg-gray-50/50 dark:bg-gray-900 text-xs font-medium focus:outline-none focus:border-black dark:focus:border-white"
                  >
                    <option value="Novo">Novo (Embalado / Sem uso)</option>
                    <option value="Como Novo">Como Novo (Exemplar impecável)</option>
                    <option value="Muito Bom">Muito Bom (Sinais mínimos de manuseio)</option>
                    <option value="Bom Estado">Bom Estado (Páginas limpas, capa firme)</option>
                    <option value="Usado">Usado (Com marcas normais de leitura)</option>
                  </select>
                </div>
              </div>
            </div>

            {/* Secção: Sinopse & Descrição */}
            <div className="space-y-3">
              <span className="text-[11px] font-bold uppercase tracking-wider text-gray-500 block">
                Sinopse & Descrição da Obra
              </span>

              <div>
                <textarea
                  rows={4}
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Escreve uma sinopse cativante ou detalhes da edição, ano e publicação..."
                  className="w-full px-3.5 py-2.5 rounded-xl border border-gray-200 dark:border-gray-800 bg-gray-50/50 dark:bg-gray-900 text-xs font-medium focus:outline-none focus:border-black dark:focus:border-white resize-none"
                />
              </div>
            </div>
            </div>

            {/* Barra de Ações Fixa no Rodapé (SEMPRE visível no telemóvel e desktop) */}
            <div className="shrink-0 px-3.5 sm:px-6 py-3 border-t border-gray-100 dark:border-gray-800 bg-white dark:bg-gray-900 flex items-center justify-between gap-2 pb-[max(0.75rem,env(safe-area-inset-bottom))] shadow-[0_-4px_25px_rgba(0,0,0,0.06)] dark:shadow-[0_-4px_25px_rgba(0,0,0,0.4)]">
              <button
                type="button"
                onClick={onClose}
                disabled={loading}
                className="py-2.5 px-3 sm:px-4 rounded-xl border border-gray-200 dark:border-gray-800 text-xs font-semibold hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors text-gray-600 dark:text-gray-300"
              >
                Cancelar
              </button>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleOpenPreview}
                  disabled={loading}
                  className="py-2.5 px-3 sm:px-4 rounded-xl border border-gray-200 dark:border-gray-800 hover:bg-gray-100 dark:hover:bg-gray-800 text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors text-gray-700 dark:text-gray-300"
                >
                  <Eye className="w-3.5 h-3.5" />
                  <span className="hidden xs:inline">Pré-visualizar</span>
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="py-2.5 px-4 sm:px-6 rounded-xl bg-black dark:bg-white text-white dark:text-black text-xs font-bold active:scale-95 transition-all shadow-md flex items-center justify-center gap-2 disabled:opacity-50"
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
            </div>
          </form>
        </div>
      </div>

      {/* Modal de Pré-visualização Integrado */}
      {showPreviewModal && savedPreviewBook && (
        <BookSalePreviewModal
          isOpen={showPreviewModal}
          book={savedPreviewBook}
          onClose={() => {
            setShowPreviewModal(false);
            if (isNewlySaved) {
              onClose();
            }
          }}
          isAdmin={true}
          onEdit={() => {
            setShowPreviewModal(false);
          }}
        />
      )}
    </>
  );
}
