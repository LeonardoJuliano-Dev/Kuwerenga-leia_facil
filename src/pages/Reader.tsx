import { useState, useEffect, useRef, useCallback } from "react";
import { Link, useSearchParams } from "react-router-dom";
import {
  ArrowLeft,
  ChevronLeft,
  ChevronRight,
  Bookmark,
  BookmarkCheck,
  MessageSquarePlus,
  BookOpen,
  Download,
  CheckCircle,
  FileUp,
  Settings2,
  List,
  X,
  Trash2
} from "lucide-react";
import * as pdfjsLib from "pdfjs-dist";
import ePub from "epubjs";
import type Book from "epubjs/types/book";
import type Rendition from "epubjs/types/rendition";
import {
  getBookOffline,
  saveBookOffline,
  saveReadingProgress,
  getReadingProgress,
  saveAnnotationOffline,
  getAnnotationsForBook,
  type OfflineAnnotation
} from "../lib/offlineStorage";
import { supabase } from "../lib/supabase";

// Configura o worker do PDF.js a partir de CDN compatível
pdfjsLib.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.mjs`;

// PDF de demonstração público de domínio aberto para testes imediatos
const SAMPLE_PDF_URL = "https://raw.githubusercontent.com/mozilla/pdf.js/ba2edeae/web/compressed.tracemonkey-pldi-09.pdf";

/**
 * Detecta se um Blob é um ficheiro EPUB.
 * EPUB files are ZIP archives; the first bytes are "PK\x03\x04".
 * We also check the blob type.
 */
async function isEpubBlob(blob: Blob): Promise<boolean> {
  if (blob.type === "application/epub+zip") return true;
  // Check ZIP magic bytes (EPUBs are ZIP files)
  const header = new Uint8Array(await blob.slice(0, 4).arrayBuffer());
  return header[0] === 0x50 && header[1] === 0x4B && header[2] === 0x03 && header[3] === 0x04;
}

export default function Reader() {
  const [searchParams] = useSearchParams();
  const bookId = searchParams.get("bookId") || "demo-book";
  const [bookTitle, setBookTitle] = useState("Manual de Leitura");

  // Tipo de ficheiro activo
  const [fileType, setFileType] = useState<"pdf" | "epub" | null>(null);

  // Estados do PDF
  const [pdfDoc, setPdfDoc] = useState<pdfjsLib.PDFDocumentProxy | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [isOfflineSaved, setIsOfflineSaved] = useState(false);
  const [pdfSourceBlob, setPdfSourceBlob] = useState<Blob | null>(null);

  // Estados do EPUB
  const [epubBook, setEpubBook] = useState<Book | null>(null);
  const [epubRendition, setEpubRendition] = useState<Rendition | null>(null);
  const [epubCurrentCfi, setEpubCurrentCfi] = useState<string>("");
  const [epubProgress, setEpubProgress] = useState(0);
  const [epubChapterTitle, setEpubChapterTitle] = useState("");

  // Estados de UI e Leitura
  const [scale, setScale] = useState(1.1);
  const [themeMode, setThemeMode] = useState<"light" | "sepia" | "dark">("dark");
  const [showSettings, setShowSettings] = useState(false);
  const [showAnnotationsDrawer, setShowAnnotationsDrawer] = useState(false);
  const [showAddNoteModal, setShowAddNoteModal] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [noteContent, setNoteContent] = useState("");
  const [annotations, setAnnotations] = useState<OfflineAnnotation[]>([]);

  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const renderTaskRef = useRef<any>(null);
  const epubContainerRef = useRef<HTMLDivElement | null>(null);
  const epubRenditionRef = useRef<Rendition | null>(null);

  // ─── Helpers ───────────────────────────────────────────────────

  /** Inicializa um livro EPUB a partir de um ArrayBuffer */
  const initEpub = useCallback(async (buffer: ArrayBuffer, blob: Blob, title: string) => {
    const book = ePub(buffer);
    setEpubBook(book);
    setFileType("epub");
    setBookTitle(title);
    setPdfSourceBlob(blob);

    // Espera os metadados carregarem
    await book.ready;

    // Gera localizações para calcular progresso (cada ~1000 caracteres)
    await book.locations.generate(1000);
    setTotalPages(book.locations.length());

    // Recupera progresso de leitura
    const savedProgress = await getReadingProgress(bookId);
    if (savedProgress) {
      setCurrentPage(savedProgress.currentPage);
    }

    // Carrega anotações do livro
    const existingNotes = await getAnnotationsForBook(bookId);
    setAnnotations(existingNotes);
  }, [bookId]);

  /** Inicializa um documento PDF a partir de Uint8Array */
  const initPdf = useCallback(async (pdfData: Uint8Array, blob: Blob, title: string) => {
    setFileType("pdf");
    setBookTitle(title);
    setPdfSourceBlob(blob);

    const loadingTask = pdfjsLib.getDocument({ data: pdfData });
    const doc = await loadingTask.promise;

    setPdfDoc(doc);
    setTotalPages(doc.numPages);

    // Recupera progresso de leitura
    const savedProgress = await getReadingProgress(bookId);
    if (savedProgress && savedProgress.currentPage <= doc.numPages) {
      setCurrentPage(savedProgress.currentPage);
    }

    // Carrega anotações do livro
    const existingNotes = await getAnnotationsForBook(bookId);
    setAnnotations(existingNotes);
  }, [bookId]);

  // ─── 1. Carregar o livro ──────────────────────────────────────

  useEffect(() => {
    let isMounted = true;

    async function loadBookData() {
      setLoading(true);
      setError("");

      try {
        // Tenta obter do IndexedDB (Offline)
        const offlineBlob = await getBookOffline(bookId);

        if (offlineBlob) {
          setIsOfflineSaved(true);
          const buffer = await offlineBlob.arrayBuffer();

          // Detecta se é EPUB ou PDF
          const isEpub = await isEpubBlob(offlineBlob);

          if (!isMounted) return;

          if (isEpub) {
            await initEpub(buffer, offlineBlob, bookTitle);
          } else {
            await initPdf(new Uint8Array(buffer), offlineBlob, bookTitle);
          }
        } else if (bookId !== "demo-book") {
          // Busca do Supabase
          const { data: bookRecord } = await supabase
            .from("books")
            .select("title, file_url, file_type")
            .eq("id", bookId)
            .maybeSingle();

          if (!isMounted) return;

          if (bookRecord?.file_url) {
            const response = await fetch(bookRecord.file_url);
            const blob = await response.blob();
            const buffer = await blob.arrayBuffer();
            const title = bookRecord.title || "Livro";

            // Detecta tipo — primeiro pelo campo file_type, depois pelo blob
            const isEpub = bookRecord.file_type === "epub" || await isEpubBlob(blob);

            if (!isMounted) return;

            if (isEpub) {
              await initEpub(buffer, blob, title);
              // Cache no IndexedDB
              saveBookOffline(bookId, blob, {
                title,
                file_type: "epub"
              }).then(() => setIsOfflineSaved(true)).catch(() => {});
            } else {
              await initPdf(new Uint8Array(buffer), blob, title);
              // Cache no IndexedDB
              saveBookOffline(bookId, blob, {
                title,
                file_type: "pdf"
              }).then(() => setIsOfflineSaved(true)).catch(() => {});
            }
          } else {
            // Livro sem ficheiro — mostra erro
            if (isMounted) setError("Este livro não tem ficheiro associado.");
          }
        } else {
          // Fallback para o PDF de exemplo
          setBookTitle("Documento de Demonstração");
          const res = await fetch(SAMPLE_PDF_URL);
          const blob = await res.blob();
          const buffer = await blob.arrayBuffer();

          if (!isMounted) return;
          await initPdf(new Uint8Array(buffer), blob, "Documento de Demonstração");
        }
      } catch (err: any) {
        console.error("Erro ao carregar livro:", err);
        if (isMounted) setError("Não foi possível carregar o livro. Verifica a tua conexão ou formato.");
      } finally {
        if (isMounted) setLoading(false);
      }
    }

    loadBookData();

    return () => {
      isMounted = false;
    };
  }, [bookId]);

  // ─── 2a. Renderizar página PDF ────────────────────────────────

  useEffect(() => {
    if (fileType !== "pdf" || !pdfDoc || !canvasRef.current) return;

    let isRendering = true;
    async function renderPdfPage() {
      try {
        if (renderTaskRef.current) {
          renderTaskRef.current.cancel();
        }
        const page = await pdfDoc!.getPage(currentPage);
        if (!isRendering) return;
        const canvas = canvasRef.current!;
        const context = canvas.getContext("2d");
        if (!context) return;
        const containerWidth = Math.min(window.innerWidth - (window.innerWidth < 640 ? 16 : 48), 720);
        const unscaledViewport = page.getViewport({ scale: 1 });
        const autoScale = (containerWidth / unscaledViewport.width) * scale;
        const viewport = page.getViewport({ scale: autoScale });
        const pixelRatio = window.devicePixelRatio || 1;
        canvas.width = viewport.width * pixelRatio;
        canvas.height = viewport.height * pixelRatio;
        canvas.style.width = `${viewport.width}px`;
        canvas.style.height = `${viewport.height}px`;
        context.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0);
        const renderContext = { canvasContext: context, viewport };
        const task = page.render(renderContext as any);
        renderTaskRef.current = task;
        await task.promise;
        const progressPercent = Math.round((currentPage / (pdfDoc?.numPages || 1)) * 100);
        saveReadingProgress({
          bookId,
          currentPage,
          currentChapter: `Página ${currentPage}`,
          progress: progressPercent,
          lastReadAt: new Date().toISOString(),
          synced: false,
        });
      } catch (err: any) {
        if (err?.name !== "RenderingCancelledException") {
          console.error("Erro de renderização:", err);
        }
      }
    }
    renderPdfPage();
    return () => { isRendering = false; };
  }, [pdfDoc, fileType, currentPage, scale]);

  // ─── 2b. Montar Rendition EPUB ────────────────────────────────

  useEffect(() => {
    if (fileType !== "epub" || !epubBook || !epubContainerRef.current) return;

    // Limpa rendição anterior se existir
    if (epubRenditionRef.current) {
      try { epubRenditionRef.current.destroy(); } catch {}
    }

    const container = epubContainerRef.current;
    // Limpa o container
    container.innerHTML = "";

    // Temas de cor para o EPUB
    const themes: Record<string, Record<string, string>> = {
      dark: { body: { color: "#fff !important", background: "#000 !important" } },
      light: { body: { color: "#000 !important", background: "#fff !important" } },
      sepia: { body: { color: "#433422 !important", background: "#fbf0d9 !important" } },
    } as any;

    const rendition = epubBook.renderTo(container, {
      width: "100%",
      height: "100%",
      flow: "paginated",
      spread: "none",
    });

    // Registar temas
    Object.entries(themes).forEach(([name, styles]) => {
      rendition.themes.register(name, styles as any);
    });
    rendition.themes.select(themeMode);

    // Aplicar tamanho da fonte baseado no scale
    rendition.themes.fontSize(`${Math.round(scale * 100)}%`);

    epubRenditionRef.current = rendition;
    setEpubRendition(rendition);

    // Navegar para localização guardada
    const savedProgress = getReadingProgress(bookId);
    savedProgress.then((progress) => {
      if (progress && epubCurrentCfi) {
        rendition.display(epubCurrentCfi);
      } else {
        rendition.display();
      }
    }).catch(() => {
      rendition.display();
    });

    // Acompanhar relocação (mudança de página/capítulo)
    rendition.on("relocated", (location: any) => {
      if (!location || !location.start) return;

      const cfi = location.start.cfi;
      setEpubCurrentCfi(cfi);

      // Calcular progresso
      const progress = epubBook.locations.percentageFromCfi(cfi);
      const pct = Math.round((progress || 0) * 100);
      setEpubProgress(pct);

      // Página virtual baseada na localização
      const loc = epubBook.locations.locationFromCfi(cfi);
      const locNum = typeof loc === "number" ? loc + 1 : 1;
      setCurrentPage(locNum);

      // Nome do capítulo
      const tocItem = epubBook.navigation?.toc?.find((t: any) => {
        return t.href && cfi.includes?.(t.href);
      });
      setEpubChapterTitle(tocItem?.label || "");

      // Guardar progresso
      saveReadingProgress({
        bookId,
        currentPage: locNum,
        currentChapter: tocItem?.label || `Posição ${locNum}`,
        progress: pct,
        lastReadAt: new Date().toISOString(),
        synced: false,
      });
    });

    return () => {
      try { rendition.destroy(); } catch {}
      epubRenditionRef.current = null;
    };
  }, [epubBook, fileType, themeMode]);

  // Actualizar tamanho da fonte do EPUB quando scale muda
  useEffect(() => {
    if (fileType === "epub" && epubRenditionRef.current) {
      epubRenditionRef.current.themes.fontSize(`${Math.round(scale * 100)}%`);
    }
  }, [scale, fileType]);

  // Actualizar tema do EPUB quando themeMode muda
  useEffect(() => {
    if (fileType === "epub" && epubRenditionRef.current) {
      epubRenditionRef.current.themes.select(themeMode);
    }
  }, [themeMode, fileType]);

  // ─── Navegação ────────────────────────────────────────────────

  const goToNextPage = () => {
    if (fileType === "epub" && epubRenditionRef.current) {
      epubRenditionRef.current.next();
    } else if (fileType === "pdf" && currentPage < totalPages) {
      setCurrentPage((prev) => prev + 1);
      window.scrollTo({ top: 0, behavior: "smooth" });
    }
  };

  const goToPrevPage = () => {
    if (fileType === "epub" && epubRenditionRef.current) {
      epubRenditionRef.current.prev();
    } else if (fileType === "pdf" && currentPage > 1) {
      setCurrentPage((prev) => prev - 1);
      window.scrollTo({ top: 0, behavior: "smooth" });
    }
  };

  // ─── Descarregar para leitura Offline ─────────────────────────

  const handleDownloadOffline = async () => {
    if (!pdfSourceBlob) return;
    try {
      await saveBookOffline(bookId, pdfSourceBlob, {
        title: bookTitle,
        totalPages,
        author: "Autor",
        file_type: fileType || "pdf"
      });
      setIsOfflineSaved(true);
    } catch (e) {
      console.error("Erro ao guardar offline:", e);
    }
  };

  // ─── Carregar ficheiro do dispositivo ─────────────────────────

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setLoading(true);
    setError("");

    // Limpar estado anterior
    setPdfDoc(null);
    if (epubBook) {
      try { epubBook.destroy(); } catch {}
    }
    setEpubBook(null);
    setFileType(null);

    try {
      const title = file.name.replace(/\.[^/.]+$/, "");
      const buffer = await file.arrayBuffer();
      const isEpub = file.name.toLowerCase().endsWith(".epub") || await isEpubBlob(file);

      if (isEpub) {
        await initEpub(buffer, file, title);

        // Guarda automaticamente no IndexedDB
        const localId = `local-${Date.now()}`;
        await saveBookOffline(localId, file, {
          title,
          author: "Ficheiro Local",
          file_type: "epub"
        });
        setIsOfflineSaved(true);
      } else {
        // PDF
        const doc = await pdfjsLib.getDocument({ data: new Uint8Array(buffer) }).promise;
        setFileType("pdf");
        setBookTitle(title);
        setPdfSourceBlob(file);
        setPdfDoc(doc);
        setTotalPages(doc.numPages);
        setCurrentPage(1);

        // Guarda automaticamente no IndexedDB
        const localId = `local-${Date.now()}`;
        await saveBookOffline(localId, file, {
          title,
          author: "Ficheiro Local",
          totalPages: doc.numPages,
          file_type: "pdf"
        });
        setIsOfflineSaved(true);
      }
    } catch (err: any) {
      console.error("Erro ao ler ficheiro local:", err);
      setError("Ficheiro inválido ou não suportado.");
    } finally {
      setLoading(false);
    }
  };

  // ─── Marcações (Bookmark) ─────────────────────────────────────

  const isCurrentPageBookmarked = annotations.some(
    (a) => a.type === "bookmark" && a.pageNumber === currentPage
  );

  const toggleBookmark = async () => {
    if (isCurrentPageBookmarked) {
      const updated = annotations.filter(
        (a) => !(a.type === "bookmark" && a.pageNumber === currentPage)
      );
      setAnnotations(updated);
    } else {
      const newBookmark: OfflineAnnotation = {
        id: `bm-${Date.now()}`,
        bookId,
        type: "bookmark",
        content: fileType === "epub"
          ? `Marcador: ${epubChapterTitle || "Posição " + currentPage}`
          : `Marcador na página ${currentPage}`,
        selectedText: "",
        pageNumber: currentPage,
        chapter: fileType === "epub"
          ? (epubChapterTitle || `Posição ${currentPage}`)
          : `Página ${currentPage}`,
        synced: false,
        createdAt: new Date().toISOString()
      };
      await saveAnnotationOffline(newBookmark);
      setAnnotations([...annotations, newBookmark]);
    }
  };

  // ─── Adicionar Nota ───────────────────────────────────────────

  const handleSaveNote = async () => {
    if (!noteContent.trim()) return;

    const newNote: OfflineAnnotation = {
      id: `note-${Date.now()}`,
      bookId,
      type: "note",
      content: noteContent.trim(),
      selectedText: "",
      pageNumber: currentPage,
      chapter: fileType === "epub"
        ? (epubChapterTitle || `Posição ${currentPage}`)
        : `Página ${currentPage}`,
      synced: false,
      createdAt: new Date().toISOString()
    };

    await saveAnnotationOffline(newNote);
    setAnnotations([...annotations, newNote]);
    setNoteContent("");
    setShowAddNoteModal(false);
  };

  // ─── Fullscreen ───────────────────────────────────────────────

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch(() => {});
      setIsFullscreen(true);
    } else {
      document.exitFullscreen().catch(() => {});
      setIsFullscreen(false);
    }
  };

  // ─── Cleanup EPUB on unmount ──────────────────────────────────

  useEffect(() => {
    return () => {
      if (epubRenditionRef.current) {
        try { epubRenditionRef.current.destroy(); } catch {}
      }
      if (epubBook) {
        try { epubBook.destroy(); } catch {}
      }
    };
  }, []);

  // Classes de tema
  const themeClasses = {
    dark: "bg-black text-white",
    light: "bg-white text-black",
    sepia: "bg-[#fbf0d9] text-[#433422]"
  };

  // Texto de página / progresso
  const pageLabel = fileType === "epub"
    ? `${epubChapterTitle || "Posição " + currentPage} • ${epubProgress}%`
    : `Página ${currentPage} de ${totalPages || 1}`;

  return (
    <div className={`flex flex-col min-h-screen ${themeClasses[themeMode]} transition-colors duration-200 select-none`}>
      
      {/* Barra de Navegação Superior */}
      <header className="px-4 py-3 flex items-center justify-between sticky top-0 backdrop-blur-md bg-opacity-90 border-b border-gray-200 dark:border-gray-800 z-20">
        <div className="flex items-center gap-3">
          <Link
            to="/home"
            className="p-2 -ml-2 rounded-full hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
          >
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <div className="max-w-[180px] sm:max-w-xs truncate">
            <h1 className="font-semibold text-sm truncate">{bookTitle}</h1>
            <span className="text-[11px] text-gray-500 block truncate">
              {pageLabel}
            </span>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* Botão de Guardar Offline */}
          <button
            onClick={handleDownloadOffline}
            disabled={isOfflineSaved}
            className={`p-2 rounded-full transition-colors ${
              isOfflineSaved
                ? "text-emerald-500 cursor-default"
                : "text-gray-500 hover:text-black dark:hover:text-white"
            }`}
            title={isOfflineSaved ? "Livro guardado para ler sem internet" : "Guardar offline"}
          >
            {isOfflineSaved ? <CheckCircle className="w-5 h-5" /> : <Download className="w-5 h-5" />}
          </button>

          {/* Marcador de Página */}
          <button
            onClick={toggleBookmark}
            className="p-2 rounded-full hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
            title="Marcar página"
          >
            {isCurrentPageBookmarked ? (
              <BookmarkCheck className="w-5 h-5 text-black dark:text-white fill-current" />
            ) : (
              <Bookmark className="w-5 h-5 text-gray-500" />
            )}
          </button>

          {/* Botão de Anotações */}
          <button
            onClick={() => setShowAddNoteModal(true)}
            className="p-2 rounded-full hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors text-gray-500 hover:text-black dark:hover:text-white"
            title="Adicionar nota"
          >
            <MessageSquarePlus className="w-5 h-5" />
          </button>

          {/* Lista de Anotações / Marcadores */}
          <button
            onClick={() => setShowAnnotationsDrawer(true)}
            className="p-2 rounded-full hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors text-gray-500 hover:text-black dark:hover:text-white"
            title="Ver anotações"
          >
            <List className="w-5 h-5" />
          </button>

          {/* Preferências / Configurações */}
          <button
            onClick={() => setShowSettings(!showSettings)}
            className="p-2 rounded-full hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors text-gray-500 hover:text-black dark:hover:text-white"
          >
            <Settings2 className="w-5 h-5" />
          </button>

          {/* Fullscreen Toggle */}
          <button
            onClick={toggleFullscreen}
            className="p-2 rounded-full hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors text-gray-500 hover:text-black dark:hover:text-white"
            title={isFullscreen ? "Sair do modo tela cheia" : "Entrar no modo tela cheia"}
          >
            {isFullscreen ? <X className="w-5 h-5" /> : <BookOpen className="w-5 h-5" />}
          </button>
        </div>
      </header>

      {/* Painel Flutuante de Configurações de Leitura */}
      {showSettings && (
        <div className="bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-800 p-4 animate-in slide-in-from-top-4 duration-200 z-10 shadow-lg text-black dark:text-white">
          <div className="max-w-md mx-auto space-y-4">
            
            {/* Escolha de Tema */}
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold uppercase tracking-wider text-gray-500">Tema</span>
              <div className="flex gap-2">
                <button
                  onClick={() => setThemeMode("light")}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium border ${
                    themeMode === "light" ? "border-black bg-gray-100 text-black" : "border-gray-300 text-gray-600"
                  }`}
                >
                  Claro
                </button>
                <button
                  onClick={() => setThemeMode("sepia")}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium border bg-[#fbf0d9] text-[#433422] ${
                    themeMode === "sepia" ? "border-[#433422] ring-2 ring-[#433422]" : "border-transparent"
                  }`}
                >
                  Sépia
                </button>
                <button
                  onClick={() => setThemeMode("dark")}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium border bg-black text-white ${
                    themeMode === "dark" ? "border-white ring-2 ring-white" : "border-transparent"
                  }`}
                >
                  Escuro
                </button>
              </div>
            </div>

            {/* Ajuste de Zoom / Escala */}
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold uppercase tracking-wider text-gray-500">
                {fileType === "epub" ? "Tamanho do Texto" : "Zoom"}
              </span>
              <div className="flex items-center gap-3">
                <button
                  onClick={() => setScale((s) => Math.max(0.7, s - 0.15))}
                  className="px-2.5 py-1 rounded bg-gray-100 dark:bg-gray-800 text-sm font-bold"
                >
                  -
                </button>
                <span className="text-xs font-medium">{Math.round(scale * 100)}%</span>
                <button
                  onClick={() => setScale((s) => Math.min(2.0, s + 0.15))}
                  className="px-2.5 py-1 rounded bg-gray-100 dark:bg-gray-800 text-sm font-bold"
                >
                  +
                </button>
              </div>
            </div>

            {/* Carregar ficheiro do Dispositivo */}
            <div className="pt-2 border-t border-gray-100 dark:border-gray-800 flex justify-between items-center">
              <span className="text-xs text-gray-500">Abrir PDF ou EPUB local</span>
              <label className="cursor-pointer inline-flex items-center gap-1.5 px-3 py-1.5 bg-black dark:bg-white text-white dark:text-black rounded-lg text-xs font-medium active:scale-95 transition-transform">
                <FileUp className="w-3.5 h-3.5" />
                <span>Escolher Ficheiro</span>
                <input type="file" accept="application/pdf,application/epub+zip,.epub,.pdf" onChange={handleFileUpload} className="hidden" />
              </label>
            </div>
          </div>
        </div>
      )}

      {/* Área Central de Leitura */}
      <main className="flex-1 flex flex-col items-center justify-center p-2 sm:p-6 relative min-h-[70vh]">
        {loading && (
          <div className="flex flex-col items-center gap-3 my-20">
            <div className="w-8 h-8 border-2 border-black dark:border-white border-t-transparent dark:border-t-transparent rounded-full animate-spin"></div>
            <p className="text-xs text-gray-500">A carregar o livro...</p>
          </div>
        )}

        {error && (
          <div className="p-6 max-w-sm text-center">
            <BookOpen className="w-12 h-12 mx-auto mb-3 text-red-500 opacity-80" />
            <h3 className="font-semibold text-base mb-1">Aviso de Leitura</h3>
            <p className="text-xs text-gray-500 mb-6">{error}</p>
            <label className="inline-flex items-center gap-2 px-4 py-2.5 bg-black dark:bg-white text-white dark:text-black rounded-xl text-xs font-semibold cursor-pointer">
              <FileUp className="w-4 h-4" />
              <span>Abrir um PDF ou EPUB</span>
              <input type="file" accept="application/pdf,application/epub+zip,.epub,.pdf" onChange={handleFileUpload} className="hidden" />
            </label>
          </div>
        )}

        {/* PDF: Canvas de Renderização */}
        {fileType === "pdf" && (
          <div className={`relative max-w-full overflow-auto shadow-2xl rounded-sm ${loading ? "opacity-0" : "opacity-100"} transition-opacity duration-300`}>
            <canvas ref={canvasRef} className="block max-w-full h-auto mx-auto" />
          </div>
        )}

        {/* EPUB: Container de Renderização */}
        {fileType === "epub" && (
          <div
            ref={epubContainerRef}
            className={`w-full max-w-3xl mx-auto rounded-lg overflow-hidden ${loading ? "opacity-0" : "opacity-100"} transition-opacity duration-300`}
            style={{ height: "calc(100vh - 180px)", minHeight: "400px" }}
          />
        )}

        {/* Sem ficheiro e sem erro — mostrar botão de upload */}
        {!loading && !error && !fileType && (
          <div className="p-6 max-w-sm text-center">
            <BookOpen className="w-12 h-12 mx-auto mb-3 text-gray-400 opacity-80" />
            <h3 className="font-semibold text-base mb-1">Nenhum livro carregado</h3>
            <p className="text-xs text-gray-500 mb-6">Escolhe um ficheiro PDF ou EPUB para começar a ler.</p>
            <label className="inline-flex items-center gap-2 px-4 py-2.5 bg-black dark:bg-white text-white dark:text-black rounded-xl text-xs font-semibold cursor-pointer">
              <FileUp className="w-4 h-4" />
              <span>Abrir um PDF ou EPUB</span>
              <input type="file" accept="application/pdf,application/epub+zip,.epub,.pdf" onChange={handleFileUpload} className="hidden" />
            </label>
          </div>
        )}
      </main>

      {/* Barra Inferior com Progresso e Botões de Página */}
      <footer className="sticky bottom-0 w-full backdrop-blur-md bg-opacity-95 bg-white dark:bg-black border-t border-gray-200 dark:border-gray-800 px-6 py-3.5">
        <div className="max-w-md mx-auto">
          <div className="flex items-center justify-between mb-2">
            <button
              onClick={goToPrevPage}
              disabled={fileType === "pdf" && currentPage <= 1}
              className="flex items-center gap-1 text-xs font-semibold px-2.5 py-1 rounded hover:bg-gray-100 dark:hover:bg-gray-800 disabled:opacity-30 disabled:pointer-events-none transition-colors"
            >
              <ChevronLeft className="w-4 h-4" />
              <span>Anterior</span>
            </button>

            <span className="text-xs font-bold">
              {fileType === "epub"
                ? `${epubProgress}%`
                : `${currentPage} / ${totalPages || 1}`
              }
            </span>

            <button
              onClick={goToNextPage}
              disabled={fileType === "pdf" && currentPage >= totalPages}
              className="flex items-center gap-1 text-xs font-semibold px-2.5 py-1 rounded hover:bg-gray-100 dark:hover:bg-gray-800 disabled:opacity-30 disabled:pointer-events-none transition-colors"
            >
              <span>Seguinte</span>
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>

          {/* Barra Deslizante de Progresso */}
          <div className="flex items-center gap-3">
            <input
              type="range"
              min={fileType === "epub" ? 0 : 1}
              max={fileType === "epub" ? 100 : (totalPages || 1)}
              value={fileType === "epub" ? epubProgress : currentPage}
              onChange={(e) => {
                const val = Number(e.target.value);
                if (fileType === "epub" && epubBook && epubRenditionRef.current) {
                  // Navega para a percentagem
                  const cfi = epubBook.locations.cfiFromPercentage(val / 100);
                  if (cfi) epubRenditionRef.current.display(cfi);
                } else {
                  setCurrentPage(val);
                }
              }}
              className="flex-1 accent-black dark:accent-white h-1.5 bg-gray-200 dark:bg-gray-800 rounded-lg cursor-pointer"
            />
            <span className="text-[11px] text-gray-500 font-medium w-8 text-right">
              {fileType === "epub"
                ? `${epubProgress}%`
                : `${Math.round((currentPage / (totalPages || 1)) * 100)}%`
              }
            </span>
          </div>
        </div>
      </footer>

      {/* Modal para Adicionar Anotação */}
      {showAddNoteModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-2xl max-w-sm w-full p-5 shadow-2xl animate-in zoom-in-95 duration-200 text-black dark:text-white">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-bold text-sm">
                Adicionar Nota {fileType === "epub" ? `(${epubChapterTitle || "Posição " + currentPage})` : `(Pág. ${currentPage})`}
              </h3>
              <button onClick={() => setShowAddNoteModal(false)} className="p-1 rounded-full hover:bg-gray-100 dark:hover:bg-gray-800">
                <X className="w-4 h-4" />
              </button>
            </div>
            <textarea
              rows={4}
              value={noteContent}
              onChange={(e) => setNoteContent(e.target.value)}
              placeholder="Escreve uma anotação ou reflexão sobre este trecho..."
              className="w-full bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl p-3 text-sm focus:outline-none focus:ring-2 focus:ring-black dark:focus:ring-white mb-4 resize-none"
              autoFocus
            />
            <div className="flex gap-2 justify-end">
              <button
                onClick={() => setShowAddNoteModal(false)}
                className="px-4 py-2 text-xs font-semibold text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-xl"
              >
                Cancelar
              </button>
              <button
                onClick={handleSaveNote}
                disabled={!noteContent.trim()}
                className="px-4 py-2 text-xs font-semibold bg-black dark:bg-white text-white dark:text-black rounded-xl disabled:opacity-40"
              >
                Guardar Nota
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Drawer Lateral com Anotações e Marcadores */}
      {showAnnotationsDrawer && (
        <div className="fixed inset-0 z-50 flex justify-end bg-black/50 backdrop-blur-xs">
          <div className="w-80 max-w-full bg-white dark:bg-gray-900 h-full p-6 flex flex-col shadow-2xl animate-in slide-in-from-right duration-200 text-black dark:text-white">
            <div className="flex items-center justify-between pb-4 border-b border-gray-100 dark:border-gray-800">
              <h2 className="font-bold text-base">Marcações & Notas</h2>
              <button onClick={() => setShowAnnotationsDrawer(false)} className="p-1 rounded-full hover:bg-gray-100 dark:hover:bg-gray-800">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto py-4 space-y-3">
              {annotations.length === 0 ? (
                <div className="text-center py-12 text-gray-400 text-xs">
                  Ainda não tens notas ou marcadores neste livro.
                </div>
              ) : (
                annotations.map((a) => (
                  <div
                    key={a.id}
                    onClick={() => {
                      if (fileType === "epub" && epubRenditionRef.current && epubBook) {
                        // Para EPUB, navegar por localização
                        const cfi = epubBook.locations.cfiFromLocation(a.pageNumber - 1);
                        if (cfi) epubRenditionRef.current.display(cfi);
                      } else {
                        setCurrentPage(a.pageNumber);
                      }
                      setShowAnnotationsDrawer(false);
                    }}
                    className="p-3 rounded-xl border border-gray-100 dark:border-gray-800 bg-gray-50 dark:bg-gray-800/60 hover:border-black dark:hover:border-white transition-colors cursor-pointer group"
                  >
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-[11px] font-bold uppercase tracking-wider text-gray-500">
                        {a.type === "bookmark" ? "Marcador" : "Nota"} • {a.chapter || `Pág. ${a.pageNumber}`}
                      </span>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setAnnotations(annotations.filter((item) => item.id !== a.id));
                        }}
                        className="opacity-0 group-hover:opacity-100 text-red-500 p-1"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                    <p className="text-xs leading-relaxed line-clamp-3 text-gray-700 dark:text-gray-300">
                      {a.content}
                    </p>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
