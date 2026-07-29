-- Migration: gemini_usage_and_byok_keys
-- Step 4. Usage tracking for quota guard + BYOK key storage.

-- gemini_usage: per-day per-key per-model usage counters.
-- An addition to the master spec, approved by the human. See SCHEMA.md §9.
create table public.gemini_usage (
  usage_date    date not null default current_date,
  key_index     int  not null,
  model         text not null,
  request_count int  not null default 0,
  error_count   int  not null default 0,
  token_count   bigint not null default 0,
  updated_at    timestamptz not null default now(),
  primary key (usage_date, key_index, model)
);

alter table public.gemini_usage enable row level security;

create policy "Admins read gemini_usage"
  on public.gemini_usage for select
  to authenticated
  using (public.is_admin());

-- record_gemini_usage: upsert, race-safe. service_role only.
create or replace function public.record_gemini_usage(
  p_key_index int,
  p_model text,
  p_tokens bigint default 0,
  p_is_error boolean default false
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.gemini_usage (usage_date, key_index, model, request_count, error_count, token_count, updated_at)
  values (current_date, p_key_index, p_model, 1,
          case when p_is_error then 1 else 0 end,
          p_tokens, now())
  on conflict (usage_date, key_index, model)
  do update set
    request_count = public.gemini_usage.request_count + 1,
    error_count = public.gemini_usage.error_count + case when p_is_error then 1 else 0 end,
    token_count = public.gemini_usage.token_count + p_tokens,
    updated_at = now();
end;
$$;

-- gemini_pool_used_today: aggregated view for the quota guard.
create or replace function public.gemini_pool_used_today()
returns table(key_index int, requests bigint, errors bigint)
language sql
security definer
set search_path = ''
as $$
  select key_index, sum(request_count)::bigint, sum(error_count)::bigint
  from public.gemini_usage
  where usage_date = current_date
  group by key_index;
$$;

revoke execute on function public.record_gemini_usage(int, text, bigint, boolean) from anon, authenticated;
revoke execute on function public.gemini_pool_used_today() from anon, authenticated;

-- user_api_keys: BYOK storage. Encrypted with AES-256-GCM.
create table public.user_api_keys (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  provider text not null default 'gemini',
  key_encrypted text not null,
  is_active boolean not null default true,
  last_verified_at timestamptz,
  created_at timestamptz not null default now()
);

alter table public.user_api_keys enable row level security;

-- Owner can see that a key exists and delete it. No INSERT/UPDATE from client.
create policy "Users read own BYOK"
  on public.user_api_keys for select
  to authenticated
  using (user_id = auth.uid());

create policy "Users delete own BYOK"
  on public.user_api_keys for delete
  to authenticated
  using (user_id = auth.uid());

create policy "Admins read all BYOK"
  on public.user_api_keys for select
  to authenticated
  using (public.is_admin());
