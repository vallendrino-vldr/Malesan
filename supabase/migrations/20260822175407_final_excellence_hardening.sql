-- Final production hardening. All changes are additive/idempotent; this file
-- deliberately does not repair migration history or reset any live data.

-- ---------------------------------------------------------------------------
-- Atomic, scoped AI rate limiting
-- ---------------------------------------------------------------------------

alter table public.rate_limits
  add column if not exists scope text not null default 'ai';

-- The original key allowed only one counter per user/window. Different AI
-- surfaces have very different traffic shapes (autocomplete vs video), so the
-- scope must be part of the conflict target. The table was verified empty in
-- production before this migration was authored.
alter table public.rate_limits drop constraint if exists rate_limits_pkey;
alter table public.rate_limits
  add constraint rate_limits_pkey primary key (user_id, scope, window_start);

create or replace function public.consume_rate_limit(
  p_user uuid,
  p_scope text,
  p_limit integer,
  p_window_seconds integer default 60
)
returns table (
  allowed boolean,
  retry_after_seconds integer,
  request_count integer
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_now timestamptz := clock_timestamp();
  v_window timestamptz;
  v_count integer;
  v_scope text := left(trim(coalesce(p_scope, '')), 64);
begin
  if auth.role() <> 'service_role' then
    raise exception 'service_role only';
  end if;
  if p_user is null or v_scope = '' then
    raise exception 'user and scope are required';
  end if;
  if p_limit < 1 or p_limit > 1000 then
    raise exception 'limit out of range';
  end if;
  if p_window_seconds < 1 or p_window_seconds > 86400 then
    raise exception 'window out of range';
  end if;

  v_window := to_timestamp(
    floor(extract(epoch from v_now) / p_window_seconds) * p_window_seconds
  );

  insert into public.rate_limits (user_id, scope, window_start, request_count)
  values (p_user, v_scope, v_window, 1)
  on conflict (user_id, scope, window_start)
  do update set request_count = public.rate_limits.request_count + 1
  returning public.rate_limits.request_count into v_count;

  -- Bound growth without a global table scan. The primary key starts with the
  -- user id, so pruning this caller's old counters stays cheap.
  delete from public.rate_limits
  where user_id = p_user
    and window_start < v_now - interval '1 day';

  return query select
    v_count <= p_limit,
    greatest(
      1,
      ceil(extract(epoch from (v_window + make_interval(secs => p_window_seconds) - v_now)))::integer
    ),
    v_count;
end;
$$;

revoke all on function public.consume_rate_limit(uuid, text, integer, integer) from public;
revoke all on function public.consume_rate_limit(uuid, text, integer, integer) from anon;
revoke all on function public.consume_rate_limit(uuid, text, integer, integer) from authenticated;
grant execute on function public.consume_rate_limit(uuid, text, integer, integer) to service_role;

-- ---------------------------------------------------------------------------
-- Future installs must match the already-private production proof bucket.
-- ---------------------------------------------------------------------------

update storage.buckets set public = false where id = 'topup_proofs';
drop policy if exists "Anyone can read proofs" on storage.objects;

-- ---------------------------------------------------------------------------
-- RLS planner hardening
-- auth.uid() wrapped in SELECT is evaluated once per statement rather than once
-- per row. Policies keep the same access semantics.
-- ---------------------------------------------------------------------------

do $$
begin
  if to_regclass('public.pipeline_cards') is not null then
    alter policy "Users read own pipeline cards" on public.pipeline_cards
      using (user_id = (select auth.uid()));
    alter policy "Users insert own pipeline cards" on public.pipeline_cards
      with check (user_id = (select auth.uid()));
    alter policy "Users update own pipeline cards" on public.pipeline_cards
      using (user_id = (select auth.uid()))
      with check (user_id = (select auth.uid()));
    alter policy "Users delete own pipeline cards" on public.pipeline_cards
      using (user_id = (select auth.uid()));
  end if;

  if to_regclass('public.creator_dna') is not null then
    alter policy "Users read own DNA" on public.creator_dna
      using (user_id = (select auth.uid()));
    alter policy "Users upsert own DNA" on public.creator_dna
      with check (user_id = (select auth.uid()));
    alter policy "Users update own DNA" on public.creator_dna
      using (user_id = (select auth.uid()))
      with check (user_id = (select auth.uid()));
  end if;

  if to_regclass('public.generations') is not null then
    alter policy "Users read own generations" on public.generations
      using (user_id = (select auth.uid()));
    alter policy "Users update own generations" on public.generations
      using (user_id = (select auth.uid()))
      with check (user_id = (select auth.uid()));
  end if;

  if to_regclass('public.personas') is not null then
    alter policy "Users read own personas" on public.personas
      using (user_id = (select auth.uid()));
    alter policy "Users insert own personas" on public.personas
      with check (user_id = (select auth.uid()));
    alter policy "Users update own personas" on public.personas
      using (user_id = (select auth.uid()))
      with check (user_id = (select auth.uid()));
    alter policy "Users delete own personas" on public.personas
      using (user_id = (select auth.uid()));
  end if;

  if to_regclass('public.drafts') is not null then
    alter policy "Users read own drafts" on public.drafts
      using (user_id = (select auth.uid()));
    alter policy "Users insert own drafts" on public.drafts
      with check (user_id = (select auth.uid()));
    alter policy "Users update own drafts" on public.drafts
      using (user_id = (select auth.uid()))
      with check (user_id = (select auth.uid()));
    alter policy "Users delete own drafts" on public.drafts
      using (user_id = (select auth.uid()));
  end if;

  if to_regclass('public.app_config') is not null then
    alter policy "app_config admin read" on public.app_config
      using (
        exists (
          select 1 from public.profiles p
          where p.id = (select auth.uid()) and p.role = 'admin'
        )
      );
  end if;

  if to_regclass('public.error_log') is not null then
    alter policy "error_log admin read" on public.error_log
      using (
        exists (
          select 1 from public.profiles p
          where p.id = (select auth.uid()) and p.role = 'admin'
        )
      );
  end if;
end;
$$;
