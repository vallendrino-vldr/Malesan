-- Auto Clip Bridge jobs. Web users own rows through RLS; native helpers can
-- claim work only through the service-role RPC with a short-lived one-time token.

create table public.auto_clip_jobs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  video_id text not null check (video_id ~ '^[A-Za-z0-9_-]{11}$'),
  source_url text not null check (source_url = 'https://www.youtube.com/watch?v=' || video_id),
  title text not null check (char_length(title) between 1 and 300),
  clip_title text not null check (char_length(clip_title) between 1 and 90),
  start_time integer not null check (start_time >= 0 and start_time < 1800),
  end_time integer not null check (end_time > start_time and end_time <= 1800),
  ratio text not null default '9:16' check (ratio in ('9:16', '1:1', '16:9')),
  focus text not null default 'auto' check (focus in ('auto', 'left', 'center', 'right')),
  caption_preset text not null default 'default' check (char_length(caption_preset) between 1 and 32),
  language text not null default 'id' check (language in ('id', 'en')),
  status text not null default 'queued' check (
    status in ('queued', 'acquiring', 'trimming', 'tracking', 'transcribing', 'ready', 'exporting', 'failed', 'cancelled')
  ),
  progress smallint not null default 0 check (progress between 0 and 100),
  stage text,
  error_code text,
  error_message text,
  bridge_token_hash text check (bridge_token_hash is null or bridge_token_hash ~ '^[a-f0-9]{64}$'),
  bridge_token_expires_at timestamptz,
  bridge_token_used_at timestamptz,
  worker_token_hash text check (worker_token_hash is null or worker_token_hash ~ '^[a-f0-9]{64}$'),
  worker_token_expires_at timestamptz,
  bridge_claimed_at timestamptz,
  credit_amount integer not null check (credit_amount >= 0),
  credit_ref text unique,
  output_name text,
  output_bytes bigint check (output_bytes is null or output_bytes >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint auto_clip_jobs_clip_duration check (end_time - start_time between 20 and 180),
  constraint auto_clip_jobs_token_pair check (
    (bridge_token_hash is null and bridge_token_expires_at is null)
    or (bridge_token_hash is not null and bridge_token_expires_at is not null)
  ),
  constraint auto_clip_jobs_worker_token_pair check (
    (worker_token_hash is null and worker_token_expires_at is null)
    or (worker_token_hash is not null and worker_token_expires_at is not null)
  )
);

create index auto_clip_jobs_user_created_idx
  on public.auto_clip_jobs (user_id, created_at desc);
create index auto_clip_jobs_claimable_idx
  on public.auto_clip_jobs (bridge_token_hash, bridge_token_expires_at)
  where bridge_token_hash is not null and bridge_token_used_at is null;

alter table public.auto_clip_jobs enable row level security;

create policy "Users read own auto clip jobs"
  on public.auto_clip_jobs for select to authenticated
  using ((select auth.uid()) = user_id);
create policy "Users insert own auto clip jobs"
  on public.auto_clip_jobs for insert to authenticated
  with check ((select auth.uid()) = user_id);

-- No authenticated UPDATE grant: cancellation and progress pass through routes
-- that verify ownership or a worker capability before using service role.
revoke insert, update, delete, truncate, references, trigger
  on public.auto_clip_jobs from authenticated;
grant select, insert on public.auto_clip_jobs to authenticated;
revoke all on public.auto_clip_jobs from anon;

-- Atomic helper claim: consumes token, locks the job, charges once, and moves it
-- to acquisition. No raw token is stored. Replays return no row and cannot charge.
create or replace function public.claim_auto_clip_job(
  p_job uuid,
  p_token_hash text,
  p_credit_ref text,
  p_worker_token_hash text
)
returns setof public.auto_clip_jobs
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_job public.auto_clip_jobs%rowtype;
begin
  if auth.role() not in ('service_role', 'supabase_admin') then
    raise exception 'claim_auto_clip_job: not authorized';
  end if;
  if p_token_hash !~ '^[a-f0-9]{64}$'
    or p_worker_token_hash !~ '^[a-f0-9]{64}$'
    or nullif(trim(p_credit_ref), '') is null then
    raise exception 'claim_auto_clip_job: invalid claim';
  end if;

  select * into v_job
  from public.auto_clip_jobs
  where id = p_job
    and status = 'queued'
    and bridge_token_hash = p_token_hash
    and bridge_token_used_at is null
    and bridge_token_expires_at > clock_timestamp()
  for update;

  if not found then
    return;
  end if;

  update public.auto_clip_jobs
  set status = 'acquiring',
      progress = 1,
      stage = 'Mengambil potongan',
      bridge_token_used_at = clock_timestamp(),
      bridge_claimed_at = clock_timestamp(),
      worker_token_hash = p_worker_token_hash,
      worker_token_expires_at = clock_timestamp() + interval '24 hours',
      updated_at = clock_timestamp()
  where id = p_job
  returning * into v_job;

  return next v_job;
end;
$$;

revoke all on function public.claim_auto_clip_job(uuid, text, text, text) from public;
revoke all on function public.claim_auto_clip_job(uuid, text, text, text) from anon;
revoke all on function public.claim_auto_clip_job(uuid, text, text, text) from authenticated;
grant execute on function public.claim_auto_clip_job(uuid, text, text, text) to service_role;
