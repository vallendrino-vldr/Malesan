# SCHEMA — Malesan

Target: Supabase (Postgres). Everything here is implemented as **migrations**, not as
hand-edits in the Supabase dashboard. Status of implementation is tracked in `ROADMAP.md`.

> **Status as of 2026-07-28 (step 2):** `profiles` is **live** on project
> `hjdctzrvnhvarxoxixrn`, with RLS enabled and verified by attack. Everything else in this
> file is still specification only. Step 3 creates the credit tables and functions.
>
> **Step 3 update:** `credit_ledger` and the three credit functions are live and verified,
> including the concurrent double-spend test.
>
> Applied migrations, in order:
> 1. `create_profiles_table`
> 2. `auth_helpers_and_signup_trigger` — `is_admin()`, `gen_referral_code()`, `handle_new_user()`
> 3. `profiles_rls_and_column_guard`
> 4. `fix_column_guard_must_be_security_invoker` — **security fix, read it before touching the guard**
> 5. `harden_function_execute_grants`
> 6. `credit_ledger_table`
> 7. `credit_functions` — `spend_credits`, `claim_daily_refill`, `grant_credits`
> 8. `fix_credit_fn_caller_checks_use_auth_role` — **security fix, see §7**

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

- ~~`profiles.referral_code` generation strategy~~ — **resolved at step 2.**
  `gen_referral_code()` returns 8 characters from `ABCDEFGHJKMNPQRSTUVWXYZ23456789`
  (I, L, O, 0 and 1 excluded — these codes get typed by hand and read off screenshots).
  `handle_new_user()` retries up to 10 times on `unique_violation`, and returns early if the
  profile already exists so a replayed signup is idempotent.
- Credit pack IDR pricing needs a home. `PRD.md` requires it be admin-editable and not
  hardcoded — likely a small `credit_packs` table added at step 11. Not in the base schema
  above because the master prompt did not specify it; **raise as a proposal before adding.**

---

## 6. The column guard — read this before editing anything

The `profiles` UPDATE policy lets a user write their own row, because they legitimately own
`display_name` and `onboarding_completed`. An RLS policy cannot express *"but not these
columns"*, so a `BEFORE UPDATE` trigger reverts the protected ones:

- always reverted: `credits_free`, `credits_paid`, `last_refill_date`, `is_pro`,
  `free_trial_used`, `id`, `email`, `referral_code`, `referred_by`, `created_at`
- reverted unless `is_admin()`: `role`, `is_banned`, `ban_reason`

**`protect_profile_columns()` must stay `SECURITY INVOKER`.** It discriminates on
`current_user`:

| Caller | `current_user` | Result |
|---|---|---|
| Client via PostgREST | `authenticated` | protected columns reverted |
| Inside `spend_credits` etc. (`SECURITY DEFINER`) | `postgres` | passes through |

The first version was written `SECURITY DEFINER`. Inside such a function `current_user` is the
function *owner*, so the condition was false on every call and the guard never fired once. A
plain authenticated user could run

```sql
update profiles set credits_free = 999999, role = 'admin' where id = <self>;
```

and it stuck — and once `role = 'admin'`, `is_admin()` returned true, which opened the SELECT
and UPDATE policies across **every** user's row. Total compromise from one keyword. This was
caught only because the RLS check was performed as an actual attack rather than by reading the
policy and assuming.

Do not reach for `auth.role()` instead: it reads the JWT claim, which still says
`authenticated` inside a `SECURITY DEFINER` function, so the guard would silently undo the
credit deduction `spend_credits` had just made.

Equally: **never enable `FORCE ROW LEVEL SECURITY` on `profiles`.** `is_admin()` reads
`profiles` from inside a policy defined on `profiles`; it avoids infinite recursion only
because a `SECURITY DEFINER` owner bypasses RLS.

### Verified at step 2, as an attacker

| Attempt | Result |
|---|---|
| Read another user's row | 0 rows |
| Read as signed-out `anon` | 0 rows |
| `credits_free = 999999` on own row | reverted to 5 |
| `role = 'admin'` on own row | reverted to `user` |
| Rewrite own `email` / `referral_code` | reverted |
| `update` another user's `display_name` | no effect |
| `insert` a forged profile with 100000 credits | blocked (no INSERT policy) |
| `display_name` + `onboarding_completed` on own row | **succeeded**, as intended |
| Admin reads all rows / bans a user | succeeded |
| Admin grants themselves credits directly | **reverted** — must go through `grant_credits` |

---

## 7. `current_user` vs `auth.role()` — the two inverse traps

Both of these were live bugs in this repo. They point in opposite directions, and getting
either backwards produces a guard that silently does nothing.

| Function kind | What `current_user` is | Use this to identify the caller |
|---|---|---|
| `SECURITY INVOKER` | the caller | **`current_user`** |
| `SECURITY DEFINER` | the function owner (`postgres`) | **`auth.role()`** |

- `protect_profile_columns()` is `SECURITY INVOKER` → it checks `current_user`. Written as
  `SECURITY DEFINER` it never fired, and any user could make themselves an admin (§6).
- `spend_credits`, `claim_daily_refill` and `grant_credits` are `SECURITY DEFINER` → they
  check `auth.role()`. Written with `current_user` those checks were dead code. No hole was
  actually open, because `EXECUTE` is granted to `service_role` alone — but a guard that
  quietly does nothing is worse than no guard, because the next reader trusts it.

`auth.role()` reads the role claim from `request.jwt.claims`, a session GUC, so it still
reports the true caller from inside a `SECURITY DEFINER` body.

---

## 8. Credit functions — verified behaviour

`EXECUTE` on all three is granted to **`service_role` only**. They are not a public API.
Server routes call them with the service-role client *after* establishing who the user is.
Exposing `spend_credits` to `authenticated` would let a client burn its own credits without
generating anything; exposing `grant_credits` would be far worse.

### The race test — mandatory, and it is the point of the whole step

`scripts/race-test.mjs` fires genuinely parallel HTTP requests at `spend_credits`. **Re-run it
after any change to that function.** A sequential test passes even with the lock removed,
which is exactly why it must be concurrent.

Results as run at step 3:

| Scenario | Expected | Observed |
|---|---|---|
| free=1, paid=0, spend 1, **12 parallel** | 1 wins | **1 won**, 11 `INSUFFICIENT_CREDITS`, 0 anomalies |
| free=1, paid=4, spend 2, **20 parallel** | 2 win | **2 won**, 18 rejected, 0 anomalies |

The cross-bucket case also proves the split: the winning spend took 1 free + 1 paid and wrote
**two** ledger rows; the second took 2 from paid and wrote one. Final state `free=0, paid=1`,
`sum(delta) = -4`, and the last `balance_after` matched the real balance.

### Other verified behaviour

| Behaviour | Result |
|---|---|
| `claim_daily_refill` from `credits_free = 37` | set to **10**, not 47 — proves "set to, not add to" |
| `claim_daily_refill` called twice in one day | second call is a no-op, one ledger row only |
| Refill ledger row when the balance drops | `delta = -27` recorded honestly rather than hidden |
| `grant_credits(350, 'paid')` | balance 11 → 361, one ledger row |
| Admin spends 999 holding 3 credits | succeeds, balance unchanged, **no ledger row** (nothing moved) |
| `authenticated` calls `grant_credits` | denied |
| `authenticated` calls `spend_credits` / `claim_daily_refill` | denied |
| `authenticated` inserts directly into `credit_ledger` | denied |

After all four attacks the balance was untouched and `credit_ledger` contained zero forged
rows.

---

## 9. Step 4 additions — `gemini_usage` and `user_api_keys`

### `gemini_usage` — an addition to the master spec, approved 2026-07-28

`AGENTS.md` §3 mandates a quota guard ("below 20% pool remaining, serve paid and BYOK users
only") but the master spec never said where usage is counted. Gemini does not report remaining
quota, and Vercel serverless has no shared memory between requests — so without a table the
guard is guesswork. The human approved adding one.

```sql
create table gemini_usage (
  usage_date    date not null default current_date,
  key_index     int  not null,        -- 1 or 2: which key, therefore which GCP project
  model         text not null,
  request_count int  not null default 0,
  error_count   int  not null default 0,
  token_count   bigint not null default 0,
  updated_at    timestamptz not null default now(),
  primary key (usage_date, key_index, model)
);
```

Written **only** by `record_gemini_usage(p_key_index, p_model, p_tokens, p_is_error)`, which
upserts so concurrent generations cannot lose counts to a read-modify-write race. Read by
`gemini_pool_used_today()`. Both are `service_role` only. RLS: admin read.

**`usage_date` is a UTC date, which is not the quota day.** Gemini's free-tier quota resets at
midnight Pacific, roughly 14:00 WIB, so the counter and the real quota window are offset by
several hours. The guard is deliberately conservative rather than exact. This is also the
data source for the admin "API key pool health" screen at step 12.

### `user_api_keys` — BYOK

Verbatim from §2. RLS allows the owner to see *that* a key exists and to delete it; there is
**no INSERT or UPDATE policy**, because keys are written only by the server route that
performs the encryption, using the service-role client. The ciphertext is never returned to
the browser — not even to its owner, who would learn nothing they did not already type.

`key_encrypted` is AES-256-GCM as `iv.tag.ciphertext` (base64url), keyed by `ENCRYPTION_KEY`.
GCM rather than CBC because it authenticates: a tampered ciphertext fails to decrypt instead
of silently yielding garbage that then gets sent to Google as an API key. **If
`ENCRYPTION_KEY` is lost or rotated, every stored key becomes undecryptable** and users must
re-enter theirs. There is no recovery path, by design.
