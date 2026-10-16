-- ============================================================
-- KUWERENGA+: Expansão do Módulo de Venda de Livros
-- ============================================================
-- Executa este script no Supabase Dashboard -> SQL Editor -> New Query

-- Adicionar novos campos do vendedor, localização e avaliação de compra na tabela 'books'
alter table public.books add column if not exists seller_name text;
alter table public.books add column if not exists seller_type text default 'independent' check (seller_type in ('bookstore', 'independent'));
alter table public.books add column if not exists location text;
alter table public.books add column if not exists delivery_options text;
alter table public.books add column if not exists purchase_rating numeric(3,2) default 5.0;
alter table public.books add column if not exists rating_comment text;

comment on column public.books.seller_name is 'Nome da livraria ou do vendedor independente';
comment on column public.books.seller_type is 'Tipo de vendedor: bookstore (livraria) ou independent (independente)';
comment on column public.books.location is 'Cidade ou província onde o livro se encontra para entrega';
comment on column public.books.delivery_options is 'Opções de envio ou levantamento em mão';
comment on column public.books.purchase_rating is 'Classificação avaliada pelos compradores ou leitores da obra (1 a 5 estrelas)';
comment on column public.books.rating_comment is 'Comentário ou avaliação de compra deixada pelo comprador';
