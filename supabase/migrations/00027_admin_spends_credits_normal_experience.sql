-- Migration: 00027_admin_spends_credits_normal_experience.sql
-- Allow admin accounts to spend credits just like regular users so the owner
-- experiences the exact same user flow and credit balance deduction.

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

revoke execute on function public.spend_credits(uuid, int, text, text) from anon, authenticated;
grant execute on function public.spend_credits(uuid, int, text, text) to service_role;
