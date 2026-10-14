-- ==============================================================================
-- Script de Expansão de Categorias e Moderação de Livros pelo Administrador
-- Executar no SQL Editor do Supabase
-- ==============================================================================

-- 1. Inserir as 24 categorias literárias sem apagar nem duplicar as existentes
INSERT INTO public.categories (name, icon) VALUES
  ('Romance & Drama', 'heart'),
  ('Ficção Científica & Fantasia', 'rocket'),
  ('Literatura Moçambicana & Africana', 'book-open'),
  ('Desenvolvimento Pessoal & Motivação', 'star'),
  ('Negócios & Empreendedorismo', 'briefcase'),
  ('Finanças & Investimentos', 'dollar-sign'),
  ('História & Civilizações', 'history'),
  ('Educação & Pedagogia', 'graduation-cap'),
  ('Tecnologia, Programação & IA', 'monitor'),
  ('Saúde, Medicina & Bem-Estar', 'activity'),
  ('Direito, Legislação & Cidadania', 'shield'),
  ('Psicologia & Relações Humanas', 'users'),
  ('Filosofia & Pensamento Crítico', 'brain'),
  ('Poesia & Letras', 'feather'),
  ('Biografias & Grandes Vidas', 'award'),
  ('Espiritualidade & Fé', 'sun'),
  ('Infantil & Literatura Juvenil', 'smile'),
  ('Ciências Exatas & Engenharia', 'compass'),
  ('Política & Sociedade', 'globe'),
  ('Arte, Fotografia & Cultura', 'palette'),
  ('Idiomas & Comunicação', 'message-circle'),
  ('Policial, Mistério & Suspense', 'search'),
  ('Culinária & Gastronomia', 'coffee'),
  ('Aventura, Crónicas & Viagens', 'map')
ON CONFLICT (name) DO NOTHING;

-- 2. Garantir que utilizadores autenticados possam ler todas as categorias
ALTER TABLE public.categories ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Categories are viewable by everyone" ON public.categories;
CREATE POLICY "Categories are viewable by everyone"
  ON public.categories FOR SELECT
  USING (true);

-- 3. Assegurar políticas de moderação para o Administrador (leonardojulianoj@gmail.com)
-- Permite ao admin visualizar todos os livros (mesmo os que estão pendentes de aprovação: is_approved = false)
DROP POLICY IF EXISTS "Admin can view all books" ON public.books;
CREATE POLICY "Admin can view all books"
  ON public.books FOR SELECT
  USING (
    auth.jwt() ->> 'email' = 'leonardojulianoj@gmail.com'
    OR is_approved = true
    OR auth.uid() = uploaded_by
  );

-- Permite ao admin aprovar ou rejeitar/atualizar qualquer livro
DROP POLICY IF EXISTS "Admin can update all books" ON public.books;
CREATE POLICY "Admin can update all books"
  ON public.books FOR UPDATE
  USING (
    auth.jwt() ->> 'email' = 'leonardojulianoj@gmail.com'
    OR auth.uid() = uploaded_by
  );

-- Permite ao admin remover qualquer livro rejeitado
DROP POLICY IF EXISTS "Admin can delete books" ON public.books;
CREATE POLICY "Admin can delete books"
  ON public.books FOR DELETE
  USING (
    auth.jwt() ->> 'email' = 'leonardojulianoj@gmail.com'
    OR auth.uid() = uploaded_by
  );
