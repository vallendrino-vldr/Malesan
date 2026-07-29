-- Migration: auth_helpers_and_signup_trigger
-- Step 2. Helper functions + automatic profile creation on signup.

-- Unambiguous referral code alphabet (I, L, O, 0, 1 excluded).
-- About 8.5×10¹¹ combinations. See DECISIONS.md.
create or replace function public.gen_referral_code()
returns text
language plpgsql
as $$
declare
  chars text := 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
  result text := '';
  i int;
begin
  for i in 1..8 loop
    result := result || substr(chars, floor(random() * length(chars) + 1)::int, 1);
  end loop;
  return result;
end;
$$;

-- is_admin: SECURITY DEFINER, reads auth.uid() from profiles.
-- Used inside RLS policies. Must not be spoofable from the client.
create or replace function public.is_admin()
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
begin
  return exists (
    select 1 from public.profiles
    where id = auth.uid() and role = 'admin'
  );
end;
$$;

-- Grant EXECUTE to authenticated (needed for RLS policy expressions).
-- The Supabase linter flags this; it is a false positive. See DECISIONS.md.
grant execute on function public.is_admin() to authenticated;

-- Signup trigger: creates a profile row when a new auth user is created.
-- Retries referral code up to 10 times on unique_violation.
-- Returns early if profile already exists (idempotent on replayed signups).
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  code text;
  attempts int := 0;
begin
  -- Idempotent: if profile already exists, skip.
  if exists (select 1 from public.profiles where id = new.id) then
    return new;
  end if;

  loop
    code := public.gen_referral_code();
    begin
      insert into public.profiles (id, email, display_name, avatar_url, referral_code)
      values (
        new.id,
        coalesce(new.email, ''),
        coalesce(new.raw_user_meta_data ->> 'full_name', new.raw_user_meta_data ->> 'name'),
        new.raw_user_meta_data ->> 'avatar_url',
        code
      );
      return new;
    exception when unique_violation then
      attempts := attempts + 1;
      if attempts >= 10 then raise; end if;
    end;
  end loop;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();
