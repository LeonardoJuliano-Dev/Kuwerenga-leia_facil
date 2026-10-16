-- ============================================================
-- KUWERENGA+: Expansao do Modulo de Venda de Livros & Visibilidade Geral
-- ============================================================
-- Executa este script no Supabase Dashboard -> SQL Editor -> New Query

-- 1. Garantir que as colunas basicas e expandidas de venda existem na tabela 'books'
alter table public.books add column if not exists is_for_sale boolean default false;
alter table public.books add column if not exists price numeric(10,2) default 0;
alter table public.books add column if not exists currency text default 'MZN';
alter table public.books add column if not exists stock_status text default 'available';
alter table public.books add column if not exists seller_whatsapp text;
alter table public.books add column if not exists physical_condition text default 'Novo';
alter table public.books add column if not exists seller_name text;
alter table public.books add column if not exists seller_type text default 'independent';
alter table public.books add column if not exists location text;
alter table public.books add column if not exists delivery_options text;
alter table public.books add column if not exists purchase_rating numeric(3,2) default 5.0;
alter table public.books add column if not exists rating_comment text;

-- 2. Permitir livros fisicos (tipo 'physical') e ficheiro facultativo
alter table public.books drop constraint if exists books_file_type_check;
alter table public.books add constraint books_file_type_check check (file_type in ('pdf', 'epub', 'physical'));

alter table public.books alter column file_url drop not null;

-- 3. Marcar todos os livros colocados a venda como aprovados para que fiquem imediatamente visiveis
update public.books
set is_approved = true
where is_for_sale = true;

-- 4. Atualizar politica de leitura RLS: todos os utilizadores (leitores e visitantes) podem ver livros aprovados OU a venda
drop policy if exists "Approved books are viewable by everyone" on public.books;
create policy "Approved books are viewable by everyone"
  on public.books for select
  using (coalesce(is_approved, false) = true or coalesce(is_for_sale, false) = true);

-- 5. Atualizar politica de insercao e edicao para administradores e utilizadores autenticados
drop policy if exists "Admins can insert any book" on public.books;
create policy "Admins can insert any book"
  on public.books for insert
  with check (auth.uid() is not null);

drop policy if exists "Admins can update any book" on public.books;
create policy "Admins can update any book"
  on public.books for update
  using (
    auth.uid() = uploaded_by
    or exists (
      select 1 from public.profiles
      where profiles.id = auth.uid() and profiles.is_admin = true
    )
  );

-- Comentarios explicativos
comment on column public.books.seller_name is 'Nome da livraria ou do vendedor independente';
comment on column public.books.seller_type is 'Tipo de vendedor: bookstore (livraria) ou independent (independente)';
comment on column public.books.location is 'Cidade ou provincia onde o livro se encontra para entrega';
comment on column public.books.delivery_options is 'Opcoes de envio ou levantamento em mao';
comment on column public.books.purchase_rating is 'Classificacao avaliada pelos compradores ou leitores da obra (1 a 5 estrelas)';
comment on column public.books.rating_comment is 'Comentario ou avaliacao de compra deixada pelo comprador';
