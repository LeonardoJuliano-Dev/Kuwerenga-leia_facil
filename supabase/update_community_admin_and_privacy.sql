-- ============================================================
-- LEITURA+ / KUWERENGA: Atualização de Comunidades e Chat
-- Regras de Administrador, Grupos Privados e Eliminação de Mensagens
-- ============================================================
-- Executa este script no Supabase Dashboard -> SQL Editor -> New Query

-- 1. Garantir coluna is_public na tabela clubs
alter table public.clubs add column if not exists is_public boolean default true;

-- 2. Tabela de Pedidos de Adesão para Clubes Privados
create table if not exists public.club_join_requests (
  id uuid default gen_random_uuid() primary key,
  club_id uuid references public.clubs(id) on delete cascade not null,
  user_id uuid references public.profiles(id) on delete cascade not null,
  status text default 'pending' check (status in ('pending', 'approved', 'rejected')),
  created_at timestamptz default now(),
  unique(club_id, user_id)
);

alter table public.club_join_requests enable row level security;

-- Políticas para Pedidos de Adesão
drop policy if exists "Join requests viewable by club admins and request author" on public.club_join_requests;
create policy "Join requests viewable by club admins and request author"
  on public.club_join_requests for select using (
    auth.uid() = user_id
    or exists (
      select 1 from public.clubs c
      where c.id = club_join_requests.club_id
      and (c.created_by = auth.uid() or exists (
        select 1 from public.club_members cm
        where cm.club_id = c.id and cm.user_id = auth.uid() and cm.role = 'admin'
      ))
    )
  );

drop policy if exists "Authenticated users can submit join requests" on public.club_join_requests;
create policy "Authenticated users can submit join requests"
  on public.club_join_requests for insert with check (auth.uid() = user_id);

drop policy if exists "Admins can update join requests" on public.club_join_requests;
create policy "Admins can update join requests"
  on public.club_join_requests for update using (
    exists (
      select 1 from public.clubs c
      where c.id = club_join_requests.club_id
      and (c.created_by = auth.uid() or exists (
        select 1 from public.club_members cm
        where cm.club_id = c.id and cm.user_id = auth.uid() and cm.role = 'admin'
      ))
    )
  );

drop policy if exists "Users or admins can delete join requests" on public.club_join_requests;
create policy "Users or admins can delete join requests"
  on public.club_join_requests for delete using (
    auth.uid() = user_id
    or exists (
      select 1 from public.clubs c
      where c.id = club_join_requests.club_id
      and (c.created_by = auth.uid() or exists (
        select 1 from public.club_members cm
        where cm.club_id = c.id and cm.user_id = auth.uid() and cm.role = 'admin'
      ))
    )
  );

-- 3. Atualizar política de eliminação de mensagens do Chat (Autor ou Admin podem apagar)
drop policy if exists "Users or admins can delete club discussions" on public.club_discussions;
create policy "Users or admins can delete club discussions"
  on public.club_discussions for delete using (
    auth.uid() = user_id
    or exists (
      select 1 from public.clubs c
      where c.id = club_discussions.club_id
      and (c.created_by = auth.uid() or exists (
        select 1 from public.club_members cm
        where cm.club_id = c.id and cm.user_id = auth.uid() and cm.role = 'admin'
      ))
    )
  );

-- 4. Permitir que o Admin atualize as configurações do clube (nome, descrição, privacidade is_public)
drop policy if exists "Admins can update their clubs" on public.clubs;
create policy "Admins can update their clubs"
  on public.clubs for update using (
    auth.uid() = created_by
    or exists (
      select 1 from public.club_members cm
      where cm.club_id = clubs.id and cm.user_id = auth.uid() and cm.role = 'admin'
    )
  );

-- 5. Permitir que o Admin remova membros ou membros saiam
drop policy if exists "Admins can remove members or members can leave" on public.club_members;
create policy "Admins can remove members or members can leave"
  on public.club_members for delete using (
    auth.uid() = user_id
    or exists (
      select 1 from public.clubs c
      where c.id = club_members.club_id
      and (c.created_by = auth.uid() or exists (
        select 1 from public.club_members cm
        where cm.club_id = c.id and cm.user_id = auth.uid() and cm.role = 'admin'
      ))
    )
  );

-- 6. Garantir que todas as comunidades (públicas e privadas) são visíveis para os leitores poderem solicitar adesão
drop policy if exists "Public clubs are viewable by everyone" on public.clubs;
drop policy if exists "Clubs are viewable by everyone" on public.clubs;
create policy "Clubs are viewable by everyone"
  on public.clubs for select using (true);

