import { useState, useEffect, useRef } from "react";
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
  FileCheck2,
  ArrowUpDown,
  Camera,
  Upload,
  RotateCcw,
  Save
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
  const [editCustomCategory, setEditCustomCategory] = useState("");
  const [editCoverPreview, setEditCoverPreview] = useState("");
  const [editCoverFile, setEditCoverFile] = useState<File | null>(null);
  const [savingEdits, setSavingEdits] = useState(false);
  const [approving, setApproving] = useState(false);
  const editCoverInputRef = useRef<HTMLInputElement>(null);

  // Estado de Categoria Personalizada (formulário principal)
  const [customCategory, setCustomCategory] = useState("");

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

  // Inverter Título e Autor caso tenham sido colocados em campos trocados
  const handleSwapTitleAndAuthor = () => {
    const prevTitle = title;
    setTitle(author);
    setAuthor(prevTitle);
  };

  const handleSwapEditTitleAndAuthor = () => {
    const prevTitle = editTitle;
    setEditTitle(editAuthor);
    setEditAuthor(prevTitle);
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

      // Obter o ID real da categoria (resolve personalizada se necessário)
      let effectiveCategoryId = categoryId;
      if (categoryId === "__custom__") {
        const trimmed = customCategory.trim();
        if (trimmed) {
          // Verifica se já existe uma categoria com esse nome nas categorias carregadas
          const existing = categories.find(
            (c) => c.name.toLowerCase() === trimmed.toLowerCase()
          );
          effectiveCategoryId = existing?.id || `cat-custom-${trimmed.toLowerCase().replace(/\s+/g, "-").replace(/[^a-z0-9-]/g, "")}`;
        } else {
          effectiveCategoryId = "";
        }
      }

      if (effectiveCategoryId && !effectiveCategoryId.startsWith("cat-")) {
        resolvedCategoryId = effectiveCategoryId;
      } else if (effectiveCategoryId) {
        const selectedCat = categories.find((c) => c.id === effectiveCategoryId);
        const catName = selectedCat?.name || (categoryId === "__custom__" ? customCategory.trim() : null);
        if (catName) {
          const { data: found } = await supabase
            .from("categories")
            .select("id")
            .ilike("name", catName)
            .maybeSingle();

          if (found?.id) {
            resolvedCategoryId = found.id;
          } else {
            const { data: created } = await supabase
              .from("categories")
              .insert({ name: catName })
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
      setEditCoverPreview(insertedBook.cover_url || "");
      setEditCoverFile(null);
      setConfirmedReview(false);
      setSuccess(true);

    } catch (err: any) {
      console.error("Erro ao doar livro:", err);
      setError(err?.message || "Ocorreu um erro ao registar o livro. Tenta novamente.");
    } finally {
      setUploading(false);
    }
  };

  // Abrir o Modal de Edição do Livro Submetido inicializando todos os campos
  const handleOpenEditSubmitted = () => {
    if (!submittedBook) return;
    setEditTitle(submittedBook.title || "");
    setEditAuthor(submittedBook.author || "");
    setEditDescription(submittedBook.description || "");
    setEditCategoryId(submittedBook.category_id || "");
    setEditCustomCategory("");
    setEditCoverPreview(submittedBook.cover_url || "");
    setEditCoverFile(null);
    setIsEditingSubmitted(true);
  };

  // Ao selecionar nova imagem de capa no modal de edição
  const handleEditCoverChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      setError("⚠️ Por favor escolhe uma imagem válida para a capa.");
      return;
    }

    setEditCoverFile(file);
    setEditCoverPreview(URL.createObjectURL(file));
  };

  // Salvar Edições Feitas pelo Utilizador no Livro Submetido
  const handleSaveEdits = async () => {
    if (!submittedBook?.id) return;
    setSavingEdits(true);
    setError("");

    // 1. Resolve categoria personalizada
    let finalCategoryId = editCategoryId;
    if (editCategoryId === "__custom__") {
      const trimmed = editCustomCategory.trim();
      if (!trimmed) {
        setError("⚠️ Por favor escreve o nome da categoria personalizada.");
        setSavingEdits(false);
        return;
      }
      const existing = categories.find(
        (c) => c.name.toLowerCase() === trimmed.toLowerCase()
      );
      finalCategoryId = existing?.id ||
        `cat-custom-${trimmed.toLowerCase().replace(/\s+/g, "-").replace(/[^a-z0-9-]/g, "")}`;
    }

    try {
      // 2. Upload da nova capa se foi selecionado novo ficheiro
      let finalCoverUrl = submittedBook.cover_url;
      if (editCoverFile) {
        try {
          const fileExt = editCoverFile.name.split(".").pop() || "jpg";
          const coverPath = `donated_${Date.now()}_${Math.random().toString(36).substring(7)}.${fileExt}`;

          const { error: uploadErr } = await supabase.storage
            .from("covers")
            .upload(coverPath, editCoverFile, { upsert: true });

          if (!uploadErr) {
            const { data: pubData } = supabase.storage.from("covers").getPublicUrl(coverPath);
            finalCoverUrl = pubData.publicUrl;
          } else {
            const reader = new FileReader();
            finalCoverUrl = await new Promise<string>((resolve) => {
              reader.onloadend = () => resolve(reader.result as string);
              reader.readAsDataURL(editCoverFile);
            });
          }
        } catch (uploadCatch) {
          console.warn("⚠️ Fallback capa edição submetida:", uploadCatch);
          finalCoverUrl = editCoverPreview || finalCoverUrl;
        }
      }

      // 3. Atualizar livro na base de dados
      const { error: updateErr } = await supabase
        .from("books")
        .update({
          title: editTitle.trim(),
          author: editAuthor.trim(),
          description: editDescription.trim() || null,
          category_id: finalCategoryId || null,
          cover_url: finalCoverUrl || null,
          updated_at: new Date().toISOString()
        })
        .eq("id", submittedBook.id);

      if (updateErr) throw updateErr;

      // 4. Atualizar estado local
      setSubmittedBook((prev: any) => ({
        ...prev,
        title: editTitle.trim(),
        author: editAuthor.trim(),
        description: editDescription.trim(),
        category_id: finalCategoryId,
        cover_url: finalCoverUrl
      }));

      setIsEditingSubmitted(false);
    } catch (err: any) {
      console.error("❌ Erro ao salvar alterações:", err);
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
    setCustomCategory("");
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
                onClick={handleOpenEditSubmitted}
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

            {/* 3. Título do Livro com Botão de Pesquisa Oficial e Troca Rápida */}
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="block text-xs font-semibold uppercase tracking-wider text-gray-500">
                  Título do Livro *
                </label>
                <div className="flex items-center gap-2.5">
                  {(title || author) && (
                    <button
                      type="button"
                      onClick={handleSwapTitleAndAuthor}
                      className="text-[11px] font-medium text-gray-500 hover:text-black dark:hover:text-white flex items-center gap-1 transition-colors"
                      title="Inverter Título e Autor caso tenham ficado em campos trocados"
                    >
                      <ArrowUpDown className="w-3 h-3" />
                      <span>Trocar com Autor</span>
                    </button>
                  )}
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
                Nome do Autor(a) *
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
                  Género / Categoria Literária ({categories.length} Géneros)
                </label>
                <select
                  value={categoryId}
                  onChange={(e) => {
                    setCategoryId(e.target.value);
                    if (e.target.value !== "__custom__") setCustomCategory("");
                  }}
                  className="w-full px-3.5 py-3 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl text-xs sm:text-sm font-medium focus:outline-none focus:border-black dark:focus:border-white transition-all"
                >
                  {categories.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                  <option value="__custom__">Outra categoria (escrever)...</option>
                </select>

                {/* Campo de Categoria Personalizada */}
                {categoryId === "__custom__" && (
                  <div className="mt-2.5 animate-in fade-in slide-in-from-top-2 duration-150">
                    <input
                      type="text"
                      value={customCategory}
                      onChange={(e) => setCustomCategory(e.target.value)}
                      placeholder="Ex: Literatura Moçambicana, Contos Africanos..."
                      className="w-full px-3.5 py-3 bg-white dark:bg-gray-900 border-2 border-black dark:border-white rounded-xl text-xs sm:text-sm font-medium focus:outline-none transition-all"
                      autoFocus
                    />
                    <p className="text-[10px] text-gray-400 mt-1 pl-1">Escreve o nome exato do género ou categoria que desejas atribuir a este livro.</p>
                  </div>
                )}
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

      {/* ─── MODAL DE EDIÇÃO DO LIVRO SUBMETIDO (RESPONSIVO MOBILE E SEM EMOJIS) ─── */}
      {isEditingSubmitted && submittedBook && (
        <div className="fixed inset-0 z-[100] bg-black/70 backdrop-blur-xs flex sm:items-center sm:justify-center p-0 sm:p-4 animate-in fade-in duration-150">
          <div className="bg-white dark:bg-gray-900 w-full h-full sm:h-auto sm:max-h-[90vh] sm:max-w-lg sm:rounded-3xl border-0 sm:border border-gray-200 dark:border-gray-800 shadow-2xl flex flex-col overflow-hidden animate-in zoom-in-95 duration-200">
            
            {/* Header Fixo */}
            <div className="shrink-0 px-4 sm:px-6 py-3.5 sm:py-4 border-b border-gray-100 dark:border-gray-800 flex items-center justify-between bg-white dark:bg-gray-900 pt-[max(0.75rem,env(safe-area-inset-top))]">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-2xl bg-black dark:bg-white text-white dark:text-black flex items-center justify-center shadow-xs">
                  <Pencil className="w-4 h-4 stroke-[2.2]" />
                </div>
                <div>
                  <h3 className="font-bold text-sm sm:text-base leading-tight">
                    Editar Detalhes da Obra
                  </h3>
                  <p className="text-[11px] text-gray-500 dark:text-gray-400 leading-none mt-0.5">
                    Ajusta os dados ou altera a imagem da capa
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsEditingSubmitted(false)}
                className="p-1.5 rounded-xl hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-400 hover:text-black dark:hover:text-white transition-colors"
                title="Fechar"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Corpo do Modal com Scroll Suave */}
            <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-4 overscroll-contain text-left text-xs sm:text-sm">
              
              {/* Secção de Capa com Upload e Pré-visualização Completa */}
              <div className="p-3.5 sm:p-4 rounded-2xl bg-gray-50 dark:bg-gray-800/40 border border-gray-200 dark:border-gray-800 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-bold uppercase tracking-wider text-gray-500 flex items-center gap-1.5">
                    <Image className="w-3.5 h-3.5 text-gray-400" />
                    <span>Imagem da Capa</span>
                  </span>
                  {editCoverFile && (
                    <span className="text-[10px] font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/40 px-2 py-0.5 rounded-full border border-emerald-200 dark:border-emerald-800 flex items-center gap-1">
                      <Sparkles className="w-3 h-3" />
                      <span>Nova capa pronta</span>
                    </span>
                  )}
                </div>

                <div className="flex flex-col sm:flex-row gap-3.5 sm:gap-4 items-center sm:items-start">
                  {/* Pré-visualização da Capa */}
                  <div className="w-24 h-34 sm:w-28 sm:h-38 rounded-2xl border-2 border-dashed border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 flex flex-col items-center justify-center overflow-hidden shrink-0 relative shadow-sm group">
                    {editCoverPreview ? (
                      <img
                        src={editCoverPreview}
                        alt="Capa do Livro"
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <div className="flex flex-col items-center p-2 text-center text-gray-400">
                        <Image className="w-7 h-7 mb-1 opacity-60" />
                        <span className="text-[10px] font-semibold">Sem capa</span>
                      </div>
                    )}

                    {/* Botão de câmara em hover */}
                    <button
                      type="button"
                      onClick={() => editCoverInputRef.current?.click()}
                      className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col items-center justify-center text-white text-[10px] font-bold gap-1 cursor-pointer"
                    >
                      <Camera className="w-5 h-5" />
                      <span>Trocar</span>
                    </button>
                  </div>

                  {/* Ações da Capa */}
                  <div className="flex-1 w-full space-y-2">
                    <input
                      ref={editCoverInputRef}
                      type="file"
                      accept="image/*"
                      onChange={handleEditCoverChange}
                      className="hidden"
                    />

                    <button
                      type="button"
                      onClick={() => editCoverInputRef.current?.click()}
                      className="w-full py-2.5 px-3.5 rounded-xl bg-black dark:bg-white text-white dark:text-black text-xs font-bold flex items-center justify-center gap-2 hover:opacity-90 active:scale-95 transition-all shadow-xs"
                    >
                      <Upload className="w-4 h-4 stroke-[2.2]" />
                      <span>{editCoverPreview ? "Alterar / Escolher Nova Capa" : "Escolher Imagem de Capa"}</span>
                    </button>

                    {editCoverFile && (
                      <button
                        type="button"
                        onClick={() => {
                          setEditCoverFile(null);
                          setEditCoverPreview(submittedBook.cover_url || "");
                        }}
                        className="w-full py-2 px-3 rounded-xl border border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-300 text-[11px] font-medium flex items-center justify-center gap-1.5 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
                      >
                        <RotateCcw className="w-3.5 h-3.5" />
                        <span>Restaurar Capa Original</span>
                      </button>
                    )}

                    <p className="text-[10px] text-gray-400 dark:text-gray-500 leading-relaxed pt-1">
                      Formatos suportados: JPG, PNG ou WebP.
                    </p>
                  </div>
                </div>
              </div>

              {/* Título */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="block text-xs font-bold text-gray-700 dark:text-gray-300">
                    Título do Livro *
                  </label>
                  {(editTitle || editAuthor) && (
                    <button
                      type="button"
                      onClick={handleSwapEditTitleAndAuthor}
                      className="text-[11px] font-semibold text-gray-500 hover:text-black dark:hover:text-white flex items-center gap-1 px-2 py-0.5 rounded-lg bg-gray-100 dark:bg-gray-800 transition-colors"
                    >
                      <ArrowUpDown className="w-3 h-3" />
                      <span>Trocar com Autor</span>
                    </button>
                  )}
                </div>
                <input
                  type="text"
                  value={editTitle}
                  onChange={(e) => setEditTitle(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-gray-50/70 dark:bg-black border border-gray-200 dark:border-gray-700 rounded-xl font-semibold text-xs sm:text-sm focus:outline-none focus:border-black dark:focus:border-white transition-all"
                  placeholder="Título da obra"
                  required
                />
              </div>

              {/* Autor */}
              <div>
                <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 mb-1.5">
                  Nome do Autor(a) *
                </label>
                <input
                  type="text"
                  value={editAuthor}
                  onChange={(e) => setEditAuthor(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-gray-50/70 dark:bg-black border border-gray-200 dark:border-gray-700 rounded-xl font-semibold text-xs sm:text-sm focus:outline-none focus:border-black dark:focus:border-white transition-all"
                  placeholder="Nome do autor"
                  required
                />
              </div>

              {/* Género / Categoria */}
              <div>
                <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 mb-1.5">
                  Género / Categoria Literária
                </label>
                <select
                  value={editCategoryId}
                  onChange={(e) => {
                    setEditCategoryId(e.target.value);
                    if (e.target.value !== "__custom__") setEditCustomCategory("");
                  }}
                  className="w-full px-3.5 py-2.5 bg-gray-50/70 dark:bg-black border border-gray-200 dark:border-gray-700 rounded-xl text-xs sm:text-sm font-medium focus:outline-none focus:border-black dark:focus:border-white transition-all"
                >
                  <option value="">— Sem categoria definida —</option>
                  {categories.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                  <option value="__custom__">Outra categoria (escrever)...</option>
                </select>

                {/* Campo de Categoria Personalizada no Modal de Edição */}
                {editCategoryId === "__custom__" && (
                  <div className="mt-2.5 p-3 rounded-xl bg-gray-100/70 dark:bg-gray-800/60 border border-gray-200 dark:border-gray-700 animate-in fade-in slide-in-from-top-2 duration-150 space-y-1.5">
                    <label className="block text-[11px] font-bold text-gray-800 dark:text-gray-200">
                      Digita o Nome do Novo Género / Categoria:
                    </label>
                    <input
                      type="text"
                      value={editCustomCategory}
                      onChange={(e) => setEditCustomCategory(e.target.value)}
                      placeholder="Ex: Literatura Moçambicana, Contos Africanos..."
                      className="w-full px-3 py-2 bg-white dark:bg-gray-900 border-2 border-black dark:border-white rounded-lg text-xs font-medium focus:outline-none transition-all"
                      autoFocus
                    />
                    <p className="text-[10px] text-gray-500 dark:text-gray-400">
                      Esta categoria será gravada para esta obra.
                    </p>
                  </div>
                )}
              </div>

              {/* Sinopse */}
              <div>
                <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 mb-1.5">
                  Sinopse ou Descrição da Obra
                </label>
                <textarea
                  rows={4}
                  value={editDescription}
                  onChange={(e) => setEditDescription(e.target.value)}
                  placeholder="Escreve uma sinopse cativante da obra..."
                  className="w-full px-3.5 py-2.5 bg-gray-50/70 dark:bg-black border border-gray-200 dark:border-gray-700 rounded-xl text-xs sm:text-sm font-medium focus:outline-none focus:border-black dark:focus:border-white transition-all resize-none leading-relaxed"
                />
              </div>
            </div>

            {/* Rodapé FIXO com Botões Sempre Visíveis */}
            <div className="shrink-0 px-4 sm:px-6 py-3.5 sm:py-4 border-t border-gray-100 dark:border-gray-800 bg-white/95 dark:bg-gray-900/95 backdrop-blur-md flex items-center justify-between gap-3 sticky bottom-0 z-20 pb-[max(1rem,env(safe-area-inset-bottom))] shadow-[0_-4px_20px_rgba(0,0,0,0.06)] dark:shadow-[0_-4px_20px_rgba(0,0,0,0.4)]">
              <button
                type="button"
                onClick={() => setIsEditingSubmitted(false)}
                disabled={savingEdits}
                className="py-2.5 px-4 rounded-xl border border-gray-200 dark:border-gray-800 text-xs font-semibold text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors flex items-center gap-1.5"
              >
                <X className="w-3.5 h-3.5" />
                <span>Cancelar</span>
              </button>

              <button
                type="button"
                onClick={handleSaveEdits}
                disabled={savingEdits || !editTitle.trim() || !editAuthor.trim()}
                className="py-2.5 px-5 sm:px-6 bg-black dark:bg-white text-white dark:text-black rounded-xl text-xs sm:text-sm font-bold flex items-center justify-center gap-2 hover:opacity-90 active:scale-95 transition-all shadow-md disabled:opacity-50 disabled:pointer-events-none"
              >
                {savingEdits ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white dark:border-black border-t-transparent rounded-full animate-spin" />
                    <span>A guardar alterações...</span>
                  </>
                ) : (
                  <>
                    <Save className="w-4 h-4 stroke-[2.2]" />
                    <span>Guardar Alterações</span>
                  </>
                )}
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
