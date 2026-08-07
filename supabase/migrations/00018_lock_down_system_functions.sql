-- Migration: lock_down_system_functions
--
-- The database linter reported four SECURITY DEFINER functions reachable over
-- PostgREST as `anon` and `authenticated`:
--
--   admin_user_activity(int)        — admin analytics
--   gemini_pool_report_today()      — key-pool health
--   rls_auto_enable()               — maintenance helper
--   refund_credits(uuid,int,text)   — the LEGACY refund overload
--
-- Every one of them is called from server code with the service-role client
-- (verified by grep across src/ before writing this), so the public grants
-- bought nothing and cost an attack surface on a product that holds money.
--
-- Each function does carry its own internal auth.role() guard. That is the
-- reason this matters rather than the reason it does not: SCHEMA.md §7 records
-- two live bugs in this very repo where such a guard silently did nothing
-- because it interrogated the wrong caller identity. One of them let any
-- authenticated user make themselves an admin. A guard is the last line of
-- defence, not the only one.
--
-- The legacy refund_credits overload is the one worth naming. It was superseded
-- by refund_credits(uuid, text, text) in migration 00014, and it grants credits
-- on a HEURISTIC — "assume the loss came from free up to a ceiling of 10" —
-- rather than by reversing the recorded spend rows, so it can hand back credits
-- that were never taken. Nothing calls it: every caller passes p_ref, which
-- resolves to the ref-keyed version. It is revoked rather than dropped, because
-- removing a function from a live money system is not a thing to do in passing.
--
-- FIRST ATTEMPT FAILED, AND THE FAILURE IS THE LESSON. `REVOKE EXECUTE ... FROM
-- anon, authenticated` reported success and changed nothing, because EXECUTE had
-- been granted to PUBLIC — which both roles inherit, and which a per-role revoke
-- does not touch. It was caught only by checking has_function_privilege()
-- afterwards instead of trusting the successful statement. Revoke from PUBLIC,
-- then grant back the one role that actually calls it.

revoke all on function public.admin_user_activity(integer) from public, anon, authenticated;
grant execute on function public.admin_user_activity(integer) to service_role;

revoke all on function public.gemini_pool_report_today() from public, anon, authenticated;
grant execute on function public.gemini_pool_report_today() to service_role;

revoke all on function public.rls_auto_enable() from public, anon, authenticated;

revoke all on function public.refund_credits(uuid, integer, text) from public, anon, authenticated;
grant execute on function public.refund_credits(uuid, integer, text) to service_role;

-- public.is_admin() is deliberately NOT revoked. RLS policies call it, and a
-- function invoked inside a policy runs as the caller — revoking it from
-- `authenticated` stops every admin policy in the database from evaluating.
-- It also leaks nothing: it answers one boolean question about the caller.

-- Verified after applying, with has_function_privilege() for each role:
--   admin_user_activity      anon=f  authenticated=f  service_role=t
--   gemini_pool_report_today anon=f  authenticated=f  service_role=t
--   rls_auto_enable          anon=f  authenticated=f  service_role=t
--   refund_credits (both)    anon=f  authenticated=f  service_role=t
--   is_admin                 anon=f  authenticated=t  service_role=t
