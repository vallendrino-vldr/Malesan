-- Migration: profiles_rls_and_column_guard
-- Step 2. RLS policies + column-level trigger to protect privileged fields.

-- Users can only read their own row.
create policy "Users read own profile"
  on public.profiles for select
  to authenticated
  using (id = auth.uid());

-- Admins can read all profiles.
create policy "Admins read all profiles"
  on public.profiles for select
  to authenticated
  using (public.is_admin());

-- Users can update their own row (but the trigger below protects privileged columns).
create policy "Users update own profile"
  on public.profiles for update
  to authenticated
  using (id = auth.uid())
  with check (id = auth.uid());

-- Admins can update any profile (but the trigger still protects credit columns).
create policy "Admins update any profile"
  on public.profiles for update
  to authenticated
  using (public.is_admin());

-- Column guard trigger. MUST stay SECURITY INVOKER. See SCHEMA.md §6, DECISIONS.md.
-- Inside SECURITY INVOKER, current_user is the caller:
--   - PostgREST (client) → 'authenticated' → columns are reverted
--   - Inside spend_credits (SECURITY DEFINER) → 'postgres' → passes through
create or replace function public.protect_profile_columns()
returns trigger
language plpgsql
security invoker
as $$
begin
  -- Only protect when called by a non-superuser (i.e. via the client).
  if current_user in ('authenticated', 'anon') then
    -- Always revert these, regardless of role.
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

    -- Admin-only columns.
    if not public.is_admin() then
      new.role := old.role;
      new.is_banned := old.is_banned;
      new.ban_reason := old.ban_reason;
    end if;
  end if;

  return new;
end;
$$;

create trigger protect_columns
  before update on public.profiles
  for each row execute function public.protect_profile_columns();
