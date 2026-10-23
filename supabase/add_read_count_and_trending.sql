-- ============================================================
-- KUWERENGA+: Suporte a Métricas de Livros Mais Lidos
-- ============================================================
-- Executa este script no Supabase Dashboard -> SQL Editor -> New Query

-- 1. Adicionar coluna read_count na tabela books se ainda não existir
alter table public.books add column if not exists read_count int default 0;

-- 2. Garantir que valores nulos sejam inicializados a 0
update public.books set read_count = 0 where read_count is null;

-- 3. Criar índice para ordenação rápida por livros mais lidos
create index if not exists idx_books_read_count on public.books(read_count desc, created_at desc);

-- 4. Função RPC segura para incrementar a contagem de leituras
create or replace function public.increment_book_read_count(target_book_id uuid)
returns int as $$
declare
  new_count int;
begin
  update public.books
  set read_count = coalesce(read_count, 0) + 1
  where id = target_book_id
  returning read_count into new_count;

  return coalesce(new_count, 1);
end;
$$ language plpgsql security definer;

-- 5. Dar permissão de execução da função a utilizadores anónimos e autenticados
grant execute on function public.increment_book_read_count(uuid) to anon, authenticated;
