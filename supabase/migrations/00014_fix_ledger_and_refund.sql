-- Fix 1: grant_credits using UPDATE ... RETURNING to avoid TOCTOU race conditions
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
  v_free int;
  v_paid int;
begin
  if auth.role() not in ('service_role', 'supabase_admin') then
    raise exception 'grant_credits: not authorized';
  end if;

  if p_bucket = 'free' then
    update public.profiles 
    set credits_free = credits_free + p_amount 
    where id = p_user
    returning credits_free, credits_paid into v_free, v_paid;
  elsif p_bucket = 'paid' then
    update public.profiles 
    set credits_paid = credits_paid + p_amount 
    where id = p_user
    returning credits_free, credits_paid into v_free, v_paid;
  else
    raise exception 'Invalid bucket: %', p_bucket;
  end if;

  v_new_total := v_free + v_paid;

  insert into public.credit_ledger (user_id, delta, bucket, reason, ref_id, balance_after)
  values (p_user, p_amount, p_bucket, p_reason, p_ref, v_new_total);

  return v_new_total;
end;
$$;

-- Fix 2: refund_credits to intelligently restore credits to the right bucket
create or replace function public.refund_credits(
  p_user uuid,
  p_amount int,
  p_reason text
)
returns int
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_free int;
  v_paid int;
  v_to_free int;
  v_to_paid int;
  v_new_total int;
begin
  if auth.role() not in ('service_role', 'supabase_admin') then
    raise exception 'refund_credits: not authorized';
  end if;

  -- Lock the row
  select credits_free, credits_paid
  into v_free, v_paid
  from public.profiles
  where id = p_user
  for update;

  if not found then
    raise exception 'User not found';
  end if;

  -- Smart refund: If they have less than 10 free credits, we assume the loss came from 'free' 
  -- up to the ceiling of 10. Anything beyond goes to 'paid'.
  -- This is a heuristic because we don't store the exact bucket breakdown in the error catch block.
  if v_free < 10 then
    v_to_free := least(10 - v_free, p_amount);
  else
    v_to_free := 0;
  end if;
  
  v_to_paid := p_amount - v_to_free;

  update public.profiles
  set credits_free = credits_free + v_to_free,
      credits_paid = credits_paid + v_to_paid
  where id = p_user
  returning credits_free, credits_paid into v_free, v_paid;

  v_new_total := v_free + v_paid;

  if v_to_free > 0 then
    insert into public.credit_ledger (user_id, delta, bucket, reason, balance_after)
    values (p_user, v_to_free, 'free', p_reason, v_new_total - v_to_paid);
  end if;

  if v_to_paid > 0 then
    insert into public.credit_ledger (user_id, delta, bucket, reason, balance_after)
    values (p_user, v_to_paid, 'paid', p_reason, v_new_total);
  end if;

  return v_new_total;
end;
$$;

revoke execute on function public.grant_credits(uuid, int, text, text, text) from anon, authenticated;
revoke execute on function public.refund_credits(uuid, int, text) from anon, authenticated;
