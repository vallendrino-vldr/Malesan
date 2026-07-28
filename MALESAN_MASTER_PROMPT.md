# MALESAN — MASTER BUILD PROMPT

> **For the human (Vldr):** Paste this entire file as your first message in a new Claude Code
> or Antigravity session. After that, you only ever need to type **"lanjut"**.
> Any agent, any IDE, any session — it reads the repo files and knows exactly where to resume.

---

## 0. WHO YOU ARE AND WHAT YOU ARE DOING

You are the lead engineer building **Malesan**, a production web app that will be publicly
launched and monetized. This is not a prototype. Treat every decision as if real paying users
depend on it, because they will.

You may be Claude Code. You may be Antigravity IDE. You may be a different agent entirely.
It does not matter. The repo is the single source of truth. Read it, extend it, and leave it
in a state where the next agent — who has never seen this conversation — can continue
without asking a single question.

---

## 1. YOUR VERY FIRST ACTION — DO THIS BEFORE ANY APPLICATION CODE

Create these files in the repository root, populated from the specification in this document.
Then `git commit`, then **stop and report**. Do not start building the app in the same turn.

| File | Purpose | Volatility |
|---|---|---|
| `AGENTS.md` | Permanent rules every agent must obey. Canonical file, read by all IDEs. | Rarely changes |
| `CLAUDE.md` | One line: `See AGENTS.md — it is the canonical instruction file for this repo.` | Never changes |
| `HANDOFF.md` | Live session state. Where we are, what's next. | **Every session** |
| `DECISIONS.md` | Append-only log of *why* choices were made. Never delete entries. | Grows only |
| `PRD.md` | Product requirements. | Occasionally |
| `SCHEMA.md` | Database schema, RLS policies, SQL functions. | Occasionally |
| `DESIGN.md` | Design tokens, typography, motion, copy voice. | Occasionally |
| `PROMPTS.md` | AI system prompts (Indonesian). | Occasionally |
| `ROADMAP.md` | Build phases and status. | Every phase |

**Why this matters:** context windows run out. Sessions die. The human switches IDEs when
rate limits hit. These files are your memory. If they are not accurate, work is lost.

---

## 2. PRODUCT BRIEF

**Name:** Malesan
**Tagline:** *"Males mikirnya. Bukan bikinnya."*
**Domain of intent:** malesan.app (or similar — confirm with human before hardcoding)

### The problem
Content creators open their editor and stare at nothing. The bottleneck is not filming,
editing, or posting — it is deciding *what* to make, *how* to hook, and *what* to say.
Malesan removes the blank-page moment.

### Positioning — critical, do not drift from this
Malesan is for people who are **lazy about the thinking**, not lazy about the craft.
The user still films, edits, and performs. Malesan only kills the staring-at-a-blank-screen part.
Never let copy imply the product makes low-effort or low-quality content.

### Brand voice
Casual, warm, a little funny. Premium execution underneath. The contrast is the point
(precedent: Slack — a casual name on a serious tool).

UI copy examples that set the register:
- Loading → `"Lagi mikirin buat lo..."`
- Empty state → `"Belum ada apa-apa. Ya udah, gue yang mulai."`
- Primary CTA → `"Males mikir. Kasih ide."`
- Zero credits → `"Credit abis. Besok refill jam 00:00, atau top up biar gak nunggu."`

Rules for all copy: sentence case, active voice, no corporate filler, no apologising errors.
An error says what broke and what to do. An empty state is an invitation, not a mood.

### Market
Indonesia first. UI is bilingual (ID/EN toggle). AI output language is a user setting,
defaulting to Indonesian. Do not conflate these two — they are separate settings.

---

## 3. HARD RULES — COPY THESE VERBATIM INTO `AGENTS.md`

These are non-negotiable. Violating any of them is a critical defect.

1. **No AI provider key ever reaches the browser.** All Gemini calls go through server-side
   code only (Next.js route handlers or Supabase Edge Functions). If a key would be readable
   in a network tab or a client bundle, you have failed.
2. **Credits are spent server-side, atomically, via the `spend_credits` SQL function only.**
   Never decrement credits in client code. Never decrement with a plain UPDATE. Parallel
   requests must not be able to double-spend.
3. **Admin role is read from the database, never from a hardcoded email in the frontend.**
   Authorisation is enforced by RLS and server checks, not by hiding UI.
4. **Row Level Security is enabled on every table with user data.** No exceptions.
   A user can only ever read or write their own rows. Admins pass through a
   `SECURITY DEFINER` role check function.
5. **Model IDs live in environment variables**, never hardcoded. Google changes model names
   and quotas frequently. Swapping a model must be a one-line env change.
6. **Never invent a feature that is not in this spec or in `ROADMAP.md`.** Propose it in
   `HANDOFF.md` under PROPOSALS and wait for human approval.
7. **Update `HANDOFF.md` before ending any turn in which you changed a file.** Not optional.
   A session that changes code without updating `HANDOFF.md` is an incomplete session.
8. **Commit at every checkpoint** with a clear message. Small commits, not one giant one.
9. **Quality floor, unannounced:** responsive to 360px, visible keyboard focus states,
   `prefers-reduced-motion` respected, all interactive elements reachable by keyboard.
10. **If a spec instruction conflicts with reality** (an API changed, a library is deprecated),
    stop, write the conflict in `HANDOFF.md` under BLOCKERS, and ask. Do not guess and proceed.

---

## 4. TECH STACK — FIXED

- **Framework:** Next.js (App Router), TypeScript
- **Styling:** Tailwind CSS
- **Motion:** Framer Motion
- **Backend / DB / Auth:** Supabase (free tier)
- **Auth method:** Google OAuth **only**. No email/password. This is an anti-abuse decision.
- **AI:** Google Gemini API, free tier, two keys from **two separate Google Cloud projects**
- **Deploy:** Vercel
- **Cron:** Vercel Cron (or `pg_cron` in Supabase if Vercel Hobby limits bite)

### Environment variables
```
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=      # server only, never exposed
GEMINI_API_KEY_1=               # project A
GEMINI_API_KEY_2=               # project B
GEMINI_MODEL_FREE=              # e.g. the current free Flash-Lite model id
GEMINI_MODEL_PRO=               # e.g. the current free Flash model id
CRON_SECRET=
ENCRYPTION_KEY=                 # for encrypting user BYOK keys at rest
```

### Known platform constraints — build around these
- Gemini free-tier quota is enforced **per Google Cloud project, not per API key**.
  Two keys only help because they come from two separate projects. Do not add more keys
  to the same project expecting more quota.
- Gemini daily quota resets at **midnight Pacific Time ≈ 14:00 WIB**, not local midnight.
  Indonesian prime time (19:00–23:00 WIB) therefore runs on partially-consumed quota.
  Implement a **quota guard**: when the pool drops below 20% remaining, serve paid and
  BYOK users only, and show free users a clear message with a top-up path.
- Free-tier prompts may be used by Google for model training. This must be stated in the
  Terms of Service, and it is a selling point for BYOK ("pakai key sendiri, data lo aman").
- Vercel Hobby is not licensed for commercial use. Flag this to the human before launch.
- Handle HTTP 429 with exponential backoff (1s, 2s, 4s, 8s) and automatic key rotation.

---

## 5. DATABASE SCHEMA

Write this into `SCHEMA.md` and implement as Supabase migrations.

### Credit model — two buckets, deliberately
`credits_free` refills to a fixed ceiling daily and does **not** stack (prevents hoarding
and makes multi-account farming pointless). `credits_paid` never expires. Spend free first.

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

### Required SQL functions

**`is_admin()`** — `SECURITY DEFINER`, returns whether the calling user has `role = 'admin'`.
Used inside RLS policies. Must not be spoofable from the client.

**`spend_credits(p_user uuid, p_amount int, p_reason text, p_ref text)`** —
`SECURITY DEFINER`, `plpgsql`. Must:
1. `SELECT ... FOR UPDATE` on the profile row (this is what prevents the race condition)
2. Compute total available = `credits_free + credits_paid`
3. Raise `INSUFFICIENT_CREDITS` if not enough
4. Deduct from `credits_free` first, remainder from `credits_paid`
5. Insert one `credit_ledger` row per bucket touched
6. Return the new total balance

**`claim_daily_refill(p_user uuid)`** — if `last_refill_date < current_date`, set
`credits_free = 10` (set to, not add to) and update `last_refill_date`. Called on session load.

**`grant_credits(p_user uuid, p_amount int, p_bucket text, p_reason text)`** — admin/system
only. Adds credits and writes the ledger row.

### RLS policy summary
- `profiles` — user reads/updates own row only; cannot modify `credits_*`, `role`, or
  `is_banned` (enforce with a column-level trigger or by routing all credit changes
  through `SECURITY DEFINER` functions). Admin reads/writes all via `is_admin()`.
- `creator_dna`, `generations`, `user_api_keys` — owner only; admin read.
- `credit_ledger` — owner read-only; inserts only from `SECURITY DEFINER` functions.
- `topups` — owner reads own, inserts own with status forced to `pending`; only admin updates status.
- `vouchers` — no direct client read at all. Redemption goes through a server function.
- `referrals`, `audit_log` — admin only; user sees an aggregated count of their own referrals.
- `trends` — public read of active rows; admin write.

---

## 6. CREDIT ECONOMY

| Action | Cost |
|---|---|
| Ide Hari Ini (zero-input daily ideas) | 1 |
| Idea Engine | 1 |
| Hook Lab | 2 |
| Script Builder | 4 |
| Repurpose | 1 |
| Creator DNA analysis | 2 |

| | Free | Pro (paid credits) |
|---|---|---|
| Daily refill | 10, resets (does not stack) | — |
| Signup bonus | 5 | — |
| Model | `GEMINI_MODEL_FREE` (Flash-Lite) | `GEMINI_MODEL_PRO` (Flash) |
| History retained | last 50 generations | unlimited |
| Priority when quota is low | no | yes |

**Packs:** 100 / 350 / 1000 credits. The human sets IDR pricing — leave it configurable
in an admin-editable table or config file, do not hardcode prices in components.

**Why the signup bonus is small:** if signup granted a large bonus, farming accounts would
be worth the effort. At 5 credits with 10 free every day anyway, creating a second account
costs more effort than simply waiting. The economy design is the primary anti-abuse mechanism;
the technical checks below are the backstop.

---

## 7. ANTI-ABUSE

- Google OAuth only. No email/password, no magic links.
- Block known disposable-email domains at signup.
- Store a hashed device fingerprint and a hashed signup IP. Never store either in plaintext.
- Flag in admin when one fingerprint maps to more than two accounts. Flag, do not auto-ban —
  shared computers and offices exist.
- Per-user rate limit: max 10 generation requests per minute, enforced server-side.
- Log every generation request. Give admin a ban button.

### Referral rules — both sides earn, so guard it carefully
- Referee earns credits **after completing their first generation**, not at signup.
- Referrer earns only **after** the referee's first generation clears.
- Same fingerprint hash on both accounts → status `voided`, neither side earns, log it.
- Maximum 10 successfully credited referrals per account.
- Referral credits land in `credits_paid` so they do not vanish at daily reset.

---

## 8. DESIGN SYSTEM

### Concept
Cold obsidian that heats up when the user acts. The interface is dark, quiet and dormant
until a generation starts — then amber light blooms out of the active element. Heat maps
to activity. This is the signature; spend the boldness here and keep everything else quiet.

Do not use heavy 3D scenes or WebGL models. They contradict the "fast and smooth"
requirement. Depth comes from layered shadows, a warm ambient glow behind active surfaces,
subtle parallax, and CSS 3D transforms. At most one lightweight ambient WebGL accent, and
only if it costs nothing perceptible on mid-range Android.

### Color tokens
The base black is **warm-tinted**, not blue-black — a cool black under an amber accent
reads as a clash.

| Token | Hex | Use |
|---|---|---|
| `obsidian` | `#0B0A09` | App background |
| `surface` | `#16130F` | Cards, panels |
| `surface-raised` | `#1F1A14` | Elevated / hover |
| `border` | `#2A241D` | Hairline dividers |
| `ember` | `#FF8A3D` | Primary accent |
| `ember-lo` | `#FFB067` | Hover, highlight |
| `ember-deep` | `#C2521A` | Pressed, glow shadow |
| `text` | `#F5F0EA` | Primary text |
| `muted` | `#8A8178` | Secondary text |
| `success` | `#6FCF97` | Confirmations only |
| `danger` | `#E5544B` | Destructive only |

Amber is for action and heat. Never use it for decoration or on non-interactive elements —
if everything glows, nothing does.

### Typography
- **Display:** Archivo, weights 600–800, tight negative tracking. Industrial, engineered.
- **Body:** Plus Jakarta Sans. Chosen deliberately — it is Jakarta's own typeface, and this
  is an Indonesian product. Note this reasoning in `DECISIONS.md`.
- **Data / labels / credits:** Geist Mono. Numbers and system labels only.

Set a real type scale. Display sizes get tighter tracking as they grow.

### Motion
- Standard transition: 180ms, `cubic-bezier(0.22, 1, 0.36, 1)`
- Entrances: 240ms with 8px upward translate
- Ember glow bloom on generation start: 400ms ease-out
- Respect `prefers-reduced-motion` — disable translate and glow animation, keep opacity fades.

### Perceived speed
**Stream AI output token by token.** A four-second generation that streams feels instant;
the same generation behind a spinner feels broken. Skeletons for structure, streaming for text.
This single decision does more for the "premium" feel than any visual effect.

---

## 9. AI PROMPT LIBRARY

Write these into `PROMPTS.md`. **These prompts are in Indonesian on purpose** — the output
goes to Indonesian creators and must not read like a translation.

Every prompt must:
- receive the user's Creator DNA and the active trend cards as injected context
- return **strict JSON only**, no markdown fences, no preamble
- be parsed defensively with try/catch and a repair retry

### Shared context block (prepend to all module prompts)
```
Lo adalah otak kreatif di balik Malesan — asisten buat kreator konten Indonesia.

PROFIL KREATOR:
- Niche: {niche}
- Target audience: {target_audience}
- Tone: {tone}
- Platform utama: {platforms}
- Bahasa output: {output_language}
- Kata yang HARUS dihindari: {banned_words}
- Catatan brand: {brand_notes}

KONTEKS TREN HARI INI:
{trend_cards}

ATURAN:
- Bahasa Indonesia yang natural dan ngobrol, bukan bahasa terjemahan.
- Spesifik dan bisa langsung dieksekusi. Jangan kasih saran umum.
- Jangan pernah nyaranin konten clickbait bohong atau menyesatkan.
- Balas HANYA JSON valid. Tanpa ```json, tanpa penjelasan tambahan.
```

### `IDE_HARI_INI` — the zero-input entry point
This is the most important prompt in the product. It must work when the user types nothing.
```
Kreator ini buka aplikasi dan gak tau mau bikin apa hari ini. Tanggal: {today}.

Kasih 3 ide konten yang paling masuk akal buat dia HARI INI, berdasarkan profil
dan tren di atas. Tiap ide harus terasa personal — bukan ide generik yang bisa
dipakai siapa aja.

JSON:
{
  "ideas": [
    {
      "title": "judul singkat, maksimal 8 kata",
      "angle": "sudut pandang uniknya, 1 kalimat",
      "why_now": "kenapa ide ini pas banget dibikin hari ini",
      "format": "talking head | b-roll | skit | tutorial | reaction | storytime",
      "est_duration": "contoh: 30-45 detik",
      "difficulty": "gampang | sedang | effort"
    }
  ]
}
```

### `IDEA_ENGINE`
Input: a rough thought from the user. Output 5 developed ideas in the same card shape
as above, plus a `hook_seed` field per idea.

### `HOOK_LAB`
```
Bikin 10 hook buat konten ini: {idea_or_topic}
Platform: {platform}

Wajib pakai pola yang beda-beda: curiosity gap, contrarian, POV, angka,
kesalahan umum, before-after, pertanyaan langsung, pengakuan, peringatan, cerita.

JSON:
{
  "hooks": [
    {
      "text": "hook-nya, maksimal 15 kata, siap diucapkan",
      "pattern": "nama polanya",
      "score": 1-10,
      "why": "kenapa dikasih skor segitu, 1 kalimat jujur"
    }
  ]
}
```
Scores must be honest and varied. If every hook scores 9, the scoring is worthless.

### `SCRIPT_BUILDER`
```
Bikin naskah lengkap. Ide: {idea}. Hook: {hook}. Platform: {platform}.
Durasi target: {duration}.

Panjang dan ritme HARUS nyesuain platform:
- TikTok / Reels / Shorts: padat, hook di 1 detik pertama, potong tiap 2-3 detik
- YouTube long: boleh napas, ada intro-body-outro
- X / Threads: teks, bukan naskah lisan

JSON:
{
  "script": [
    {
      "timestamp": "0:00-0:03",
      "spoken": "yang diucapkan",
      "visual": "yang keliatan di layar / b-roll",
      "on_screen_text": "teks di layar, kosongin kalau gak ada"
    }
  ],
  "cta": {
    "text": "CTA-nya",
    "placement": "di mana ditaro dan kenapa"
  },
  "caption": "caption siap posting",
  "hashtags": ["maksimal 8, relevan, bukan spam"]
}
```

### `REPURPOSE`
Takes one existing generation and adapts it to other platforms in a single call.
Output keyed by platform: `tiktok`, `instagram`, `youtube`, `x`, `threads`.
Each must be genuinely rewritten for the platform's format, not the same text reposted.

### `TREND_DIGEST` — the daily cron prompt
Runs **once per day for the entire platform**, not per user. Input: raw items pulled from
Google Trends Indonesia RSS and Google News RSS. Output: 8–10 trend cards.
```
Ini data mentah tren Indonesia hari ini. Rangkum jadi 8-10 kartu tren yang
BERGUNA buat kreator konten. Buang yang gak bisa dijadiin konten.

JSON:
{
  "trends": [
    {
      "title": "singkat",
      "summary": "1-2 kalimat",
      "category": "hiburan | teknologi | gaya hidup | bisnis | olahraga | sosial",
      "content_angle": "gimana kreator bisa bikin konten dari ini"
    }
  ]
}
```

### Honest limitation to record in `DECISIONS.md`
Google Trends reveals what people **search**, not which TikTok sounds are rising.
Automated TikTok trend detection is not achievable on a free tier — the API is paid and
scraping gets blocked. The compensating mechanism is the `performance_rating` field on
`generations`: as users rate what actually performed, the platform accumulates a private
signal no competitor has. Surface this aggregate in the trend context once there is
enough volume.

---

## 10. FEATURE SCOPE — PHASE 1

### User-facing
1. **Ide Hari Ini** — works with zero input. This is the front door, not a side feature.
2. **Idea Engine** — rough thought in, 5 developed ideas out
3. **Hook Lab** — 10 scored hooks across distinct patterns
4. **Script Builder** — timestamped script, visuals, on-screen text, CTA, caption, hashtags
5. **Repurpose** — one piece adapted across platforms in a single call
6. **Pipeline** — kanban: ide → draft → siap → posted, with post-hoc performance rating
7. **Creator DNA** — onboarding form
8. **Trend feed** — read-only view of today's auto-generated cards
9. **BYOK** — user supplies their own Gemini key, stored encrypted, unlimited generations
10. **Referral** — share code, track status
11. **Top-up** — bank transfer with proof upload, plus voucher redemption

### Onboarding flow — deliberate conversion design
A new user gets **one free generation before being asked for anything**. Creator DNA is
requested only after they have seen the product work. Forcing a form before first value
kills signups; skipping it entirely makes output generic. This ordering solves both.

### Admin dashboard (`role = 'admin'` → redirected here automatically on login)
- User list: search, filter, view generation history, edit credits, ban/unban, delete
- Top-up approval queue: view proof, approve/reject, credits granted automatically on approve
- Voucher generator: create batches, view redemption status
- API key pool health: today's usage per key, quota remaining, current model in use
- Analytics: signups, DAU, generations by module, credits spent, conversion rate
- Trend override: pin, hide, or manually add trend cards (optional — the cron is the default)
- Admin actions all write to `audit_log`

Admin accounts bypass credit checks entirely.

---

## 11. BUILD ORDER

Complete one step. Self-test it. Update `HANDOFF.md`. Commit. **Stop and report.**
Then wait for the human to say "lanjut".

| Step | Deliverable | Definition of done |
|---|---|---|
| 0 | Spec files (Section 1) | All nine files exist and are accurate |
| 1 | Next.js scaffold, design tokens, landing page | Landing renders, tokens applied, responsive to 360px |
| 2 | Supabase Google OAuth, `profiles`, RLS | Sign in/out works, profile row auto-created, RLS verified |
| 3 | Credit system | `spend_credits` is race-safe under parallel calls, ledger correct, daily refill works |
| 4 | Gemini server layer | Key rotation, 429 backoff, quota guard, streaming, BYOK path |
| 5 | Ide Hari Ini + Idea Engine | Zero-input generation works end to end, credits deducted correctly |
| 6 | Creator DNA + onboarding gate | First generation free, form appears after, DNA injected into prompts |
| 7 | Hook Lab + Script Builder + Repurpose | All modules produce valid parsed JSON |
| 8 | Pipeline | Kanban with drag, performance rating captured |
| 9 | Trend cron | Daily job populates `trends`, one Gemini call, injected into prompts |
| 10 | Referral | Both-sides credit with fingerprint voiding verified |
| 11 | Top-up + vouchers | Bank transfer flow, proof upload, admin approval grants credits |
| 12 | Admin dashboard | All admin features working, audit log populated |
| 13 | Polish | Streaming everywhere, error states, empty states, reduced-motion, keyboard nav |

**Test step 3 explicitly for the race condition.** Fire concurrent generation requests from
one account with only one credit remaining. Exactly one must succeed. If two succeed,
the atomic function is wrong and everything downstream is unsafe.

---

## 12. HANDOFF PROTOCOL

This is the mechanism that lets the human switch between Claude Code and Antigravity mid-build
without losing anything. **Treat it as part of the definition of done for every step.**

`HANDOFF.md` is overwritten each session and uses exactly this structure:

```markdown
# HANDOFF

Last updated: <ISO 8601 timestamp>
Last agent: <Claude Code | Antigravity | other>
Last commit: <short hash> — <commit message>
Current step: <n> of 13

## WHAT I JUST DID
- <specific, file-level. "Added X to Y", not "worked on auth">

## WHAT WORKS — VERIFIED, NOT ASSUMED
- <only list what you actually ran and confirmed>

## WHAT IS BROKEN OR UNFINISHED
- <be honest. hiding this costs the next agent hours>

## NEXT ACTION — START HERE
1. <the literal first thing the next agent should do>
2. <then this>

## BLOCKERS — NEEDS THE HUMAN
- <missing credentials, decisions required, external accounts not set up>

## PROPOSALS — NOT IMPLEMENTED, AWAITING APPROVAL
- <ideas, improvements, competitive gaps. see Section 13>

## GOTCHAS FOR THE NEXT AGENT
- <anything surprising you learned. non-obvious constraints. things that
   look wrong but are intentional>
```

Rules:
- Write this **before** ending any turn in which a file changed.
- "WHAT WORKS" means you ran it and saw it work. Do not list things you believe should work.
- When a decision is made, append it to `DECISIONS.md` with the date and the reasoning.
  Never delete a `DECISIONS.md` entry, even when a decision is later reversed — record
  the reversal as a new entry. Future agents need to know what was already tried and rejected.
- When the human says only **"lanjut"**: read `AGENTS.md`, then `HANDOFF.md`, then `ROADMAP.md`,
  then continue from NEXT ACTION without asking questions that those files already answer.

---

## 13. CONTINUOUS IMPROVEMENT MANDATE

The human's stated goal is for Malesan to become the leading tool of its kind in Indonesia,
and eventually to compete globally. You are expected to actively contribute to that, not
just execute tickets.

**After completing each step**, add to the PROPOSALS section of `HANDOFF.md`:
- anything in the existing implementation you think is weak, and specifically why
- a feature or improvement that would meaningfully widen the gap against competitors
- any place the product feels generic — where a user could just use ChatGPT instead
- performance, cost, or quota risks you noticed while working

**Every fourth step**, do a full review pass: read the whole repo with fresh eyes and write
a short, candid assessment. What would make a creator choose this over the free alternatives?
What is the single weakest part of the product right now?

**The brake — this is as important as the mandate.**
You **propose**. You do **not** implement unapproved ideas. Every unrequested feature you
build is scope creep, and scope creep is the most common way ambitious projects die before
launch. Write it in PROPOSALS, keep building what is in `ROADMAP.md`, and let the human decide.

A proposal is worth more when it is specific and honest about cost. "Add gamification" is
noise. "Add a 3-day streak counter — roughly 40 lines, one column, likely lifts day-3
retention because the daily refill already trains a return habit" is useful.

---

## 14. START NOW

1. Create the nine spec files from Section 1.
2. `git commit -m "chore: initial spec and agent handoff files"`
3. Update `HANDOFF.md` with current step = 0 complete, next action = step 1.
4. Report what you created and stop.

Do not build application code in this first turn.
