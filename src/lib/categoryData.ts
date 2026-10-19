import { supabase } from "./supabase";

export interface AppCategory {
  id: string;
  name: string;
  slug?: string;
}

/**
 * Lista atualizada de 53 categorias/géneros literários oficiais
 */
export const EXPANDED_CATEGORIES: AppCategory[] = [
  { id: "cat-artes", name: "Artes" },
  { id: "cat-autoajuda", name: "Autoajuda" },
  { id: "cat-autobiografia", name: "Autobiografia" },
  { id: "cat-aventura", name: "Aventura" },
  { id: "cat-biografia", name: "Biografia" },
  { id: "cat-ciencia", name: "Ciência" },
  { id: "cat-classicos", name: "Clássicos" },
  { id: "cat-comedia", name: "Comédia" },
  { id: "cat-conto", name: "Conto" },
  { id: "cat-contos", name: "Contos" },
  { id: "cat-cronica", name: "Crônica" },
  { id: "cat-culinaria", name: "Culinária" },
  { id: "cat-direito", name: "Direito" },
  { id: "cat-distopia", name: "Distopia" },
  { id: "cat-drama", name: "Drama" },
  { id: "cat-economia", name: "Economia" },
  { id: "cat-educacao", name: "Educação" },
  { id: "cat-ensaios", name: "Ensaios" },
  { id: "cat-espiritismo", name: "Espiritismo" },
  { id: "cat-espiritualidade", name: "Espiritualidade" },
  { id: "cat-fantasia", name: "Fantasia" },
  { id: "cat-ficcao", name: "Ficção" },
  { id: "cat-ficcao-cientifica", name: "Ficção Científica" },
  { id: "cat-ficcao-contemporanea", name: "Ficção Contemporânea" },
  { id: "cat-ficcao-historica", name: "Ficção Histórica" },
  { id: "cat-filosofia", name: "Filosofia" },
  { id: "cat-historia", name: "História" },
  { id: "cat-infantojuvenil", name: "Infantojuvenil" },
  { id: "cat-jovem-adulto", name: "Jovem Adulto" },
  { id: "cat-literatura-brasileira", name: "Literatura Brasileira" },
  { id: "cat-literatura-portuguesa", name: "Literatura Portuguesa" },
  { id: "cat-misterio", name: "Mistério" },
  { id: "cat-musica", name: "Música" },
  { id: "cat-naturalismo", name: "Naturalismo" },
  { id: "cat-negocios", name: "Negócios" },
  { id: "cat-nao-ficcao", name: "Não Ficção" },
  { id: "cat-poesia", name: "Poesia" },
  { id: "cat-politica", name: "Política" },
  { id: "cat-psicologia", name: "Psicologia" },
  { id: "cat-quadrinhos", name: "Quadrinhos" },
  { id: "cat-realismo", name: "Realismo" },
  { id: "cat-religiao", name: "Religião" },
  { id: "cat-romance", name: "Romance" },
  { id: "cat-romance-policial", name: "Romance Policial" },
  { id: "cat-romantismo", name: "Romantismo" },
  { id: "cat-saude", name: "Saúde" },
  { id: "cat-sociologia", name: "Sociologia" },
  { id: "cat-suspense", name: "Suspense" },
  { id: "cat-satira", name: "Sátira" },
  { id: "cat-teatro", name: "Teatro" },
  { id: "cat-terror", name: "Terror" },
  { id: "cat-viagens", name: "Viagens" },
  { id: "cat-epico", name: "Épico" }
];

/**
 * Mapeamento de categorias antigas para as novas para manter livros existentes visíveis
 */
export const LEGACY_CATEGORY_MAPPING: Record<string, string> = {
  "romance & drama": "Romance",
  "ficção científica & fantasia": "Ficção Científica",
  "literatura moçambicana & africana": "Contos",
  "desenvolvimento pessoal & motivação": "Autoajuda",
  "negócios & empreendedorismo": "Negócios",
  "finanças & investimentos": "Economia",
  "história & civilizações": "História",
  "educação & pedagogia": "Educação",
  "tecnologia, programação & ia": "Ciência",
  "tecnologia": "Ciência",
  "saúde, medicina & bem-estar": "Saúde",
  "direito, legislação & cidadania": "Direito",
  "psicologia & relações humanas": "Psicologia",
  "filosofia & pensamento crítico": "Filosofia",
  "poesia & letras": "Poesia",
  "biografias & grandes vidas": "Biografia",
  "espiritualidade & fé": "Espiritualidade",
  "infantil & literatura juvenil": "Infantojuvenil",
  "ciências exatas & engenharia": "Ciência",
  "política & sociedade": "Política",
  "arte, fotografia & cultura": "Artes",
  "idiomas & comunicação": "Educação",
  "policial, mistério & suspense": "Suspense",
  "culinária & gastronomia": "Culinária",
  "aventura, crónicas & viagens": "Aventura",
  "2c57a0f9-be09-462b-977c-c4eb27192496": "Romance", // Romance & Drama
  "c493760c-3a10-4478-a277-3a861550b0f8": "Ficção Científica", // Ficção Científica & Fantasia
  "283023ac-f2e4-41a5-b23f-644fec03ad8c": "Contos", // Literatura Moçambicana & Africana
  "e992df36-b6aa-40d9-8882-f9723d47e865": "Autoajuda", // Desenvolvimento Pessoal & Motivação
  "c15a457f-8989-48cd-a314-392f3a0525ef": "Negócios", // Negócios & Empreendedorismo
  "412de605-35b2-4a9b-a5e7-79dd392dc54e": "Economia", // Finanças & Investimentos
  "91c45efb-bc5b-4948-bdce-091b96edcb59": "História", // História & Civilizações
  "dced28f7-9758-44c5-a9cf-a9347cab1378": "Educação", // Educação & Pedagogia
  "58e65e9e-677b-4cdb-be5e-11d5aee7a579": "Ciência", // Tecnologia, Programação & IA
  "d2f0b0b4-5318-4936-9009-5b4a786f38de": "Saúde", // Saúde, Medicina & Bem-Estar
  "a2344f77-9b0a-495c-a342-485188541f82": "Direito", // Direito, Legislação & Cidadania
  "31c042af-6dff-487b-ba95-0fdf434f2c92": "Psicologia", // Psicologia & Relações Humanas
  "3990a1c0-60b6-4b77-ac6a-ff9fca808513": "Filosofia", // Filosofia & Pensamento Crítico
  "e0fd1816-7a2a-4c3e-9eee-1f332e0cc10d": "Poesia", // Poesia & Letras
  "bead85b3-62de-4b28-992f-e4303f84777f": "Biografia", // Biografias & Grandes Vidas
  "895e9b53-2f1d-411b-9f89-826f6271efd0": "Espiritualidade", // Espiritualidade & Fé
  "0b000b26-9419-4508-85de-b9c3a21a9c97": "Infantojuvenil", // Infantil & Literatura Juvenil
  "b560f037-eaa5-41b8-b39a-a706b2ef9e4e": "Ciência", // Ciências Exatas & Engenharia
  "33070847-a5e2-4111-b573-7bf464493397": "Política", // Política & Sociedade
  "05971fc2-b488-4326-83f8-85e82a6871a3": "Artes", // Arte, Fotografia & Cultura
  "641cb9cd-67a2-4fee-8152-577a9b07b86b": "Educação", // Idiomas & Comunicação
  "70bac1a7-1866-4b24-a9b2-e5f011d5fef3": "Suspense", // Policial, Mistério & Suspense
  "c5419333-45e0-478c-8417-ddc4105ef1dc": "Culinária", // Culinária & Gastronomia
  "300dfa17-7509-4c4a-a932-cd4c2f6c68a1": "Aventura", // Aventura, Crónicas & Viagens
  "3ce02700-c3d2-46e2-8924-5aa7029ffb4c": "Ciência", // Tecnologia
};

let cachedMergedCategories: AppCategory[] | null = null;

/**
 * Carrega as categorias oficiais garantindo que apenas as 53 novas categorias
 * estejam ativas no sistema, removendo as anteriores.
 */
export async function loadAndSyncCategories(forceRefresh = false): Promise<AppCategory[]> {
  if (cachedMergedCategories && !forceRefresh) {
    return cachedMergedCategories;
  }

  try {
    const { data: dbCategories, error } = await supabase
      .from("categories")
      .select("id, name")
      .order("name");

    const categoryMap = new Map<string, AppCategory>();

    // 1. Regista as 53 novas categorias
    EXPANDED_CATEGORIES.forEach((cat) => {
      categoryMap.set(cat.name.toLowerCase().trim(), { ...cat });
    });

    // 2. Sobrepõe apenas se a categoria da base de dados pertencer à nova lista (remove as anteriores)
    if (!error && dbCategories && dbCategories.length > 0) {
      dbCategories.forEach((dbCat: any) => {
        const key = dbCat.name.toLowerCase().trim();
        if (categoryMap.has(key)) {
          categoryMap.set(key, {
            id: dbCat.id,
            name: categoryMap.get(key)!.name,
          });
        }
      });
    }

    const merged = Array.from(categoryMap.values()).sort((a, b) =>
      a.name.localeCompare(b.name, "pt", { sensitivity: "base" })
    );

    cachedMergedCategories = merged;
    return merged;
  } catch (err) {
    console.warn("Falha ao sincronizar categorias com a base de dados:", err);
    return EXPANDED_CATEGORIES;
  }
}

/**
 * Mapeia IDs ou nomes de categorias legadas (anteriores) para os IDs das novas categorias
 */
export function resolveLegacyCategory(
  legacyIdOrName: string | null | undefined,
  currentCategories: AppCategory[]
): string | null {
  if (!legacyIdOrName) return null;

  // 1. Se já for uma categoria atual válida
  const directMatch = currentCategories.find(
    (c) => c.id === legacyIdOrName || c.name.toLowerCase().trim() === legacyIdOrName.toLowerCase().trim()
  );
  if (directMatch) return directMatch.id;

  // 2. Se for um UUID legado ou nome antigo
  const lower = legacyIdOrName.toLowerCase().trim();
  const targetNewName = LEGACY_CATEGORY_MAPPING[lower] || LEGACY_CATEGORY_MAPPING[legacyIdOrName];
  if (targetNewName) {
    const mapped = currentCategories.find(
      (c) => c.name.toLowerCase().trim() === targetNewName.toLowerCase().trim()
    );
    if (mapped) return mapped.id;
  }

  // 3. Procura parcial inteligente
  const partial = currentCategories.find((c) => {
    const catLower = c.name.toLowerCase();
    return catLower.includes(lower) || lower.includes(catLower);
  });
  if (partial) return partial.id;

  return null;
}

/**
 * Encontra o ID da categoria correspondente ao nome sugerido pela IA ou texto
 */
export function matchCategoryByName(
  suggestedName: string,
  availableCategories: AppCategory[]
): string | null {
  if (!suggestedName) return null;
  const clean = suggestedName.toLowerCase().trim();

  // 1. Correspondência exata
  const exact = availableCategories.find(
    (c) => c.name.toLowerCase().trim() === clean
  );
  if (exact) return exact.id;

  // 2. Mapeamento legado se aplicável
  const legacyTarget = LEGACY_CATEGORY_MAPPING[clean];
  if (legacyTarget) {
    const matchedLegacy = availableCategories.find(
      (c) => c.name.toLowerCase().trim() === legacyTarget.toLowerCase().trim()
    );
    if (matchedLegacy) return matchedLegacy.id;
  }

  // 3. Correspondência parcial / por palavras-chave
  const partial = availableCategories.find((c) => {
    const catLower = c.name.toLowerCase();
    return (
      catLower.includes(clean) ||
      clean.includes(catLower) ||
      c.name.split(/[&,/\s]+/).some((word) => word.length > 3 && clean.includes(word.toLowerCase()))
    );
  });

  return partial ? partial.id : null;
}
