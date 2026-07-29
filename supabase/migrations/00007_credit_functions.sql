-- Migration: credit_functions
-- Step 3. The three atomic credit functions — service_role only.
-- All SECURITY DEFINER. Caller checks use auth.role(), NOT current_user.
-- See SCHEMA.md §7 for why.

-- spend_credits: the atomic spend. Takes FOR UPDATE lock to prevent races.
create or replace function public.spend_credits(
  p_user uuid,
  p_amount int,
  p_reason text,
  p_ref text default null
)
returns int
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_free int;
  v_paid int;
  v_role text;
  v_total int;
  v_free_spent int;
  v_paid_spent int;
begin
  -- Caller must be service_role (or postgres). See DECISIONS.md.
  if auth.role() not in ('service_role', 'supabase_admin') then
    raise exception 'spend_credits: not authorized';
  end if;

  -- Lock the row to serialise concurrent spends.
  select credits_free, credits_paid, role
  into v_free, v_paid, v_role
  from public.profiles
  where id = p_user
  for update;

  if not found then
    raise exception 'User not found';
  end if;

  -- Admins bypass credit checks entirely. PRD §5.
  if v_role = 'admin' then
    return v_free + v_paid;
  end if;

  v_total := v_free + v_paid;
  if v_total < p_amount then
    raise exception 'INSUFFICIENT_CREDITS';
  end if;

  -- Spend free first, then paid.
  v_free_spent := least(p_amount, v_free);
  v_paid_spent := p_amount - v_free_spent;

  update public.profiles
  set credits_free = credits_free - v_free_spent,
      credits_paid = credits_paid - v_paid_spent
  where id = p_user;

  v_total := v_total - p_amount;

  -- Ledger: one row per bucket touched.
  if v_free_spent > 0 then
    insert into public.credit_ledger (user_id, delta, bucket, reason, ref_id, balance_after)
    values (p_user, -v_free_spent, 'free', p_reason, p_ref, v_total + v_paid_spent);
  end if;

  if v_paid_spent > 0 then
    insert into public.credit_ledger (user_id, delta, bucket, reason, ref_id, balance_after)
    values (p_user, -v_paid_spent, 'paid', p_reason, p_ref, v_total);
  end if;

  return v_total;
end;
$$;

-- claim_daily_refill: SETS credits_free to 10, does NOT add 10.
-- Idempotent per day. Called on session load.
create or replace function public.claim_daily_refill(p_user uuid)
returns int
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_free int;
  v_paid int;
  v_old_free int;
  v_delta int;
  v_new_total int;
  v_refill_amount int := 10;
begin
  if auth.role() not in ('service_role', 'supabase_admin') then
    raise exception 'claim_daily_refill: not authorized';
  end if;

  select credits_free, credits_paid
  into v_free, v_paid
  from public.profiles
  where id = p_user and last_refill_date < current_date
  for update;

  if not found then
    -- Already refilled today or user does not exist.
    select credits_free + credits_paid into v_new_total
    from public.profiles where id = p_user;
    return coalesce(v_new_total, 0);
  end if;

  v_old_free := v_free;
  v_delta := v_refill_amount - v_old_free;

  update public.profiles
  set credits_free = v_refill_amount,
      last_refill_date = current_date
  where id = p_user;

  v_new_total := v_refill_amount + v_paid;

  -- Write a ledger row even if delta is negative (admin grant above ceiling).
  -- See DECISIONS.md.
  if v_delta <> 0 then
    insert into public.credit_ledger (user_id, delta, bucket, reason, balance_after)
    values (p_user, v_delta, 'free', 'daily_refill', v_new_total);
  end if;

  return v_new_total;
end;
$$;

-- grant_credits: admin/system grants.
create or replace function public.grant_credits(
  p_user uuid,
  p_amount int,
  p_bucket text,
  p_reason text,
  p_ref text default null
)
returns int
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_new_total int;
begin
  if auth.role() not in ('service_role', 'supabase_admin') then
    raise exception 'grant_credits: not authorized';
  end if;

  if p_bucket = 'free' then
    update public.profiles set credits_free = credits_free + p_amount where id = p_user;
  elsif p_bucket = 'paid' then
    update public.profiles set credits_paid = credits_paid + p_amount where id = p_user;
  else
    raise exception 'Invalid bucket: %', p_bucket;
  end if;

  select credits_free + credits_paid into v_new_total
  from public.profiles where id = p_user;

  insert into public.credit_ledger (user_id, delta, bucket, reason, ref_id, balance_after)
  values (p_user, p_amount, p_bucket, p_reason, p_ref, v_new_total);

  return v_new_total;
end;
$$;

-- Revoke EXECUTE from anon and authenticated. These are service_role only.
revoke execute on function public.spend_credits(uuid, int, text, text) from anon, authenticated;
revoke execute on function public.claim_daily_refill(uuid) from anon, authenticated;
revoke execute on function public.grant_credits(uuid, int, text, text, text) from anon, authenticated;
