import { EXPANDED_CATEGORIES } from "./categoryData";
import { supabase } from "./supabase";

export interface OfficialBookSearchResult {
  title: string;
  author: string;
  synopsis: string;
  categoryName: string;
  categoryId?: string;
  coverUrl?: string;
  pageCount?: number;
  publisher?: string;
  publishedYear?: string;
  isbn?: string;
  source: "google_books" | "wikipedia" | "open_library" | "ai_local";
}

/**
 * Remove extensões, sufixos de sites de downloads e caracteres desnecessários
 */
export function cleanBookQuery(rawName: string): string {
  if (!rawName) return "";
  let clean = rawName.trim();

  // Remove extensão
  clean = clean.replace(/\.(pdf|epub|mobi|azw3|txt)$/i, "");

  // Remove etiquetas de download e sufixos
  clean = clean.replace(/(\[.*?\]|\(.*?\))/g, " ");
  clean = clean.replace(/(z-library|oceanofpdf|doceru|lelivros|baixa-livros|pdfdrive|vdoc\.pub|elivros|annas-archive|libgen)/gi, "");
  clean = clean.replace(/[_\-]+/g, " ");
  clean = clean.replace(/\s{2,}/g, " ").trim();

  return clean;
}

/**
 * Tenta decompor nomes de ficheiro no formato "Autor - Título" ou "Título - Autor"
 */
export function parseFileNameTitleAndAuthor(rawName: string): { title: string; author: string } {
  let base = rawName.replace(/\.(pdf|epub|mobi|azw3|txt)$/i, "").trim();
  base = base.replace(/(\[.*?\]|\(.*?\))/g, " ");
  base = base.replace(/(z-library|oceanofpdf|doceru|lelivros|baixa-livros|pdfdrive|vdoc\.pub|elivros|annas-archive)/gi, "");

  // Se tiver hífen divisor
  if (base.includes(" - ")) {
    const parts = base.split(" - ").map((p) => p.trim()).filter(Boolean);
    if (parts.length >= 2) {
      // Geralmente "Autor - Título" ou "Título - Autor"
      return {
        author: cleanBookQuery(parts[0]),
        title: cleanBookQuery(parts.slice(1).join(" "))
      };
    }
  }

  // Se tiver 'por' ou 'by'
  const byMatch = base.match(/^(.*?)\s+(?:por|by)\s+(.*)$/i);
  if (byMatch && byMatch[1] && byMatch[2]) {
    return {
      title: cleanBookQuery(byMatch[1]),
      author: cleanBookQuery(byMatch[2])
    };
  }

  return {
    title: cleanBookQuery(base),
    author: ""
  };
}

/**
 * Mapeia termos e categorias de catálogos internacionais para as categorias da aplicação
 */
export function mapOfficialCategoryToAppCategory(
  officialCategories: string[] = [],
  title = "",
  description = ""
): string {
  const combined = (officialCategories.join(" ") + " " + title + " " + description).toLowerCase();

  const rules: { target: string; keywords: string[] }[] = [
    {
      target: "Tecnologia, Programação & IA",
      keywords: ["computer", "programming", "software", "technology", "artificial intelligence", "data science", "web", "computação", "tecnologia", "código", "algoritmo", "python", "javascript", "engenharia de software"]
    },
    {
      target: "Finanças & Investimentos",
      keywords: ["finance", "investing", "investment", "money", "wealth", "stock", "finanças", "dinheiro", "ações", "mercado financeiro", "economia", "património", "juros"]
    },
    {
      target: "Negócios & Empreendedorismo",
      keywords: ["business", "entrepreneurship", "management", "leadership", "marketing", "sales", "strategy", "negócios", "empreendedorismo", "gestão", "liderança", "empresas", "vendas"]
    },
    {
      target: "Literatura Moçambicana & Africana",
      keywords: ["moçambique", "mozambique", "africa", "africana", "maputo", "mia couto", "craveirinha", "pauliana", "chiziane", "luanda", "angola", "savana", "literatura africana"]
    },
    {
      target: "Desenvolvimento Pessoal & Motivação",
      keywords: ["self-help", "motivation", "personal development", "habits", "productivity", "mindset", "autoajuda", "desenvolvimento pessoal", "hábitos", "motivação", "foco", "disciplina", "sucesso"]
    },
    {
      target: "Ficção Científica & Fantasia",
      keywords: ["science fiction", "sci-fi", "fantasy", "space", "galaxy", "magic", "ficção científica", "fantasia", "dragão", "espacial", "robô", "distopia", "futurismo"]
    },
    {
      target: "História & Civilizações",
      keywords: ["history", "civilization", "war", "empire", "revolution", "historical", "história", "guerra", "império", "século", "civilizações", "independência", "colonialismo"]
    },
    {
      target: "Psicologia & Relações Humanas",
      keywords: ["psychology", "behavior", "emotion", "mental health", "relationships", "psicologia", "comportamento", "emoção", "terapia", "mente", "ansiedade", "relações"]
    },
    {
      target: "Filosofia & Pensamento Crítico",
      keywords: ["philosophy", "ethics", "logic", "reason", "existence", "filosofia", "ética", "pensamento", "sócrates", "platão", "nietzsche", "estóico", "epicteto"]
    },
    {
      target: "Poesia & Letras",
      keywords: ["poetry", "poems", "verse", "poesia", "poemas", "versos", "lírica", "estrofe"]
    },
    {
      target: "Policial, Mistério & Suspense",
      keywords: ["mystery", "thriller", "crime", "detective", "suspense", "policial", "investigação", "assassinato", "mistério"]
    },
    {
      target: "Saúde, Medicina & Bem-Estar",
      keywords: ["health", "medicine", "fitness", "wellness", "diet", "nutrition", "saúde", "medicina", "bem-estar", "exercício", "alimentação", "nutrição", "clínica"]
    },
    {
      target: "Direito, Legislação & Cidadania",
      keywords: ["law", "legal", "justice", "constitution", "legislation", "direito", "legislação", "leis", "constituição", "justiça", "advocacia", "cidadania"]
    },
    {
      target: "Educação & Pedagogia",
      keywords: ["education", "teaching", "pedagogy", "school", "learning", "educação", "pedagogia", "ensino", "didática", "aprendizagem", "escola"]
    },
    {
      target: "Infantil & Literatura Juvenil",
      keywords: ["juvenile", "children", "kids", "fairy tale", "young adult", "infantil", "criança", "juvenil", "fábula", "contos infantis"]
    },
    {
      target: "Espiritualidade & Fé",
      keywords: ["religion", "spirituality", "faith", "christianity", "bible", "prayer", "god", "religião", "espiritualidade", "fé", "bíblia", "oração", "deus", "evangelho"]
    },
    {
      target: "Biografias & Grandes Vidas",
      keywords: ["biography", "autobiography", "memoir", "life story", "biografia", "autobiografia", "memórias"]
    },
    {
      target: "Culinária & Gastronomia",
      keywords: ["cooking", "cookbook", "culinary", "recipes", "food", "culinária", "gastronomia", "receitas", "cozinha"]
    },
    {
      target: "Ciências Exatas & Engenharia",
      keywords: ["mathematics", "physics", "chemistry", "engineering", "science", "matemática", "física", "química", "engenharia", "ciências"]
    },
    {
      target: "Política & Sociedade",
      keywords: ["politics", "political", "society", "sociology", "government", "política", "sociologia", "governo", "cidadão"]
    },
    {
      target: "Arte, Fotografia & Cultura",
      keywords: ["art", "photography", "design", "music", "cinema", "arte", "fotografia", "música", "cultura"]
    },
    {
      target: "Idiomas & Comunicação",
      keywords: ["language", "linguistics", "grammar", "english", "portuguese", "dicionário", "idiomas", "gramática", "comunicação", "inglês"]
    },
    {
      target: "Aventura, Crónicas & Viagens",
      keywords: ["adventure", "travel", "journey", "chronicles", "crónicas", "viagens", "aventura", "expedição"]
    },
    {
      target: "Romance & Drama",
      keywords: ["romance", "fiction", "drama", "novel", "love", "ficção", "novela", "paixão"]
    }
  ];

  for (const rule of rules) {
    if (rule.keywords.some((kw) => combined.includes(kw))) {
      return rule.target;
    }
  }

  return "Romance & Drama";
}

/**
 * Remove formatação HTML de sinopses retornadas por catálogos
 */
function cleanHtmlSynopsis(html: string): string {
  if (!html) return "";
  let clean = html.replace(/<[^>]*>/g, " ");
  clean = clean.replace(/&nbsp;/g, " ");
  clean = clean.replace(/&amp;/g, "&");
  clean = clean.replace(/&quot;/g, '"');
  clean = clean.replace(/&apos;/g, "'");
  clean = clean.replace(/&#39;/g, "'");
  clean = clean.replace(/&lt;/g, "<");
  clean = clean.replace(/&gt;/g, ">");
  clean = clean.replace(/\s{2,}/g, " ").trim();
  return clean;
}

/**
 * Pesquisa metadados e sinopse oficial na Google Books API, Wikipedia e Open Library
 */
export async function searchOfficialBookMetadata(
  titleOrFileName: string,
  authorHint = ""
): Promise<OfficialBookSearchResult | null> {
  const query = cleanBookQuery(titleOrFileName);
  if (!query || query.length < 2) return null;

  const parsed = parseFileNameTitleAndAuthor(titleOrFileName);
  const primaryTitle = parsed.title || query;
  const primaryAuthor = authorHint || parsed.author;

  // 1. Consulta à Google Books API (com múltiplos termos de busca)
  const searchVariations = [
    primaryAuthor ? `${primaryTitle} ${primaryAuthor}` : primaryTitle,
    primaryTitle,
    query
  ];

  for (const q of Array.from(new Set(searchVariations))) {
    try {
      const googleUrl = `https://www.googleapis.com/books/v1/volumes?q=${encodeURIComponent(q)}&maxResults=5&printType=books`;
      const res = await fetch(googleUrl);

      if (res.ok) {
        const data = await res.json();
        const items = data.items;

        if (items && Array.isArray(items) && items.length > 0) {
          const bestItem = items.find((it: any) => it.volumeInfo?.description) || items[0];
          const vol = bestItem.volumeInfo || {};

          const officialTitle = vol.title || primaryTitle;
          const officialAuthors = Array.isArray(vol.authors)
            ? vol.authors.join(", ")
            : (vol.authors || primaryAuthor);
          const rawDesc = vol.description || "";
          let cleanSynopsis = cleanHtmlSynopsis(rawDesc);

          // Se o Google Books não tiver descrição, tenta Wikipedia abaixo
          if (!cleanSynopsis || cleanSynopsis.length < 20) {
            const wikiDesc = await fetchWikipediaSummary(officialTitle);
            if (wikiDesc) cleanSynopsis = wikiDesc;
          }

          const officialCats = Array.isArray(vol.categories) ? vol.categories : [];
          const mappedCategory = mapOfficialCategoryToAppCategory(officialCats, officialTitle, cleanSynopsis);

          let coverUrl: string | undefined = undefined;
          if (vol.imageLinks) {
            coverUrl = vol.imageLinks.thumbnail || vol.imageLinks.smallThumbnail;
            if (coverUrl && coverUrl.startsWith("http://")) {
              coverUrl = coverUrl.replace("http://", "https://");
            }
          }

          const isbns = vol.industryIdentifiers?.map((i: any) => i.identifier).join(", ");

          return {
            title: officialTitle,
            author: officialAuthors,
            synopsis: cleanSynopsis,
            categoryName: mappedCategory,
            coverUrl,
            pageCount: vol.pageCount,
            publisher: vol.publisher,
            publishedYear: vol.publishedDate ? vol.publishedDate.slice(0, 4) : undefined,
            isbn: isbns,
            source: "google_books"
          };
        }
      }
    } catch (err) {
      console.warn("Consulta Google Books falhou para variação:", q, err);
    }
  }

  // 2. Consulta à Wikipedia em Português (Resumo Enciclopédico Oficial)
  try {
    const wikiSynopsis = await fetchWikipediaSummary(primaryTitle);
    if (wikiSynopsis && wikiSynopsis.length > 30) {
      const mappedCategory = mapOfficialCategoryToAppCategory([], primaryTitle, wikiSynopsis);
      return {
        title: primaryTitle,
        author: primaryAuthor,
        synopsis: wikiSynopsis,
        categoryName: mappedCategory,
        source: "wikipedia"
      };
    }
  } catch (wikiErr) {
    console.warn("Consulta Wikipedia falhou:", wikiErr);
  }

  // 3. Fallback: Open Library API
  try {
    const olUrl = `https://openlibrary.org/search.json?q=${encodeURIComponent(primaryTitle)}&limit=5`;
    const res = await fetch(olUrl);

    if (res.ok) {
      const data = await res.json();
      const docs = data.docs;

      if (docs && Array.isArray(docs) && docs.length > 0) {
        const doc = docs[0];
        const officialTitle = doc.title || primaryTitle;
        const officialAuthor = Array.isArray(doc.author_name)
          ? doc.author_name.join(", ")
          : (doc.author_name || primaryAuthor);
        const subjects = Array.isArray(doc.subject) ? doc.subject.slice(0, 5) : [];

        let synopsis = "";
        if (doc.key) {
          try {
            const workRes = await fetch(`https://openlibrary.org${doc.key}.json`);
            if (workRes.ok) {
              const workData = await workRes.json();
              if (typeof workData.description === "string") {
                synopsis = cleanHtmlSynopsis(workData.description);
              } else if (workData.description?.value) {
                synopsis = cleanHtmlSynopsis(workData.description.value);
              }
            }
          } catch {}
        }

        if (!synopsis && Array.isArray(doc.first_sentence)) {
          synopsis = doc.first_sentence.join(" ");
        }

        const mappedCategory = mapOfficialCategoryToAppCategory(subjects, officialTitle, synopsis);

        let coverUrl: string | undefined = undefined;
        if (doc.cover_i) {
          coverUrl = `https://covers.openlibrary.org/b/id/${doc.cover_i}-L.jpg`;
        }

        return {
          title: officialTitle,
          author: officialAuthor,
          synopsis,
          categoryName: mappedCategory,
          coverUrl,
          publishedYear: doc.first_publish_year ? String(doc.first_publish_year) : undefined,
          source: "open_library"
        };
      }
    }
  } catch (err) {
    console.warn("Falha na busca Open Library:", err);
  }

  return null;
}

/**
 * Consulta a Wikipedia em Português para obter o resumo oficial enciclopédico de uma obra literária
 */
async function fetchWikipediaSummary(bookTitle: string): Promise<string | null> {
  if (!bookTitle || bookTitle.length < 2) return null;

  try {
    const clean = bookTitle.trim().replace(/\s+/g, "_");
    const url = `https://pt.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(clean)}`;
    const res = await fetch(url);
    if (res.ok) {
      const data = await res.json();
      if (data && data.extract && data.type !== "disambiguation") {
        return cleanHtmlSynopsis(data.extract);
      }
    }
  } catch {}

  return null;
}

/**
 * Garante que a categoria mapeada está sincronizada na tabela categories do Supabase
 */
export async function syncOfficialCategory(categoryName: string): Promise<string | null> {
  if (!categoryName) return null;

  try {
    const { data: existing } = await supabase
      .from("categories")
      .select("id")
      .ilike("name", categoryName.trim())
      .maybeSingle();

    if (existing?.id) return existing.id;

    const { data: created, error } = await supabase
      .from("categories")
      .insert({ name: categoryName.trim() })
      .select("id")
      .maybeSingle();

    if (!error && created?.id) return created.id;
  } catch (err) {
    console.warn("Aviso ao sincronizar categoria oficial:", err);
  }

  const found = EXPANDED_CATEGORIES.find(
    (c) => c.name.toLowerCase() === categoryName.toLowerCase().trim()
  );
  return found?.id || null;
}
