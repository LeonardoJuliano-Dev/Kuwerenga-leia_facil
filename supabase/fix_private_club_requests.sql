-- =====================================================================
-- MIGRAÇÃO: Correção de Políticas RLS para Pedidos de Adesão em Comunidades
-- =====================================================================

-- 1. Garantir que a tabela club_join_requests possui o campo status com valores válidos
create table if not exists public.club_join_requests (
  id uuid default gen_random_uuid() primary key,
  club_id uuid references public.clubs(id) on delete cascade not null,
  user_id uuid references public.profiles(id) on delete cascade not null,
  status text default 'pending' check (status in ('pending', 'approved', 'rejected')),
  created_at timestamptz default now(),
  unique(club_id, user_id)
);

alter table public.club_join_requests enable row level security;

-- 2. Atualizar políticas de club_members para permitir que administradores aprovem membros
drop policy if exists "Authenticated users can join clubs" on public.club_members;
drop policy if exists "Users can join or admins can add members" on public.club_members;

create policy "Users can join or admins can add members"
  on public.club_members for insert with check (
    -- O próprio utilizador pode entrar se for clube público
    auth.uid() = user_id
    -- OU o criador/administrador da comunidade pode adicionar membros
    or exists (
      select 1 from public.clubs c
      where c.id = club_members.club_id
      and (
        c.created_by = auth.uid()
        or exists (
          select 1 from public.club_members admin_cm
          where admin_cm.club_id = c.id
          and admin_cm.user_id = auth.uid()
          and admin_cm.role in ('admin', 'creator')
        )
      )
    )
    -- OU o utilizador teve o seu pedido de adesão aprovado
    or exists (
      select 1 from public.club_join_requests req
      where req.club_id = club_members.club_id
      and req.user_id = club_members.user_id
      and req.status = 'approved'
    )
  );

-- 3. Atualizar políticas de visualização e atualização dos pedidos de adesão
drop policy if exists "Join requests viewable by club admins and request author" on public.club_join_requests;
create policy "Join requests viewable by club admins and request author"
  on public.club_join_requests for select using (
    auth.uid() = user_id
    or exists (
      select 1 from public.clubs c
      where c.id = club_join_requests.club_id
      and (
        c.created_by = auth.uid()
        or exists (
          select 1 from public.club_members cm
          where cm.club_id = c.id
          and cm.user_id = auth.uid()
          and cm.role in ('admin', 'creator')
        )
      )
    )
  );

drop policy if exists "Admins can update join requests" on public.club_join_requests;
create policy "Admins can update join requests"
  on public.club_join_requests for update using (
    exists (
      select 1 from public.clubs c
      where c.id = club_join_requests.club_id
      and (
        c.created_by = auth.uid()
        or exists (
          select 1 from public.club_members cm
          where cm.club_id = c.id
          and cm.user_id = auth.uid()
          and cm.role in ('admin', 'creator')
        )
      )
    )
  );

-- 4. Função segura de aprovação com privilégios de segurança (SECURITY DEFINER)
create or replace function public.approve_club_join_request(
  p_request_id uuid,
  p_club_id uuid,
  p_user_id uuid
)
returns boolean
language plpgsql
security definer
as $$
declare
  v_is_admin boolean;
begin
  -- Verifica se quem está a chamar é o criador ou admin do clube
  select exists (
    select 1 from public.clubs c
    where c.id = p_club_id
    and (
      c.created_by = auth.uid()
      or exists (
        select 1 from public.club_members cm
        where cm.club_id = p_club_id
        and cm.user_id = auth.uid()
        and cm.role in ('admin', 'creator')
      )
    )
  ) into v_is_admin;

  if not v_is_admin then
    raise exception 'Apenas administradores da comunidade podem aprovar membros.';
  end if;

  -- 1. Adiciona utilizador aos membros
  insert into public.club_members (club_id, user_id, role)
  values (p_club_id, p_user_id, 'member')
  on conflict (club_id, user_id) do nothing;

  -- 2. Atualiza estado do pedido para aprovado
  update public.club_join_requests
  set status = 'approved'
  where id = p_request_id;

  -- 3. Atualiza contagem de membros
  update public.clubs
  set member_count = (
    select count(*) from public.club_members where club_id = p_club_id
  )
  where id = p_club_id;

  return true;
end;
$$;
