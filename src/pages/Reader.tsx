import { useState, useEffect, useRef } from "react";
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

export default function Reader() {
  const [searchParams] = useSearchParams();
  const bookId = searchParams.get("bookId") || "demo-book";
  const [bookTitle, setBookTitle] = useState("Manual de Leitura");

  // Estados do PDF
  const [pdfDoc, setPdfDoc] = useState<pdfjsLib.PDFDocumentProxy | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [isOfflineSaved, setIsOfflineSaved] = useState(false);
  const [pdfSourceBlob, setPdfSourceBlob] = useState<Blob | null>(null);

  // Estados de UI e Leitura
  const [scale, setScale] = useState(1.1);
  const [themeMode, setThemeMode] = useState<"light" | "sepia" | "dark">("dark");
  const [showSettings, setShowSettings] = useState(false);
  const [showAnnotationsDrawer, setShowAnnotationsDrawer] = useState(false);
  const [showAddNoteModal, setShowAddNoteModal] = useState(false);
  const [noteContent, setNoteContent] = useState("");
  const [annotations, setAnnotations] = useState<OfflineAnnotation[]>([]);

  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const renderTaskRef = useRef<any>(null);

  // 1. Carregar o livro (IndexedDB primeiro, depois Nuvem ou Demo)
  useEffect(() => {
    let isMounted = true;

    async function loadBookData() {
      setLoading(true);
      setError("");

      try {
        // Tenta obter do IndexedDB (Offline)
        const offlineBlob = await getBookOffline(bookId);

        let pdfData: Uint8Array | null = null;

        if (offlineBlob) {
          setIsOfflineSaved(true);
          setPdfSourceBlob(offlineBlob);
          const buffer = await offlineBlob.arrayBuffer();
          pdfData = new Uint8Array(buffer);
        } else {
          // Se houver livro real no Supabase
          if (bookId !== "demo-book") {
            const { data: bookRecord } = await supabase
              .from("books")
              .select("title, file_url")
              .eq("id", bookId)
              .maybeSingle();

            if (bookRecord?.file_url) {
              setBookTitle(bookRecord.title);
              const response = await fetch(bookRecord.file_url);
              const blob = await response.blob();
              setPdfSourceBlob(blob);
              const buffer = await blob.arrayBuffer();
              pdfData = new Uint8Array(buffer);
            }
          }

          // Fallback para o PDF de exemplo
          if (!pdfData) {
            setBookTitle("Documento de Demonstração");
            const res = await fetch(SAMPLE_PDF_URL);
            const blob = await res.blob();
            setPdfSourceBlob(blob);
            const buffer = await blob.arrayBuffer();
            pdfData = new Uint8Array(buffer);
          }
        }

        if (!pdfData || !isMounted) return;

        // Inicializa o documento com PDF.js
        const loadingTask = pdfjsLib.getDocument({ data: pdfData });
        const doc = await loadingTask.promise;

        if (!isMounted) return;
        setPdfDoc(doc);
        setTotalPages(doc.numPages);

        // Recupera o progresso de leitura onde o utilizador parou
        const savedProgress = await getReadingProgress(bookId);
        if (savedProgress && savedProgress.currentPage <= doc.numPages) {
          setCurrentPage(savedProgress.currentPage);
        }

        // Carrega anotações do livro
        const existingNotes = await getAnnotationsForBook(bookId);
        setAnnotations(existingNotes);

      } catch (err: any) {
        console.error("Erro ao carregar PDF:", err);
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

  // 2. Renderizar a página no Canvas
  useEffect(() => {
    if (!pdfDoc || !canvasRef.current) return;

    let isRendering = true;

    async function renderPage() {
      try {
        if (renderTaskRef.current) {
          renderTaskRef.current.cancel();
        }

        const page = await pdfDoc!.getPage(currentPage);
        if (!isRendering) return;

        const canvas = canvasRef.current!;
        const context = canvas.getContext("2d");
        if (!context) return;

        const viewport = page.getViewport({ scale });
        const pixelRatio = window.devicePixelRatio || 1;

        canvas.width = viewport.width * pixelRatio;
        canvas.height = viewport.height * pixelRatio;
        canvas.style.width = `${viewport.width}px`;
        canvas.style.height = `${viewport.height}px`;

        context.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0);

        const renderContext = {
          canvasContext: context,
          viewport: viewport,
        };

        const task = page.render(renderContext as any);
        renderTaskRef.current = task;
        await task.promise;

        // Salvar progresso no IndexedDB automaticamente
        const progressPercent = Math.round((currentPage / (pdfDoc?.numPages || 1)) * 100);
        saveReadingProgress({
          bookId,
          currentPage,
          currentChapter: `Página ${currentPage}`,
          progress: progressPercent,
          lastReadAt: new Date().toISOString(),
          synced: false
        });

      } catch (err: any) {
        if (err?.name !== "RenderingCancelledException") {
          console.error("Erro de renderização:", err);
        }
      }
    }

    renderPage();

    return () => {
      isRendering = false;
    };
  }, [pdfDoc, currentPage, scale]);

  // Controlo de Navegação
  const goToNextPage = () => {
    if (currentPage < totalPages) {
      setCurrentPage((prev) => prev + 1);
      window.scrollTo({ top: 0, behavior: "smooth" });
    }
  };

  const goToPrevPage = () => {
    if (currentPage > 1) {
      setCurrentPage((prev) => prev - 1);
      window.scrollTo({ top: 0, behavior: "smooth" });
    }
  };

  // 3. Descarregar para leitura Offline
  const handleDownloadOffline = async () => {
    if (!pdfSourceBlob) return;
    try {
      await saveBookOffline(bookId, pdfSourceBlob, {
        title: bookTitle,
        totalPages,
        author: "Autor",
        file_type: "pdf"
      });
      setIsOfflineSaved(true);
    } catch (e) {
      console.error("Erro ao guardar offline:", e);
    }
  };

  // 4. Carregar PDF do próprio dispositivo
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setLoading(true);
    setError("");

    try {
      setBookTitle(file.name.replace(/\.[^/.]+$/, ""));
      setPdfSourceBlob(file);

      const buffer = await file.arrayBuffer();
      const doc = await pdfjsLib.getDocument({ data: new Uint8Array(buffer) }).promise;

      setPdfDoc(doc);
      setTotalPages(doc.numPages);
      setCurrentPage(1);

      // Guarda automaticamente no IndexedDB
      const localId = `local-${Date.now()}`;
      await saveBookOffline(localId, file, {
        title: file.name.replace(/\.[^/.]+$/, ""),
        author: "Ficheiro Local",
        totalPages: doc.numPages,
        file_type: "pdf"
      });
      setIsOfflineSaved(true);
    } catch (err: any) {
      console.error("Erro ao ler ficheiro local:", err);
      setError("Ficheiro inválido ou não suportado.");
    } finally {
      setLoading(false);
    }
  };

  // 5. Marcações (Bookmark)
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
        content: `Marcador na página ${currentPage}`,
        selectedText: "",
        pageNumber: currentPage,
        chapter: `Página ${currentPage}`,
        synced: false,
        createdAt: new Date().toISOString()
      };
      await saveAnnotationOffline(newBookmark);
      setAnnotations([...annotations, newBookmark]);
    }
  };

  // 6. Adicionar Nota
  const handleSaveNote = async () => {
    if (!noteContent.trim()) return;

    const newNote: OfflineAnnotation = {
      id: `note-${Date.now()}`,
      bookId,
      type: "note",
      content: noteContent.trim(),
      selectedText: "",
      pageNumber: currentPage,
      chapter: `Página ${currentPage}`,
      synced: false,
      createdAt: new Date().toISOString()
    };

    await saveAnnotationOffline(newNote);
    setAnnotations([...annotations, newNote]);
    setNoteContent("");
    setShowAddNoteModal(false);
  };

  // Classes de tema
  const themeClasses = {
    dark: "bg-black text-white",
    light: "bg-white text-black",
    sepia: "bg-[#fbf0d9] text-[#433422]"
  };

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
            <span className="text-[11px] text-gray-500 block">
              Página {currentPage} de {totalPages || 1}
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
              <span className="text-xs font-semibold uppercase tracking-wider text-gray-500">Zoom</span>
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

            {/* Carregar PDF do Teclado/Dispositivo */}
            <div className="pt-2 border-t border-gray-100 dark:border-gray-800 flex justify-between items-center">
              <span className="text-xs text-gray-500">Abrir outro PDF local</span>
              <label className="cursor-pointer inline-flex items-center gap-1.5 px-3 py-1.5 bg-black dark:bg-white text-white dark:text-black rounded-lg text-xs font-medium active:scale-95 transition-transform">
                <FileUp className="w-3.5 h-3.5" />
                <span>Escolher Ficheiro</span>
                <input type="file" accept="application/pdf" onChange={handleFileUpload} className="hidden" />
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
            <p className="text-xs text-gray-500">A carregar páginas do livro...</p>
          </div>
        )}

        {error && (
          <div className="p-6 max-w-sm text-center">
            <BookOpen className="w-12 h-12 mx-auto mb-3 text-red-500 opacity-80" />
            <h3 className="font-semibold text-base mb-1">Aviso de Leitura</h3>
            <p className="text-xs text-gray-500 mb-6">{error}</p>
            <label className="inline-flex items-center gap-2 px-4 py-2.5 bg-black dark:bg-white text-white dark:text-black rounded-xl text-xs font-semibold cursor-pointer">
              <FileUp className="w-4 h-4" />
              <span>Abrir um PDF do teu telemóvel</span>
              <input type="file" accept="application/pdf" onChange={handleFileUpload} className="hidden" />
            </label>
          </div>
        )}

        {/* Canvas de Renderização da Página */}
        <div className={`relative max-w-full overflow-auto shadow-2xl rounded-sm ${loading ? "opacity-0" : "opacity-100"} transition-opacity duration-300`}>
          <canvas ref={canvasRef} className="block max-w-full h-auto mx-auto" />
        </div>
      </main>

      {/* Barra Inferior com Progresso e Botões de Página */}
      <footer className="sticky bottom-0 w-full backdrop-blur-md bg-opacity-95 bg-white dark:bg-black border-t border-gray-200 dark:border-gray-800 px-6 py-3.5">
        <div className="max-w-md mx-auto">
          <div className="flex items-center justify-between mb-2">
            <button
              onClick={goToPrevPage}
              disabled={currentPage <= 1}
              className="flex items-center gap-1 text-xs font-semibold px-2.5 py-1 rounded hover:bg-gray-100 dark:hover:bg-gray-800 disabled:opacity-30 disabled:pointer-events-none transition-colors"
            >
              <ChevronLeft className="w-4 h-4" />
              <span>Anterior</span>
            </button>

            <span className="text-xs font-bold">
              {currentPage} / {totalPages || 1}
            </span>

            <button
              onClick={goToNextPage}
              disabled={currentPage >= totalPages}
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
              min={1}
              max={totalPages || 1}
              value={currentPage}
              onChange={(e) => setCurrentPage(Number(e.target.value))}
              className="flex-1 accent-black dark:accent-white h-1.5 bg-gray-200 dark:bg-gray-800 rounded-lg cursor-pointer"
            />
            <span className="text-[11px] text-gray-500 font-medium w-8 text-right">
              {Math.round((currentPage / (totalPages || 1)) * 100)}%
            </span>
          </div>
        </div>
      </footer>

      {/* Modal para Adicionar Anotação */}
      {showAddNoteModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-2xl max-w-sm w-full p-5 shadow-2xl animate-in zoom-in-95 duration-200 text-black dark:text-white">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-bold text-sm">Adicionar Nota (Pág. {currentPage})</h3>
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
                      setCurrentPage(a.pageNumber);
                      setShowAnnotationsDrawer(false);
                    }}
                    className="p-3 rounded-xl border border-gray-100 dark:border-gray-800 bg-gray-50 dark:bg-gray-800/60 hover:border-black dark:hover:border-white transition-colors cursor-pointer group"
                  >
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-[11px] font-bold uppercase tracking-wider text-gray-500">
                        {a.type === "bookmark" ? "Marcador" : "Nota"} • Pág. {a.pageNumber}
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
