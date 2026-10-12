-- ============================================================
-- LEITURA+ / KUWERENGA: Atualização da Tabela de Perfis
-- Suporte a Visualizações, Username, Bio e Livros Favoritos
-- ============================================================
-- Executa este script no Supabase Dashboard -> SQL Editor -> New Query

-- 1. Permitir leitura pública dos perfis para permitir ver o perfil de outros leitores nas comunidades
drop policy if exists "Users can view their own profile" on public.profiles;
drop policy if exists "Profiles are viewable by everyone" on public.profiles;

create policy "Profiles are viewable by everyone"
  on public.profiles for select using (true);

-- 2. Garantir que os utilizadores podem atualizar apenas o seu próprio perfil
drop policy if exists "Users can update their own profile" on public.profiles;
create policy "Users can update their own profile"
  on public.profiles for update using (auth.uid() = id);

-- 3. Adicionar colunas de rede social de leitura
alter table public.profiles add column if not exists username text;
alter table public.profiles add column if not exists bio text;
alter table public.profiles add column if not exists profile_views int default 0;
alter table public.profiles add column if not exists favorite_books jsonb default '[]'::jsonb;
alter table public.profiles add column if not exists reading_time_minutes int default 0;
alter table public.profiles add column if not exists scheduled_delete_at timestamptz;

-- 4. Função RPC para incrementar visualizações de perfil de forma segura
create or replace function public.increment_profile_views(target_user_id uuid)
returns int as $$
declare
  new_views int;
begin
  update public.profiles
  set profile_views = coalesce(profile_views, 0) + 1
  where id = target_user_id
  returning profile_views into new_views;
  
  return coalesce(new_views, 1);
end;
$$ language plpgsql security definer;
