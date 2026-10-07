-- ============================================================
-- KUWERENGA: Criar Buckets de Armazenamento no Supabase
-- ============================================================
-- Executar este script no Supabase Dashboard -> SQL Editor -> New Query

-- 1. Criar os buckets 'books' e 'covers' como PÚBLICOS
insert into storage.buckets (id, name, public, file_size_limit)
values 
  ('books', 'books', true, 52428800),
  ('covers', 'covers', true, 10485760)
on conflict (id) do update set public = true;

-- 2. Políticas de leitura aberta (permite carregar e ler PDFs e ePubs no leitor)
drop policy if exists "Public Access to Books" on storage.objects;
create policy "Public Access to Books"
  on storage.objects for select using (bucket_id = 'books');

drop policy if exists "Public Access to Covers" on storage.objects;
create policy "Public Access to Covers"
  on storage.objects for select using (bucket_id = 'covers');

-- 3. Políticas de envio por utilizadores autenticados (Doar Livro)
drop policy if exists "Authenticated users can upload books" on storage.objects;
create policy "Authenticated users can upload books"
  on storage.objects for insert with check (
    bucket_id = 'books' and auth.role() = 'authenticated'
  );

drop policy if exists "Authenticated users can upload covers" on storage.objects;
create policy "Authenticated users can upload covers"
  on storage.objects for insert with check (
    bucket_id = 'covers' and auth.role() = 'authenticated'
  );
