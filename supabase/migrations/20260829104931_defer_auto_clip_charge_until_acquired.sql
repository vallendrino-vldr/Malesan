-- Acquisition must succeed before billing. Claim only establishes worker identity;
-- this second RPC charges once under a row lock after a non-empty clip exists.
create or replace function public.charge_auto_clip_job(
  p_job uuid,
  p_worker_token_hash text,
  p_credit_ref text
)
returns setof public.auto_clip_jobs
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_job public.auto_clip_jobs%rowtype;
  v_remaining integer;
begin
  if auth.role() not in ('service_role', 'supabase_admin') then
    raise exception 'charge_auto_clip_job: not authorized';
  end if;
  if p_worker_token_hash !~ '^[a-f0-9]{64}$' or nullif(trim(p_credit_ref), '') is null then
    raise exception 'charge_auto_clip_job: invalid charge';
  end if;

  select * into v_job
  from public.auto_clip_jobs
  where id = p_job
    and worker_token_hash = p_worker_token_hash
    and worker_token_expires_at > clock_timestamp()
  for update;

  if not found then return; end if;
  if v_job.credit_ref is not null then
    if v_job.credit_ref = p_credit_ref then return next v_job; end if;
    raise exception 'charge_auto_clip_job: conflicting reference';
  end if;
  if v_job.status <> 'acquiring' then
    raise exception 'charge_auto_clip_job: invalid state %', v_job.status;
  end if;

  v_remaining := public.spend_credits(
    v_job.user_id,
    v_job.credit_amount,
    'video_auto_clip',
    p_credit_ref
  );

  update public.auto_clip_jobs
  set credit_ref = p_credit_ref,
      status = 'trimming',
      progress = greatest(progress, 20),
      stage = 'Memotong video',
      updated_at = clock_timestamp()
  where id = p_job
  returning * into v_job;
  return next v_job;
end;
$$;

revoke all on function public.charge_auto_clip_job(uuid, text, text) from public;
revoke all on function public.charge_auto_clip_job(uuid, text, text) from anon;
revoke all on function public.charge_auto_clip_job(uuid, text, text) from authenticated;
grant execute on function public.charge_auto_clip_job(uuid, text, text) to service_role;
