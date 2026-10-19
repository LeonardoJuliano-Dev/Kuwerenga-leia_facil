import * as pdfjsLib from "pdfjs-dist";
import pdfWorker from "pdfjs-dist/build/pdf.worker.min.mjs?url";
import ePub from "epubjs";
import { EXPANDED_CATEGORIES, type AppCategory } from "./categoryData";
import {
  searchOfficialBookMetadata,
  syncOfficialCategory,
  parseFileNameTitleAndAuthor,
  looksLikeTitle,
  looksLikeAuthor
} from "./bookSearchService";

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
      name: "Ciência",
      keywords: ["código", "software", "programação", "javascript", "python", "computador", "algoritmo", "inteligência artificial", "web", "dados", "tecnologia", "física", "química", "matemática", "biologia", "ciência"]
    },
    {
      name: "Economia",
      keywords: ["dinheiro", "investimento", "finanças", "ações", "riqueza", "bolsa", "património", "juros", "lucro", "economia"]
    },
    {
      name: "Negócios",
      keywords: ["empresa", "negócio", "empreendedor", "gestão", "liderança", "marketing", "vendas", "startup", "estratégia"]
    },
    {
      name: "Autoajuda",
      keywords: ["hábito", "mente", "sucesso", "motivação", "produtividade", "foco", "disciplina", "autoconhecimento", "potencial", "autoajuda"]
    },
    {
      name: "Ficção Científica",
      keywords: ["galáxia", "nave", "planeta", "espacial", "robô", "androide", "alienígena", "futurismo", "ficção científica"]
    },
    {
      name: "Fantasia",
      keywords: ["magia", "dragão", "feitiço", "mago", "elfo", "bruxo", "feitiçaria", "fantasia"]
    },
    {
      name: "Distopia",
      keywords: ["distopia", "totalitário", "sociedade opressiva", "regime", "1984", "vigilância"]
    },
    {
      name: "História",
      keywords: ["século", "guerra", "império", "revolução", "civilização", "história", "colónia", "independência", "antiguidade"]
    },
    {
      name: "Psicologia",
      keywords: ["comportamento", "psicologia", "emoção", "cérebro", "terapia", "ansiedade", "relação", "personalidade", "mente"]
    },
    {
      name: "Filosofia",
      keywords: ["filosofia", "pensamento", "ética", "moral", "razão", "existência", "sócrates", "platão", "kant", "epicteto"]
    },
    {
      name: "Poesia",
      keywords: ["poema", "versos", "estrofe", "poesia", "rima", "lírica", "soneto"]
    },
    {
      name: "Romance Policial",
      keywords: ["detetive", "crime", "investigação", "polícia", "sherlock", "assassino", "agatha christie", "policial"]
    },
    {
      name: "Suspense",
      keywords: ["suspense", "tensão", "perigo iminente", "perseguidor"]
    },
    {
      name: "Mistério",
      keywords: ["mistério", "enigma", "segredo", "desaparecimento"]
    },
    {
      name: "Saúde",
      keywords: ["saúde", "corpo", "medicina", "alimentação", "exercício", "sono", "doença", "nutrição", "clínica"]
    },
    {
      name: "Direito",
      keywords: ["lei", "direito", "artigo", "constituição", "código penal", "tribunal", "advogado", "justiça"]
    },
    {
      name: "Educação",
      keywords: ["ensino", "escola", "aprendizagem", "pedagogia", "professor", "aluno", "didática", "aula"]
    },
    {
      name: "Infantojuvenil",
      keywords: ["criança", "conto de fadas", "infantil", "ilustrado", "brincadeira", "pequeno", "infantojuvenil"]
    },
    {
      name: "Jovem Adulto",
      keywords: ["adolescente", "jovem adulto", "colegial", "ensino médio"]
    },
    {
      name: "Espiritualidade",
      keywords: ["espiritual", "alma", "paz interior", "meditação", "energia"]
    },
    {
      name: "Espiritismo",
      keywords: ["espiritismo", "kardec", "chico xavier", "médium", "reencarnação"]
    },
    {
      name: "Religião",
      keywords: ["deus", "bíblia", "oração", "fé", "igreja", "evangelho", "senhor", "jesus", "cristão", "religião"]
    },
    {
      name: "Biografia",
      keywords: ["biografia", "memórias", "vida e obra", "trajetória", "relato biográfico"]
    },
    {
      name: "Autobiografia",
      keywords: ["autobiografia", "minhas memórias", "minha trajetória"]
    },
    {
      name: "Culinária",
      keywords: ["receita", "culinária", "ingredientes", "gastronomia", "prato", "cozinha"]
    },
    {
      name: "Política",
      keywords: ["política", "governo", "estado", "eleição", "partido", "democracia", "cidadão"]
    },
    {
      name: "Sociologia",
      keywords: ["sociologia", "sociedade", "social", "classes sociais", "cultura coletiva"]
    },
    {
      name: "Artes",
      keywords: ["arte", "pintura", "escultura", "fotografia", "desenho", "museu"]
    },
    {
      name: "Música",
      keywords: ["música", "canção", "instrumento", "partitura", "cantor", "melodia"]
    },
    {
      name: "Aventura",
      keywords: ["aventura", "expedição", "selva", "viagem arriscada", "explorador"]
    },
    {
      name: "Viagens",
      keywords: ["viagens", "viagem", "turismo", "guia de viagem", "roteiro"]
    },
    {
      name: "Teatro",
      keywords: ["teatro", "peça teatral", "dramaturgia", "ato", "palco"]
    },
    {
      name: "Terror",
      keywords: ["terror", "horror", "monstro", "assombração", "pesadelo", "fantasma"]
    },
    {
      name: "Quadrinhos",
      keywords: ["quadrinhos", "hq", "mangá", "tirinhas", "graphic novel"]
    },
    {
      name: "Clássicos",
      keywords: ["clássicos", "obra prima clássica", "cânone literário"]
    },
    {
      name: "Literatura Portuguesa",
      keywords: ["portugal", "eça de queirós", "fernando pessoa", "saramago", "camões", "literatura portuguesa"]
    },
    {
      name: "Literatura Brasileira",
      keywords: ["brasil", "machado de assis", "clarice lispector", "jorge amado", "literatura brasileira"]
    },
    {
      name: "Contos",
      keywords: ["contos", "coletânea de contos", "antologia de contos"]
    },
    {
      name: "Conto",
      keywords: ["conto curto", "pequena história"]
    },
    {
      name: "Crônica",
      keywords: ["crônica", "crónicas", "crônica do cotidiano"]
    },
    {
      name: "Ensaios",
      keywords: ["ensaios", "ensaio crítico", "reflexão ensaística"]
    },
    {
      name: "Não Ficção",
      keywords: ["não ficção", "fato verídico", "reportagem", "investigação real"]
    },
    {
      name: "Sátira",
      keywords: ["sátira", "paródia", "crítica satírica", "ironia"]
    },
    {
      name: "Comédia",
      keywords: ["comédia", "humor", "divertido", "piada"]
    },
    {
      name: "Épico",
      keywords: ["épico", "ilíada", "odisseia", "poema épico", "feitos heroicos"]
    },
    {
      name: "Romantismo",
      keywords: ["romantismo", "romântico do século xix", "idealismo romântico"]
    },
    {
      name: "Realismo",
      keywords: ["realismo", "realista", "retrato fiel da sociedade"]
    },
    {
      name: "Naturalismo",
      keywords: ["naturalismo", "determinismo", "instinto biológico", "o cortiço"]
    },
    {
      name: "Ficção Histórica",
      keywords: ["ficção histórica", "ambientado no século", "cenário de época"]
    },
    {
      name: "Ficção Contemporânea",
      keywords: ["ficção contemporânea", "século xxi", "vida urbana atual"]
    },
    {
      name: "Drama",
      keywords: ["drama", "conflito íntimo", "dor emocional", "separação"]
    },
    {
      name: "Romance",
      keywords: ["amor", "paixão", "coração", "romance", "casamento", "sentimento", "namoro"]
    }
  ];

  for (const r of rules) {
    if (r.keywords.some((kw) => combined.includes(kw))) {
      return r.name;
    }
  }

  return "Romance";
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
          if (info.Title.includes(" - ") || info.Title.includes(" – ")) {
            const parsedMeta = parseFileNameTitleAndAuthor(info.Title);
            if (parsedMeta.title) extractedTitle = parsedMeta.title;
            if (parsedMeta.author) extractedAuthor = parsedMeta.author;
          } else {
            extractedTitle = cleanExtractedTitle(info.Title);
          }
        }
        if (info.Author && typeof info.Author === "string" && info.Author.trim().length > 2 && !extractedAuthor) {
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

    // Se título e autor parecerem invertidos após a leitura do ficheiro, normaliza
    if (extractedTitle && extractedAuthor && looksLikeAuthor(extractedTitle) && looksLikeTitle(extractedAuthor)) {
      const temp = extractedTitle;
      extractedTitle = extractedAuthor;
      extractedAuthor = temp;
    }

    // Fallback inteligente do título e autor a partir do nome do ficheiro se ainda estiverem vazios
    if (!extractedTitle || !extractedAuthor) {
      const parsedFromFile = parseFileNameTitleAndAuthor(file.name);
      if (!extractedTitle && parsedFromFile.title) {
        extractedTitle = parsedFromFile.title;
      }
      if (!extractedAuthor && parsedFromFile.author) {
        extractedAuthor = parsedFromFile.author;
      }
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
