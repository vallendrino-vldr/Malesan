-- Migration: workflow_engine
-- The deep-workflow pass: personas, drafts, CTA injection, schedulable pipeline
-- cards, in/out token accounting, and realtime on the config + board tables.
--
-- Deliberately additive. Every existing column, policy and function keeps its
-- shape, because this runs against a live product that takes money.

-- ============================================================
-- 1. PERSONAS — several saved brand voices per creator
-- ============================================================
-- creator_dna holds ONE voice and is the onboarding artefact. A creator who
-- runs a personal account and a client account needs to switch, not overwrite,
-- so voices live in their own table and creator_dna stays the default.
create table if not exists public.personas (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  name text not null,
  voice text not null,
  is_default boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_personas_user on public.personas (user_id);
-- At most one default per creator. A partial unique index rather than a trigger:
-- the database enforces it even if a future code path forgets to.
create unique index if not exists idx_personas_one_default
  on public.personas (user_id) where is_default;

alter table public.personas enable row level security;

drop policy if exists "Users read own personas" on public.personas;
create policy "Users read own personas" on public.personas
  for select to authenticated using (user_id = auth.uid());

drop policy if exists "Users insert own personas" on public.personas;
create policy "Users insert own personas" on public.personas
  for insert to authenticated with check (user_id = auth.uid());

drop policy if exists "Users update own personas" on public.personas;
create policy "Users update own personas" on public.personas
  for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());

drop policy if exists "Users delete own personas" on public.personas;
create policy "Users delete own personas" on public.personas
  for delete to authenticated using (user_id = auth.uid());

drop policy if exists "Admins read all personas" on public.personas;
create policy "Admins read all personas" on public.personas
  for select to authenticated using (public.is_admin());

-- ============================================================
-- 2. DRAFTS — the writing surface, autosaved
-- ============================================================
create table if not exists public.drafts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  title text not null default 'Draft tanpa judul',
  content text not null default '',
  pipeline_card_id uuid references public.pipeline_cards(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_drafts_user_updated on public.drafts (user_id, updated_at desc);

alter table public.drafts enable row level security;

drop policy if exists "Users read own drafts" on public.drafts;
create policy "Users read own drafts" on public.drafts
  for select to authenticated using (user_id = auth.uid());

drop policy if exists "Users insert own drafts" on public.drafts;
create policy "Users insert own drafts" on public.drafts
  for insert to authenticated with check (user_id = auth.uid());

drop policy if exists "Users update own drafts" on public.drafts;
create policy "Users update own drafts" on public.drafts
  for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());

drop policy if exists "Users delete own drafts" on public.drafts;
create policy "Users delete own drafts" on public.drafts
  for delete to authenticated using (user_id = auth.uid());

-- ============================================================
-- 3. CTA — the creator's own link, injected into generated endings
-- ============================================================
-- On creator_dna rather than profiles because this is prompt context: it is
-- read wherever the voice is read, and profiles is guarded by the column
-- trigger (§6 of SCHEMA.md), which would revert writes the user legitimately owns.
alter table public.creator_dna add column if not exists cta_url text;
alter table public.creator_dna add column if not exists cta_label text;
alter table public.creator_dna add column if not exists cta_enabled boolean not null default false;

-- ============================================================
-- 4. PIPELINE CARDS — schedulable, orderable, and live
-- ============================================================
alter table public.pipeline_cards add column if not exists schedule_label text;
alter table public.pipeline_cards add column if not exists schedule_reason text;
alter table public.pipeline_cards add column if not exists sort_order int not null default 0;
alter table public.pipeline_cards add column if not exists updated_at timestamptz not null default now();

create index if not exists idx_pipeline_cards_sort
  on public.pipeline_cards (user_id, status, sort_order);

-- ============================================================
-- 5. TOKEN ACCOUNTING — split in/out so cost can be estimated honestly
-- ============================================================
alter table public.gemini_usage add column if not exists input_tokens bigint not null default 0;
alter table public.gemini_usage add column if not exists output_tokens bigint not null default 0;

-- The old signature already carried defaults on p_tokens/p_is_error, so simply
-- adding two more defaulted params would create an overload that makes every
-- existing 4-arg call ambiguous. Drop, then recreate with the wider signature —
-- callers pass named args and keep resolving.
drop function if exists public.record_gemini_usage(integer, text, bigint, boolean);

create or replace function public.record_gemini_usage(
  p_key_index integer,
  p_model text,
  p_tokens bigint default 0,
  p_is_error boolean default false,
  p_input_tokens bigint default 0,
  p_output_tokens bigint default 0
)
returns void
language plpgsql
security definer
set search_path to ''
as $function$
begin
  insert into public.gemini_usage as g
    (usage_date, key_index, model, request_count, error_count, token_count,
     input_tokens, output_tokens)
  values
    (current_date, p_key_index, p_model, 1,
     case when p_is_error then 1 else 0 end, greatest(p_tokens, 0),
     greatest(p_input_tokens, 0), greatest(p_output_tokens, 0))
  on conflict (usage_date, key_index, model) do update
    set request_count  = g.request_count + 1,
        error_count    = g.error_count + case when p_is_error then 1 else 0 end,
        token_count    = g.token_count + greatest(p_tokens, 0),
        input_tokens   = g.input_tokens + greatest(p_input_tokens, 0),
        output_tokens  = g.output_tokens + greatest(p_output_tokens, 0),
        updated_at     = now();
end;
$function$;

revoke all on function public.record_gemini_usage(integer, text, bigint, boolean, bigint, bigint) from public, anon, authenticated;
grant execute on function public.record_gemini_usage(integer, text, bigint, boolean, bigint, bigint) to service_role;

-- ============================================================
-- 6. REALTIME — config and board changes reach open tabs
-- ============================================================
-- app_config so a feature flag, price or banner lands without a reload;
-- pipeline_cards so the board is live. Realtime enforces RLS, so a user still
-- only ever receives their own rows — and app_config is admin-read only.
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and tablename = 'app_config'
  ) then
    alter publication supabase_realtime add table public.app_config;
  end if;

  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and tablename = 'pipeline_cards'
  ) then
    alter publication supabase_realtime add table public.pipeline_cards;
  end if;
end $$;

-- ============================================================
-- 7. CONFIG SEEDS — new knobs, all with safe defaults
-- ============================================================
insert into public.app_config (key, value) values
  ('shadow_prompt', '""'::jsonb),
  ('price_in_per_mtok', '0'::jsonb),
  ('price_out_per_mtok', '0'::jsonb),
  ('cost_clip', '4'::jsonb),
  ('cost_thread', '3'::jsonb),
  ('cost_autocomplete', '0'::jsonb),
  ('cost_schedule_tag', '0'::jsonb)
on conflict (key) do nothing;

-- ============================================================
-- 8. MODULE CHECK — the niche engines write generations too
-- ============================================================
alter table public.generations drop constraint if exists generations_module_check;
alter table public.generations add constraint generations_module_check
  check (module = any (array[
    'ide_hari_ini'::text, 'idea'::text, 'hook'::text, 'script'::text,
    'repurpose'::text, 'vibe_kit'::text, 'clip'::text, 'thread'::text
  ]));
