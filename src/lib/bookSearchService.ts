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
 * Verifica se uma string se assemelha tipicamente a um título de obra literária
 */
export function looksLikeTitle(str: string): boolean {
  const s = str.trim();
  if (!s) return false;

  // Inicia com artigos ou pronomes definidos/indefinidos em português/inglês/espanhol
  if (/^(o|a|os|as|um|uma|uns|umas|the|an|el|la|los|las|un|una)\s+/i.test(s)) return true;

  // Inicia com termos comuns em títulos de livros
  if (/^(como|por que|porque|quando|onde|quem|qual|o que|guia|manual|história|historia|lições|licoes|princípios|principios|segredos|arte|poder|livro|fundamentos|regras|introdução|introducao|tratado|ensaio|diário|diario|cartas|memórias|memorias|contos|poemas|crónicas|cronicas|relato|caminho|método|metodo)\s+/i.test(s)) return true;

  // Contém números (ex: 1984, 21 Lições, Volume 2, Livro 1)
  if (/\b\d{1,4}\b/.test(s)) return true;

  // Contém pontuação característica de títulos com subtítulo
  if (/[:;?!]/.test(s)) return true;
  if (/\b(vol|volume|edição|edicao|parte|livro|capítulo|capitulo)\b/i.test(s)) return true;

  // Títulos descritivos geralmente contêm 5 ou mais palavras
  const words = s.split(/\s+/).filter(Boolean);
  if (words.length >= 5) return true;

  return false;
}

/**
 * Verifica se uma string se assemelha tipicamente a um nome de autor (pessoa)
 */
export function looksLikeAuthor(str: string): boolean {
  const s = str.trim();
  if (!s) return false;

  // Nomes de autores não contêm números ou pontuações como : ? !
  if (/[:;?!]/.test(s) || /\d/.test(s)) return false;

  // Se começar por artigos típicos de títulos, não é nome de autor
  if (/^(o|a|os|as|um|uma|the|como|guia|manual|história|historia|lições|licoes)\s+/i.test(s)) return false;

  const words = s.split(/\s+/).filter(Boolean);
  // Nomes de autores têm geralmente entre 2 a 4 palavras (ex: Mia Couto, Paulo Coelho, George Orwell, Machado de Assis)
  if (words.length >= 2 && words.length <= 4) {
    const validCapitalization = words.every((w, idx) => {
      const lower = w.toLowerCase();
      if (idx > 0 && ["de", "da", "do", "dos", "das", "e", "van", "von", "del", "la"].includes(lower)) {
        return true;
      }
      return /^[A-ZÀ-Ú]/.test(w);
    });
    if (validCapitalization) return true;
  }

  return false;
}

/**
 * Decompõe inteligentemente nomes de ficheiro no formato "Título - Autor" ou "Autor - Título",
 * identificando corretamente qual é o título da obra e qual é o nome do autor.
 */
export function parseFileNameTitleAndAuthor(rawName: string): { title: string; author: string } {
  if (!rawName) return { title: "", author: "" };

  let base = rawName.replace(/\.(pdf|epub|mobi|azw3|txt)$/i, "").trim();

  // 1. Remove sufixos e tags de sites conhecidos de download
  base = base.replace(/(z-library|oceanofpdf|doceru|lelivros|baixa-livros|pdfdrive|vdoc\.pub|elivros|annas-archive|libgen)/gi, "");

  // 2. Extrai autor se estiver formatado entre parêntesis ou colchetes: "Título (Autor)" ou "Título [Autor]"
  const bracketMatch = base.match(/^(.*?)\s*[\(\[]([A-Za-zÀ-ÿ\s\.\,\'\-]+)[\)\]]\s*$/);
  if (bracketMatch && bracketMatch[1] && bracketMatch[2]) {
    const potentialTitle = bracketMatch[1].trim();
    const potentialAuthor = bracketMatch[2].trim();
    if (
      potentialAuthor.length > 2 &&
      !/^(pdf|epub|completo|livro|download|pt|en|scan|hq|edicao|\d+)$/i.test(potentialAuthor)
    ) {
      return {
        title: cleanBookQuery(potentialTitle),
        author: cleanBookQuery(potentialAuthor),
      };
    }
  }

  // Remove parênteses restantes não relacionados com autoria
  base = base.replace(/(\[.*?\]|\(.*?\))/g, " ");

  // 3. Se tiver indicação explícita de autoria: "Título por Autor" ou "Título by Autor"
  const byMatch = base.match(/^(.*?)\s+(?:por|by|escrito por)\s+(.*)$/i);
  if (byMatch && byMatch[1] && byMatch[2]) {
    return {
      title: cleanBookQuery(byMatch[1]),
      author: cleanBookQuery(byMatch[2]),
    };
  }

  // 4. Divisor de hífen ou travessão (" - ", " – ", " — " ou "_-_")
  const normalizedSeparators = base
    .replace(/[_\s]*[–—][_\s]*/g, " - ")
    .replace(/_+/g, " ")
    .replace(/\s+-\s+/g, " - ");

  if (normalizedSeparators.includes(" - ")) {
    const parts = normalizedSeparators.split(" - ").map((p) => p.trim()).filter(Boolean);
    if (parts.length >= 2) {
      const part0 = cleanBookQuery(parts[0]);
      const part1 = cleanBookQuery(parts.slice(1).join(" "));

      // Heurística de desambiguação inteligente entre Título e Autor
      const part0IsTitle = looksLikeTitle(part0);
      const part1IsTitle = looksLikeTitle(part1);
      const part0IsAuthor = looksLikeAuthor(part0);
      const part1IsAuthor = looksLikeAuthor(part1);

      // Se part0 for claramente título ou part1 for claramente autor:
      // Exemplo: "O Alquimista - Paulo Coelho" ou "1984 - George Orwell"
      if ((part0IsTitle && !part1IsTitle) || (part1IsAuthor && !part0IsAuthor)) {
        return {
          title: part0,
          author: part1,
        };
      }

      // Se part1 for claramente título ou part0 for claramente autor:
      // Exemplo: "Paulo Coelho - O Alquimista" ou "Mia Couto - O Outro Pé da Sereia"
      if ((part1IsTitle && !part0IsTitle) || (part0IsAuthor && !part1IsAuthor)) {
        return {
          title: part1,
          author: part0,
        };
      }

      // Convenção padrão na vasta maioria dos livros digitais: "Título - Autor"
      // (ex: "Terra Sonâmbula - Mia Couto")
      return {
        title: part0,
        author: part1,
      };
    }
  }

  return {
    title: cleanBookQuery(base),
    author: "",
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
      target: "Ciência",
      keywords: ["computer", "programming", "software", "technology", "artificial intelligence", "data science", "web", "computação", "tecnologia", "código", "algoritmo", "python", "javascript", "engenharia de software", "mathematics", "physics", "chemistry", "engineering", "science", "matemática", "física", "química", "engenharia", "ciências"]
    },
    {
      target: "Economia",
      keywords: ["finance", "investing", "investment", "money", "wealth", "stock", "finanças", "dinheiro", "ações", "mercado financeiro", "economia", "património", "juros"]
    },
    {
      target: "Negócios",
      keywords: ["business", "entrepreneurship", "management", "leadership", "marketing", "sales", "strategy", "negócios", "empreendedorismo", "gestão", "liderança", "empresas", "vendas"]
    },
    {
      target: "Autoajuda",
      keywords: ["self-help", "motivation", "personal development", "habits", "productivity", "mindset", "autoajuda", "desenvolvimento pessoal", "hábitos", "motivação", "foco", "disciplina", "sucesso"]
    },
    {
      target: "Ficção Científica",
      keywords: ["science fiction", "sci-fi", "space", "galaxy", "espacial", "robô", "futurismo"]
    },
    {
      target: "Fantasia",
      keywords: ["fantasy", "magic", "fantasia", "dragão", "feitiço", "mago", "elfo"]
    },
    {
      target: "Distopia",
      keywords: ["dystopia", "distopia", "totalitário", "autoritário", "futuro sombrio"]
    },
    {
      target: "História",
      keywords: ["history", "civilization", "war", "empire", "revolution", "historical", "história", "guerra", "império", "século", "civilizações", "independência", "colonialismo"]
    },
    {
      target: "Psicologia",
      keywords: ["psychology", "behavior", "emotion", "mental health", "relationships", "psicologia", "comportamento", "emoção", "terapia", "mente", "ansiedade", "relações"]
    },
    {
      target: "Filosofia",
      keywords: ["philosophy", "ethics", "logic", "reason", "existence", "filosofia", "ética", "pensamento", "sócrates", "platão", "nietzsche", "estóico", "epicteto"]
    },
    {
      target: "Poesia",
      keywords: ["poetry", "poems", "verse", "poesia", "poemas", "versos", "lírica", "estrofe"]
    },
    {
      target: "Romance Policial",
      keywords: ["detective", "crime", "investigação", "policial", "sherlock", "agatha christie", "assassino", "investigador"]
    },
    {
      target: "Suspense",
      keywords: ["thriller", "suspense", "tensão", "mistério"]
    },
    {
      target: "Mistério",
      keywords: ["mystery", "mistério", "enigma", "segredo obscuro"]
    },
    {
      target: "Saúde",
      keywords: ["health", "medicine", "fitness", "wellness", "diet", "nutrition", "saúde", "medicina", "bem-estar", "exercício", "alimentação", "nutrição", "clínica"]
    },
    {
      target: "Direito",
      keywords: ["law", "legal", "justice", "constitution", "legislation", "direito", "legislação", "leis", "constituição", "justiça", "advocacia", "cidadania"]
    },
    {
      target: "Educação",
      keywords: ["education", "teaching", "pedagogy", "school", "learning", "educação", "pedagogia", "ensino", "didática", "aprendizagem", "escola"]
    },
    {
      target: "Infantojuvenil",
      keywords: ["juvenile", "children", "kids", "fairy tale", "infantil", "criança", "fábula", "contos infantis"]
    },
    {
      target: "Jovem Adulto",
      keywords: ["young adult", "ya", "adolescente", "jovem adulto", "coming of age"]
    },
    {
      target: "Espiritualidade",
      keywords: ["spirituality", "espiritualidade", "alma", "meditação", "paz interior"]
    },
    {
      target: "Espiritismo",
      keywords: ["spiritism", "espiritismo", "allan kardec", "chico xavier", "médium", "reencarnação"]
    },
    {
      target: "Religião",
      keywords: ["religion", "faith", "christianity", "bible", "prayer", "god", "religião", "fé", "bíblia", "oração", "deus", "evangelho", "teologia", "igreja"]
    },
    {
      target: "Biografia",
      keywords: ["biography", "memoir", "life story", "biografia", "memórias", "trajetória"]
    },
    {
      target: "Autobiografia",
      keywords: ["autobiography", "autobiografia", "minha vida"]
    },
    {
      target: "Culinária",
      keywords: ["cooking", "cookbook", "culinary", "recipes", "food", "culinária", "gastronomia", "receitas", "cozinha"]
    },
    {
      target: "Política",
      keywords: ["politics", "political", "government", "política", "governo", "estado", "eleições", "democracia"]
    },
    {
      target: "Sociologia",
      keywords: ["sociology", "society", "sociologia", "sociedade", "social", "culturas"]
    },
    {
      target: "Artes",
      keywords: ["art", "photography", "design", "cinema", "arte", "fotografia", "pintura", "arquitetura", "cultura"]
    },
    {
      target: "Música",
      keywords: ["music", "música", "canção", "álbum", "compositor", "partitura", "instrumento"]
    },
    {
      target: "Aventura",
      keywords: ["adventure", "journey", "aventura", "expedição", "explorador"]
    },
    {
      target: "Viagens",
      keywords: ["travel", "viagens", "viagem", "roteiro", "turismo", "mochilão"]
    },
    {
      target: "Teatro",
      keywords: ["theatre", "theater", "play", "dramaturgia", "teatro", "peça teatral", "ato", "cena"]
    },
    {
      target: "Terror",
      keywords: ["horror", "terror", "assombração", "pesadelo", "monstro", "vampiro"]
    },
    {
      target: "Quadrinhos",
      keywords: ["comics", "manga", "hq", "quadrinhos", "graphic novel", "tiras", "mangá"]
    },
    {
      target: "Clássicos",
      keywords: ["classic", "clássicos", "obras primas", "cânone", "literatura clássica"]
    },
    {
      target: "Literatura Portuguesa",
      keywords: ["literatura portuguesa", "portugal", "eça de queirós", "camões", "pessoa", "saramago", "lisboa", "porto"]
    },
    {
      target: "Literatura Brasileira",
      keywords: ["literatura brasileira", "brasil", "machado de assis", "clarice lispector", "jorge amado", "guimarães rosa"]
    },
    {
      target: "Contos",
      keywords: ["short stories", "contos", "coletânea de contos", "antologia"]
    },
    {
      target: "Conto",
      keywords: ["conto", "fábula curta"]
    },
    {
      target: "Crônica",
      keywords: ["crônica", "crónicas", "chronicles", "crónica"]
    },
    {
      target: "Ensaios",
      keywords: ["essays", "ensaios", "ensaio crítico"]
    },
    {
      target: "Não Ficção",
      keywords: ["non-fiction", "não ficção", "fato real", "documentário", "jornalismo"]
    },
    {
      target: "Sátira",
      keywords: ["satire", "sátira", "paródia", "ironia"]
    },
    {
      target: "Comédia",
      keywords: ["comedy", "humor", "comédia", "engraçado"]
    },
    {
      target: "Épico",
      keywords: ["epic", "épico", "ilíada", "odisseia", "heroico", "saga épica"]
    },
    {
      target: "Romantismo",
      keywords: ["romantismo", "romântico", "século xix romântico", "goethe", "alencar"]
    },
    {
      target: "Realismo",
      keywords: ["realismo", "realista", "balzac", "flaubert"]
    },
    {
      target: "Naturalismo",
      keywords: ["naturalismo", "naturalista", "zola", "aluísio azevedo"]
    },
    {
      target: "Ficção Histórica",
      keywords: ["historical fiction", "ficção histórica", "romance histórico"]
    },
    {
      target: "Ficção Contemporânea",
      keywords: ["contemporary fiction", "ficção contemporânea"]
    },
    {
      target: "Drama",
      keywords: ["drama", "conflito familiar", "tragédia"]
    },
    {
      target: "Romance",
      keywords: ["romance", "fiction", "novel", "love", "ficção", "novela", "paixão"]
    }
  ];

  for (const rule of rules) {
    if (rule.keywords.some((kw) => combined.includes(kw))) {
      return rule.target;
    }
  }

  return "Romance";
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
