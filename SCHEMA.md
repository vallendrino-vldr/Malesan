# SCHEMA — Malesan

Target: Supabase (Postgres). Everything here is implemented as **migrations**, not as
hand-edits in the Supabase dashboard. Status of implementation is tracked in `ROADMAP.md`.

> **Status:** specified, **not yet migrated.** No tables exist yet. Step 2 creates `profiles`
> and its RLS; step 3 creates the credit tables and functions.

---

## 1. Credit model — two buckets, deliberately

`credits_free` refills **to** a fixed ceiling daily and does **not** stack. This prevents
hoarding and makes multi-account farming pointless. `credits_paid` never expires.
**Spend free first, then paid.**

---

## 2. Tables

```sql
-- ============ PROFILES ============
create table profiles (
  id uuid primary key references auth.users on delete cascade,
  email text not null,
  display_name text,
  avatar_url text,
  role text not null default 'user' check (role in ('user','admin')),
  credits_free int not null default 5 check (credits_free >= 0),
  credits_paid int not null default 0 check (credits_paid >= 0),
  last_refill_date date not null default current_date,
  is_pro boolean not null default false,
  onboarding_completed boolean not null default false,
  free_trial_used boolean not null default false,
  referral_code text unique not null,
  referred_by uuid references profiles(id),
  fingerprint_hash text,
  signup_ip_hash text,
  is_banned boolean not null default false,
  ban_reason text,
  created_at timestamptz not null default now()
);

-- ============ CREATOR DNA ============
create table creator_dna (
  user_id uuid primary key references profiles(id) on delete cascade,
  niche text,
  target_audience text,
  tone text,
  platforms text[] default '{}',
  output_language text not null default 'id',
  banned_words text[] default '{}',
  brand_notes text,
  updated_at timestamptz not null default now()
);

-- ============ GENERATIONS ============
create table generations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references profiles(id) on delete cascade,
  module text not null,           -- ide_hari_ini | idea | hook | script | repurpose
  platform text,                  -- tiktok | instagram | youtube | x | threads
  input jsonb,
  output jsonb,
  model_used text,
  credits_spent int not null,
  is_favorite boolean not null default false,
  performance_rating int,         -- 1-5, set by user after posting. Feeds the trend signal.
  created_at timestamptz not null default now()
);

-- ============ CREDIT LEDGER (append-only audit trail) ============
create table credit_ledger (
  id bigserial primary key,
  user_id uuid not null references profiles(id) on delete cascade,
  delta int not null,
  bucket text not null check (bucket in ('free','paid')),
  reason text not null,
  ref_id text,
  balance_after int not null,
  created_at timestamptz not null default now()
);

-- ============ TOP-UPS ============
create table topups (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references profiles(id) on delete cascade,
  amount_idr int not null,
  credits int not null,
  method text not null check (method in ('bank_transfer','qris','voucher','saweria','manual_admin')),
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

-- ============ USER BYOK KEYS ============
create table user_api_keys (
  user_id uuid primary key references profiles(id) on delete cascade,
  provider text not null default 'gemini',
  key_encrypted text not null,
  is_active boolean not null default true,
  last_verified_at timestamptz,
  created_at timestamptz not null default now()
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
```

---

## 3. Required SQL functions

All of these are `SECURITY DEFINER`. They are the **only** legitimate path for mutating
credits — see `AGENTS.md` rule 2.

### `is_admin()`
`SECURITY DEFINER`. Returns whether the calling user has `role = 'admin'`. Used inside RLS
policies. **Must not be spoofable from the client** — it reads `auth.uid()` and looks the role
up in `profiles`; it never trusts a JWT claim or a client-supplied argument.

### `spend_credits(p_user uuid, p_amount int, p_reason text, p_ref text)`
`SECURITY DEFINER`, `plpgsql`. Must, in order:

1. `SELECT ... FOR UPDATE` on the profile row — **this is what prevents the race condition**
2. Compute total available = `credits_free + credits_paid`
3. Raise `INSUFFICIENT_CREDITS` if not enough
4. Deduct from `credits_free` first, remainder from `credits_paid`
5. Insert one `credit_ledger` row **per bucket touched**
6. Return the new total balance

> **Test this explicitly for the race condition.** Fire concurrent generation requests from
> one account with only one credit remaining. Exactly one must succeed. If two succeed, the
> atomic function is wrong and everything downstream is unsafe.

### `claim_daily_refill(p_user uuid)`
If `last_refill_date < current_date`, **set** `credits_free = 10` (set to, not add to) and
update `last_refill_date`. Called on session load.

### `grant_credits(p_user uuid, p_amount int, p_bucket text, p_reason text)`
Admin/system only. Adds credits and writes the ledger row.

---

## 4. RLS policy summary

RLS is **enabled on every table with user data. No exceptions.**

| Table | Policy |
|---|---|
| `profiles` | User reads/updates own row only; **cannot** modify `credits_*`, `role`, or `is_banned` — enforce with a column-level trigger, or by routing all credit changes through `SECURITY DEFINER` functions. Admin reads/writes all via `is_admin()`. |
| `creator_dna` | Owner only; admin read |
| `generations` | Owner only; admin read |
| `user_api_keys` | Owner only; admin read |
| `credit_ledger` | Owner read-only; inserts only from `SECURITY DEFINER` functions |
| `topups` | Owner reads own; inserts own with `status` forced to `pending`; **only admin updates status** |
| `vouchers` | **No direct client read at all.** Redemption goes through a server function. |
| `referrals` | Admin only; user sees an aggregated count of their own referrals |
| `audit_log` | Admin only |
| `trends` | Public read of `is_active` rows; admin write |
| `rate_limits` | No client access; server/`SECURITY DEFINER` only |

---

## 5. Open schema questions

- `profiles.referral_code` is `not null unique` with no default — generation strategy must be
  decided when the signup trigger is written (step 2). Candidate: short base32 of the uuid,
  collision-retried in the trigger.
- Credit pack IDR pricing needs a home. `PRD.md` requires it be admin-editable and not
  hardcoded — likely a small `credit_packs` table added at step 11. Not in the base schema
  above because the master prompt did not specify it; **raise as a proposal before adding.**
