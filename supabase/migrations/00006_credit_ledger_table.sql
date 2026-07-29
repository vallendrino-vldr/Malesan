-- Migration: credit_ledger_table
-- Step 3. Append-only audit trail for credit movements.

create table public.credit_ledger (
  id bigserial primary key,
  user_id uuid not null references public.profiles(id) on delete cascade,
  delta int not null,
  bucket text not null check (bucket in ('free','paid')),
  reason text not null,
  ref_id text,
  balance_after int not null,
  created_at timestamptz not null default now()
);

alter table public.credit_ledger enable row level security;

-- Owner can read their own ledger entries.
create policy "Users read own ledger"
  on public.credit_ledger for select
  to authenticated
  using (user_id = auth.uid());

-- Admins can read all.
create policy "Admins read all ledger"
  on public.credit_ledger for select
  to authenticated
  using (public.is_admin());

-- No INSERT/UPDATE/DELETE policies for authenticated.
-- Inserts come from SECURITY DEFINER functions only.
