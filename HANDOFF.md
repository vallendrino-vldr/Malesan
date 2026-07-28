# HANDOFF

Last updated: 2026-07-28T14:20:00Z
Last agent: Claude Code
Last commit: `<pending — filled in immediately after the step 3 commit>`
Current step: 3 of 13 — **complete**. Step 2 also closed in this session.

## WHAT I JUST DID

**Step 2 closed.** The human enabled Google as a Supabase auth provider and signed in for
real. A profile row was created automatically: `vadlyvldr@gmail.com`, display name `VLDR`,
avatar present, referral code `PM2VVTFF`, 5 free credits, `role = user`. The trigger, the
OAuth callback and the metadata mapping all work against a real Google account, not a
synthetic one.

**Step 3 — the credit system.** Three migrations:
1. `credit_ledger_table` — table, index on `(user_id, created_at desc)`, RLS with a
   select-only policy and **no** insert/update/delete policy at all.
2. `credit_functions` — `spend_credits`, `claim_daily_refill`, `grant_credits`, with
   `EXECUTE` granted to `service_role` only.
3. `fix_credit_fn_caller_checks_use_auth_role` — **security fix**, see GOTCHAS.

Also: `scripts/race-test.mjs` committed so the race test is repeatable, and
`src/lib/supabase/database.types.ts` extended with `credit_ledger` and the three functions.

## WHAT WORKS — VERIFIED, NOT ASSUMED

**The race test — the point of the whole step.** `scripts/race-test.mjs` fires genuinely
parallel HTTP requests through PostgREST. A sequential test would pass even with the lock
removed, which is exactly why it is concurrent.

| Scenario | Expected | Observed |
|---|---|---|
| free=1, paid=0, spend 1, **12 parallel** | 1 wins | **1 won**, 11 `INSUFFICIENT_CREDITS`, 0 anomalies |
| free=1, paid=4, spend 2, **20 parallel** | 2 win | **2 won**, 18 rejected, 0 anomalies |

The cross-bucket case also proved the split: the winner took 1 free + 1 paid and wrote **two**
ledger rows; the second took 2 from paid and wrote one. Final `free=0, paid=1`,
`sum(delta) = -4`, last `balance_after` matched the real balance. Returned balances were
`3` then `1` — cleanly serialised from 5.

**Everything else, each actually executed:**

| Behaviour | Result |
|---|---|
| `claim_daily_refill` from `credits_free = 37` | set to **10**, not 47 |
| `claim_daily_refill` twice in one day | second is a no-op, one ledger row only |
| Refill that reduces a balance | `delta = -27` recorded rather than hidden |
| `grant_credits(350, 'paid')` | 11 → 361, one ledger row |
| Admin spends 999 holding 3 | succeeds, balance unchanged, **no ledger row** |
| `authenticated` calls `grant_credits` | denied |
| `authenticated` calls `spend_credits` / `claim_daily_refill` | denied |
| `authenticated` inserts into `credit_ledger` directly | denied |

After all four attacks the balance was untouched and `credit_ledger` held zero forged rows.

- `npm run lint`, `npm run typecheck`, `npm run build` all clean.
- All synthetic test users deleted. The database now holds exactly one profile: the human's.

## WHAT IS BROKEN OR UNFINISHED

- **`/app` has never been seen rendering real data.** The human signed in from their own
  browser; the automation browser has no session, so it only ever sees the redirect to
  `/masuk`. The page compiles and the query is RLS-correct, but nobody has confirmed the four
  stat tiles actually display. **Sign-out is likewise untested.**
- Still true since step 1: **no page has been looked at visually.** The browser pane will not
  composite frames in this environment, so every visual claim rests on computed styles and
  compiled CSS. The focus ring and the 180ms transitions remain structurally verified but
  visually unconfirmed.
- **`claim_daily_refill` is not wired to anything.** `SCHEMA.md` says it is "called on session
  load"; nothing calls it yet. A user's free credits will never refill until step 5 hooks it
  into the app.
- **The migrations are still not in this repo** — they live only in
  `supabase_migrations.schema_migrations` on the hosted project. `supabase db pull`
  reconstructs them. This contradicts `AGENTS.md` §0 and should be fixed at the start of
  step 4.
- No ban enforcement. No disposable-email blocking. No rate limiting (`rate_limits` table
  does not exist yet). None of these has a roadmap step.
- New advisor warning: "Leaked Password Protection Disabled". **Not applicable** — this
  project has no password auth at all, only Google OAuth. Safe to ignore permanently.

## NEXT ACTION — START HERE

1. Read `AGENTS.md`, then this file, then `ROADMAP.md`.
2. Quick wins before starting step 4: run `supabase db pull` into `supabase/migrations/` and
   commit it, and ask the human to confirm `/app` renders and sign-out works.
3. **Step 4 — the Gemini server layer.** Needs the human first (see BLOCKERS). It covers:
   - two keys from two *separate* Google Cloud projects, with rotation;
   - HTTP 429 handling with exponential backoff (1s, 2s, 4s, 8s);
   - the quota guard: below 20% pool remaining, serve paid and BYOK users only. **Nothing
     currently measures pool usage** — Gemini does not expose remaining quota, so a local
     counter has to be built here or the guard is guesswork;
   - streaming, established now rather than retrofitted;
   - the BYOK path, decrypting `user_api_keys.key_encrypted` with `ENCRYPTION_KEY`.
   - **Decide the JSON-mode strategy here, not at step 7.** If Gemini structured output is
     used, most of the defensive parsing in `PROMPTS.md` becomes unnecessary. Deciding late
     means writing the parsing layer twice.
4. Step 4 is also a **review-pass step** (every fourth). Read the whole repo with fresh eyes
   and write a candid assessment: what would make a creator choose this over the free
   alternatives, and what is the single weakest part right now.

## BLOCKERS — NEEDS THE HUMAN

- 🔴 **Two Gemini API keys, from two separate Google Cloud projects.** Quota is enforced per
  *project*, not per key — two keys in one project buy nothing. **No credit card is needed:**
  `aistudio.google.com` issues free-tier keys with just a Google account. Put them in
  `.env.local` as `GEMINI_API_KEY_1` and `GEMINI_API_KEY_2`.
- 🔴 **Current Gemini model IDs** for `GEMINI_MODEL_FREE` (Flash-Lite tier) and
  `GEMINI_MODEL_PRO` (Flash tier). Confirm the live IDs at step 4 rather than trusting
  anything written earlier — Google renames these often.
- **`ENCRYPTION_KEY`** for BYOK key storage. If it is ever lost or changed, every stored BYOK
  key becomes undecryptable.
- **`CRON_SECRET`** before step 9.
- **Domain not confirmed.** `malesan.app` is unverified. Nothing hardcodes it; `metadataBase`
  is deliberately absent from `layout.tsx`.
- **Credit pack IDR pricing** — step 11.
- **Vercel Hobby is not licensed for commercial use.** Resolve before a monetized launch.
- **Before launch, publish the Google consent screen.** It is in "Testing" mode, so only
  listed test users can sign in. The scopes (`email`, `profile`, `openid`) are non-sensitive,
  so no Google verification review is required.
- Credential rotation was raised and the human declined it as a deliberate working method.
  Recorded in `DECISIONS.md`. Do not raise it again.

## PROPOSALS — NOT IMPLEMENTED, AWAITING APPROVAL

- **Wire `claim_daily_refill` into the session path.** It exists, is tested, and is called by
  nothing. Until it runs, free credits never come back and the entire free tier is broken.
  This is arguably a bug rather than a proposal, but no step owns it — fold it into step 5.
- **Ban enforcement has no owner.** `is_banned` exists and admins can set it, but nothing
  reads it: a banned user signs in and generates normally. ~20 lines in the `/app` layout and
  each generation route. Without it, the step 12 ban button does nothing.
- **`rate_limits` is specified but not built.** `PRD.md` §7 requires max 10 generations per
  minute per user, enforced server-side. Step 4 or 5 is the natural home; right now nothing
  stops a script from draining the whole Gemini pool through one account.
- **A `credit_packs` table** (~6 columns + one admin screen) — `PRD.md` forbids hardcoding
  pack prices but nothing holds them.
- **A `generation_failures` log, or a `status` column on `generations`** — `PROMPTS.md` says a
  failed JSON parse must not charge the user, but nothing records the attempt, so the admin
  "API key pool health" screen cannot show a real failure rate.
- **i18n still has no home in the roadmap.** Every string written so far is hardcoded
  Indonesian. Adopt a message catalogue at step 5 or accept that the promised ID/EN toggle
  will not ship.
- **Migrate to the `sb_publishable_…` key** and rename the env var. Rotating the legacy anon
  JWT means rotating the project JWT secret and invalidating every live session.
- **The weakest point in the product, unchanged:** `IDE_HARI_INI` is the front door and the
  whole differentiator, yet a new user reaches it with empty Creator DNA and, on launch day,
  an empty `trends` table. In that state it returns what ChatGPT returns for free — while the
  landing page has already promised "kenal gaya lo" and "tau hari ini". Seed `trends` before
  launch and add a three-second "lo bikin konten apa?" at first run. **Decide before step 5.**

## GOTCHAS FOR THE NEXT AGENT

- **`current_user` vs `auth.role()` — two inverse traps, both of which were live bugs here.**

  | Function kind | `current_user` is | Identify the caller with |
  |---|---|---|
  | `SECURITY INVOKER` | the caller | `current_user` |
  | `SECURITY DEFINER` | the owner (`postgres`) | `auth.role()` |

  `protect_profile_columns()` is INVOKER and checks `current_user`; written as DEFINER the
  guard never fired and any user could make themselves admin. The credit functions are
  DEFINER and check `auth.role()`; written with `current_user` those checks were dead code.
  Full write-up in `SCHEMA.md` §6–§7.
- **Re-run `node scripts/race-test.mjs` after any change to `spend_credits`.** A sequential
  test passes even with the `FOR UPDATE` removed. The script prints the SQL needed to create
  its throwaway user; it does not create it itself.
- **`credit_ledger` has no INSERT/UPDATE/DELETE policy, deliberately.** Only `SECURITY
  DEFINER` functions write to it, and they bypass RLS. That absence is what makes
  "append-only" true rather than merely intended.
- **`balance_after` is the TOTAL balance, not the bucket balance.** A cross-bucket spend
  writes two rows; the first shows a mid-operation total. Read the later row.
- **Admin spends write no ledger row** — nothing moved, so there is nothing to record. Admin
  activity auditing belongs in `audit_log` at step 12.
- **Never enable `FORCE ROW LEVEL SECURITY` on `profiles`.** `is_admin()` reads `profiles`
  from inside a policy on `profiles`; it avoids infinite recursion only because a
  `SECURITY DEFINER` owner bypasses RLS.
- **`is_admin()` must keep `EXECUTE` for `authenticated`.** The linter flags it; that is a
  false positive. Policy expressions run as the querying role.
- **`rls_auto_enable()` is a Supabase platform function, not ours.** Its two linter warnings
  are false positives — an `event_trigger` function cannot be called over RPC.
- **Next.js 16 renamed `middleware.ts` to `proxy.ts`.** The old name still builds but in dev
  throws "Cannot find the middleware module" and every matched route 404s.
- **Regenerate `src/lib/supabase/database.types.ts` after every migration.**
- **Tailwind v4 has no `--duration-*` theme namespace.** A duration in `@theme` is dropped
  silently with a green build. Durations live on `:root`; usage is
  `duration-[var(--duration-standard)]`.
- **Do not put Framer Motion entrances on server-rendered pages** — hydration mismatch, and
  `opacity: 0` in the SSR HTML means a blank page if the bundle fails. Use the CSS `.reveal`
  class. Framer Motion is reserved for steps 5 and 8.
- **`--color-border` is named `--color-hairline` in CSS.** Use `border-hairline`.
- **This project has its own git repo** at `Documents/malesan`, remote
  `github.com/vallendrino-vldr/Malesan`, nested inside an unrelated repo rooted at the user's
  home folder (remote `duitkita`, no `.gitignore`). **Never `git add -A` from a parent
  directory**; check `git rev-parse --show-toplevel` first.
- **A second Supabase project, `duitkitav2`, exists in the same org.** Always pass
  `project_id = hjdctzrvnhvarxoxixrn`.
- `gh` (GitHub CLI) is **not installed**. Auth is a token in `.git/config`, untracked.
- **Two different language settings.** UI language and `creator_dna.output_language` are
  separate.
- **Gemini quota resets ~14:00 WIB**, not local midnight, and is per Google Cloud *project*.
- **The quality floor is not step 13.** 360px, focus states, reduced motion, keyboard
  reachability ship with every component.
- **`DECISIONS.md` is append-only.** Reversals are new entries, never edits.
