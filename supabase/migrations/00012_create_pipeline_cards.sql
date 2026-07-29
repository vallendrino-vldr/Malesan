-- Migration: create_pipeline_cards
-- Step 8: Kanban board support

create table public.pipeline_cards (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  title text not null,
  content jsonb,
  status text not null default 'ide' check (status in ('ide', 'draft', 'siap', 'posted')),
  generation_id uuid references public.generations(id) on delete set null,
  created_at timestamptz not null default now()
);

alter table public.pipeline_cards enable row level security;

create policy "Users read own pipeline cards"
  on public.pipeline_cards for select
  to authenticated
  using (user_id = auth.uid());

create policy "Users insert own pipeline cards"
  on public.pipeline_cards for insert
  to authenticated
  with check (user_id = auth.uid());

create policy "Users update own pipeline cards"
  on public.pipeline_cards for update
  to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

create policy "Users delete own pipeline cards"
  on public.pipeline_cards for delete
  to authenticated
  using (user_id = auth.uid());

create policy "Admins read all pipeline cards"
  on public.pipeline_cards for select
  to authenticated
  using (public.is_admin());

create index idx_pipeline_cards_user_status on public.pipeline_cards (user_id, status);
