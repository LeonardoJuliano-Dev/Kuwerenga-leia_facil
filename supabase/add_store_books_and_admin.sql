-- ============================================================
-- KUWERENGA+: Módulo de Venda de Livros & Permissões de Admin
-- ============================================================
-- Executa este script no Supabase Dashboard -> SQL Editor -> New Query

-- 1. Adicionar permissão de Administrador aos Perfis
alter table public.profiles add column if not exists is_admin boolean default false;

-- 2. Adicionar campos de Venda de Livros na tabela 'books'
alter table public.books add column if not exists is_for_sale boolean default false;
alter table public.books add column if not exists price numeric(10,2) default 0;
alter table public.books add column if not exists currency text default 'MZN';
alter table public.books add column if not exists stock_status text default 'available' check (stock_status in ('available', 'out_of_stock'));
alter table public.books add column if not exists seller_whatsapp text;
alter table public.books add column if not exists physical_condition text default 'new';

-- 3. Atualizar Políticas RLS de 'books' para permitir ao Administrador gerir todos os livros
-- Permitir que administradores atualizem qualquer livro (doado ou à venda)
drop policy if exists "Admins can update any book" on public.books;
create policy "Admins can update any book"
  on public.books for update
  using (
    exists (
      select 1 from public.profiles
      where profiles.id = auth.uid() and profiles.is_admin = true
    )
  );

-- Permitir que administradores apaguem qualquer livro
drop policy if exists "Admins can delete any book" on public.books;
create policy "Admins can delete any book"
  on public.books for delete
  using (
    exists (
      select 1 from public.profiles
      where profiles.id = auth.uid() and profiles.is_admin = true
    )
  );

-- Permitir que os próprios utilizadores continuem a apagar os seus livros doados
drop policy if exists "Users can delete their own books" on public.books;
create policy "Users can delete their own books"
  on public.books for delete
  using (auth.uid() = uploaded_by);

-- 4. Função auxiliar para verificar se o utilizador autenticado é administrador
create or replace function public.is_current_user_admin()
returns boolean as $$
begin
  return exists (
    select 1 from public.profiles
    where id = auth.uid() and is_admin = true
  );
end;
$$ language plpgsql security definer;

-- 5. Ativar privilégios de Administrador para a conta designada
update public.profiles
set is_admin = true
where id in (
  select id from auth.users
  where lower(email) = 'leonardojulianoj@gmail.com'
);

