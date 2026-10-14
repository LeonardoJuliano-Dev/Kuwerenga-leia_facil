import { supabase } from "./supabase";

export interface AppCategory {
  id: string;
  name: string;
  slug?: string;
}

/**
 * Lista rica e abrangente de 24 categorias literárias essenciais
 */
export const EXPANDED_CATEGORIES: AppCategory[] = [
  { id: "cat-romance", name: "Romance & Drama" },
  { id: "cat-ficcao", name: "Ficção Científica & Fantasia" },
  { id: "cat-mocambicana", name: "Literatura Moçambicana & Africana" },
  { id: "cat-desenvolvimento", name: "Desenvolvimento Pessoal & Motivação" },
  { id: "cat-negocios", name: "Negócios & Empreendedorismo" },
  { id: "cat-financas", name: "Finanças & Investimentos" },
  { id: "cat-historia", name: "História & Civilizações" },
  { id: "cat-educacao", name: "Educação & Pedagogia" },
  { id: "cat-tecnologia", name: "Tecnologia, Programação & IA" },
  { id: "cat-saude", name: "Saúde, Medicina & Bem-Estar" },
  { id: "cat-direito", name: "Direito, Legislação & Cidadania" },
  { id: "cat-psicologia", name: "Psicologia & Relações Humanas" },
  { id: "cat-filosofia", name: "Filosofia & Pensamento Crítico" },
  { id: "cat-poesia", name: "Poesia & Letras" },
  { id: "cat-biografia", name: "Biografias & Grandes Vidas" },
  { id: "cat-espiritualidade", name: "Espiritualidade & Fé" },
  { id: "cat-infantil", name: "Infantil & Literatura Juvenil" },
  { id: "cat-ciencias", name: "Ciências Exatas & Engenharia" },
  { id: "cat-politica", name: "Política & Sociedade" },
  { id: "cat-arte", name: "Arte, Fotografia & Cultura" },
  { id: "cat-idiomas", name: "Idiomas & Comunicação" },
  { id: "cat-suspense", name: "Policial, Mistério & Suspense" },
  { id: "cat-culinaria", name: "Culinária & Gastronomia" },
  { id: "cat-aventura", name: "Aventura, Crónicas & Viagens" }
];

let cachedMergedCategories: AppCategory[] | null = null;

/**
 * Carrega todas as categorias da base de dados e mescla com a lista expandida rica,
 * garantindo que todas as 24 categorias estejam sempre disponíveis em todos os formulários.
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

    // 1. Regista as categorias expandidas predefinidas
    EXPANDED_CATEGORIES.forEach((cat) => {
      categoryMap.set(cat.name.toLowerCase().trim(), { ...cat });
    });

    // 2. Sobrepõe com as categorias existentes no Supabase (mantendo os UUIDs reais)
    if (!error && dbCategories && dbCategories.length > 0) {
      dbCategories.forEach((dbCat: any) => {
        const key = dbCat.name.toLowerCase().trim();
        categoryMap.set(key, {
          id: dbCat.id,
          name: dbCat.name,
        });
      });
    }

    const merged = Array.from(categoryMap.values()).sort((a, b) =>
      a.name.localeCompare(b.name, "pt")
    );

    cachedMergedCategories = merged;
    return merged;
  } catch (err) {
    console.warn("Falha ao sincronizar categorias com a base de dados:", err);
    return EXPANDED_CATEGORIES;
  }
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

  // 2. Correspondência parcial / por palavras-chave
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
