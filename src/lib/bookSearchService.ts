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
  source: "google_books" | "open_library" | "ai_local";
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
  clean = clean.replace(/(z-library|oceanofpdf|doceru|lelivros|baixa-livros|pdfdrive|vdoc\.pub|elivros|annas-archive)/gi, "");
  clean = clean.replace(/[_\-]+/g, " ");
  clean = clean.replace(/\s{2,}/g, " ").trim();

  return clean;
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
 * Pesquisa metadados e sinopse oficial na Google Books API e Open Library
 */
export async function searchOfficialBookMetadata(
  titleOrFileName: string,
  authorHint = ""
): Promise<OfficialBookSearchResult | null> {
  const query = cleanBookQuery(titleOrFileName);
  if (!query || query.length < 2) return null;

  const searchQuery = authorHint
    ? `${query} ${cleanBookQuery(authorHint)}`
    : query;

  // 1. Consulta à Google Books API (Catálogo Oficial Mundial com suporte robusto em português)
  try {
    const googleUrl = `https://www.googleapis.com/books/v1/volumes?q=${encodeURIComponent(searchQuery)}&maxResults=5&printType=books`;
    const res = await fetch(googleUrl);

    if (res.ok) {
      const data = await res.json();
      const items = data.items;

      if (items && Array.isArray(items) && items.length > 0) {
        // Encontra o item com melhor sinopse e detalhes
        const bestItem = items.find((it: any) => it.volumeInfo?.description) || items[0];
        const vol = bestItem.volumeInfo || {};

        const officialTitle = vol.title || query;
        const officialAuthors = Array.isArray(vol.authors) ? vol.authors.join(", ") : (vol.authors || authorHint);
        const rawDesc = vol.description || "";
        const cleanSynopsis = cleanHtmlSynopsis(rawDesc);
        const officialCats = Array.isArray(vol.categories) ? vol.categories : [];
        const mappedCategory = mapOfficialCategoryToAppCategory(officialCats, officialTitle, cleanSynopsis);

        // Capa em alta resolução se disponível
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
    console.warn("Falha na busca Google Books:", err);
  }

  // 2. Fallback: Open Library API
  try {
    const olUrl = `https://openlibrary.org/search.json?q=${encodeURIComponent(searchQuery)}&limit=5`;
    const res = await fetch(olUrl);

    if (res.ok) {
      const data = await res.json();
      const docs = data.docs;

      if (docs && Array.isArray(docs) && docs.length > 0) {
        const doc = docs[0];
        const officialTitle = doc.title || query;
        const officialAuthor = Array.isArray(doc.author_name) ? doc.author_name.join(", ") : (doc.author_name || authorHint);
        const subjects = Array.isArray(doc.subject) ? doc.subject.slice(0, 5) : [];
        const mappedCategory = mapOfficialCategoryToAppCategory(subjects, officialTitle);

        let synopsis = "";
        // Se houver first_sentence ou key de obra, tenta obter a descrição
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

        let coverUrl: string | undefined = undefined;
        if (doc.cover_i) {
          coverUrl = `https://covers.openlibrary.org/b/id/${doc.cover_i}-L.jpg`;
        }

        return {
          title: officialTitle,
          author: officialAuthor,
          synopsis: synopsis,
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
 * Garante que a categoria mapeada está sincronizada na tabela categories do Supabase
 */
export async function syncOfficialCategory(categoryName: string): Promise<string | null> {
  if (!categoryName) return null;

  try {
    // 1. Procura categoria existente
    const { data: existing } = await supabase
      .from("categories")
      .select("id")
      .ilike("name", categoryName.trim())
      .maybeSingle();

    if (existing?.id) return existing.id;

    // 2. Se não existir, insere
    const { data: created, error } = await supabase
      .from("categories")
      .insert({ name: categoryName.trim() })
      .select("id")
      .maybeSingle();

    if (!error && created?.id) return created.id;
  } catch (err) {
    console.warn("Aviso ao sincronizar categoria oficial:", err);
  }

  // 3. Fallback: procura correspondência na lista expandida
  const found = EXPANDED_CATEGORIES.find(
    (c) => c.name.toLowerCase() === categoryName.toLowerCase().trim()
  );
  return found?.id || null;
}
