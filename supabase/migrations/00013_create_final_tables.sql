-- ============ TOP-UPS & PACKS ============
create table credit_packs (
  id uuid primary key default gen_random_uuid(),
  credits int not null,
  price_idr int not null,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

-- Seed initial credit packs
insert into credit_packs (credits, price_idr) values 
  (100, 15000),
  (350, 45000),
  (1000, 100000);

create table topups (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references profiles(id) on delete cascade,
  amount_idr int not null,
  credits int not null,
  method text not null check (method in ('bank_transfer','qris','voucher','manual_admin')),
  proof_url text,
  status text not null default 'pending' check (status in ('pending','approved','rejected')),
  reviewed_by uuid references profiles(id),
  reviewed_at timestamptz,
  note text,
  created_at timestamptz not null default now()
);

-- ============ VOUCHERS ============
create table vouchers (
  code text primary key,
  credits int not null,
  is_redeemed boolean not null default false,
  redeemed_by uuid references profiles(id),
  redeemed_at timestamptz,
  created_by uuid references profiles(id),
  expires_at timestamptz,
  created_at timestamptz not null default now()
);

-- ============ REFERRALS ============
create table referrals (
  id uuid primary key default gen_random_uuid(),
  referrer_id uuid not null references profiles(id) on delete cascade,
  referee_id uuid not null references profiles(id) on delete cascade unique,
  status text not null default 'pending' check (status in ('pending','credited','voided')),
  void_reason text,
  credited_at timestamptz,
  created_at timestamptz not null default now()
);

-- ============ TRENDS (auto-populated daily) ============
create table trends (
  id uuid primary key default gen_random_uuid(),
  source text not null,           -- google_trends | google_news | user_signal
  title text not null,
  summary text,
  category text,
  region text default 'ID',
  is_active boolean not null default true,
  captured_at timestamptz not null default now()
);

-- ============ RATE LIMITING ============
create table rate_limits (
  user_id uuid not null references profiles(id) on delete cascade,
  window_start timestamptz not null,
  request_count int not null default 0,
  primary key (user_id, window_start)
);

-- ============ AUDIT LOG ============
create table audit_log (
  id bigserial primary key,
  actor_id uuid references profiles(id),
  action text not null,
  target_type text,
  target_id text,
  metadata jsonb,
  created_at timestamptz not null default now()
);

-- ============ STORAGE BUCKET ============
insert into storage.buckets (id, name, public) 
values ('topup_proofs', 'topup_proofs', true)
on conflict (id) do nothing;

create policy "Users can upload proofs" on storage.objects for insert to authenticated 
with check (bucket_id = 'topup_proofs' and (auth.uid())::text = (storage.foldername(name))[1]);

create policy "Anyone can read proofs" on storage.objects for select to public 
using (bucket_id = 'topup_proofs');

create policy "Admin can delete proofs" on storage.objects for delete to authenticated 
using (bucket_id = 'topup_proofs' and is_admin());

-- ============ RLS POLICIES ============

-- credit_packs
alter table credit_packs enable row level security;
create policy "Public read credit packs" on credit_packs for select using (is_active = true);
create policy "Admin write credit packs" on credit_packs for all to authenticated using (is_admin());

-- topups
alter table topups enable row level security;
create policy "User read own topups" on topups for select to authenticated using (user_id = auth.uid() or is_admin());
create policy "User insert own topups" on topups for insert to authenticated with check (user_id = auth.uid() and status = 'pending');
create policy "Admin update topups" on topups for update to authenticated using (is_admin());

-- vouchers
alter table vouchers enable row level security;
-- No client read by default. Redemption goes through RPC or Server Action. Admin can manage them.
create policy "Admin manage vouchers" on vouchers for all to authenticated using (is_admin());

-- referrals
alter table referrals enable row level security;
create policy "Admin manage referrals" on referrals for all to authenticated using (is_admin());
-- Users see aggregated count in Server Actions, no direct RLS read needed

-- trends
alter table trends enable row level security;
create policy "Public read active trends" on trends for select using (is_active = true);
create policy "Admin manage trends" on trends for all to authenticated using (is_admin());

-- rate_limits
alter table rate_limits enable row level security;
-- Server and service role only. No direct access.

-- audit_log
alter table audit_log enable row level security;
create policy "Admin read audit log" on audit_log for select to authenticated using (is_admin());
create policy "Admin insert audit log" on audit_log for insert to authenticated with check (is_admin());

-- Grants for service_role explicitly
grant all on credit_packs, topups, vouchers, referrals, trends, rate_limits, audit_log to service_role;
