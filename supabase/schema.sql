-- =============================================
-- LEITURA+ | Supabase Database Schema
-- =============================================
-- Run this SQL in the Supabase SQL Editor
-- (Dashboard > SQL Editor > New query)
-- =============================================

-- ========== PROFILES ==========
-- Extends Supabase Auth users with app-specific data
create table public.profiles (
  id uuid references auth.users on delete cascade primary key,
  full_name text,
  avatar_url text,
  reading_goal int default 12, -- books per year
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- Enable RLS
alter table public.profiles enable row level security;

create policy "Users can view their own profile"
  on public.profiles for select using (auth.uid() = id);

create policy "Users can update their own profile"
  on public.profiles for update using (auth.uid() = id);

create policy "Users can insert their own profile"
  on public.profiles for insert with check (auth.uid() = id);

-- Auto-create profile on signup
create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, full_name, avatar_url)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'full_name', new.raw_user_meta_data->>'name', ''),
    coalesce(new.raw_user_meta_data->>'avatar_url', '')
  );
  return new;
end;
$$ language plpgsql security definer;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();


-- ========== CATEGORIES ==========
create table public.categories (
  id uuid default gen_random_uuid() primary key,
  name text not null unique,
  icon text,
  created_at timestamptz default now()
);

alter table public.categories enable row level security;

create policy "Categories are viewable by everyone"
  on public.categories for select using (true);

-- Seed default categories
insert into public.categories (name, icon) values
  ('Romance', 'heart'),
  ('História', 'history'),
  ('Negócios', 'briefcase'),
  ('Educação', 'graduation-cap'),
  ('Saúde', 'activity'),
  ('Tecnologia', 'monitor'),
  ('Ficção Científica', 'rocket'),
  ('Autoajuda', 'star'),
  ('Poesia', 'feather'),
  ('Filosofia', 'brain');


-- ========== BOOKS ==========
create table public.books (
  id uuid default gen_random_uuid() primary key,
  title text not null,
  author text not null,
  description text,
  cover_url text,
  file_url text not null,
  file_type text not null check (file_type in ('pdf', 'epub')),
  file_size bigint default 0,
  total_pages int default 0,
  category_id uuid references public.categories(id),
  uploaded_by uuid references public.profiles(id),
  is_approved boolean default false,
  language text default 'pt',
  isbn text,
  avg_rating numeric(3,2) default 0,
  total_ratings int default 0,
  total_downloads int default 0,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

alter table public.books enable row level security;

create policy "Approved books are viewable by everyone"
  on public.books for select using (is_approved = true);

create policy "Users can view their own uploaded books"
  on public.books for select using (auth.uid() = uploaded_by);

create policy "Authenticated users can upload books"
  on public.books for insert with check (auth.uid() = uploaded_by);

create policy "Users can update their own books"
  on public.books for update using (auth.uid() = uploaded_by);

-- Full text search index
create index books_search_idx on public.books
  using gin(to_tsvector('portuguese', title || ' ' || author || ' ' || coalesce(description, '')));


-- ========== USER LIBRARY ==========
create table public.user_books (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references public.profiles(id) on delete cascade not null,
  book_id uuid references public.books(id) on delete cascade not null,
  status text default 'to_read' check (status in ('to_read', 'reading', 'finished', 'saved')),
  current_page int default 0,
  current_chapter text,
  progress numeric(5,2) default 0,
  last_read_at timestamptz,
  started_at timestamptz,
  finished_at timestamptz,
  is_downloaded boolean default false,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  unique(user_id, book_id)
);

alter table public.user_books enable row level security;

create policy "Users can manage their own library"
  on public.user_books for all using (auth.uid() = user_id);


-- ========== ANNOTATIONS ==========
create table public.annotations (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references public.profiles(id) on delete cascade not null,
  book_id uuid references public.books(id) on delete cascade not null,
  type text not null check (type in ('highlight', 'note', 'bookmark')),
  content text,
  selected_text text,
  page_number int,
  chapter text,
  position_data jsonb,
  color text default '#000000',
  is_personal boolean default true,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

alter table public.annotations enable row level security;

create policy "Users can manage their own annotations"
  on public.annotations for all using (auth.uid() = user_id);


-- ========== REVIEWS / COMMENTS ==========
create table public.reviews (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references public.profiles(id) on delete cascade not null,
  book_id uuid references public.books(id) on delete cascade not null,
  rating int check (rating >= 1 and rating <= 5),
  comment text,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  unique(user_id, book_id)
);

alter table public.reviews enable row level security;

create policy "Reviews are viewable by everyone"
  on public.reviews for select using (true);

create policy "Authenticated users can create reviews"
  on public.reviews for insert with check (auth.uid() = user_id);

create policy "Users can update their own reviews"
  on public.reviews for update using (auth.uid() = user_id);

create policy "Users can delete their own reviews"
  on public.reviews for delete using (auth.uid() = user_id);

-- Auto-update book avg_rating
create or replace function public.update_book_rating()
returns trigger as $$
declare
  target_book_id uuid;
begin
  target_book_id := coalesce(new.book_id, old.book_id);
  update public.books set
    avg_rating = coalesce((select avg(rating)::numeric(3,2) from public.reviews where book_id = target_book_id), 0),
    total_ratings = (select count(*) from public.reviews where book_id = target_book_id),
    updated_at = now()
  where id = target_book_id;
  return coalesce(new, old);
end;
$$ language plpgsql security definer;

create trigger on_review_change
  after insert or update or delete on public.reviews
  for each row execute procedure public.update_book_rating();


-- ========== READING CLUBS ==========
create table public.clubs (
  id uuid default gen_random_uuid() primary key,
  name text not null,
  description text,
  cover_url text,
  current_book_id uuid references public.books(id),
  current_goal text,
  created_by uuid references public.profiles(id) on delete cascade not null,
  is_public boolean default true,
  member_count int default 1,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

alter table public.clubs enable row level security;

create policy "Public clubs are viewable by everyone"
  on public.clubs for select using (is_public = true);

create policy "Authenticated users can create clubs"
  on public.clubs for insert with check (auth.uid() = created_by);

create policy "Club creators can update their clubs"
  on public.clubs for update using (auth.uid() = created_by);


-- ========== CLUB MEMBERS ==========
create table public.club_members (
  id uuid default gen_random_uuid() primary key,
  club_id uuid references public.clubs(id) on delete cascade not null,
  user_id uuid references public.profiles(id) on delete cascade not null,
  role text default 'member' check (role in ('admin', 'moderator', 'member')),
  joined_at timestamptz default now(),
  unique(club_id, user_id)
);

alter table public.club_members enable row level security;

create policy "Members can view their club memberships"
  on public.club_members for select using (auth.uid() = user_id);

create policy "Club members are viewable by other members"
  on public.club_members for select using (
    exists (
      select 1 from public.club_members cm
      where cm.club_id = club_members.club_id and cm.user_id = auth.uid()
    )
  );

create policy "Authenticated users can join clubs"
  on public.club_members for insert with check (auth.uid() = user_id);

create policy "Users can leave clubs"
  on public.club_members for delete using (auth.uid() = user_id);

-- Auto-update member count
create or replace function public.update_club_member_count()
returns trigger as $$
declare
  target_club_id uuid;
begin
  target_club_id := coalesce(new.club_id, old.club_id);
  update public.clubs set
    member_count = (select count(*) from public.club_members where club_id = target_club_id),
    updated_at = now()
  where id = target_club_id;
  return coalesce(new, old);
end;
$$ language plpgsql security definer;

create trigger on_club_member_change
  after insert or delete on public.club_members
  for each row execute procedure public.update_club_member_count();


-- ========== CLUB DISCUSSIONS ==========
create table public.club_discussions (
  id uuid default gen_random_uuid() primary key,
  club_id uuid references public.clubs(id) on delete cascade not null,
  user_id uuid references public.profiles(id) on delete cascade not null,
  message text not null,
  chapter_reference text,
  parent_id uuid references public.club_discussions(id),
  created_at timestamptz default now()
);

alter table public.club_discussions enable row level security;

create policy "Club members can view discussions"
  on public.club_discussions for select using (
    exists (
      select 1 from public.club_members cm
      where cm.club_id = club_discussions.club_id and cm.user_id = auth.uid()
    )
  );

create policy "Club members can post discussions"
  on public.club_discussions for insert with check (
    exists (
      select 1 from public.club_members cm
      where cm.club_id = club_discussions.club_id and cm.user_id = auth.uid()
    )
  );


-- ========== STORAGE BUCKETS ==========
insert into storage.buckets (id, name, public) values ('books', 'books', false);
insert into storage.buckets (id, name, public) values ('covers', 'covers', true);
insert into storage.buckets (id, name, public) values ('avatars', 'avatars', true);

-- Storage policies
create policy "Authenticated users can upload books"
  on storage.objects for insert with check (
    bucket_id = 'books' and auth.role() = 'authenticated'
  );

create policy "Authenticated users can read books"
  on storage.objects for select using (
    bucket_id = 'books' and auth.role() = 'authenticated'
  );

create policy "Anyone can view covers"
  on storage.objects for select using (bucket_id = 'covers');

create policy "Authenticated users can upload covers"
  on storage.objects for insert with check (
    bucket_id = 'covers' and auth.role() = 'authenticated'
  );

create policy "Anyone can view avatars"
  on storage.objects for select using (bucket_id = 'avatars');

create policy "Users can upload their own avatars"
  on storage.objects for insert with check (
    bucket_id = 'avatars' and auth.role() = 'authenticated'
  );


-- ========== READING STATS VIEW ==========
create or replace view public.user_reading_stats as
select
  ub.user_id,
  count(*) filter (where ub.status != 'saved') as total_books,
  count(*) filter (where ub.status = 'reading') as currently_reading,
  count(*) filter (where ub.status = 'finished') as finished_books,
  count(*) filter (where ub.status = 'saved') as saved_books,
  (select count(*) from public.annotations a where a.user_id = ub.user_id) as total_annotations,
  (select count(*) from public.annotations a where a.user_id = ub.user_id and a.type = 'highlight') as total_highlights
from public.user_books ub
group by ub.user_id;
