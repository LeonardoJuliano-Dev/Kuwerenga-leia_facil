import { useState, useEffect, useRef, useCallback } from "react";
import { Link, useSearchParams } from "react-router-dom";
import {
  ArrowLeft,
  ArrowRight,
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
  Trash2,
  BookA,
  Copy,
  Check,
  Search,
  Highlighter
} from "lucide-react";
import * as pdfjsLib from "pdfjs-dist";
import "pdfjs-dist/web/pdf_viewer.css";
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
import { getTermDefinition, type DefinitionResult } from "../lib/dictionaryService";

import pdfWorker from "pdfjs-dist/build/pdf.worker.min.mjs?url";
pdfjsLib.GlobalWorkerOptions.workerSrc = pdfWorker;

// PDF de demonstração público de domínio aberto para testes imediatos
const SAMPLE_PDF_URL = "https://raw.githubusercontent.com/mozilla/pdf.js/ba2edeae/web/compressed.tracemonkey-pldi-09.pdf";

/**
 * Detecta e valida o formato real do ficheiro a partir dos bytes de cabeçalho
 */
async function detectBookFormat(blob: Blob): Promise<"pdf" | "epub" | "invalid"> {
  if (blob.type === "application/pdf") return "pdf";
  if (blob.type === "application/epub+zip") return "epub";

  try {
    const header = new Uint8Array(await blob.slice(0, 8).arrayBuffer());
    // PDF começa com %PDF (0x25 0x50 0x44 0x46)
    if (header[0] === 0x25 && header[1] === 0x50 && header[2] === 0x44 && header[3] === 0x46) {
      return "pdf";
    }
    // EPUB é um arquivo ZIP que começa com PK\x03\x04 (0x50 0x4B 0x03 0x04)
    if (header[0] === 0x50 && header[1] === 0x4B && header[2] === 0x03 && header[3] === 0x04) {
      return "epub";
    }
  } catch {}

  return "invalid";
}

/**
 * Determina o tema inicial de leitura:
 * Quando o sistema/aplicação se encontra em modo claro, abre por defeito no tema 'sepia' (conforto visual).
 * Caso esteja em modo escuro, abre em 'dark'.
 */
function getInitialReaderTheme(): "light" | "sepia" | "dark" {
  if (typeof window === "undefined") return "sepia";
  try {
    const isDark =
      document.documentElement.classList.contains("dark") ||
      document.body.classList.contains("dark") ||
      (window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches);

    return isDark ? "dark" : "sepia";
  } catch {
    return "sepia";
  }
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
  const [epubCurrentCfi, setEpubCurrentCfi] = useState<string>("");
  const [epubProgress, setEpubProgress] = useState(0);
  const [epubChapterTitle, setEpubChapterTitle] = useState("");

  // Estados de UI e Leitura
  const [scale, setScale] = useState(1.1);
  const [themeMode, setThemeMode] = useState<"light" | "sepia" | "dark">(getInitialReaderTheme);
  const [showSettings, setShowSettings] = useState(false);
  const [showAnnotationsDrawer, setShowAnnotationsDrawer] = useState(false);
  const [showAddNoteModal, setShowAddNoteModal] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [noteContent, setNoteContent] = useState("");
  const [annotations, setAnnotations] = useState<OfflineAnnotation[]>([]);

  const [windowDimensions, setWindowDimensions] = useState({
    w: typeof window !== "undefined" ? window.innerWidth : 1024,
    h: typeof window !== "undefined" ? window.innerHeight : 768
  });

  // Estados de Seleção de Texto e Menu Flutuante
  const [selectedText, setSelectedText] = useState("");
  const [selectedCfiRange, setSelectedCfiRange] = useState("");
  const [showColorPicker, setShowColorPicker] = useState(false);
  const [selectionPosition, setSelectionPosition] = useState<{ x: number; y: number } | null>(null);
  const [showFloatingMenu, setShowFloatingMenu] = useState(false);
  const [copiedFeedback, setCopiedFeedback] = useState(false);

  // Estados do Dicionário
  const [showDictionaryModal, setShowDictionaryModal] = useState(false);
  const [dictionaryQuery, setDictionaryQuery] = useState("");
  const [dictionaryLoading, setDictionaryLoading] = useState(false);
  const [dictionaryResult, setDictionaryResult] = useState<DefinitionResult | null>(null);
  const [dictionaryError, setDictionaryError] = useState<string | null>(null);

  // Estados para Saltar de Página
  const [showJumpPopover, setShowJumpPopover] = useState(false);
  const [jumpInputValue, setJumpInputValue] = useState("");

  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const textLayerRef = useRef<HTMLDivElement | null>(null);
  const pdfContainerRef = useRef<HTMLDivElement | null>(null);
  const [pdfDimensions, setPdfDimensions] = useState<{ w: number; h: number }>({ w: 0, h: 0 });
  const renderTaskRef = useRef<any>(null);
  const epubContainerRef = useRef<HTMLDivElement | null>(null);
  const epubRenditionRef = useRef<Rendition | null>(null);

  /** Aplica visualmente os realces guardados nos spans da camada de texto do PDF */
  const applyPdfHighlights = useCallback((container: HTMLDivElement, pageNum: number, currentAnnotations: OfflineAnnotation[]) => {
    const pageHighlights = currentAnnotations.filter(
      (a) => a.type === "highlight" && a.pageNumber === pageNum && a.content
    );
    if (pageHighlights.length === 0) return;

    const bgMap: Record<string, string> = {
      yellow: "rgba(254, 240, 138, 0.7)",
      green: "rgba(187, 247, 208, 0.7)",
      blue: "rgba(191, 219, 254, 0.7)",
      pink: "rgba(251, 207, 232, 0.7)",
    };

    const spans = Array.from(container.querySelectorAll("span"));
    if (spans.length === 0) return;

    for (const hl of pageHighlights) {
      const hlText = hl.content.trim().toLowerCase();
      if (!hlText) continue;
      const bg = bgMap[hl.color || "yellow"] || bgMap.yellow;

      for (const span of spans) {
        const text = span.textContent?.trim().toLowerCase();
        if (text && text.length > 1 && (hlText.includes(text) || text.includes(hlText))) {
          span.style.backgroundColor = bg;
          span.style.borderRadius = "2px";
        }
      }
    }
  }, []);

  // ─── Helpers ───────────────────────────────────────────────────

  /** Inicializa um livro EPUB a partir de Blob */
  const initEpub = useCallback(async (blob: Blob, title: string) => {
    try {
      const buffer = await blob.arrayBuffer();
      const book = ePub(buffer);
      setEpubBook(book);
      setFileType("epub");
      setBookTitle(title);
      setPdfSourceBlob(blob);

      // Timeout preventivo de 7s para os metadados
      await Promise.race([
        book.ready,
        new Promise((_, reject) => setTimeout(() => reject(new Error("Timeout ao processar metadados do EPUB")), 7000))
      ]);

      // Carrega anotações do livro
      getAnnotationsForBook(bookId).then(setAnnotations).catch(() => {});

      // Recupera progresso de leitura guardado
      getReadingProgress(bookId).then((savedProgress) => {
        if (savedProgress) {
          setCurrentPage(savedProgress.currentPage || 1);
          setEpubProgress(savedProgress.progress || 0);
        }
      }).catch(() => {});

      // Gera posições em segundo plano sem bloquear o leitor
      book.locations.generate(1000).then(() => {
        const count = book.locations.length();
        if (count > 0) setTotalPages(count);
      }).catch(() => {});
    } catch (err: any) {
      console.error("Erro ao inicializar EPUB:", err);
      throw new Error(err?.message || "Não foi possível ler o ficheiro EPUB.");
    }
  }, [bookId]);

  /** Inicializa um documento PDF a partir de Blob */
  const initPdf = useCallback(async (blob: Blob, title: string) => {
    try {
      const buffer = await blob.arrayBuffer();
      const loadingTask = pdfjsLib.getDocument({
        data: new Uint8Array(buffer),
        cMapUrl: "/pdfjs/cmaps/",
        cMapPacked: true,
        standardFontDataUrl: "/pdfjs/standard_fonts/",
        useSystemFonts: true,
      });
      const doc = await loadingTask.promise;

      setPdfDoc(doc);
      setFileType("pdf");
      setBookTitle(title);
      setPdfSourceBlob(blob);
      setTotalPages(doc.numPages);
      setCurrentPage(1);

      // Recupera progresso de leitura
      const savedProgress = await getReadingProgress(bookId);
      if (savedProgress && savedProgress.currentPage <= doc.numPages) {
        setCurrentPage(savedProgress.currentPage);
      }

      // Carrega anotações do livro
      const existingNotes = await getAnnotationsForBook(bookId);
      setAnnotations(existingNotes);
    } catch (err: any) {
      console.error("Erro ao inicializar PDF:", err);
      throw new Error(err?.message || "Não foi possível renderizar o PDF.");
    }
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
          const format = await detectBookFormat(offlineBlob);

          if (!isMounted) return;

          if (format === "epub") {
            await initEpub(offlineBlob, bookTitle);
          } else if (format === "pdf") {
            await initPdf(offlineBlob, bookTitle);
          } else {
            throw new Error("O ficheiro guardado localmente está corrompido.");
          }
        } else if (bookId !== "demo-book") {
          // Busca do Supabase
          const { data: bookRecord, error: fetchRecordErr } = await supabase
            .from("books")
            .select("title, file_url, file_type")
            .eq("id", bookId)
            .maybeSingle();

          if (fetchRecordErr) throw fetchRecordErr;
          if (!isMounted) return;

          if (bookRecord?.file_url) {
            const title = bookRecord.title || "Livro";
            let blob: Blob | null = null;

            // 1. Tenta fetch direto da URL
            try {
              const response = await fetch(bookRecord.file_url);
              if (response.ok) {
                const fetchedBlob = await response.blob();
                if (fetchedBlob.type !== "application/json") {
                  blob = fetchedBlob;
                }
              }
            } catch (fetchErr) {
              console.warn("Fetch direto falhou, a tentar via Supabase Storage:", fetchErr);
            }

            // 2. Fallback: Descarrega via Supabase Storage API
            if (!blob && bookRecord.file_url) {
              const urlParts = bookRecord.file_url.split("/books/");
              const storagePath = urlParts.length > 1 ? urlParts[1] : bookRecord.file_url.split("/").pop();
              if (storagePath) {
                const { data: downloadedBlob, error: dlErr } = await supabase.storage.from("books").download(storagePath);
                if (!dlErr && downloadedBlob && downloadedBlob.type !== "application/json") {
                  blob = downloadedBlob;
                }
              }
            }

            if (!blob) {
              throw new Error("O ficheiro deste livro não se encontra no armazenamento (Storage) do Supabase. Executa o script 'supabase/create_storage_buckets.sql' no Supabase SQL Editor para criar o bucket 'books'.");
            }

            // Valida cabeçalho real do ficheiro para evitar analisar respostas de erro JSON
            const format = await detectBookFormat(blob);
            if (format === "invalid") {
              const errorText = await blob.slice(0, 160).text();
              if (errorText.includes("NoSuchBucket") || errorText.includes("Bucket not found")) {
                throw new Error("O bucket 'books' ainda não existe no Supabase Storage. Executa o ficheiro 'supabase/create_storage_buckets.sql' no Dashboard do Supabase para ativar o armazenamento.");
              }
              throw new Error("O formato do ficheiro transferido não é um PDF ou EPUB válido.");
            }

            if (!isMounted) return;

            if (format === "epub") {
              await initEpub(blob, title);
              saveBookOffline(bookId, blob, {
                title,
                file_type: "epub"
              }).then(() => setIsOfflineSaved(true)).catch(() => {});
            } else {
              await initPdf(blob, title);
              saveBookOffline(bookId, blob, {
                title,
                file_type: "pdf"
              }).then(() => setIsOfflineSaved(true)).catch(() => {});
            }
          } else {
            if (isMounted) setError("Este livro não tem ficheiro associado.");
          }
        } else {
          // Fallback para o PDF de exemplo
          setBookTitle("Documento de Demonstração");
          const res = await fetch(SAMPLE_PDF_URL);
          const blob = await res.blob();

          if (!isMounted) return;
          await initPdf(blob, "Documento de Demonstração");
        }
      } catch (err: any) {
        console.error("Erro ao carregar livro:", err);
        if (isMounted) setError(err?.message || "Não foi possível carregar o livro.");
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

        // Limpa o canvas antes de renderizar
        context.clearRect(0, 0, canvas.width, canvas.height);

        const availW = windowDimensions.w;
        const availH = windowDimensions.h;
        const containerWidth = Math.min(availW - (availW < 640 ? 16 : 48), 960);
        const maxHeight = availH - (availW < 640 ? 120 : 160);
        const unscaledViewport = page.getViewport({ scale: 1 });
        const widthScale = (containerWidth / unscaledViewport.width) * scale;
        const heightScale = maxHeight > 0 ? (maxHeight / unscaledViewport.height) * scale : widthScale;
        // No telemóvel escala pela largura para manter as letras grandes e nítidas
        const autoScale = availW < 640 ? widthScale : Math.min(widthScale, heightScale);

        const pixelRatio = window.devicePixelRatio || 1;
        const viewport = page.getViewport({ scale: autoScale });
        const cssW = Math.floor(viewport.width);
        const cssH = Math.floor(viewport.height);

        setPdfDimensions({ w: cssW, h: cssH });

        canvas.width = Math.floor(viewport.width * pixelRatio);
        canvas.height = Math.floor(viewport.height * pixelRatio);
        canvas.style.width = `${cssW}px`;
        canvas.style.height = `${cssH}px`;

        const renderContext = {
          canvasContext: context,
          viewport,
          transform: pixelRatio !== 1 ? [pixelRatio, 0, 0, pixelRatio, 0, 0] : null,
        };
        const task = page.render(renderContext as any);
        renderTaskRef.current = task;
        await task.promise;

        // Renderizar camada de texto (TextLayer) para permitir seleção, dicionário e anotações
        if (textLayerRef.current) {
          const textLayerDiv = textLayerRef.current;
          textLayerDiv.innerHTML = "";
          textLayerDiv.style.width = `${cssW}px`;
          textLayerDiv.style.height = `${cssH}px`;

          try {
            pdfjsLib.setLayerDimensions(textLayerDiv, viewport);
          } catch {
            // Continua caso setLayerDimensions seja opcional
          }

          const textContent = await page.getTextContent();
          if (!isRendering) return;

          const textLayer = new pdfjsLib.TextLayer({
            textContentSource: textContent,
            container: textLayerDiv,
            viewport,
          });

          await textLayer.render();
          if (!isRendering) return;

          // Reaplicar visualmente os destaques guardados nesta página
          applyPdfHighlights(textLayerDiv, currentPage, annotations);
        }

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
  }, [pdfDoc, fileType, currentPage, scale, windowDimensions, annotations, applyPdfHighlights]);

  // ─── 2b. Montar Rendition EPUB ────────────────────────────────

  useEffect(() => {
    if (fileType !== "epub" || !epubBook || !epubContainerRef.current) return;

    // Limpa rendição anterior se existir
    if (epubRenditionRef.current) {
      try { epubRenditionRef.current.destroy(); } catch {}
    }

    const container = epubContainerRef.current;
    container.innerHTML = "";

    const rendition = epubBook.renderTo(container, {
      width: "100%",
      height: "100%",
      flow: "paginated",
      spread: "none",
    });

    // Registar temas de cor
    rendition.themes.register("dark", {
      body: { "background-color": "#000000 !important", "color": "#ffffff !important" }
    });
    rendition.themes.register("light", {
      body: { "background-color": "#ffffff !important", "color": "#000000 !important" }
    });
    rendition.themes.register("sepia", {
      body: { "background-color": "#fbf0d9 !important", "color": "#433422 !important" }
    });
    rendition.themes.select(themeMode);
    rendition.themes.fontSize(`${Math.round(scale * 100)}%`);

    // Injetar regras de estilo que garantem visibilidade perfeita de qualquer EPUB
    rendition.hooks.content.register((contents: any) => {
      const isDark = themeMode === "dark";
      const isSepia = themeMode === "sepia";
      const textColor = isDark ? "#ffffff" : isSepia ? "#433422" : "#000000";
      const bgColor = isDark ? "#000000" : isSepia ? "#fbf0d9" : "#ffffff";

      contents.addStylesheetRules({
        "body": {
          "color": `${textColor} !important`,
          "background-color": `${bgColor} !important`,
          "padding": "16px 20px !important",
          "font-family": "Inter, system-ui, -apple-system, sans-serif !important",
          "line-height": "1.75 !important",
        },
        "p, div, span, li": {
          "color": "inherit !important",
          "line-height": "1.75 !important",
        },
        "h1, h2, h3, h4, h5, h6": {
          "color": "inherit !important",
          "margin-bottom": "0.75em !important",
        },
        "img, svg": {
          "max-width": "100% !important",
          "height": "auto !important",
          "display": "block !important",
          "margin": "1rem auto !important",
        },
        ".highlight-yellow": {
          "background-color": "rgba(254, 240, 138, 0.7) !important",
          "color": "inherit !important",
          "border-radius": "3px !important",
          "padding": "0 2px !important"
        },
        ".highlight-green": {
          "background-color": "rgba(187, 247, 208, 0.7) !important",
          "color": "inherit !important",
          "border-radius": "3px !important",
          "padding": "0 2px !important"
        },
        ".highlight-blue": {
          "background-color": "rgba(191, 219, 254, 0.7) !important",
          "color": "inherit !important",
          "border-radius": "3px !important",
          "padding": "0 2px !important"
        },
        ".highlight-pink": {
          "background-color": "rgba(251, 207, 232, 0.7) !important",
          "color": "inherit !important",
          "border-radius": "3px !important",
          "padding": "0 2px !important"
        }
      });

      // Captura de teclado dentro do iframe
      contents.document?.addEventListener("keydown", (e: KeyboardEvent) => {
        if (e.key === "ArrowRight" || e.key === "PageDown" || e.key === " ") {
          e.preventDefault();
          rendition.next();
        } else if (e.key === "ArrowLeft" || e.key === "PageUp") {
          e.preventDefault();
          rendition.prev();
        }
      });

      // Gesto natural de Swipe horizontal para virar página (sem interferir em toques/seleção)
      let touchStartX = 0;
      let touchStartY = 0;
      let touchStartTime = 0;

      contents.document?.addEventListener("touchstart", (e: TouchEvent) => {
        const touch = e.changedTouches[0];
        touchStartX = touch.clientX;
        touchStartY = touch.clientY;
        touchStartTime = Date.now();
      }, { passive: true });

      contents.document?.addEventListener("touchend", (e: TouchEvent) => {
        const touch = e.changedTouches[0];
        const deltaX = touch.clientX - touchStartX;
        const deltaY = touch.clientY - touchStartY;
        const deltaTime = Date.now() - touchStartTime;

        // Se houver texto selecionado, não vira a página
        const sel = contents.window.getSelection();
        if (sel && sel.toString().trim().length > 0) return;

        // Swipe horizontal intencional (> 65px de arrasto e < 500ms)
        if (Math.abs(deltaX) > 65 && Math.abs(deltaY) < 45 && deltaTime < 500) {
          if (deltaX < 0) {
            setShowFloatingMenu(false);
            rendition.next();
          } else {
            setShowFloatingMenu(false);
            rendition.prev();
          }
        }
      }, { passive: true });

      // Captura de seleção de texto dentro do EPUB para Dicionário e Pintura
      const triggerEpubSelection = () => {
        setTimeout(() => {
          const sel = contents.window.getSelection();
          const text = sel?.toString()?.trim();
          if (text && text.length > 0) {
            try {
              const range = sel.getRangeAt(0);
              const rect = range.getBoundingClientRect();
              const iframe = container.querySelector("iframe");
              const iframeRect = iframe?.getBoundingClientRect() || container.getBoundingClientRect();
              setSelectedText(text);
              setShowColorPicker(false);
              const centerX = iframeRect.left + rect.left + rect.width / 2;
              const topY = iframeRect.top + rect.top;
              setSelectionPosition({
                x: Math.min(window.innerWidth - 120, Math.max(120, centerX)),
                y: Math.max(70, topY)
              });
              setShowFloatingMenu(true);
            } catch {}
          } else {
            setShowFloatingMenu(false);
            setShowColorPicker(false);
          }
        }, 100);
      };

      contents.document?.addEventListener("mouseup", triggerEpubSelection);
      contents.document?.addEventListener("touchend", triggerEpubSelection);
      contents.document?.addEventListener("dblclick", triggerEpubSelection);

      // Suprimir menu de contexto nativo redundante do sistema quando há seleção
      contents.document?.addEventListener("contextmenu", (e: MouseEvent) => {
        const sel = contents.window.getSelection();
        if (sel?.toString()?.trim()) {
          e.preventDefault();
        }
      });
    });

    epubRenditionRef.current = rendition;

    // Navegar para localização guardada ou início
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

      let pct = 0;
      if (epubBook.locations && epubBook.locations.length() > 0) {
        const progress = epubBook.locations.percentageFromCfi(cfi);
        pct = Math.round((progress || 0) * 100);
      }
      setEpubProgress(pct);

      let locNum = 1;
      if (epubBook.locations && epubBook.locations.length() > 0) {
        const loc = epubBook.locations.locationFromCfi(cfi);
        locNum = typeof loc === "number" ? loc + 1 : 1;
      }
      setCurrentPage(locNum);

      const tocItem = epubBook.navigation?.toc?.find((t: any) => {
        return t.href && cfi.includes?.(t.href);
      });
      setEpubChapterTitle(tocItem?.label || "");

      saveReadingProgress({
        bookId,
        currentPage: locNum,
        currentChapter: tocItem?.label || `Posição ${locNum}`,
        progress: pct,
        lastReadAt: new Date().toISOString(),
        synced: false,
      });

      // Reaplicar highlights guardados após mudança de página
      annotations.filter(a => a.type === "highlight" && a.cfiRange).forEach((hl) => {
        try {
          rendition.annotations.highlight(
            hl.cfiRange!,
            {},
            () => {},
            `highlight-${hl.color || "yellow"}`
          );
        } catch {}
      });
    });

    // Captura nativa de seleção do epubjs com cfiRange para realces e dicionário
    rendition.on("selected", (cfiRange: string, contents: any) => {
      setSelectedCfiRange(cfiRange);
      try {
        const range = rendition.getRange(cfiRange);
        const text = range?.toString()?.trim() || contents?.window?.getSelection()?.toString()?.trim() || "";
        if (text) {
          setSelectedText(text);
          setShowColorPicker(false);
          setShowFloatingMenu(true);
        }
      } catch {}
    });

    return () => {
      try { rendition.destroy(); } catch {}
      epubRenditionRef.current = null;
    };
  }, [epubBook, fileType]);

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
      try {
        const isDark = themeMode === "dark";
        const isSepia = themeMode === "sepia";
        const textColor = isDark ? "#ffffff" : isSepia ? "#433422" : "#000000";
        const bgColor = isDark ? "#000000" : isSepia ? "#fbf0d9" : "#ffffff";
        const iframes = epubContainerRef.current?.querySelectorAll("iframe");
        iframes?.forEach((iframe) => {
          const doc = iframe.contentDocument;
          if (doc && doc.body) {
            doc.body.style.backgroundColor = bgColor;
            doc.body.style.color = textColor;
          }
        });
      } catch {}
    }
  }, [themeMode, fileType]);

  // Navegação por teclado global
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "ArrowRight" || e.key === "PageDown") {
        goToNextPage();
      } else if (e.key === "ArrowLeft" || e.key === "PageUp") {
        goToPrevPage();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [fileType, currentPage, totalPages]);

  // Redimensionamento de ecrã (responsividade desktop e mobile)
  useEffect(() => {
    let timer: any;
    const handleResize = () => {
      clearTimeout(timer);
      timer = setTimeout(() => {
        setWindowDimensions({ w: window.innerWidth, h: window.innerHeight });
        if (fileType === "epub" && epubRenditionRef.current && epubContainerRef.current) {
          const w = epubContainerRef.current.clientWidth;
          const h = epubContainerRef.current.clientHeight;
          if (w > 0 && h > 0) {
            epubRenditionRef.current.resize(w, h);
          }
        }
      }, 150);
    };
    window.addEventListener("resize", handleResize);
    return () => {
      clearTimeout(timer);
      window.removeEventListener("resize", handleResize);
    };
  }, [fileType]);

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

  /** Salta diretamente para uma página / posição específica */
  const handleJumpSubmit = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const val = parseInt(jumpInputValue.trim(), 10);
    if (isNaN(val)) {
      setShowJumpPopover(false);
      return;
    }

    if (fileType === "pdf") {
      const target = Math.max(1, Math.min(totalPages || 1, val));
      setCurrentPage(target);
      setShowJumpPopover(false);
      window.scrollTo({ top: 0, behavior: "smooth" });
    } else if (fileType === "epub" && epubBook && epubRenditionRef.current) {
      if (totalPages > 0 && epubBook.locations && epubBook.locations.length() > 0) {
        const targetLoc = Math.max(1, Math.min(totalPages, val));
        const cfi = epubBook.locations.cfiFromLocation(targetLoc - 1);
        if (cfi) {
          epubRenditionRef.current.display(cfi);
          setShowJumpPopover(false);
          return;
        }
      }
      // Fallback por percentagem (0 a 100%)
      const targetPct = Math.max(0, Math.min(100, val));
      const cfi = epubBook.locations.cfiFromPercentage(targetPct / 100);
      if (cfi) {
        epubRenditionRef.current.display(cfi);
      }
      setShowJumpPopover(false);
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
      const format = await detectBookFormat(file);

      if (format === "epub" || file.name.toLowerCase().endsWith(".epub")) {
        await initEpub(file, title);

        // Guarda automaticamente no IndexedDB
        const localId = `local-${Date.now()}`;
        await saveBookOffline(localId, file, {
          title,
          author: "Ficheiro Local",
          file_type: "epub"
        });
        setIsOfflineSaved(true);
      } else if (format === "pdf" || file.name.toLowerCase().endsWith(".pdf")) {
        await initPdf(file, title);

        const localId = `local-${Date.now()}`;
        await saveBookOffline(localId, file, {
          title,
          author: "Ficheiro Local",
          totalPages: totalPages || 1,
          file_type: "pdf"
        });
        setIsOfflineSaved(true);
      } else {
        throw new Error("Formato não suportado. Por favor, seleciona um ficheiro PDF ou EPUB válido.");
      }
    } catch (err: any) {
      console.error("Erro ao ler ficheiro local:", err);
      setError(err?.message || "Ficheiro inválido ou não suportado.");
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

  // ─── Dicionário e Seleção de Texto (PDF e Documento) ─────────

  useEffect(() => {
    const handleSelection = (e?: Event) => {
      const target = e?.target as HTMLElement | null;
      if (
        target?.closest?.("[data-floating-menu]") ||
        target?.closest?.("[role='dialog']") ||
        target?.closest?.("button") ||
        target?.closest?.("input") ||
        target?.closest?.("textarea")
      ) {
        return;
      }

      setTimeout(() => {
        const selection = window.getSelection();
        const text = selection?.toString()?.trim();

        if (selection && selection.rangeCount > 0 && text && text.length > 0) {
          if (
            document.activeElement?.tagName === "INPUT" ||
            document.activeElement?.tagName === "TEXTAREA"
          ) {
            return;
          }

          try {
            const range = selection.getRangeAt(0);
            const rect = range.getBoundingClientRect();
            if (rect.width > 0 || rect.height > 0) {
              setSelectedText(text);
              setSelectedCfiRange(""); // Reset para PDF
              setShowColorPicker(false);
              const posX = rect.left + rect.width / 2;
              const posY = rect.top;
              setSelectionPosition({
                x: Math.min(window.innerWidth - 120, Math.max(120, posX)),
                y: Math.max(70, posY)
              });
              setShowFloatingMenu(true);
            }
          } catch {}
        } else {
          setShowFloatingMenu(false);
          setShowColorPicker(false);
        }
      }, 80);
    };

    window.addEventListener("mouseup", handleSelection);
    window.addEventListener("touchend", handleSelection);
    window.addEventListener("dblclick", handleSelection);
    window.addEventListener("keyup", handleSelection);

    return () => {
      window.removeEventListener("mouseup", handleSelection);
      window.removeEventListener("touchend", handleSelection);
      window.removeEventListener("dblclick", handleSelection);
      window.removeEventListener("keyup", handleSelection);
    };
  }, []);

  const handleLookupDefinition = async (textToSearch?: string) => {
    const raw = textToSearch || selectedText;
    const term = raw.trim();
    if (!term) return;

    setShowFloatingMenu(false);
    setShowDictionaryModal(true);
    setDictionaryQuery(term);
    setDictionaryLoading(true);
    setDictionaryError(null);
    setDictionaryResult(null);

    try {
      const res = await getTermDefinition(term);
      setDictionaryResult(res);
    } catch (err: any) {
      setDictionaryError(err?.message || "Não foi possível encontrar uma definição para este termo.");
    } finally {
      setDictionaryLoading(false);
    }
  };

  const handleCopySelectedText = async () => {
    if (!selectedText) return;
    try {
      await navigator.clipboard.writeText(selectedText);
      setCopiedFeedback(true);
      setTimeout(() => {
        setCopiedFeedback(false);
        setShowFloatingMenu(false);
      }, 1200);
    } catch {
      setShowFloatingMenu(false);
    }
  };

  const handleCreateNoteFromSelection = () => {
    setShowFloatingMenu(false);
    setNoteContent(`"${selectedText}"\n\n`);
    setShowAddNoteModal(true);
  };

  const handleHighlightSelection = async (color: "yellow" | "green" | "blue" | "pink") => {
    if (!selectedText.trim()) return;

    if (fileType === "epub" && epubRenditionRef.current && selectedCfiRange) {
      try {
        epubRenditionRef.current.annotations.highlight(
          selectedCfiRange,
          {},
          () => {},
          `highlight-${color}`
        );
      } catch (err) {
        console.warn("Erro ao destacar no EPUB:", err);
      }
    } else if (fileType === "pdf" && textLayerRef.current) {
      // Destacar visualmente no textLayer do PDF
      const sel = window.getSelection();
      if (sel && sel.rangeCount > 0) {
        try {
          const range = sel.getRangeAt(0);
          const spans = textLayerRef.current.querySelectorAll("span");
          const bgMap: Record<string, string> = {
            yellow: "rgba(254, 240, 138, 0.7)",
            green: "rgba(187, 247, 208, 0.7)",
            blue: "rgba(191, 219, 254, 0.7)",
            pink: "rgba(251, 207, 232, 0.7)",
          };
          const bg = bgMap[color] || bgMap.yellow;
          spans.forEach((span) => {
            if (range.intersectsNode(span)) {
              span.style.backgroundColor = bg;
              span.style.borderRadius = "2px";
            }
          });
        } catch {}
      }
    }

    const newHighlight: OfflineAnnotation = {
      id: `hl-${Date.now()}`,
      bookId,
      type: "highlight",
      content: selectedText.trim(),
      selectedText: selectedText.trim(),
      pageNumber: currentPage,
      chapter: fileType === "epub"
        ? (epubChapterTitle || `Posição ${currentPage}`)
        : `Página ${currentPage}`,
      cfiRange: selectedCfiRange,
      color,
      synced: false,
      createdAt: new Date().toISOString()
    };

    await saveAnnotationOffline(newHighlight);
    setAnnotations((prev) => [...prev, newHighlight]);
    setShowFloatingMenu(false);
    setShowColorPicker(false);
  };

  const handleSaveDefinitionAsNote = async () => {
    if (!dictionaryResult) return;

    const mainDef = dictionaryResult.definitions[0] || "";
    const noteText = `[Dicionário] ${dictionaryResult.term}${
      dictionaryResult.grammaticalClass ? ` (${dictionaryResult.grammaticalClass})` : ""
    }: ${mainDef}`;

    const newNote: OfflineAnnotation = {
      id: `dict-note-${Date.now()}`,
      bookId,
      type: "note",
      content: noteText,
      selectedText: dictionaryResult.term,
      pageNumber: currentPage,
      chapter: fileType === "epub"
        ? (epubChapterTitle || `Posição ${currentPage}`)
        : `Página ${currentPage}`,
      synced: false,
      createdAt: new Date().toISOString()
    };

    await saveAnnotationOffline(newNote);
    setAnnotations((prev) => [...prev, newNote]);
    setShowDictionaryModal(false);
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
      <header className={`px-3 sm:px-4 py-2 sm:py-3 flex items-center justify-between sticky top-0 backdrop-blur-md z-20 transition-colors ${
        themeMode === "sepia"
          ? "border-b border-[#dfceaa] bg-[#fbf0d9]/95 text-[#433422]"
          : "border-b border-gray-200 dark:border-gray-800 bg-white/90 dark:bg-black/90"
      }`}>
        <div className="flex items-center gap-2 sm:gap-3 min-w-0 flex-1 mr-2">
          <Link
            to="/home"
            className={`p-1.5 sm:p-2 -ml-1 sm:-ml-2 rounded-full transition-colors shrink-0 ${
              themeMode === "sepia"
                ? "hover:bg-[#433422]/10 text-[#433422]"
                : "hover:bg-gray-100 dark:hover:bg-gray-800 text-inherit"
            }`}
          >
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <div className="min-w-0 flex-1">
            <h1 className="font-semibold text-xs sm:text-sm truncate">{bookTitle}</h1>
            <span className={`text-[10px] sm:text-[11px] block truncate ${themeMode === "sepia" ? "text-[#7a6449]" : "text-gray-500"}`}>
              {pageLabel}
            </span>
          </div>
        </div>

        <div className="flex items-center gap-1 sm:gap-2 shrink-0">
          {/* Botão de Guardar Offline */}
          <button
            onClick={handleDownloadOffline}
            disabled={isOfflineSaved}
            className={`p-1.5 sm:p-2 rounded-full transition-colors ${
              isOfflineSaved
                ? "text-emerald-500 cursor-default"
                : themeMode === "sepia"
                ? "text-[#7a6449] hover:bg-[#433422]/10 hover:text-[#433422]"
                : "text-gray-500 hover:text-black dark:hover:text-white hover:bg-gray-100 dark:hover:bg-gray-800"
            }`}
            title={isOfflineSaved ? "Livro guardado para ler sem internet" : "Guardar offline"}
          >
            {isOfflineSaved ? <CheckCircle className="w-4.5 h-4.5 sm:w-5 sm:h-5" /> : <Download className="w-4.5 h-4.5 sm:w-5 sm:h-5" />}
          </button>

          {/* Marcador de Página */}
          <button
            onClick={toggleBookmark}
            className={`p-1.5 sm:p-2 rounded-full transition-colors ${
              themeMode === "sepia"
                ? "hover:bg-[#433422]/10"
                : "hover:bg-gray-100 dark:hover:bg-gray-800"
            }`}
            title="Marcar página"
          >
            {isCurrentPageBookmarked ? (
              <BookmarkCheck className={`w-4.5 h-4.5 sm:w-5 sm:h-5 fill-current ${themeMode === "sepia" ? "text-[#433422]" : "text-black dark:text-white"}`} />
            ) : (
              <Bookmark className={`w-4.5 h-4.5 sm:w-5 sm:h-5 ${themeMode === "sepia" ? "text-[#7a6449]" : "text-gray-500"}`} />
            )}
          </button>

          {/* Botão de Anotações (visível a partir de ecrãs de ~380px) */}
          <button
            onClick={() => setShowAddNoteModal(true)}
            className={`hidden min-[400px]:flex p-1.5 sm:p-2 rounded-full transition-colors ${
              themeMode === "sepia"
                ? "hover:bg-[#433422]/10 text-[#7a6449] hover:text-[#433422]"
                : "hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-500 hover:text-black dark:hover:text-white"
            }`}
            title="Adicionar nota"
          >
            <MessageSquarePlus className="w-4.5 h-4.5 sm:w-5 sm:h-5" />
          </button>

          {/* Lista de Anotações / Marcadores */}
          <button
            onClick={() => setShowAnnotationsDrawer(true)}
            className={`p-1.5 sm:p-2 rounded-full transition-colors ${
              themeMode === "sepia"
                ? "hover:bg-[#433422]/10 text-[#7a6449] hover:text-[#433422]"
                : "hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-500 hover:text-black dark:hover:text-white"
            }`}
            title="Ver anotações"
          >
            <List className="w-4.5 h-4.5 sm:w-5 sm:h-5" />
          </button>

          {/* Dicionário de Língua Portuguesa */}
          <button
            onClick={() => {
              setShowDictionaryModal(true);
              if (selectedText.trim()) {
                handleLookupDefinition(selectedText);
              }
            }}
            className={`p-1.5 sm:p-2 rounded-full transition-colors ${
              themeMode === "sepia"
                ? "hover:bg-[#433422]/10 text-[#7a6449] hover:text-[#433422]"
                : "hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-500 hover:text-black dark:hover:text-white"
            }`}
            title="Dicionário e Definições"
          >
            <BookA className="w-4.5 h-4.5 sm:w-5 sm:h-5" />
          </button>

          {/* Preferências / Configurações */}
          <button
            onClick={() => setShowSettings(!showSettings)}
            className={`p-1.5 sm:p-2 rounded-full transition-colors ${
              themeMode === "sepia"
                ? "hover:bg-[#433422]/10 text-[#7a6449] hover:text-[#433422]"
                : "hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-500 hover:text-black dark:hover:text-white"
            }`}
            title="Definições"
          >
            <Settings2 className="w-4.5 h-4.5 sm:w-5 sm:h-5" />
          </button>

          {/* Fullscreen Toggle (desktop e tablets) */}
          <button
            onClick={toggleFullscreen}
            className="hidden sm:flex p-1.5 sm:p-2 rounded-full hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors text-gray-500 hover:text-black dark:hover:text-white"
            title={isFullscreen ? "Sair do modo tela cheia" : "Entrar no modo tela cheia"}
          >
            {isFullscreen ? <X className="w-4.5 h-4.5 sm:w-5 sm:h-5" /> : <BookOpen className="w-4.5 h-4.5 sm:w-5 sm:h-5" />}
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
      <main className="flex-1 w-full flex flex-col items-center justify-center p-1 sm:p-4 pb-16 sm:pb-20 relative min-h-[60vh]">
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

        {/* Botões Flutuantes Laterais de Navegação (Desktop) */}
        <button
          onClick={goToPrevPage}
          disabled={fileType === "pdf" && currentPage <= 1}
          className="hidden md:flex absolute left-4 lg:left-8 top-1/2 -translate-y-1/2 w-12 h-12 rounded-full bg-white/80 dark:bg-gray-900/80 hover:bg-black hover:text-white dark:hover:bg-white dark:hover:text-black backdrop-blur-md items-center justify-center shadow-lg border border-gray-200 dark:border-gray-800 disabled:opacity-20 disabled:pointer-events-none transition-all z-20 group"
          title="Página Anterior (Seta Esquerda ou clique à esquerda)"
        >
          <ChevronLeft className="w-6 h-6 group-hover:-translate-x-0.5 transition-transform" />
        </button>

        <button
          onClick={goToNextPage}
          disabled={fileType === "pdf" && currentPage >= totalPages}
          className="hidden md:flex absolute right-4 lg:right-8 top-1/2 -translate-y-1/2 w-12 h-12 rounded-full bg-white/80 dark:bg-gray-900/80 hover:bg-black hover:text-white dark:hover:bg-white dark:hover:text-black backdrop-blur-md items-center justify-center shadow-lg border border-gray-200 dark:border-gray-800 disabled:opacity-20 disabled:pointer-events-none transition-all z-20 group"
          title="Página Seguinte (Seta Direita ou clique à direita)"
        >
          <ChevronRight className="w-6 h-6 group-hover:translate-x-0.5 transition-transform" />
        </button>

        {/* PDF: Canvas de Renderização e TextLayer sobreposta para seleção de texto */}
        {fileType === "pdf" && (
          <div
            ref={pdfContainerRef}
            className={`relative max-w-full overflow-auto shadow-2xl rounded-sm select-text ${loading ? "opacity-0" : "opacity-100"} transition-opacity duration-300`}
            style={{
              width: pdfDimensions.w ? `${pdfDimensions.w}px` : undefined,
              height: pdfDimensions.h ? `${pdfDimensions.h}px` : undefined,
            }}
          >
            <canvas
              ref={canvasRef}
              className="block pointer-events-none transition-all"
              style={{
                width: pdfDimensions.w ? `${pdfDimensions.w}px` : undefined,
                height: pdfDimensions.h ? `${pdfDimensions.h}px` : undefined,
                filter:
                  themeMode === "sepia"
                    ? "sepia(0.25) contrast(0.96)"
                    : undefined,
              }}
            />
            <div
              ref={textLayerRef}
              className="textLayer absolute inset-0 select-text pointer-events-auto"
              style={{
                width: pdfDimensions.w ? `${pdfDimensions.w}px` : undefined,
                height: pdfDimensions.h ? `${pdfDimensions.h}px` : undefined,
              }}
            />
          </div>
        )}

        {/* EPUB: Container de Renderização */}
        {fileType === "epub" && (
          <div
            ref={epubContainerRef}
            className={`w-full max-w-4xl mx-auto rounded-lg sm:rounded-xl overflow-hidden relative shadow-sm ${loading ? "opacity-0" : "opacity-100"} transition-opacity duration-300`}
            style={{ height: "calc(100vh - 120px)", minHeight: "360px" }}
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

      {/* Rodapé Flutuante Compacto para Mudança de Página */}
      <footer className="fixed bottom-4 sm:bottom-6 left-1/2 -translate-x-1/2 z-30 pointer-events-auto">
        {/* Balão Flutuante para Saltar de Página */}
        {showJumpPopover && (
          <>
            <div
              className="fixed inset-0 z-20"
              onClick={() => setShowJumpPopover(false)}
            />
            <div
              className={`absolute bottom-full mb-3 left-1/2 -translate-x-1/2 z-30 p-3 rounded-2xl shadow-2xl backdrop-blur-xl border animate-in zoom-in-95 duration-150 min-w-[210px] sm:min-w-[230px] ${
                themeMode === "sepia"
                  ? "bg-[#fbf0d9] text-[#433422] border-[#dfceaa] shadow-[#433422]/15"
                  : "bg-white/95 dark:bg-gray-900/95 text-black dark:text-white border-gray-200 dark:border-gray-800 shadow-xl"
              }`}
            >
              <div className="flex items-center justify-between mb-2">
                <span className="text-[11px] font-bold tracking-tight uppercase opacity-75">
                  {fileType === "epub" && totalPages === 0 ? "Ir para o Progresso" : "Saltar para Página"}
                </span>
                <button
                  type="button"
                  onClick={() => setShowJumpPopover(false)}
                  className="p-1 rounded-full hover:bg-black/10 dark:hover:bg-white/10 opacity-60 hover:opacity-100 transition-opacity"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>

              <form onSubmit={handleJumpSubmit} className="flex items-center gap-1.5">
                <input
                  type="number"
                  min={1}
                  max={fileType === "pdf" ? (totalPages || 1) : (totalPages > 0 ? totalPages : 100)}
                  value={jumpInputValue}
                  onChange={(e) => setJumpInputValue(e.target.value)}
                  placeholder={fileType === "epub" && totalPages === 0 ? "0 - 100" : `1 - ${totalPages || 1}`}
                  autoFocus
                  className={`flex-1 min-w-0 px-2.5 py-1.5 text-xs font-semibold rounded-xl border focus:outline-none focus:ring-2 text-center transition-all ${
                    themeMode === "sepia"
                      ? "bg-[#f5e7c8] border-[#dfceaa] text-[#433422] focus:ring-[#433422]"
                      : "bg-gray-50 dark:bg-gray-800 border-gray-200 dark:border-gray-700 text-black dark:text-white focus:ring-black dark:focus:ring-white"
                  }`}
                />
                <button
                  type="submit"
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold active:scale-95 transition-transform flex items-center gap-1 shrink-0 ${
                    themeMode === "sepia"
                      ? "bg-[#433422] text-[#fbf0d9]"
                      : "bg-black dark:bg-white text-white dark:text-black"
                  }`}
                >
                  <span>Ir</span>
                  <ArrowRight className="w-3 h-3 stroke-[2.5]" />
                </button>
              </form>

              <div className="mt-1.5 text-[10px] opacity-60 text-center font-medium">
                {fileType === "pdf"
                  ? `Total: ${totalPages || 1} páginas`
                  : totalPages > 0
                  ? `Posição 1 de ${totalPages}`
                  : "Insira de 0% a 100%"}
              </div>
            </div>
          </>
        )}

        <div
          className={`flex items-center gap-2 sm:gap-3 px-3 py-1.5 rounded-full backdrop-blur-md shadow-xl border transition-all select-none ${
            themeMode === "sepia"
              ? "bg-[#f5e7c8]/95 text-[#433422] border-[#dfceaa] shadow-[#433422]/10"
              : "bg-white/90 dark:bg-gray-900/90 text-black dark:text-white border-gray-200/80 dark:border-gray-800/80 shadow-black/10 dark:shadow-white/5"
          }`}
        >
          <button
            onClick={goToPrevPage}
            disabled={fileType === "pdf" && currentPage <= 1}
            className={`w-8 h-8 rounded-full flex items-center justify-center disabled:opacity-20 disabled:pointer-events-none active:scale-95 transition-all ${
              themeMode === "sepia"
                ? "hover:bg-[#433422]/10"
                : "hover:bg-black/10 dark:hover:bg-white/10"
            }`}
            title="Página Anterior"
            aria-label="Página Anterior"
          >
            <ChevronLeft className="w-5 h-5 stroke-[2.2]" />
          </button>

          {/* Botão de Contagem Centralizada Clicável */}
          <button
            onClick={() => {
              setJumpInputValue(
                fileType === "pdf"
                  ? String(currentPage)
                  : totalPages > 0
                  ? String(currentPage)
                  : String(epubProgress)
              );
              setShowJumpPopover(!showJumpPopover);
            }}
            className={`text-xs font-bold tracking-tight px-2.5 py-1 rounded-full min-w-[56px] text-center whitespace-nowrap transition-all active:scale-95 ${
              themeMode === "sepia"
                ? "hover:bg-[#433422]/10 text-[#433422]"
                : "hover:bg-black/10 dark:hover:bg-white/10"
            } ${showJumpPopover ? "ring-2 ring-current" : ""}`}
            title="Tocar para saltar para uma página específica"
            aria-label="Saltar para uma página específica"
          >
            {fileType === "epub"
              ? `${epubProgress}%`
              : `${currentPage} / ${totalPages || 1}`
            }
          </button>

          <button
            onClick={goToNextPage}
            disabled={fileType === "pdf" && currentPage >= totalPages}
            className={`w-8 h-8 rounded-full flex items-center justify-center disabled:opacity-20 disabled:pointer-events-none active:scale-95 transition-all ${
              themeMode === "sepia"
                ? "hover:bg-[#433422]/10"
                : "hover:bg-black/10 dark:hover:bg-white/10"
            }`}
            title="Página Seguinte"
            aria-label="Página Seguinte"
          >
            <ChevronRight className="w-5 h-5 stroke-[2.2]" />
          </button>
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
                      <span className="text-[11px] font-bold uppercase tracking-wider text-gray-500 flex items-center gap-1.5">
                        {a.type === "highlight" ? (
                          <>
                            <span
                              className={`w-2 h-2 rounded-full inline-block ${
                                a.color === "green"
                                  ? "bg-emerald-400"
                                  : a.color === "blue"
                                  ? "bg-blue-400"
                                  : a.color === "pink"
                                  ? "bg-pink-400"
                                  : "bg-yellow-400"
                              }`}
                            />
                            <span>Destaque</span>
                          </>
                        ) : a.type === "bookmark" ? (
                          "Marcador"
                        ) : (
                          "Nota"
                        )} • {a.chapter || `Pág. ${a.pageNumber}`}
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
                    <p className={`text-xs leading-relaxed line-clamp-3 ${
                      a.type === "highlight"
                        ? a.color === "green"
                          ? "bg-emerald-100/60 dark:bg-emerald-950/40 text-emerald-900 dark:text-emerald-200 px-1.5 py-0.5 rounded"
                          : a.color === "blue"
                          ? "bg-blue-100/60 dark:bg-blue-950/40 text-blue-900 dark:text-blue-200 px-1.5 py-0.5 rounded"
                          : a.color === "pink"
                          ? "bg-pink-100/60 dark:bg-pink-950/40 text-pink-900 dark:text-pink-200 px-1.5 py-0.5 rounded"
                          : "bg-yellow-100/60 dark:bg-yellow-950/40 text-yellow-900 dark:text-yellow-200 px-1.5 py-0.5 rounded"
                        : "text-gray-700 dark:text-gray-300"
                    }`}>
                      {a.content}
                    </p>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}

      {/* ─── Menu Contextual de Seleção (Mobile: Barra Inferior Ancorada / Desktop: Tooltip Flutuante) ─── */}
      {showFloatingMenu && (
        <>
          {/* Versão Mobile (Dock inferior confortável, evitando sobreposição com o menu do sistema operativo) */}
          <div
            data-floating-menu
            onMouseDown={(e) => e.stopPropagation()}
            onTouchStart={(e) => e.stopPropagation()}
            className="sm:hidden fixed bottom-20 left-3 right-3 max-w-sm mx-auto z-40 bg-white/95 dark:bg-gray-900/95 text-black dark:text-white backdrop-blur-xl rounded-2xl p-2 shadow-2xl flex items-center justify-between border border-gray-200 dark:border-gray-800 animate-in slide-in-from-bottom-4 duration-200 select-none"
          >
            <div className="min-w-0 flex-1 mr-2 pl-1">
              <span className="text-[11px] font-medium text-gray-500 dark:text-gray-400 truncate block">
                "{selectedText.slice(0, 16)}{selectedText.length > 16 ? "..." : ""}"
              </span>
            </div>

            <div className="flex items-center gap-1 shrink-0">
              <button
                onClick={() => handleLookupDefinition()}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-black dark:bg-white text-white dark:text-black rounded-xl text-xs font-bold active:scale-95 transition-all shadow-xs"
                title="Ver significado no dicionário"
              >
                <BookA className="w-3.5 h-3.5 stroke-[2.2]" />
                <span>Definir</span>
              </button>

              {/* Botão Pintar / Cores Mobile */}
              <div className="relative flex items-center">
                <button
                  onClick={() => setShowColorPicker(!showColorPicker)}
                  className={`p-1.5 rounded-xl transition-colors ${
                    showColorPicker
                      ? "bg-black/10 dark:bg-white/20 text-black dark:text-white"
                      : "hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-600 dark:text-gray-300"
                  }`}
                  title="Pintar / Realçar texto"
                >
                  <Highlighter className="w-4 h-4 stroke-[2]" />
                </button>

                {showColorPicker && (
                  <div className="absolute bottom-full mb-3 right-0 bg-white dark:bg-gray-800 p-2 rounded-2xl shadow-2xl border border-gray-200 dark:border-gray-700 flex items-center gap-2 animate-in zoom-in-95 duration-150 z-50">
                    <button
                      onClick={() => handleHighlightSelection("yellow")}
                      className="w-5 h-5 rounded-full bg-yellow-300 ring-2 ring-yellow-400 hover:scale-110 active:scale-95 transition-transform"
                      title="Amarelo"
                    />
                    <button
                      onClick={() => handleHighlightSelection("green")}
                      className="w-5 h-5 rounded-full bg-emerald-300 ring-2 ring-emerald-400 hover:scale-110 active:scale-95 transition-transform"
                      title="Verde"
                    />
                    <button
                      onClick={() => handleHighlightSelection("blue")}
                      className="w-5 h-5 rounded-full bg-blue-300 ring-2 ring-blue-400 hover:scale-110 active:scale-95 transition-transform"
                      title="Azul"
                    />
                    <button
                      onClick={() => handleHighlightSelection("pink")}
                      className="w-5 h-5 rounded-full bg-pink-300 ring-2 ring-pink-400 hover:scale-110 active:scale-95 transition-transform"
                      title="Rosa"
                    />
                  </div>
                )}
              </div>

              <button
                onClick={handleCreateNoteFromSelection}
                className="p-1.5 rounded-xl hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-600 dark:text-gray-300 transition-colors"
                title="Criar nota a partir deste trecho"
              >
                <MessageSquarePlus className="w-4 h-4" />
              </button>

              <button
                onClick={handleCopySelectedText}
                className="p-1.5 rounded-xl hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-600 dark:text-gray-300 transition-colors"
                title="Copiar texto"
              >
                {copiedFeedback ? <Check className="w-4 h-4 text-emerald-500" /> : <Copy className="w-4 h-4" />}
              </button>

              <button
                onClick={() => {
                  setShowFloatingMenu(false);
                  setShowColorPicker(false);
                }}
                className="p-1 rounded-xl text-gray-400 hover:text-black dark:hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Versão Desktop (Tooltip posicionado sobre o texto) */}
          {selectionPosition && (
            <div
              data-floating-menu
              onMouseDown={(e) => e.stopPropagation()}
              style={{
                left: `${selectionPosition.x}px`,
                top: `${selectionPosition.y - 48}px`,
              }}
              className="hidden sm:flex fixed -translate-x-1/2 z-40 bg-black/90 dark:bg-white/95 text-white dark:text-black backdrop-blur-md rounded-2xl p-1 shadow-2xl items-center gap-0.5 border border-white/20 dark:border-black/20 animate-in zoom-in-95 duration-150 select-none"
            >
              <button
                onClick={() => handleLookupDefinition()}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl hover:bg-white/20 dark:hover:bg-black/10 text-xs font-semibold active:scale-95 transition-all"
                title="Ver significado no dicionário"
              >
                <BookA className="w-3.5 h-3.5 stroke-[2.2]" />
                <span>Definir</span>
              </button>

              {/* Botão Pintar / Cores Desktop */}
              <div className="relative flex items-center">
                <button
                  onClick={() => setShowColorPicker(!showColorPicker)}
                  className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl transition-all ${
                    showColorPicker
                      ? "bg-white/30 dark:bg-black/20 font-bold"
                      : "hover:bg-white/20 dark:hover:bg-black/10 text-xs font-semibold"
                  }`}
                  title="Pintar / Realçar texto"
                >
                  <Highlighter className="w-3.5 h-3.5 stroke-[2.2]" />
                  <span>Pintar</span>
                </button>

                {showColorPicker && (
                  <div className="absolute bottom-full mb-2 left-1/2 -translate-x-1/2 bg-white dark:bg-gray-800 p-1.5 rounded-2xl shadow-xl border border-gray-200 dark:border-gray-700 flex items-center gap-1.5 animate-in zoom-in-95 duration-150 z-50">
                    <button
                      onClick={() => handleHighlightSelection("yellow")}
                      className="w-5 h-5 rounded-full bg-yellow-300 ring-2 ring-yellow-400 hover:scale-110 active:scale-95 transition-transform"
                      title="Amarelo"
                    />
                    <button
                      onClick={() => handleHighlightSelection("green")}
                      className="w-5 h-5 rounded-full bg-emerald-300 ring-2 ring-emerald-400 hover:scale-110 active:scale-95 transition-transform"
                      title="Verde"
                    />
                    <button
                      onClick={() => handleHighlightSelection("blue")}
                      className="w-5 h-5 rounded-full bg-blue-300 ring-2 ring-blue-400 hover:scale-110 active:scale-95 transition-transform"
                      title="Azul"
                    />
                    <button
                      onClick={() => handleHighlightSelection("pink")}
                      className="w-5 h-5 rounded-full bg-pink-300 ring-2 ring-pink-400 hover:scale-110 active:scale-95 transition-transform"
                      title="Rosa"
                    />
                  </div>
                )}
              </div>

              <button
                onClick={handleCreateNoteFromSelection}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl hover:bg-white/20 dark:hover:bg-black/10 text-xs font-semibold active:scale-95 transition-all"
                title="Criar nota a partir deste trecho"
              >
                <MessageSquarePlus className="w-3.5 h-3.5" />
                <span>Nota</span>
              </button>

              <button
                onClick={handleCopySelectedText}
                className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl hover:bg-white/20 dark:hover:bg-black/10 text-xs font-semibold active:scale-95 transition-all"
                title="Copiar texto"
              >
                {copiedFeedback ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
              </button>

              <button
                onClick={() => {
                  setShowFloatingMenu(false);
                  setShowColorPicker(false);
                }}
                className="p-1.5 rounded-xl hover:bg-white/20 dark:hover:bg-black/10 text-white/60 dark:text-black/60 hover:text-white dark:hover:text-black"
              >
                <X className="w-3 h-3" />
              </button>
            </div>
          )}
        </>
      )}

      {/* ─── Modal / Gaveta do Dicionário de Língua Portuguesa ─── */}
      {showDictionaryModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-end sm:items-center justify-center p-0 sm:p-4 z-50 animate-in fade-in duration-200">
          <div className="bg-white dark:bg-gray-900 border-t sm:border border-gray-200 dark:border-gray-800 rounded-t-3xl sm:rounded-3xl max-w-lg w-full max-h-[85vh] flex flex-col shadow-2xl animate-in slide-in-from-bottom-6 sm:zoom-in-95 duration-200 text-black dark:text-white overflow-hidden">
            
            {/* Header do Dicionário */}
            <div className="p-4 sm:p-5 border-b border-gray-100 dark:border-gray-800 flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-black dark:bg-white text-white dark:text-black flex items-center justify-center shadow-xs">
                  <BookA className="w-5 h-5 stroke-[2.2]" />
                </div>
                <div>
                  <h3 className="font-bold text-sm tracking-tight leading-none">Dicionário de Português</h3>
                  <span className="text-[10px] uppercase tracking-wider text-gray-400 font-semibold block mt-0.5">
                    Kuwerenga+ Léxico
                  </span>
                </div>
              </div>

              <button
                onClick={() => setShowDictionaryModal(false)}
                className="p-2 rounded-full hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors text-gray-400 hover:text-black dark:hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Barra de Pesquisa Manual no Dicionário */}
            <div className="px-4 sm:px-5 pt-3 pb-2">
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  if (dictionaryQuery.trim()) {
                    handleLookupDefinition(dictionaryQuery);
                  }
                }}
                className="relative"
              >
                <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
                <input
                  type="text"
                  value={dictionaryQuery}
                  onChange={(e) => setDictionaryQuery(e.target.value)}
                  placeholder="Pesquisar palavra ou expressão..."
                  className="w-full pl-10 pr-20 py-2.5 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl text-xs font-medium focus:outline-none focus:ring-2 focus:ring-black dark:focus:ring-white"
                />
                <button
                  type="submit"
                  disabled={!dictionaryQuery.trim() || dictionaryLoading}
                  className="absolute right-1.5 top-1/2 -translate-y-1/2 px-3 py-1 bg-black dark:bg-white text-white dark:text-black rounded-lg text-xs font-semibold disabled:opacity-40"
                >
                  Buscar
                </button>
              </form>
            </div>

            {/* Conteúdo da Definição */}
            <div className="p-4 sm:p-5 flex-1 overflow-y-auto space-y-4">
              {dictionaryLoading ? (
                <div className="py-12 flex flex-col items-center justify-center gap-3">
                  <div className="w-8 h-8 border-2 border-black dark:border-white border-t-transparent dark:border-t-transparent rounded-full animate-spin"></div>
                  <p className="text-xs text-gray-500 font-medium">A consultar o dicionário...</p>
                </div>
              ) : dictionaryError ? (
                <div className="py-8 text-center px-4">
                  <p className="text-sm font-semibold text-red-500 mb-1">Definição não encontrada</p>
                  <p className="text-xs text-gray-500 mb-4">{dictionaryError}</p>
                </div>
              ) : dictionaryResult ? (
                <div>
                  {/* Cabeçalho do Termo */}
                  <div className="flex items-baseline gap-2.5 mb-2 flex-wrap">
                    <h2 className="text-xl font-bold tracking-tight capitalize">{dictionaryResult.term}</h2>
                    {dictionaryResult.grammaticalClass && (
                      <span className="px-2 py-0.5 rounded-md bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300 text-[11px] font-semibold">
                        {dictionaryResult.grammaticalClass}
                      </span>
                    )}
                    {dictionaryResult.type === "phrase" && (
                      <span className="px-2 py-0.5 rounded-md bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300 text-[11px] font-semibold">
                        Expressão
                      </span>
                    )}
                  </div>

                  {dictionaryResult.etymology && (
                    <p className="text-xs italic text-gray-400 mb-4">
                      {dictionaryResult.etymology}
                    </p>
                  )}

                  {/* Definições Numeradas */}
                  <div className="mt-3 space-y-3">
                    <h4 className="text-[11px] uppercase tracking-wider font-bold text-gray-400">
                      Significados
                    </h4>
                    <ol className="space-y-2.5">
                      {dictionaryResult.definitions.map((def, idx) => (
                        <li key={idx} className="flex items-start gap-2.5 text-xs sm:text-sm leading-relaxed">
                          <span className="w-5 h-5 rounded-full bg-gray-100 dark:bg-gray-800 font-bold text-[10px] flex items-center justify-center shrink-0 mt-0.5 text-gray-600 dark:text-gray-300">
                            {idx + 1}
                          </span>
                          <span className="flex-1">{def}</span>
                        </li>
                      ))}
                    </ol>
                  </div>

                  {/* Fonte */}
                  <div className="mt-5 pt-3 border-t border-gray-100 dark:border-gray-800 flex items-center justify-between text-[10px] text-gray-400">
                    <span>
                      Fonte: {dictionaryResult.source === "dicionario" ? "Dicionário Aberto da Língua Portuguesa" : dictionaryResult.source === "wikipedia" ? "Wikipédia Lusófona" : "Memória de Vocabulário"}
                    </span>
                    {dictionaryResult.source === "local" && (
                      <span className="text-emerald-500 font-medium">Disponível Offline</span>
                    )}
                  </div>
                </div>
              ) : (
                <div className="py-10 text-center text-gray-400 text-xs">
                  Seleciona uma palavra no livro ou pesquisa acima para ver a definição.
                </div>
              )}
            </div>

            {/* Ações do Rodapé do Modal */}
            <div className="p-4 bg-gray-50 dark:bg-gray-800/50 border-t border-gray-100 dark:border-gray-800 flex items-center justify-between gap-3">
              {dictionaryResult ? (
                <button
                  onClick={handleSaveDefinitionAsNote}
                  className="flex items-center gap-1.5 px-4 py-2 bg-black dark:bg-white text-white dark:text-black rounded-xl text-xs font-semibold shadow-xs hover:opacity-90 active:scale-95 transition-all"
                >
                  <MessageSquarePlus className="w-3.5 h-3.5" />
                  <span>Guardar como Nota</span>
                </button>
              ) : <div />}

              <button
                onClick={() => setShowDictionaryModal(false)}
                className="px-4 py-2 border border-gray-200 dark:border-gray-700 rounded-xl text-xs font-semibold hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
              >
                Fechar
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
