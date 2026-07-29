-- Migration: create_creator_dna_and_generations
-- Step 5. The two tables needed for the first product surface.

-- ============ CREATOR DNA ============
create table public.creator_dna (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  niche text,
  target_audience text,
  tone text,
  platforms text[] default '{}',
  output_language text not null default 'id',
  banned_words text[] default '{}',
  brand_notes text,
  updated_at timestamptz not null default now()
);

alter table public.creator_dna enable row level security;

create policy "Users read own DNA"
  on public.creator_dna for select
  to authenticated
  using (user_id = auth.uid());

create policy "Users upsert own DNA"
  on public.creator_dna for insert
  to authenticated
  with check (user_id = auth.uid());

create policy "Users update own DNA"
  on public.creator_dna for update
  to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

create policy "Admins read all DNA"
  on public.creator_dna for select
  to authenticated
  using (public.is_admin());

-- ============ GENERATIONS ============
create table public.generations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  module text not null check (module in ('ide_hari_ini', 'idea', 'hook', 'script', 'repurpose')),
  platform text check (platform is null or platform in ('tiktok', 'instagram', 'youtube', 'x', 'threads')),
  input jsonb,
  output jsonb,
  model_used text,
  credits_spent int not null,
  is_favorite boolean not null default false,
  performance_rating int check (performance_rating is null or (performance_rating >= 1 and performance_rating <= 5)),
  created_at timestamptz not null default now()
);

alter table public.generations enable row level security;

-- Owner reads/writes own generations.
create policy "Users read own generations"
  on public.generations for select
  to authenticated
  using (user_id = auth.uid());

create policy "Users update own generations"
  on public.generations for update
  to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

-- Admins read all.
create policy "Admins read all generations"
  on public.generations for select
  to authenticated
  using (public.is_admin());

-- No INSERT policy for authenticated — inserts come from the server route
-- using the service-role client after credit spend. This prevents a client
-- from forging generation records.

-- Index for fetching recent generations by user.
create index idx_generations_user_created on public.generations (user_id, created_at desc);
