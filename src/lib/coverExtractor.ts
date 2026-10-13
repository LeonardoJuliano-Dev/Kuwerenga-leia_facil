import * as pdfjsLib from "pdfjs-dist";
import pdfWorker from "pdfjs-dist/build/pdf.worker.min.mjs?url";
import ePub from "epubjs";

// Configura o worker do pdfjs se ainda não estiver definido
if (!pdfjsLib.GlobalWorkerOptions.workerSrc) {
  pdfjsLib.GlobalWorkerOptions.workerSrc = pdfWorker;
}

export interface ExtractedCoverResult {
  blob: Blob;
  previewUrl: string;
  file: File;
}

/**
 * Renderiza a primeira página de um ficheiro PDF para imagem JPEG de capa
 */
export async function extractCoverFromPdf(fileOrBlob: Blob | File): Promise<ExtractedCoverResult | null> {
  try {
    const arrayBuffer = await fileOrBlob.arrayBuffer();
    const loadingTask = pdfjsLib.getDocument({
      data: arrayBuffer,
      cMapUrl: "/pdfjs/cmaps/",
      cMapPacked: true,
      standardFontDataUrl: "/pdfjs/standard_fonts/",
    });

    const pdf = await loadingTask.promise;
    if (pdf.numPages < 1) return null;

    const page = await pdf.getPage(1);
    const unscaledViewport = page.getViewport({ scale: 1 });

    // Escala para uma largura padrão de ~500px para qualidade nítida e ficheiro leve (~60-120KB)
    const targetWidth = 500;
    const scale = targetWidth / unscaledViewport.width;
    const viewport = page.getViewport({ scale });

    const canvas = document.createElement("canvas");
    canvas.width = Math.floor(viewport.width);
    canvas.height = Math.floor(viewport.height);

    const ctx = canvas.getContext("2d", { alpha: false });
    if (!ctx) return null;

    // Fundo branco inicial
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    const renderContext = {
      canvasContext: ctx,
      viewport: viewport,
    };

    await page.render(renderContext).promise;

    return new Promise((resolve) => {
      canvas.toBlob(
        (blob) => {
          if (!blob) {
            resolve(null);
            return;
          }
          const previewUrl = URL.createObjectURL(blob);
          const coverFile = new File([blob], "capa_pagina_1.jpg", {
            type: "image/jpeg",
            lastModified: Date.now(),
          });
          resolve({ blob, previewUrl, file: coverFile });
        },
        "image/jpeg",
        0.88
      );
    });
  } catch (err) {
    console.warn("Não foi possível extrair capa do PDF automaticamente:", err);
    return null;
  }
}

/**
 * Tenta extrair a capa embutida de um ficheiro ePub
 */
export async function extractCoverFromEpub(fileOrBlob: Blob | File): Promise<ExtractedCoverResult | null> {
  try {
    const arrayBuffer = await fileOrBlob.arrayBuffer();
    // @ts-ignore epubjs types
    const book = ePub(arrayBuffer);
    await book.ready;

    // @ts-ignore
    const coverUrl = await book.coverUrl();
    if (coverUrl) {
      const response = await fetch(coverUrl);
      const blob = await response.blob();
      const previewUrl = URL.createObjectURL(blob);
      const coverFile = new File([blob], "capa_epub.jpg", {
        type: blob.type || "image/jpeg",
        lastModified: Date.now(),
      });
      return { blob, previewUrl, file: coverFile };
    }
    return null;
  } catch (err) {
    console.warn("Não foi possível extrair capa do ePub automaticamente:", err);
    return null;
  }
}

/**
 * Função utilitária inteligente que deteta o formato e extrai a primeira página/capa
 */
export async function extractCoverFromFile(file: File): Promise<ExtractedCoverResult | null> {
  const ext = file.name.split(".").pop()?.toLowerCase();

  if (ext === "pdf" || file.type === "application/pdf") {
    return await extractCoverFromPdf(file);
  }

  if (ext === "epub" || file.type === "application/epub+zip") {
    return await extractCoverFromEpub(file);
  }

  return null;
}
