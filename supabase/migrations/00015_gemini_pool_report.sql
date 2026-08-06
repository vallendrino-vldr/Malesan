-- Migration: gemini_pool_report
-- Per-key health for the admin panel.
--
-- `gemini_pool_used_today` already aggregates requests and errors, but it drops
-- token_count and updated_at, and the panel needs both: tokens are the only
-- signal of how *expensive* a key's traffic is, and updated_at is what
-- distinguishes "this key is idle" from "this key is broken and nothing has
-- reached it". Widening the existing function would change a signature the
-- quota guard depends on, so this is a second, additive function.
--
-- `current_date` is evaluated here rather than passed in, for the same reason
-- record_gemini_usage does: the writer and the reader must agree on which day
-- "today" is. A client-supplied date would drift from the counter it is reading
-- by whatever the caller's timezone happens to be.
create or replace function public.gemini_pool_report_today()
returns table(
  key_index    int,
  requests     bigint,
  errors       bigint,
  tokens       bigint,
  last_used_at timestamptz
)
language sql
security definer
set search_path = ''
as $$
  select
    key_index,
    sum(request_count)::bigint,
    sum(error_count)::bigint,
    sum(token_count)::bigint,
    max(updated_at)
  from public.gemini_usage
  where usage_date = current_date
  group by key_index;
$$;

-- Same posture as the rest of this table's surface: service_role only. The
-- admin panel reads it through the service-role client, and RLS on
-- gemini_usage already refuses everyone else.
revoke execute on function public.gemini_pool_report_today() from anon, authenticated;
