-- Migration: harden_function_execute_grants
-- Revoke EXECUTE from anon/authenticated on sensitive functions.
-- Credit functions are service_role only — see DECISIONS.md.

revoke execute on function public.handle_new_user() from anon, authenticated;
revoke execute on function public.gen_referral_code() from anon, authenticated;
