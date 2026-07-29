-- Migration: fix_column_guard_must_be_security_invoker
-- SECURITY FIX. The original was SECURITY DEFINER, which made the guard
-- silently never fire. See SCHEMA.md §6 for the full write-up.
-- This migration is a no-op if 00003 already has the correct version.

-- Ensure the function is SECURITY INVOKER (re-create to be safe).
create or replace function public.protect_profile_columns()
returns trigger
language plpgsql
security invoker
as $$
begin
  if current_user in ('authenticated', 'anon') then
    new.credits_free := old.credits_free;
    new.credits_paid := old.credits_paid;
    new.last_refill_date := old.last_refill_date;
    new.is_pro := old.is_pro;
    new.free_trial_used := old.free_trial_used;
    new.id := old.id;
    new.email := old.email;
    new.referral_code := old.referral_code;
    new.referred_by := old.referred_by;
    new.created_at := old.created_at;

    if not public.is_admin() then
      new.role := old.role;
      new.is_banned := old.is_banned;
      new.ban_reason := old.ban_reason;
    end if;
  end if;

  return new;
end;
$$;
