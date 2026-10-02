-- ============================================================
-- LEITURA+ / KUWERENGA: Fix infinite recursion in community policies
-- ============================================================
-- Execute this script in Supabase Dashboard -> SQL Editor -> New Query

-- 1. Drop existing recursive policies
drop policy if exists "Club members are viewable by other members" on public.club_members;
drop policy if exists "Members can view their club memberships" on public.club_members;
drop policy if exists "Authenticated users can join clubs" on public.club_members;
drop policy if exists "Users can leave clubs" on public.club_members;

drop policy if exists "Club members can view discussions" on public.club_discussions;
drop policy if exists "Club members can post discussions" on public.club_discussions;

-- 2. Create non-recursive policies for club_members
-- Anyone can view club members (required to avoid cyclic subqueries)
create policy "Club members are viewable by everyone"
  on public.club_members for select using (true);

create policy "Authenticated users can join clubs"
  on public.club_members for insert with check (auth.uid() = user_id);

create policy "Users can leave clubs"
  on public.club_members for delete using (auth.uid() = user_id);

-- 3. Create non-recursive policies for club_discussions
-- Allow anyone to view discussions/chat
create policy "Discussions are viewable by everyone"
  on public.club_discussions for select using (true);

-- Allow authenticated users to send messages and post topics
create policy "Authenticated users can post discussions"
  on public.club_discussions for insert with check (auth.uid() = user_id);

-- Optional: ensure Chat Geral da Comunidade exists
insert into public.clubs (name, description, current_goal, is_public, member_count, created_by)
select 
  'Chat Geral da Comunidade',
  'Espaço aberto para todos os leitores trocarem ideias, fotos e áudios sobre literatura.',
  'Comunidade Aberta',
  true,
  1,
  (select id from public.profiles limit 1)
where not exists (
  select 1 from public.clubs where name = 'Chat Geral da Comunidade'
);
