-- Migration: ai_provider_layer
--
-- The AI Provider Management Layer. Turns a hardcoded single-vendor client into
-- a fleet the owner runs from the admin dashboard: providers, models, per-feature
-- routing, per-request cost accounting, and balance monitoring.
--
-- DELIBERATELY ADDITIVE. Not one existing table, column, policy, function or
-- grant is modified. This runs against a live product that takes money, and the
-- credit system (spend_credits / refund_credits / grant_credits / credit_ledger)
-- is not touched at all — see the note on charge-once at the bottom.
--
-- WHY NEW TABLES INSTEAD OF app_config. app_config is a flat key/value store and
-- is the right shape for scalars (a price, a flag, a model id). A provider fleet
-- is relational: providers have many models, models are referenced by routes,
-- requests reference both. Encoding that as JSON blobs in a KV row would mean no
-- foreign keys, no per-row RLS, and no way to query "what did feature X cost last
-- week". app_config keeps its job; this is a different job.

-- ============================================================
-- 1. PROVIDERS
-- ============================================================
-- One row per upstream vendor: Gemini, OpenAI, Anthropic, SumoPod, OpenRouter,
-- or any OpenAI-compatible host.
--
-- `protocol` is the wire format, NOT the brand. SumoPod, OpenRouter, Groq,
-- Together and most self-hosted gateways all speak the OpenAI chat-completions
-- shape, so they are `protocol = 'openai'` with a different base_url. Adding one
-- of those needs no code — that is the entire point of this migration.
--
-- `key_source` is what lets the existing env-based Gemini pool be represented
-- here without moving its keys into the database:
--   'db'              — key lives in api_key_encrypted on this row
--   'env_gemini_pool' — use the existing GEMINI_API_KEY_1..10 rotation
-- The legacy pool therefore keeps its rotation, its 429 cooldown and its
-- quota-guard accounting exactly as they are today, while still appearing in the
-- dashboard as a provider that can be routed to.
create table if not exists public.ai_providers (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  label text not null,
  protocol text not null default 'openai'
    check (protocol in ('gemini', 'openai', 'anthropic')),
  base_url text,
  key_source text not null default 'db'
    check (key_source in ('db', 'env_gemini_pool')),
  -- AES-256-GCM ciphertext, same format and same ENCRYPTION_KEY as the BYOK
  -- column in user_api_keys (src/lib/gemini/crypto.ts). Never plaintext, and
  -- never sent to the browser — the admin UI renders maskKey() only.
  api_key_encrypted text,
  -- Optional balance endpoint. balance_path is a dotted path into the JSON
  -- response ("data.balance"), because every gateway names this differently and
  -- hardcoding one vendor's shape is how this feature would rot.
  balance_url text,
  balance_path text,
  balance_currency text not null default 'USD',
  low_balance_threshold numeric(14, 4),
  is_active boolean not null default false,
  -- Lower wins when the router is choosing between equals.
  priority int not null default 100,
  -- Health. consecutive_failures drives the circuit breaker in the router: a
  -- provider that has failed repeatedly is skipped rather than retried into the
  -- same wall on every request.
  last_checked_at timestamptz,
  last_ok_at timestamptz,
  last_error text,
  last_latency_ms int,
  consecutive_failures int not null default 0,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.ai_providers is
  'Upstream AI vendors, managed from /admin/ai. api_key_encrypted is AES-256-GCM and must never reach the browser.';

alter table public.ai_providers enable row level security;

drop policy if exists "Admins read ai_providers" on public.ai_providers;
create policy "Admins read ai_providers" on public.ai_providers
  for select to authenticated using (public.is_admin());

-- No INSERT/UPDATE/DELETE policy for authenticated: writes go through the
-- verifyAdmin()-gated server actions using the service-role client, the same
-- posture as app_config.
grant all on public.ai_providers to service_role;

-- ============================================================
-- 2. MODEL REGISTRY
-- ============================================================
-- Prices are stored in USD per million tokens because that is the unit every
-- vendor publishes, and a scan can then fill them in automatically (OpenRouter
-- returns pricing inline). Conversion to IDR happens once, at log time, using
-- app_config.usd_to_idr — and the resulting cost_idr is FROZEN onto the usage
-- row, so a later exchange-rate change cannot silently rewrite history.
create table if not exists public.ai_models (
  id uuid primary key default gen_random_uuid(),
  provider_id uuid not null references public.ai_providers(id) on delete cascade,
  -- The vendor's own id, sent on the wire: "gemini-3.7-flash", "gpt-5",
  -- "anthropic/claude-sonnet-4".
  model_id text not null,
  label text,
  context_length int,
  input_price_usd_per_mtok numeric(12, 4) not null default 0,
  output_price_usd_per_mtok numeric(12, 4) not null default 0,
  capabilities text[] not null default '{}'
    check (capabilities <@ array[
      'text', 'vision', 'image', 'audio', 'coding',
      'reasoning', 'long_context', 'fast', 'cheap', 'premium'
    ]::text[]),
  -- Discovered but not switched on is the normal state after a scan: a scan
  -- finds a hundred models and the owner enables three.
  is_active boolean not null default false,
  supports_streaming boolean not null default true,
  supports_schema boolean not null default true,
  source text not null default 'manual' check (source in ('manual', 'scan')),
  discovered_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (provider_id, model_id)
);

comment on table public.ai_models is
  'Per-provider model registry: pricing, capabilities, context window. Populated by SCAN MODELS or by hand.';

create index if not exists idx_ai_models_provider on public.ai_models (provider_id);
create index if not exists idx_ai_models_active on public.ai_models (is_active) where is_active;

alter table public.ai_models enable row level security;

drop policy if exists "Admins read ai_models" on public.ai_models;
create policy "Admins read ai_models" on public.ai_models
  for select to authenticated using (public.is_admin());

grant all on public.ai_models to service_role;

-- ============================================================
-- 3. ROUTES — which model serves which feature
-- ============================================================
-- `feature` is a free-text key rather than an enum on purpose. The list of AI
-- features lives in code (AI_FEATURES in src/lib/ai/types.ts) and grows every
-- time a module ships; an enum here would mean a migration for every new
-- feature, which is exactly the redeploy this whole layer exists to remove.
--
-- A feature with NO row falls back to the legacy path (env Gemini pool +
-- app_config model_free/model_pro). That is deliberate: this migration changes
-- no behaviour on deploy, and each feature is opted in individually.
create table if not exists public.ai_routes (
  feature text primary key,
  label text,
  -- manual: use primary_model_id, then fallbacks, in that order.
  -- smart:  score every active model against required_capabilities + prefer.
  mode text not null default 'manual' check (mode in ('manual', 'smart')),
  primary_model_id uuid references public.ai_models(id) on delete set null,
  -- Emergency fallback chain, tried in array order after the primary fails.
  fallback_model_ids uuid[] not null default '{}',
  required_capabilities text[] not null default '{}',
  prefer text not null default 'balanced'
    check (prefer in ('cheap', 'fast', 'quality', 'balanced')),
  is_active boolean not null default true,
  notes text,
  updated_at timestamptz not null default now(),
  updated_by uuid references public.profiles(id)
);

comment on table public.ai_routes is
  'Per-feature model routing. No row for a feature = use the legacy env Gemini path.';

alter table public.ai_routes enable row level security;

drop policy if exists "Admins read ai_routes" on public.ai_routes;
create policy "Admins read ai_routes" on public.ai_routes
  for select to authenticated using (public.is_admin());

grant all on public.ai_routes to service_role;

-- ============================================================
-- 4. COST INTELLIGENCE — one row per AI attempt
-- ============================================================
-- gemini_usage already counts requests per key per day, and it stays: the quota
-- guard depends on it and it is keyed to the env pool. It cannot answer the
-- questions this table exists for — what did THIS user's script generation cost
-- us, which feature is bleeding money, what is the margin — because it has no
-- user, no feature, no money and no provider.
--
-- `ref_id` is the join to credit_ledger.ref_id. That is what makes profit
-- computable per request: cost_idr on this row against the credits taken under
-- the same ref in the ledger.
--
-- One row per ATTEMPT, not per request. A fallback writes an 'error' row for the
-- provider that failed and an 'ok' row for the one that answered, so a provider
-- that quietly fails half the time is visible instead of averaged away. Only the
-- successful row carries credits_charged, so summing that column cannot
-- double-count a fallback.
create table if not exists public.ai_usage_log (
  id bigserial primary key,
  -- set null, not cascade: deleting a user must not erase what they cost.
  user_id uuid references public.profiles(id) on delete set null,
  feature text not null,
  provider_id uuid references public.ai_providers(id) on delete set null,
  -- Denormalised so the history survives a provider being deleted.
  provider_slug text,
  model_id text,
  input_tokens int not null default 0,
  output_tokens int not null default 0,
  cost_idr numeric(14, 4) not null default 0,
  credits_charged int not null default 0,
  latency_ms int,
  status text not null default 'ok' check (status in ('ok', 'error', 'fallback')),
  attempt int not null default 1,
  error_message text,
  ref_id text,
  created_at timestamptz not null default now()
);

comment on table public.ai_usage_log is
  'One row per AI attempt: provider, model, tokens, real cost in IDR, credits charged. ref_id joins credit_ledger.';

create index if not exists idx_ai_usage_created on public.ai_usage_log (created_at desc);
create index if not exists idx_ai_usage_user on public.ai_usage_log (user_id, created_at desc);
create index if not exists idx_ai_usage_feature on public.ai_usage_log (feature, created_at desc);

alter table public.ai_usage_log enable row level security;

drop policy if exists "Admins read ai_usage_log" on public.ai_usage_log;
create policy "Admins read ai_usage_log" on public.ai_usage_log
  for select to authenticated using (public.is_admin());

grant all on public.ai_usage_log to service_role;

-- ============================================================
-- 5. BALANCE HISTORY
-- ============================================================
-- History rather than a single current-value column, because "Rp X left" is not
-- actionable on its own — "burning about Y per day, roughly Z days left" is, and
-- that needs two readings.
create table if not exists public.ai_provider_balance (
  id bigserial primary key,
  provider_id uuid not null references public.ai_providers(id) on delete cascade,
  amount numeric(14, 4),
  currency text,
  raw jsonb,
  checked_at timestamptz not null default now()
);

create index if not exists idx_ai_balance_provider
  on public.ai_provider_balance (provider_id, checked_at desc);

alter table public.ai_provider_balance enable row level security;

drop policy if exists "Admins read ai_provider_balance" on public.ai_provider_balance;
create policy "Admins read ai_provider_balance" on public.ai_provider_balance
  for select to authenticated using (public.is_admin());

grant all on public.ai_provider_balance to service_role;

-- ============================================================
-- 6. REALTIME — the dashboard reflects a change without a reload
-- ============================================================
-- Same treatment app_config and pipeline_cards already have. Realtime enforces
-- RLS, and both tables are admin-read-only, so nothing leaks to a normal user.
-- ai_usage_log is deliberately NOT published: it is the highest-write table in
-- the system and a live feed of it would be noise.
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and tablename = 'ai_providers'
  ) then
    alter publication supabase_realtime add table public.ai_providers;
  end if;

  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and tablename = 'ai_models'
  ) then
    alter publication supabase_realtime add table public.ai_models;
  end if;
end $$;

-- ============================================================
-- 7. CONFIG SEEDS
-- ============================================================
-- setConfig() refuses unknown keys, so a live-editable setting must be seeded
-- before the admin panel can touch it.
insert into public.app_config (key, value, description) values
  ('usd_to_idr', '16500'::jsonb,
   'Kurs USD ke Rupiah buat ngitung biaya AI. Dipakai sekali pas nyatet, hasilnya dikunci di riwayat.'),
  ('ai_router_enabled', 'true'::jsonb,
   'Matiin ini buat maksa semua fitur balik ke jalur Gemini lama (tombol darurat).'),
  ('ai_fallback_enabled', 'true'::jsonb,
   'Kalau provider utama gagal, otomatis coba provider cadangan.')
on conflict (key) do nothing;

-- ============================================================
-- 8. SEED THE EXISTING POOL AS A PROVIDER
-- ============================================================
-- The Gemini pool that serves the product today, represented as a provider so it
-- is visible and routable. Its keys stay in env (key_source = 'env_gemini_pool').
--
-- NOTE what is deliberately NOT seeded: any row in ai_routes. With no routes,
-- every feature keeps using the legacy path, so applying this migration changes
-- nothing that a user can observe. Routing is opted into one feature at a time
-- from the dashboard, which is the only safe way to move a live product onto a
-- new engine.
insert into public.ai_providers (slug, label, protocol, key_source, is_active, priority, notes)
values (
  'gemini-pool',
  'Gemini (key pool)',
  'gemini',
  'env_gemini_pool',
  true,
  10,
  'Pool GEMINI_API_KEY_1..10 dari env. Rotasi, backoff dan quota guard tetap jalan seperti sebelumnya.'
)
on conflict (slug) do nothing;

-- The two model ids the product is actually configured for today. Active, so
-- there is something to route to the moment the owner opens the dashboard.
insert into public.ai_models
  (provider_id, model_id, label, context_length, capabilities, is_active, source, supports_streaming, supports_schema)
select
  p.id, 'gemini-3.7-flash', 'Gemini 3.7 Flash', 1000000,
  array['text', 'vision', 'fast', 'cheap', 'long_context']::text[],
  true, 'manual', true, true
from public.ai_providers p
where p.slug = 'gemini-pool'
on conflict (provider_id, model_id) do nothing;

-- ============================================================
-- CHARGE-ONCE: WHY THE CREDIT SYSTEM NEEDED NO CHANGE
-- ============================================================
-- The requirement is that a user is charged exactly once even when the first
-- provider fails and a second one answers.
--
-- That already holds, and it holds *because* of the existing design rather than
-- in spite of it. Credits are spent ONCE, up front, before any provider is
-- called, and reversed by ref only if the request as a whole fails. Provider
-- fallback happens entirely inside the engine, below the credit layer, so the
-- ledger cannot see it and cannot double-charge for it.
--
-- The rule this imposes on every future route: spend once, call runAI(), refund
-- by ref only when runAI() gives up on every candidate. Never spend per attempt.
