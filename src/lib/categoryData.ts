export interface AppCategory {
  id: string;
  name: string;
  slug?: string;
}

/**
 * Lista rica e abrangente de categorias literárias
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
