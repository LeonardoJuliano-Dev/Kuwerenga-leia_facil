import { useState, useEffect } from "react";
import { useNavigate, Link } from "react-router-dom";
import {
  ArrowLeft,
  UploadCloud,
  Book,
  Image,
  AlertCircle,
  FileText,
  Sparkles,
  Clock,
  Check,
  Search,
  Pencil,
  CheckCircle2,
  RefreshCw,
  X,
  FileCheck2
} from "lucide-react";
import { supabase } from "../lib/supabase";
import { saveBookOffline } from "../lib/offlineStorage";
import { isGuestMode } from "../lib/guestMode";
import GuestRestrictionModal from "../components/GuestRestrictionModal";
import { extractCoverFromFile } from "../lib/coverExtractor";
import { loadAndSyncCategories, type AppCategory } from "../lib/categoryData";
import { analyzeBookWithAI } from "../lib/aiBookAnalyzer";
import {
  searchOfficialBookMetadata,
  syncOfficialCategory,
  parseFileNameTitleAndAuthor
} from "../lib/bookSearchService";
import { notifyAdminNewDonatedBook } from "../lib/notificationService";

export default function DonateBook() {
  const navigate = useNavigate();

  // Estados do Formulário
  const [title, setTitle] = useState("");
  const [author, setAuthor] = useState("");
  const [description, setDescription] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [categories, setCategories] = useState<AppCategory[]>([]);
  const [showGuestModal, setShowGuestModal] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);

  // Ficheiros e Extração
  const [bookFile, setBookFile] = useState<File | null>(null);
  const [coverFile, setCoverFile] = useState<File | null>(null);
  const [coverPreview, setCoverPreview] = useState<string | null>(null);
  const [extractingCover, setExtractingCover] = useState(false);
  const [extractedNotice, setExtractedNotice] = useState(false);

  // Estados de IA e Pesquisa Oficial
  const [analyzingAI, setAnalyzingAI] = useState(false);
  const [searchingOfficial, setSearchingOfficial] = useState(false);
  const [aiNotice, setAiNotice] = useState<string | null>(null);

  // Estados de Envio e Pós-Submissão (Revisão Obrigatória)
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);
  const [submittedBook, setSubmittedBook] = useState<any | null>(null);
  const [confirmedReview, setConfirmedReview] = useState(false);

  // Estados de Edição do Livro Submetido
  const [isEditingSubmitted, setIsEditingSubmitted] = useState(false);
  const [editTitle, setEditTitle] = useState("");
  const [editAuthor, setEditAuthor] = useState("");
  const [editDescription, setEditDescription] = useState("");
  const [editCategoryId, setEditCategoryId] = useState("");
  const [savingEdits, setSavingEdits] = useState(false);
  const [approving, setApproving] = useState(false);

  // Carregar categorias, perfil de admin e verificar modo convidado
  useEffect(() => {
    if (isGuestMode()) {
      setShowGuestModal(true);
      return;
    }

    async function initializeData() {
      const data = await loadAndSyncCategories();
      if (data && data.length > 0) {
        setCategories(data);
        setCategoryId(data[0].id);
      }

      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (user) {
          if (user.email?.toLowerCase() === "leonardojulianoj@gmail.com") {
            setIsAdmin(true);
          } else {
            const { data: profile } = await supabase
              .from("profiles")
              .select("is_admin")
              .eq("id", user.id)
              .maybeSingle();
            if (profile?.is_admin) setIsAdmin(true);
          }
        }
      } catch (err) {
        console.warn("Erro ao verificar papel de administrador:", err);
      }
    }

    initializeData();
  }, []);

  // Gestão de ficheiro do livro com Preenchimento Automático Avançado
  const handleBookChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const ext = file.name.split(".").pop()?.toLowerCase();
    if (ext !== "pdf" && ext !== "epub") {
      setError("Por favor, seleciona apenas ficheiros nos formatos PDF ou ePub.");
      return;
    }

    setBookFile(file);
    setError("");
    setExtractedNotice(false);
    setAiNotice(null);

    // 1. Extração preliminar imediata a partir do nome do ficheiro (0ms)
    const initialParsed = parseFileNameTitleAndAuthor(file.name);
    if (initialParsed.title) setTitle(initialParsed.title);
    if (initialParsed.author) setAuthor(initialParsed.author);

    // 2. Extrai automaticamente a primeira página como imagem de capa
    setExtractingCover(true);
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

    // 3. Pesquisa Automática Oficial e Análise Inteligente de Metadados
    setAnalyzingAI(true);
    try {
      const currentCats = categories.length > 0 ? categories : await loadAndSyncCategories();
      
      // Busca direta nos catálogos oficiais primeiro
      const searchQuery = initialParsed.title || file.name;
      const official = await searchOfficialBookMetadata(searchQuery, initialParsed.author);

      if (official) {
        if (official.title) setTitle(official.title);
        if (official.author) setAuthor(official.author);
        if (official.synopsis) setDescription(official.synopsis);

        if (official.categoryName) {
          const matched = currentCats.find(
            (c) => c.name.toLowerCase() === official.categoryName.toLowerCase()
          );
          if (matched) {
            setCategoryId(matched.id);
          } else {
            const syncedId = await syncOfficialCategory(official.categoryName);
            if (syncedId) setCategoryId(syncedId);
          }
        }

        if (official.coverUrl && !coverPreview) {
          setCoverPreview(official.coverUrl);
        }

        setAiNotice("Metadados e sinopse oficial preenchidos automaticamente. Revê os dados abaixo.");
      } else {
        // Fallback: Analisa o interior do livro (primeiras páginas)
        const aiResult = await analyzeBookWithAI(file, currentCats);
        if (aiResult.title) setTitle(aiResult.title);
        if (aiResult.author) setAuthor(aiResult.author);
        if (aiResult.synopsis) setDescription(aiResult.synopsis);
        if (aiResult.suggestedCategoryId) setCategoryId(aiResult.suggestedCategoryId);

        setAiNotice("Metadados identificados a partir do livro. Revê se as informações estão certas.");
      }
    } catch (err) {
      console.warn("Falha no preenchimento automático:", err);
    } finally {
      setAnalyzingAI(false);
    }
  };

  // Pesquisa Manual de Metadados e Sinopse Oficial nos Catálogos
  const handleManualOfficialSearch = async () => {
    const query = title.trim() || (bookFile?.name ? bookFile.name.replace(/\.[^/.]+$/, "") : "");
    if (!query) {
      setError("Introduz o título do livro para pesquisar a sinopse e categoria oficiais.");
      return;
    }

    setSearchingOfficial(true);
    setError("");
    try {
      const official = await searchOfficialBookMetadata(query, author);
      if (official) {
        if (official.title) setTitle(official.title);
        if (official.author) setAuthor(official.author);
        if (official.synopsis) setDescription(official.synopsis);

        if (official.categoryName) {
          const matched = categories.find(
            (c) => c.name.toLowerCase() === official.categoryName.toLowerCase()
          );
          if (matched) {
            setCategoryId(matched.id);
          } else {
            const syncedId = await syncOfficialCategory(official.categoryName);
            if (syncedId) setCategoryId(syncedId);
          }
        }

        if (official.coverUrl && !coverPreview) {
          setCoverPreview(official.coverUrl);
        }

        setAiNotice("Sinopse e metadados oficiais preenchidos. Revê os campos antes de submeter.");
      } else {
        setError("Não foi possível encontrar a sinopse oficial nos catálogos. Podes redigi-la manualmente.");
      }
    } catch (err) {
      console.warn("Erro na pesquisa manual:", err);
      setError("Ocorreu um erro ao consultar os catálogos oficiais.");
    } finally {
      setSearchingOfficial(false);
    }
  };

  // Gestão manual da Capa (substituição)
  const handleCoverChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      setError("Por favor, seleciona uma imagem válida para a capa.");
      return;
    }

    setCoverFile(file);
    setCoverPreview(URL.createObjectURL(file));
    setExtractedNotice(false);
  };

  // Submeter Doação (entra como pendente de aprovação)
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!bookFile || !title.trim() || !author.trim()) {
      setError("Por favor, anexa o ficheiro do livro e preenche o título e o autor.");
      return;
    }

    setUploading(true);
    setError("");
    setUploadProgress("A preparar o envio...");

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        throw new Error("Precisas de ter sessão iniciada para doar um livro.");
      }

      const fileExt = bookFile.name.split(".").pop()?.toLowerCase() || "pdf";
      const fileId = `${user.id}_${Date.now()}`;
      let uploadedFileUrl = "";
      let uploadedCoverUrl = "";

      // 1. Upload da Capa (se selecionada)
      if (coverFile) {
        setUploadProgress("A enviar a capa...");
        const coverExt = coverFile.name.split(".").pop() || "jpg";
        const coverPath = `${fileId}_cover.${coverExt}`;

        const { error: coverErr } = await supabase.storage
          .from("covers")
          .upload(coverPath, coverFile, { upsert: true });

        if (!coverErr) {
          const { data: pubData } = supabase.storage.from("covers").getPublicUrl(coverPath);
          uploadedCoverUrl = pubData.publicUrl;
        }
      }

      // 2. Upload do Ficheiro do Livro
      setUploadProgress("A enviar o livro (PDF/ePub)...");
      const bookPath = `${fileId}.${fileExt}`;

      const { error: bookUploadErr } = await supabase.storage
        .from("books")
        .upload(bookPath, bookFile, { upsert: true });

      if (bookUploadErr) {
        console.warn("Storage upload aviso:", bookUploadErr.message);
        uploadedFileUrl = `https://storage.googleapis.com/leitura-mz/books/${bookPath}`;
      } else {
        const { data: bookUrlData } = supabase.storage.from("books").getPublicUrl(bookPath);
        uploadedFileUrl = bookUrlData.publicUrl;
      }

      // 3. Resolução segura de UUID da Categoria
      let resolvedCategoryId: string | null = null;
      if (categoryId && !categoryId.startsWith("cat-")) {
        resolvedCategoryId = categoryId;
      } else if (categoryId) {
        const selectedCat = categories.find((c) => c.id === categoryId);
        if (selectedCat) {
          const { data: found } = await supabase
            .from("categories")
            .select("id")
            .ilike("name", selectedCat.name)
            .maybeSingle();

          if (found?.id) {
            resolvedCategoryId = found.id;
          } else {
            const { data: created } = await supabase
              .from("categories")
              .insert({ name: selectedCat.name })
              .select("id")
              .maybeSingle();

            if (created?.id) resolvedCategoryId = created.id;
          }
        }
      }

      // 4. Registar o Livro na Base de Dados (is_approved: false para moderação)
      setUploadProgress("A submeter o livro ao administrador...");
      const newBook = {
        title: title.trim(),
        author: author.trim(),
        description: description.trim() || null,
        file_url: uploadedFileUrl || "local_blob",
        file_type: fileExt as "pdf" | "epub",
        file_size: bookFile.size,
        cover_url: uploadedCoverUrl || null,
        category_id: resolvedCategoryId,
        uploaded_by: user.id,
        is_approved: false, // Requer aprovação do administrador
      };

      const { data: insertedBook, error: dbErr } = await supabase
        .from("books")
        .insert(newBook)
        .select()
        .single();

      if (dbErr) throw dbErr;

      // 5. Salvar no IndexedDB local para persistência offline
      if (insertedBook?.id) {
        await saveBookOffline(insertedBook.id, bookFile, {
          title: insertedBook.title,
          author: insertedBook.author,
          cover_url: uploadedCoverUrl,
          file_type: fileExt,
        });

        // Adiciona à estante pessoal do utilizador
        await supabase.from("user_books").upsert({
          user_id: user.id,
          book_id: insertedBook.id,
          status: "saved",
          is_downloaded: true,
        });

        // Notifica o Administrador sobre o novo livro para aprovação
        notifyAdminNewDonatedBook({
          id: insertedBook.id,
          title: insertedBook.title,
          author: insertedBook.author,
        });
      }

      // Define estado de sucesso para revisão obrigatória sem abrir o leitor
      setSubmittedBook(insertedBook);
      setEditTitle(insertedBook.title);
      setEditAuthor(insertedBook.author);
      setEditDescription(insertedBook.description || "");
      setEditCategoryId(insertedBook.category_id || categoryId);
      setConfirmedReview(false);
      setSuccess(true);

    } catch (err: any) {
      console.error("Erro ao doar livro:", err);
      setError(err?.message || "Ocorreu um erro ao registar o livro. Tenta novamente.");
    } finally {
      setUploading(false);
    }
  };

  // Salvar Edições Feitas pelo Utilizador no Livro Submetido
  const handleSaveEdits = async () => {
    if (!submittedBook?.id) return;
    setSavingEdits(true);
    setError("");

    try {
      const { error: updateErr } = await supabase
        .from("books")
        .update({
          title: editTitle.trim(),
          author: editAuthor.trim(),
          description: editDescription.trim() || null,
          category_id: editCategoryId || null,
          updated_at: new Date().toISOString()
        })
        .eq("id", submittedBook.id);

      if (updateErr) throw updateErr;

      setSubmittedBook((prev: any) => ({
        ...prev,
        title: editTitle.trim(),
        author: editAuthor.trim(),
        description: editDescription.trim(),
        category_id: editCategoryId
      }));

      setIsEditingSubmitted(false);
    } catch (err: any) {
      console.error("Erro ao salvar alterações:", err);
      setError(err?.message || "Não foi possível guardar as alterações.");
    } finally {
      setSavingEdits(false);
    }
  };

  // Aprovação e Confirmação Imediata (para Administrador)
  const handleApproveImmediately = async () => {
    if (!submittedBook?.id) return;
    setApproving(true);
    setError("");

    try {
      const { error: approveErr } = await supabase
        .from("books")
        .update({
          is_approved: true,
          updated_at: new Date().toISOString()
        })
        .eq("id", submittedBook.id);

      if (approveErr) throw approveErr;

      setSubmittedBook((prev: any) => ({
        ...prev,
        is_approved: true
      }));
    } catch (err: any) {
      console.error("Erro ao aprovar livro imediatamente:", err);
      setError(err?.message || "Não foi possível disponibilizar o livro.");
    } finally {
      setApproving(false);
    }
  };

  // Reiniciar Formulário para doar outro livro
  const handleResetForNewDonation = () => {
    setTitle("");
    setAuthor("");
    setDescription("");
    setBookFile(null);
    setCoverFile(null);
    setCoverPreview(null);
    setExtractedNotice(false);
    setAiNotice(null);
    setSuccess(false);
    setSubmittedBook(null);
    setIsEditingSubmitted(false);
    setConfirmedReview(false);
    setError("");
  };

  const currentCategoryName = categories.find(
    (c) => c.id === (submittedBook?.category_id || categoryId)
  )?.name || "Geral";

  return (
    <div className="flex flex-col min-h-screen bg-white dark:bg-black text-black dark:text-white pb-16 transition-colors">
      
      {/* Header Monocromático Padrão */}
      <header className="px-4 sm:px-6 pt-safe bg-white dark:bg-black border-b border-gray-200 dark:border-gray-800 sticky top-0 z-10">
        <div className="app-container pt-4 sm:pt-6 pb-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link
              to="/home"
              className="p-2 -ml-2 rounded-full hover:bg-gray-100 dark:hover:bg-gray-900 transition-colors text-black dark:text-white"
            >
              <ArrowLeft className="w-5 h-5" />
            </Link>
            <div>
              <h1 className="text-lg sm:text-xl font-bold tracking-tight">Doar um Livro</h1>
              <span className="text-xs text-gray-500 block">Contribui com obras para a comunidade</span>
            </div>
          </div>
        </div>
      </header>

      {/* Conteúdo Principal Centralizado e Responsivo */}
      <main className="flex-1 w-full max-w-xl mx-auto p-4 sm:p-6 pb-24">
        
        {/* ─── PAINEL PÓS-CADASTRO (REVISÃO OBRIGATÓRIA DOS DADOS) ─── */}
        {success && submittedBook ? (
          <div className="bg-white dark:bg-gray-950 rounded-2xl p-5 sm:p-7 border border-gray-200 dark:border-gray-800 shadow-xs animate-in fade-in zoom-in-95 duration-200 my-4 space-y-5">
            
            <div className="w-12 h-12 bg-gray-100 dark:bg-gray-900 text-black dark:text-white rounded-full flex items-center justify-center mx-auto border border-gray-200 dark:border-gray-800">
              <FileCheck2 className="w-6 h-6 stroke-[1.8]" />
            </div>

            {/* Aviso Obrigatório de Revisão */}
            <div className="text-center space-y-1.5">
              <h2 className="text-lg sm:text-xl font-bold tracking-tight">
                {submittedBook.is_approved
                  ? "Livro Aprovado e Disponível!"
                  : "Livro Cadastrado • Revê as Informações"}
              </h2>
              <div className="p-3 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl text-left text-xs text-gray-700 dark:text-gray-300 leading-relaxed">
                <p className="font-semibold text-black dark:text-white mb-0.5">
                  Por favor, confirma se os dados estão certos:
                </p>
                <p className="text-gray-500 dark:text-gray-400">
                  Verifica o título, autor, categoria e sinopse abaixo. O livro foi enviado para revisão do administrador e ficará disponível para todos assim que for validado.
                </p>
              </div>
            </div>

            {/* Ficha Completa de Revisão dos Dados */}
            <div className="bg-gray-50 dark:bg-gray-900 rounded-xl p-4 border border-gray-200 dark:border-gray-800 text-left space-y-3">
              <div className="flex gap-3.5 items-start">
                <div className="w-16 h-22 sm:w-20 sm:h-28 bg-gray-200 dark:bg-gray-800 rounded-lg overflow-hidden flex-shrink-0 border border-gray-200 dark:border-gray-700 flex items-center justify-center">
                  {submittedBook.cover_url || coverPreview ? (
                    <img
                      src={submittedBook.cover_url || coverPreview}
                      alt={submittedBook.title}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <Book className="w-6 h-6 text-gray-400" />
                  )}
                </div>

                <div className="flex-1 min-w-0 space-y-1">
                  <div className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-[10px] font-semibold border border-gray-200 dark:border-gray-700 bg-white dark:bg-black text-gray-700 dark:text-gray-300">
                    <span className="w-1.5 h-1.5 rounded-full bg-black dark:bg-white" />
                    <span>{submittedBook.is_approved ? "Disponível para Todos" : "Aguardando Moderação"}</span>
                  </div>
                  <h3 className="font-bold text-sm sm:text-base leading-snug">{submittedBook.title}</h3>
                  <p className="text-xs text-gray-500 dark:text-gray-400">{submittedBook.author}</p>
                  <p className="text-[11px] font-medium text-gray-400">{currentCategoryName}</p>
                </div>
              </div>

              {/* Sinopse para Verificação */}
              <div className="border-t border-gray-200 dark:border-gray-800 pt-2.5">
                <span className="text-[10px] uppercase font-bold tracking-wider text-gray-400 block mb-1">
                  Sinopse Cadastrada:
                </span>
                <p className="text-xs text-gray-600 dark:text-gray-300 leading-relaxed bg-white dark:bg-black p-3 rounded-lg border border-gray-200 dark:border-gray-800">
                  {submittedBook.description || "Sem sinopse registada. Podes adicionar clicando em Editar."}
                </p>
              </div>
            </div>

            {/* Mensagem de Erro na Edição / Aprovação */}
            {error && (
              <div className="p-3 bg-gray-100 dark:bg-gray-900 border border-gray-300 dark:border-gray-700 rounded-xl flex items-start gap-2.5 text-xs text-left">
                <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
                <span>{error}</span>
              </div>
            )}

            {/* Confirmação de Revisão Realizada */}
            {confirmedReview && (
              <div className="p-3 bg-gray-100 dark:bg-gray-900 border border-gray-300 dark:border-gray-700 rounded-xl flex items-center gap-2 text-xs text-left font-medium">
                <Check className="w-4 h-4" />
                <span>Informações validadas com sucesso. O livro aguarda moderação.</span>
              </div>
            )}

            {/* Ações de Revisão e Confirmação */}
            <div className="space-y-2 pt-1">
              
              {/* Botão 1: Confirmar que os dados estão certos */}
              {!confirmedReview && (
                <button
                  type="button"
                  onClick={() => setConfirmedReview(true)}
                  className="w-full py-3.5 px-4 bg-black dark:bg-white text-white dark:text-black rounded-xl font-semibold text-xs sm:text-sm flex items-center justify-center gap-2 shadow-xs hover:opacity-90 active:scale-98 transition-all"
                >
                  <Check className="w-4 h-4 stroke-[2.5]" />
                  <span>As Informações Estão Certas</span>
                </button>
              )}

              {/* Botão 2: Corrigir / Editar Detalhes */}
              <button
                type="button"
                onClick={() => setIsEditingSubmitted(true)}
                className="w-full py-3 px-4 rounded-xl border border-gray-300 dark:border-gray-700 hover:bg-gray-100 dark:hover:bg-gray-800 text-black dark:text-white font-medium text-xs sm:text-sm flex items-center justify-center gap-2 transition-all"
              >
                <Pencil className="w-4 h-4" />
                <span>Corrigir / Editar Informações</span>
              </button>

              {/* Botão 3: Confirmação Imediata de Administrador */}
              {isAdmin && !submittedBook.is_approved && (
                <button
                  type="button"
                  onClick={handleApproveImmediately}
                  disabled={approving}
                  className="w-full py-3 px-4 rounded-xl border border-black dark:border-white bg-gray-100 dark:bg-gray-900 font-semibold text-xs sm:text-sm flex items-center justify-center gap-2 shadow-xs hover:opacity-90 active:scale-98 transition-all disabled:opacity-50"
                >
                  {approving ? (
                    <>
                      <div className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
                      <span>A disponibilizar...</span>
                    </>
                  ) : (
                    <>
                      <CheckCircle2 className="w-4 h-4" />
                      <span>Confirmar e Disponibilizar Agora (Admin)</span>
                    </>
                  )}
                </button>
              )}

              {/* Botão 4: Doar Outro Livro */}
              <button
                type="button"
                onClick={handleResetForNewDonation}
                className="w-full py-2.5 px-4 rounded-xl bg-gray-50 dark:bg-gray-900 text-gray-700 dark:text-gray-300 hover:text-black dark:hover:text-white font-medium text-xs flex items-center justify-center gap-2 transition-all"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                <span>Doar Outro Livro</span>
              </button>

              {/* Botão 5: Voltar à Página Inicial */}
              <button
                type="button"
                onClick={() => navigate("/home")}
                className="w-full py-2 px-4 text-gray-500 hover:text-black dark:hover:text-white text-xs transition-colors font-medium"
              >
                Voltar à Página Inicial
              </button>
            </div>
          </div>
        ) : (
          
          /* ─── FORMULÁRIO PRINCIPAL DE DOAÇÃO ─── */
          <form onSubmit={handleSubmit} className="space-y-5">
            
            {/* Mensagem de Erro */}
            {error && (
              <div className="p-3.5 bg-gray-100 dark:bg-gray-900 border border-gray-300 dark:border-gray-700 rounded-xl flex items-start gap-3 text-xs leading-relaxed">
                <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5 text-black dark:text-white" />
                <span>{error}</span>
              </div>
            )}

            {/* Aviso Informativo de Moderação Prévia */}
            <div className="p-3 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl flex items-start gap-2.5 text-xs text-gray-600 dark:text-gray-400 leading-relaxed">
              <Clock className="w-4 h-4 flex-shrink-0 mt-0.5 text-gray-500" />
              <span>
                Cada livro doado é revisto e aprovado pelo administrador antes de ser disponibilizado publicamente a todos os utilizadores.
              </span>
            </div>

            {/* 1. Upload do Ficheiro do Livro */}
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-gray-500 mb-2">
                Ficheiro do Livro (PDF ou ePub) *
              </label>

              <label className={`border-2 border-dashed rounded-xl p-5 sm:p-6 flex flex-col items-center justify-center cursor-pointer transition-all ${
                bookFile 
                  ? "border-black dark:border-white bg-gray-50 dark:bg-gray-900" 
                  : "border-gray-200 dark:border-gray-800 hover:border-gray-400 bg-white dark:bg-black"
              }`}>
                {bookFile ? (
                  <div className="flex items-center gap-3 w-full">
                    <div className="w-10 h-10 sm:w-12 sm:h-12 bg-black dark:bg-white text-white dark:text-black rounded-lg flex items-center justify-center flex-shrink-0 font-bold text-xs uppercase">
                      {bookFile.name.split(".").pop()}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs sm:text-sm font-semibold truncate">{bookFile.name}</p>
                      <p className="text-[11px] text-gray-500">
                        {(bookFile.size / (1024 * 1024)).toFixed(2)} MB
                      </p>
                    </div>
                    <span className="text-xs font-semibold text-black dark:text-white flex items-center gap-1 border border-gray-200 dark:border-gray-700 px-2 py-1 rounded bg-white dark:bg-black">
                      <Check className="w-3.5 h-3.5" />
                      Pronto
                    </span>
                  </div>
                ) : (
                  <>
                    <UploadCloud className="w-8 h-8 sm:w-10 sm:h-10 text-gray-400 mb-2 stroke-1" />
                    <p className="text-xs sm:text-sm font-semibold mb-0.5">Toca para anexar o livro</p>
                    <p className="text-[11px] text-gray-500">Formatos suportados: PDF ou ePub até 50MB</p>
                  </>
                )}
                <input
                  type="file"
                  accept=".pdf,.epub,application/pdf,application/epub+zip"
                  onChange={handleBookChange}
                  className="hidden"
                />
              </label>

              {/* Indicador de Processamento / Catalogação Automática */}
              {analyzingAI && (
                <div className="mt-2.5 p-3 bg-gray-100 dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl flex items-center gap-2.5 text-xs text-gray-700 dark:text-gray-300">
                  <div className="w-4 h-4 border-2 border-black dark:border-white border-t-transparent rounded-full animate-spin" />
                  <span>A pesquisar sinopse oficial e metadados nos catálogos...</span>
                </div>
              )}

              {aiNotice && !analyzingAI && (
                <div className="mt-2.5 p-3 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl flex items-center gap-2 text-xs text-gray-700 dark:text-gray-300">
                  <Sparkles className="w-4 h-4 text-black dark:text-white shrink-0" />
                  <span>{aiNotice}</span>
                </div>
              )}
            </div>

            {/* 2. Capa Opcional */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="block text-xs font-semibold uppercase tracking-wider text-gray-500">
                  Capa do Livro
                </label>
                {extractedNotice && (
                  <span className="text-[11px] font-medium text-gray-600 dark:text-gray-400 flex items-center gap-1">
                    <Sparkles className="w-3 h-3" />
                    Obtida automaticamente
                  </span>
                )}
              </div>

              <div className="flex items-center gap-3.5">
                <div className="w-16 h-22 sm:w-20 sm:h-28 bg-gray-100 dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl overflow-hidden flex items-center justify-center flex-shrink-0 relative">
                  {coverPreview ? (
                    <img src={coverPreview} alt="Capa" className="w-full h-full object-cover" />
                  ) : extractingCover ? (
                    <div className="flex flex-col items-center justify-center p-2 text-center text-gray-400">
                      <div className="w-4 h-4 border-2 border-black dark:border-white border-t-transparent rounded-full animate-spin mb-1" />
                      <span className="text-[8px] font-semibold">A extrair...</span>
                    </div>
                  ) : (
                    <Image className="w-6 h-6 text-gray-400 stroke-1" />
                  )}
                </div>

                <div className="flex flex-col gap-1.5 flex-1 min-w-0">
                  <label className="cursor-pointer inline-flex items-center gap-2 px-3.5 py-2 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 hover:bg-gray-50 dark:hover:bg-gray-800 rounded-xl text-xs font-semibold transition-colors shadow-xs w-fit">
                    <Image className="w-3.5 h-3.5" />
                    <span>{coverPreview ? "Alterar Capa" : "Escolher Imagem"}</span>
                    <input type="file" accept="image/*" onChange={handleCoverChange} className="hidden" />
                  </label>
                  <span className="text-[10px] text-gray-500">
                    A capa é gerada da primeira página ou podes selecionar uma imagem.
                  </span>
                </div>
              </div>
            </div>

            {/* 3. Título do Livro com Botão de Pesquisa Oficial */}
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="block text-xs font-semibold uppercase tracking-wider text-gray-500">
                  Título do Livro *
                </label>
                <button
                  type="button"
                  onClick={handleManualOfficialSearch}
                  disabled={searchingOfficial}
                  className="text-[11px] font-medium text-black dark:text-white underline hover:opacity-80 flex items-center gap-1 disabled:opacity-50"
                  title="Pesquisar sinopse e categoria oficiais nos catálogos mundiais"
                >
                  {searchingOfficial ? (
                    <>
                      <div className="w-3 h-3 border border-current border-t-transparent rounded-full animate-spin" />
                      <span>A pesquisar...</span>
                    </>
                  ) : (
                    <>
                      <Search className="w-3 h-3" />
                      <span>Pesquisar Catálogo</span>
                    </>
                  )}
                </button>
              </div>
              <div className="relative">
                <Book className="w-4.5 h-4.5 absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
                <input
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="Ex: Terra Sonâmbula"
                  className="w-full pl-10 pr-4 py-3 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl text-xs sm:text-sm font-medium focus:outline-none focus:border-black dark:focus:border-white transition-all"
                  required
                />
              </div>
            </div>

            {/* 4. Autor */}
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-gray-500 mb-1.5">
                Autor(a) *
              </label>
              <div className="relative">
                <FileText className="w-4.5 h-4.5 absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
                <input
                  type="text"
                  value={author}
                  onChange={(e) => setAuthor(e.target.value)}
                  placeholder="Ex: Mia Couto"
                  className="w-full pl-10 pr-4 py-3 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl text-xs sm:text-sm font-medium focus:outline-none focus:border-black dark:focus:border-white transition-all"
                  required
                />
              </div>
            </div>

            {/* 5. Categoria (Sincronizada Automaticamente) */}
            {categories.length > 0 && (
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-gray-500 mb-1.5">
                  Categoria Literária ({categories.length} Categorias)
                </label>
                <select
                  value={categoryId}
                  onChange={(e) => setCategoryId(e.target.value)}
                  className="w-full px-3.5 py-3 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl text-xs sm:text-sm font-medium focus:outline-none focus:border-black dark:focus:border-white transition-all"
                >
                  {categories.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </div>
            )}

            {/* 6. Sinopse ou Descrição Oficial */}
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="block text-xs font-semibold uppercase tracking-wider text-gray-500">
                  Sinopse ou Descrição Oficial
                </label>
                <span className="text-[10px] text-gray-400">
                  {description ? "Preenchida automaticamente" : "Opcional"}
                </span>
              </div>
              <textarea
                rows={4}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Sinopse oficial da obra catalogada automaticamente ou redigida por ti..."
                className="w-full p-3.5 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl text-xs sm:text-sm font-medium focus:outline-none focus:border-black dark:focus:border-white transition-all resize-none leading-relaxed"
              />
            </div>

            {/* Botão de Submissão com Design do Sistema */}
            <button
              type="submit"
              disabled={uploading || !bookFile || !title.trim() || !author.trim()}
              className="w-full bg-black dark:bg-white text-white dark:text-black py-3.5 sm:py-4 rounded-xl font-semibold text-xs sm:text-sm shadow-xs hover:opacity-90 active:scale-98 transition-all flex items-center justify-center gap-2 disabled:opacity-50 disabled:pointer-events-none"
            >
              {uploading ? (
                <>
                  <div className="w-4 h-4 border-2 border-white dark:border-black border-t-transparent rounded-full animate-spin" />
                  <span>{uploadProgress}</span>
                </>
              ) : (
                <>
                  <UploadCloud className="w-4.5 h-4.5 stroke-[2]" />
                  <span>Cadastrar Livro</span>
                </>
              )}
            </button>
          </form>
        )}
      </main>

      {/* ─── MODAL DE EDIÇÃO DO LIVRO SUBMETIDO ─── */}
      {isEditingSubmitted && submittedBook && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in duration-150">
          <div className="bg-white dark:bg-gray-900 rounded-2xl max-w-lg w-full p-5 sm:p-6 border border-gray-200 dark:border-gray-800 shadow-xl space-y-4">
            
            <div className="flex items-center justify-between border-b border-gray-200 dark:border-gray-800 pb-3">
              <div className="flex items-center gap-2">
                <Pencil className="w-4 h-4" />
                <h3 className="font-bold text-sm sm:text-base">Editar Detalhes da Obra</h3>
              </div>
              <button
                type="button"
                onClick={() => setIsEditingSubmitted(false)}
                className="p-1 rounded-full hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-500"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-3.5 text-left text-xs sm:text-sm">
              <div>
                <label className="block text-[11px] font-semibold text-gray-500 uppercase tracking-wider mb-1">
                  Título
                </label>
                <input
                  type="text"
                  value={editTitle}
                  onChange={(e) => setEditTitle(e.target.value)}
                  className="w-full px-3 py-2 bg-gray-50 dark:bg-black border border-gray-200 dark:border-gray-800 rounded-lg focus:outline-none focus:border-black dark:focus:border-white font-medium"
                />
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-gray-500 uppercase tracking-wider mb-1">
                  Autor
                </label>
                <input
                  type="text"
                  value={editAuthor}
                  onChange={(e) => setEditAuthor(e.target.value)}
                  className="w-full px-3 py-2 bg-gray-50 dark:bg-black border border-gray-200 dark:border-gray-800 rounded-lg focus:outline-none focus:border-black dark:focus:border-white font-medium"
                />
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-gray-500 uppercase tracking-wider mb-1">
                  Categoria
                </label>
                <select
                  value={editCategoryId}
                  onChange={(e) => setEditCategoryId(e.target.value)}
                  className="w-full px-3 py-2 bg-gray-50 dark:bg-black border border-gray-200 dark:border-gray-800 rounded-lg focus:outline-none focus:border-black dark:focus:border-white font-medium"
                >
                  {categories.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-gray-500 uppercase tracking-wider mb-1">
                  Sinopse
                </label>
                <textarea
                  rows={4}
                  value={editDescription}
                  onChange={(e) => setEditDescription(e.target.value)}
                  className="w-full px-3 py-2 bg-gray-50 dark:bg-black border border-gray-200 dark:border-gray-800 rounded-lg focus:outline-none focus:border-black dark:focus:border-white font-medium resize-none leading-relaxed"
                />
              </div>
            </div>

            <div className="flex gap-2 pt-2 justify-end">
              <button
                type="button"
                onClick={() => setIsEditingSubmitted(false)}
                className="px-4 py-2 rounded-xl text-xs font-medium border border-gray-200 dark:border-gray-800 hover:bg-gray-100 dark:hover:bg-gray-800"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleSaveEdits}
                disabled={savingEdits || !editTitle.trim() || !editAuthor.trim()}
                className="px-4 py-2 bg-black dark:bg-white text-white dark:text-black rounded-xl text-xs font-semibold hover:opacity-90 disabled:opacity-50"
              >
                {savingEdits ? "A guardar..." : "Guardar Alterações"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal de Restrição para Convidados */}
      <GuestRestrictionModal
        isOpen={showGuestModal}
        feature="donate"
        onClose={() => {
          setShowGuestModal(false);
          navigate(-1);
        }}
      />
    </div>
  );
}
