import * as pdfjsLib from "pdfjs-dist";
import pdfWorker from "pdfjs-dist/build/pdf.worker.min.mjs?url";
import ePub from "epubjs";
import { EXPANDED_CATEGORIES, type AppCategory } from "./categoryData";
import { searchOfficialBookMetadata, syncOfficialCategory } from "./bookSearchService";

// Garante que o worker do pdfjs está pronto
if (!pdfjsLib.GlobalWorkerOptions.workerSrc) {
  pdfjsLib.GlobalWorkerOptions.workerSrc = pdfWorker;
}

export interface AIBookAnalysisResult {
  title: string;
  author: string;
  synopsis: string;
  suggestedCategoryName: string;
  suggestedCategoryId?: string;
  confidence: "high" | "medium" | "low";
}

/**
 * Limpa títulos gerados por ficheiros ou metadados desformatados
 */
function cleanExtractedTitle(raw: string): string {
  if (!raw) return "";
  let clean = raw.trim();

  // Remove extensões de ficheiro
  clean = clean.replace(/\.(pdf|epub|mobi|azw3|txt)$/i, "");

  // Remove sufixos comuns de downloads ou digitalizações
  clean = clean.replace(/(\[.*?\]|\(.*?\))/g, " ");
  clean = clean.replace(/(z-library|oceanofpdf|doceru|lelivros|baixa-livros|pdfdrive|vdoc\.pub)/gi, "");
  clean = clean.replace(/[_\-]+/g, " ");
  clean = clean.replace(/\s{2,}/g, " ").trim();

  // Capitaliza adequadamente se estiver tudo em minúsculas
  if (clean === clean.toLowerCase() && clean.length > 0) {
    clean = clean.charAt(0).toUpperCase() + clean.slice(1);
  }

  return clean;
}

/**
 * Limpa o nome do autor
 */
function cleanExtractedAuthor(raw: string): string {
  if (!raw) return "";
  let clean = raw.trim();
  clean = clean.replace(/^(por|by|escrito por|autor:|author:)\s*/i, "");
  clean = clean.replace(/(\[.*?\]|\(.*?\))/g, " ");
  clean = clean.replace(/[_\-]+/g, " ");
  clean = clean.replace(/\s{2,}/g, " ").trim();
  return clean;
}

/**
 * Classificador semântico local que sugere uma das 24 categorias
 */
function detectCategoryFromContent(text: string, title: string): string {
  const combined = (title + " " + text).toLowerCase();

  const rules: { name: string; keywords: string[] }[] = [
    {
      name: "Tecnologia, Programação & IA",
      keywords: ["código", "software", "programação", "javascript", "python", "computador", "algoritmo", "inteligência artificial", "web", "dados", "tecnologia"]
    },
    {
      name: "Finanças & Investimentos",
      keywords: ["dinheiro", "investimento", "finanças", "ações", "riqueza", "bolsa", "património", "juros", "lucro", "economia"]
    },
    {
      name: "Negócios & Empreendedorismo",
      keywords: ["empresa", "negócio", "empreendedor", "gestão", "liderança", "marketing", "vendas", "startup", "estratégia"]
    },
    {
      name: "Literatura Moçambicana & Africana",
      keywords: ["moçambique", "maputo", "mia couto", "craveirinha", "africano", "savana", "chiziane", "luanda", "angola", "beira", "nampula"]
    },
    {
      name: "Desenvolvimento Pessoal & Motivação",
      keywords: ["hábito", "mente", "sucesso", "motivação", "produtividade", "foco", "disciplina", "autoconhecimento", "potencial"]
    },
    {
      name: "Ficção Científica & Fantasia",
      keywords: ["galáxia", "nave", "planeta", "magia", "dragão", "feitiço", "futuro", "espacial", "robô", "androide", "alienígena"]
    },
    {
      name: "História & Civilizações",
      keywords: ["século", "guerra", "império", "revolução", "civilização", "história", "colónia", "independência", "antiguidade"]
    },
    {
      name: "Psicologia & Relações Humanas",
      keywords: ["comportamento", "psicologia", "emoção", "cérebro", "terapia", "ansiedade", "relação", "personalidade"]
    },
    {
      name: "Filosofia & Pensamento Crítico",
      keywords: ["filosofia", "pensamento", "ética", "moral", "razão", "existência", "sócrates", "platão", "kant", "epicteto"]
    },
    {
      name: "Poesia & Letras",
      keywords: ["poema", "versos", "estrofe", "poesia", "rima", "lírica", "soneto"]
    },
    {
      name: "Policial, Mistério & Suspense",
      keywords: ["crime", "detetive", "assassinato", "mistério", "investigação", "polícia", "suspense", "vítima"]
    },
    {
      name: "Saúde, Medicina & Bem-Estar",
      keywords: ["saúde", "corpo", "medicina", "alimentação", "exercício", "sono", "doença", "nutrição", "clínica"]
    },
    {
      name: "Direito, Legislação & Cidadania",
      keywords: ["lei", "direito", "artigo", "constituição", "código penal", "tribunal", "advogado", "justiça"]
    },
    {
      name: "Educação & Pedagogia",
      keywords: ["ensino", "escola", "aprendizagem", "pedagogia", "professor", "aluno", "didática", "aula"]
    },
    {
      name: "Infantil & Literatura Juvenil",
      keywords: ["criança", "conto de fadas", "infantil", "ilustrado", "brincadeira", "pequeno"]
    },
    {
      name: "Espiritualidade & Fé",
      keywords: ["deus", "bíblia", "oração", "espiritual", "fé", "alma", "igreja", "evangelho", "senhor"]
    },
    {
      name: "Biografias & Grandes Vidas",
      keywords: ["biografia", "memórias", "autobiografia", "vida e obra", "trajetória"]
    },
    {
      name: "Culinária & Gastronomia",
      keywords: ["receita", "culinária", "ingredientes", "gastronomia", "prato", "cozinha"]
    },
    {
      name: "Romance & Drama",
      keywords: ["amor", "paixão", "coração", "romance", "drama", "casamento", "sentimento"]
    }
  ];

  for (const r of rules) {
    if (r.keywords.some((kw) => combined.includes(kw))) {
      return r.name;
    }
  }

  return "Romance & Drama";
}

/**
 * Gera uma sinopse literária coesa e elegante a partir dos primeiros parágrafos
 */
function generateLocalSynopsis(title: string, _author: string, extractedText: string, _category: string): string {
  // Limpa caracteres estranhos de paginação
  const lines = extractedText
    .split(/\n+/)
    .map((l) => l.trim())
    .filter((l) => {
      if (!l) return false;
      if (l.startsWith("--- PÁGINA")) return false;
      if (/^\d+$/.test(l)) return false; // apenas números
      if (l.toLowerCase().includes("todos os direitos") || l.toLowerCase().includes("copyright")) return false;
      if (l.toLowerCase().includes("isbn") || l.toLowerCase().includes("catalogação")) return false;
      return true;
    });

  // Tenta encontrar um bloco de parágrafos descritivos significativos (mais de 60 caracteres)
  const descriptiveParagraphs = lines.filter((l) => l.length > 70 && !l.includes("......."));

  if (descriptiveParagraphs.length > 0) {
    const rawExcerpt = descriptiveParagraphs.slice(0, 2).join(" ");
    if (rawExcerpt.length >= 100) {
      // Trunca suavemente na última frase completa
      const truncated = rawExcerpt.slice(0, 360);
      const lastPeriod = Math.max(truncated.lastIndexOf("."), truncated.lastIndexOf("!"));
      if (lastPeriod > 120) {
        return truncated.slice(0, lastPeriod + 1);
      }
      return truncated + "...";
    }
  }

  // Se o título e autor existirem mas o texto for ilegível ou apenas sumário, deixa em branco
  // para que o utilizador possa preencher se desejar
  if (!title) return "";
  return "";
}

/**
 * Analisador principal de livros: extrai metadados do PDF/EPUB e sintetiza com IA
 */
export async function analyzeBookWithAI(
  file: File,
  availableCategories: AppCategory[]
): Promise<AIBookAnalysisResult> {
  const ext = file.name.split(".").pop()?.toLowerCase();
  let extractedTitle = "";
  let extractedAuthor = "";
  let extractedText = "";
  let extractedDescription = "";

  try {
    const arrayBuffer = await file.arrayBuffer();

    // ─────────────────────────────────────────────────────────────
    // 1. EXTRAÇÃO DE METADADOS DE PDF
    // ─────────────────────────────────────────────────────────────
    if (ext === "pdf") {
      const loadingTask = pdfjsLib.getDocument({
        data: arrayBuffer,
        cMapUrl: "/pdfjs/cmaps/",
        cMapPacked: true,
        standardFontDataUrl: "/pdfjs/standard_fonts/",
      });

      const pdf = await loadingTask.promise;

      // Metadados embutidos
      try {
        const meta = await pdf.getMetadata();
        const info = (meta?.info as any) || {};

        if (info.Title && typeof info.Title === "string" && info.Title.trim().length > 2) {
          extractedTitle = cleanExtractedTitle(info.Title);
        }
        if (info.Author && typeof info.Author === "string" && info.Author.trim().length > 2) {
          extractedAuthor = cleanExtractedAuthor(info.Author);
        }
        if (info.Subject && typeof info.Subject === "string") {
          extractedDescription = info.Subject.trim();
        }
      } catch (err) {
        console.warn("Metadados PDF não encontrados:", err);
      }

      // Extrai texto das primeiras 3 páginas (capa, folha de rosto, introdução)
      const maxPages = Math.min(pdf.numPages, 4);
      for (let i = 1; i <= maxPages; i++) {
        try {
          const page = await pdf.getPage(i);
          const content = await page.getTextContent();
          const pageStr = content.items
            .map((item: any) => item.str || "")
            .join(" ");
          extractedText += `\n--- PÁGINA ${i} ---\n` + pageStr;
        } catch {}
      }

      // Se o autor ainda não foi encontrado nos metadados, analisa o texto das primeiras páginas
      if (!extractedAuthor && extractedText) {
        const authorMatch = extractedText.match(
          /(?:por|escrito por|autor:|author:|obra de)\s+([A-ZÀ-Ú][a-zà-ú]+(?:\s+[A-ZÀ-Ú][a-zà-ú]+){1,4})/i
        );
        if (authorMatch && authorMatch[1]) {
          extractedAuthor = cleanExtractedAuthor(authorMatch[1]);
        }
      }

      // Se o título ainda não foi encontrado, tenta a primeira linha expressiva da página 1 ou 2
      if (!extractedTitle && extractedText) {
        const firstLines = extractedText
          .split("\n")
          .map((l) => l.trim())
          .filter((l) => l.length > 3 && l.length < 80 && !l.startsWith("---"));

        if (firstLines.length > 0) {
          const candidate = firstLines[0];
          // Evita nomes como 'Capítulo 1' ou 'Prefácio'
          if (!/^(cap[ií]tulo|sum[aá]rio|[ií]ndice|pref[aá]cio)/i.test(candidate)) {
            extractedTitle = cleanExtractedTitle(candidate);
          }
        }
      }
    }

    // ─────────────────────────────────────────────────────────────
    // 2. EXTRAÇÃO DE METADADOS DE EPUB
    // ─────────────────────────────────────────────────────────────
    else if (ext === "epub") {
      try {
        // @ts-ignore
        const book = ePub(arrayBuffer);
        await book.ready;
        // @ts-ignore
        const metadata = await book.loaded.metadata;

        if (metadata) {
          if (metadata.title) extractedTitle = cleanExtractedTitle(metadata.title);
          if (metadata.creator) extractedAuthor = cleanExtractedAuthor(metadata.creator);
          if (metadata.description) {
            // Remove tags HTML se presentes
            const tempDiv = document.createElement("div");
            tempDiv.innerHTML = metadata.description;
            extractedDescription = tempDiv.textContent || tempDiv.innerText || "";
          }
        }
      } catch (epubErr) {
        console.warn("Erro ao ler metadados do ePub:", epubErr);
      }
    }

    // Fallback do título a partir do nome do ficheiro se ainda estiver vazio
    if (!extractedTitle) {
      extractedTitle = cleanExtractedTitle(file.name);
    }

    // ─────────────────────────────────────────────────────────────
    // 2.5 PESQUISA EM CATÁLOGOS OFICIAIS (GOOGLE BOOKS & OPEN LIBRARY)
    // ─────────────────────────────────────────────────────────────
    const candidateQuery = extractedTitle || cleanExtractedTitle(file.name);
    if (candidateQuery) {
      try {
        const official = await searchOfficialBookMetadata(candidateQuery, extractedAuthor);
        if (official) {
          const finalTitle = official.title || extractedTitle;
          const finalAuthor = official.author || extractedAuthor;
          const finalSynopsis = official.synopsis || extractedDescription;
          const finalCategoryName = official.categoryName || detectCategoryFromContent(extractedText, finalTitle);

          let matchedCat = availableCategories.find(
            (c) => c.name.toLowerCase() === finalCategoryName.toLowerCase()
          );

          let resolvedCatId = matchedCat?.id;
          if (!resolvedCatId) {
            resolvedCatId = (await syncOfficialCategory(finalCategoryName)) || undefined;
          }

          if (finalSynopsis && finalSynopsis.length > 30) {
            return {
              title: finalTitle,
              author: finalAuthor,
              synopsis: finalSynopsis,
              suggestedCategoryName: finalCategoryName,
              suggestedCategoryId: resolvedCatId,
              confidence: "high",
            };
          }
        }
      } catch (officialErr) {
        console.warn("Pesquisa de metadados oficiais avisou:", officialErr);
      }
    }

    // ─────────────────────────────────────────────────────────────
    // 3. CONSULTA DE IA (GEMINI API SE CHAVE DISPONÍVEL)
    // ─────────────────────────────────────────────────────────────
    const geminiApiKey = (import.meta as any).env?.VITE_GEMINI_API_KEY;

    if (geminiApiKey && (extractedText || extractedTitle)) {
      try {
        const prompt = `És um catalogador e crítico literário especialista. Analisa os seguintes dados e texto extraído das primeiras páginas de um livro e retorna APENAS um objeto JSON válido (sem tags markdown nem explicações) no seguinte formato:
{
  "title": "${extractedTitle || "título deduzido ou string vazia se não puder ser determinado"}",
  "author": "${extractedAuthor || "nome do autor ou string vazia se não puder ser determinado"}",
  "suggestedCategory": "categoria literária mais adequada",
  "synopsis": "sinopse literária elegante de 2 a 4 frases em português resumindo a essência da obra"
}

Categorias válidas disponíveis:
${EXPANDED_CATEGORIES.map((c) => c.name).join(", ")}

Texto das primeiras páginas do livro:
${extractedText.slice(0, 3500)}`;

        const response = await fetch(
          `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${geminiApiKey}`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              contents: [{ parts: [{ text: prompt }] }],
              generationConfig: { temperature: 0.2, responseMimeType: "application/json" }
            }),
          }
        );

        if (response.ok) {
          const aiJson = await response.json();
          const candidateText = aiJson.candidates?.[0]?.content?.parts?.[0]?.text;
          if (candidateText) {
            const parsed = JSON.parse(candidateText);
            const finalTitle = parsed.title?.trim() || extractedTitle;
            const finalAuthor = parsed.author?.trim() || extractedAuthor;
            const finalSynopsis = parsed.synopsis?.trim() || extractedDescription;
            const finalCategory = parsed.suggestedCategory || detectCategoryFromContent(extractedText, finalTitle);

            const matchedCat = availableCategories.find(
              (c) => c.name.toLowerCase() === finalCategory.toLowerCase()
            );

            return {
              title: finalTitle,
              author: finalAuthor,
              synopsis: finalSynopsis,
              suggestedCategoryName: finalCategory,
              suggestedCategoryId: matchedCat?.id,
              confidence: "high",
            };
          }
        }
      } catch (aiErr) {
        console.warn("Chamada Gemini falhou, a utilizar motor local de IA:", aiErr);
      }
    }

    // ─────────────────────────────────────────────────────────────
    // 4. MOTOR INTELIGENTE LOCAL (PLN E ANÁLISE SEMÂNTICA)
    // ─────────────────────────────────────────────────────────────
    const detectedCategoryName = detectCategoryFromContent(extractedText, extractedTitle);
    const matchedCategory = availableCategories.find(
      (c) => c.name.toLowerCase() === detectedCategoryName.toLowerCase()
    );

    const generatedSynopsis = extractedDescription.trim() || generateLocalSynopsis(
      extractedTitle,
      extractedAuthor,
      extractedText,
      detectedCategoryName
    );

    return {
      title: extractedTitle,
      author: extractedAuthor,
      synopsis: generatedSynopsis,
      suggestedCategoryName: detectedCategoryName,
      suggestedCategoryId: matchedCategory?.id,
      confidence: extractedTitle && extractedAuthor ? "high" : "medium",
    };
  } catch (error) {
    console.error("Erro na análise por IA do livro:", error);
    return {
      title: cleanExtractedTitle(file.name),
      author: "",
      synopsis: "",
      suggestedCategoryName: "Romance & Drama",
      confidence: "low",
    };
  }
}
