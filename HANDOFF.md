# HANDOFF

Last updated: 2026-07-28T11:05:00Z
Last agent: Claude Code
Last commit: `<pending — filled in immediately after the step 2 commit>`
Current step: 2 of 13 — **database and code complete, sign-in unproven** (see BLOCKERS)

## WHAT I JUST DID

**Database** — five migrations on project `hjdctzrvnhvarxoxixrn`:
1. `create_profiles_table` — `profiles` exactly per `SCHEMA.md`, plus three indexes
   (`created_at desc`, partial on `referred_by`, partial on `fingerprint_hash`).
2. `auth_helpers_and_signup_trigger` — `is_admin()`, `gen_referral_code()`,
   `handle_new_user()` and the `on_auth_user_created` trigger on `auth.users`.
3. `profiles_rls_and_column_guard` — RLS enabled, three policies, column guard trigger.
4. `fix_column_guard_must_be_security_invoker` — **security fix**, see GOTCHAS.
5. `harden_function_execute_grants` — revoked `EXECUTE` from `anon`/`authenticated`/`PUBLIC`
   on the trigger bodies and the internal helper.

**App** — `@supabase/supabase-js` and `@supabase/ssr` added.
- `src/lib/supabase/client.ts`, `server.ts` (incl. a guarded `createServiceRoleClient`),
  `database.types.ts` generated from the live schema.
- `src/proxy.ts` — session refresh on every request.
- `src/app/auth/callback/route.ts` — code-for-session exchange, open-redirect guarded.
- `src/app/auth/signout/route.ts` — POST only.
- `src/app/masuk/page.tsx` + `src/components/GoogleSignInButton.tsx`.
- `src/app/app/page.tsx` — minimal signed-in view proving profile + RLS.
- Landing CTA and a new header link now point at `/masuk`.
- `.env.local` written with the Supabase URL, anon key and service role key. Confirmed
  gitignored via `git check-ignore`.

## WHAT WORKS — VERIFIED, NOT ASSUMED

**RLS, verified by attacking it rather than by reading the policy.** Two throwaway users were
created, every attack below was actually executed as the `authenticated` role with a forged
JWT claim, and the rows were then inspected as superuser. All test users were deleted after.

| Attempt | Result |
|---|---|
| Read another user's row | 0 rows |
| Read as signed-out `anon` | 0 rows |
| `credits_free = 999999` on own row | reverted to 5 |
| `credits_paid = 999999` on own row | reverted to 0 |
| `role = 'admin'` on own row | reverted to `user` |
| Rewrite own `email`, `referral_code`, `is_pro` | all reverted |
| `update` another user's `display_name` | no effect |
| `insert` a forged profile holding 100000 credits | blocked — no INSERT policy exists |
| `display_name` + `onboarding_completed` on own row | **succeeded**, as intended |
| Admin reads all rows, bans another user | succeeded |
| Admin grants themselves credits directly | **reverted** — must go through `grant_credits` |

- **Signup trigger** — inserting into `auth.users` creates the profile in the same
  transaction, with `credits_free = 5`, `role = 'user'`, and a generated referral code
  (observed: `XFHDX9JV`, `KER5C2BK`, `VCRGRT5K`). Google's `full_name`/`name` and
  `avatar_url`/`picture` metadata variants were both exercised and both mapped correctly.
- **Hardening did not break anything** — signup, the legitimate update, the column guard and
  `is_admin()` were all re-tested *after* the `EXECUTE` revocations. All still correct.
- **Security advisors**: down from 6 warnings to 3. Two belong to `rls_auto_enable()`, a
  Supabase platform event-trigger function that is not ours (an `event_trigger` function
  cannot be reached over RPC — false positive). The third is `is_admin()` being executable by
  `authenticated`, which is **required**: policy expressions run as the querying role, so
  revoking it would break every policy.
- **Auth gate** — `/app` while signed out redirects to `/masuk?next=%2Fapp`, verified in the
  browser. `/masuk` renders, `noindex` is set, no horizontal overflow, the Google button is
  the right ember.
- `npm run lint`, `npm run typecheck` and `npm run build` all clean. Routes: `/` static,
  `/app` `/masuk` `/auth/callback` `/auth/signout` dynamic, proxy active. Console clean.

## WHAT IS BROKEN OR UNFINISHED

- **Sign-in has never completed once.** Google is not enabled as a provider on the Supabase
  project. Hitting the authorize endpoint returns, verbatim:
  `{"code":400,"error_code":"validation_failed","msg":"Unsupported provider: provider is not enabled"}`
  Everything downstream of that — the callback exchange, the profile appearing for a real
  human, sign-out — is therefore **written but unproven**. Step 2 is not done until someone
  signs in.
- The `/app` page is a placeholder that prints four stats. It exists to prove the loop, not to
  be a product surface.
- No ban enforcement anywhere. `is_banned` is stored and admin-settable, but nothing checks it
  on sign-in or on generation. No roadmap step owns this.
- No disposable-email blocking at signup (`PRD.md` §7). No roadmap step owns this either.
- Still true from step 1: **nobody has visually looked at any page.** The browser pane will
  not composite frames here, so every visual claim rests on computed styles. The focus ring
  and the 180ms transitions remain structurally verified but visually unconfirmed.
- `npm install` still blocks the `sharp` and `unrs-resolver` postinstall scripts.

## NEXT ACTION — START HERE

1. Read `AGENTS.md`, then this file, then `ROADMAP.md`.
2. **Finish step 2** — it needs a human first (see BLOCKERS). Once Google is enabled:
   - sign in for real, confirm the profile row appears with 5 credits and a referral code,
     confirm `/app` renders it, confirm sign-out returns to `/`;
   - only then mark step 2 ✅.
3. Then **step 3 — the credit system**, the highest-risk step in the build:
   - `credit_ledger` plus `spend_credits`, `claim_daily_refill`, `grant_credits`, all per
     `SCHEMA.md` §3;
   - `spend_credits` must take `SELECT ... FOR UPDATE` on the profile row **first** — that
     lock is the entire point of the function;
   - **the mandatory race test**: fire concurrent requests from one account holding exactly
     one credit. Exactly one must succeed. If two succeed, everything downstream is unsafe
     and step 4 must not begin.
   - The column guard already assumes these functions exist and run as `postgres`. That path
     is currently untested because no `SECURITY DEFINER` credit function exists yet — step 3
     is where it gets proven.

## BLOCKERS — NEEDS THE HUMAN

- 🔴 **Enable Google as an auth provider in Supabase.** The only thing between here and a
  finished step 2. Cannot be done through the MCP tools — it needs the dashboard.
  1. Google Cloud Console → create an OAuth 2.0 Client ID (Web application).
  2. Authorised redirect URI: `https://hjdctzrvnhvarxoxixrn.supabase.co/auth/v1/callback`
  3. Supabase Dashboard → Authentication → Providers → Google → paste client ID + secret,
     enable.
  4. Supabase → Authentication → URL Configuration → add `http://localhost:3000/**` to
     Redirect URLs for local development.
- **Domain not confirmed.** `malesan.app` is unverified. Nothing hardcodes it; `metadataBase`
  is deliberately absent from `layout.tsx`.
- **Two Google Cloud projects with Gemini keys** — step 4. Must be two *separate* projects.
- **Current Gemini model IDs** — confirm live at step 4, Google renames them often.
- **Credit pack IDR pricing** — step 11.
- **Vercel Hobby is not licensed for commercial use.** Resolve before a monetized launch.
- Credential rotation was raised and the human declined it as a deliberate working method.
  Recorded in `DECISIONS.md`. Do not raise it again.

## PROPOSALS — NOT IMPLEMENTED, AWAITING APPROVAL

- **Ban enforcement has no owner.** `is_banned` exists and admins can set it, but no code path
  reads it — a banned user signs in and generates normally. Cheapest fix: check it in the
  `/app` layout and in every generation route at step 5, roughly 20 lines. As it stands, the
  ban button planned for step 12 would do nothing.
- **Migrate to the `sb_publishable_…` key** and rename the env var. Independently rotatable;
  rotating the legacy anon JWT means rotating the project JWT secret and invalidating every
  live session. Cheap now, disruptive later.
- **i18n still has no home in the roadmap.** `PRD.md` promises an ID/EN toggle; no step owns
  it, and every string written since step 1 is hardcoded Indonesian. Adopt a message catalogue
  at step 5, or accept that the toggle will not ship.
- **A `credit_packs` table** (~6 columns + one admin screen) — `PRD.md` forbids hardcoding
  pack prices but nothing holds them.
- **A `generation_failures` log, or a `status` column on `generations`** — `PROMPTS.md` says a
  failed JSON parse must not charge the user, but nothing records the attempt, so the admin
  "API key pool health" screen cannot show a real failure rate.
- **Decide the Gemini JSON-mode strategy at step 4, not step 7** — structured output would
  make most of the defensive parsing in `PROMPTS.md` unnecessary. Deciding late means writing
  the parsing layer twice.
- **The weakest point in the product, unchanged and now more concrete:** `IDE_HARI_INI` is the
  front door and the whole differentiator, yet a new user reaches it with empty Creator DNA
  and, on launch day, an empty `trends` table. In that state the prompt has no personalisation
  context at all and returns what ChatGPT returns for free — while the landing page has
  already promised "kenal gaya lo" and "tau hari ini". Seed `trends` before launch and add a
  three-second "lo bikin konten apa?" at first run. Decide before step 5.
- **Quota-guard observability** — the 20%-remaining rule exists but nothing measures pool
  usage. Gemini does not expose remaining quota; it must be counted locally, from step 4.

## GOTCHAS FOR THE NEXT AGENT

- **`protect_profile_columns()` must stay `SECURITY INVOKER`.** As `SECURITY DEFINER`,
  `current_user` is the function owner, the guard never fires, and any user can set
  `role = 'admin'` on themselves and then read and rewrite every other user's row. This was a
  real bug in this repo, caught only by attacking RLS instead of reading it. Full write-up in
  `SCHEMA.md` §6 and `DECISIONS.md`.
- **Do not use `auth.role()` in that guard.** It reads the JWT claim, which still says
  `authenticated` inside a `SECURITY DEFINER` function — it would silently undo the deduction
  `spend_credits` just made.
- **Never enable `FORCE ROW LEVEL SECURITY` on `profiles`.** `is_admin()` reads `profiles`
  from inside a policy on `profiles`; it only avoids infinite recursion because the
  `SECURITY DEFINER` owner bypasses RLS.
- **`is_admin()` must keep `EXECUTE` for `authenticated`.** The database linter flags this;
  it is a false positive. Policy expressions are evaluated as the querying role, so revoking
  it breaks every policy that references it.
- **`rls_auto_enable()` in the `public` schema is not ours** — it is a Supabase platform
  event trigger that auto-enables RLS on new tables. Leave it alone; its two linter warnings
  are false positives.
- **Next.js 16 renamed `middleware.ts` to `proxy.ts`.** The old name still builds and even
  appears in build output, but in dev it throws "Cannot find the middleware module" and every
  matched route 404s. `src/proxy.ts` exports a default `proxy` function. Do not rename it back.
- **Regenerate `src/lib/supabase/database.types.ts` after every migration.** A stale copy is
  worse than none — it type-checks against a database that no longer exists.
- **Tailwind v4 has no `--duration-*` theme namespace.** A duration in `@theme` is dropped
  silently and its utility never exists, with a green build. Durations live on `:root` in
  `@layer base` and are used as `duration-[var(--duration-standard)]`. Grep the compiled CSS
  before believing any new token works.
- **Do not put Framer Motion entrances on server-rendered pages** — it caused a hydration
  mismatch and shipped `opacity: 0` in the SSR HTML, so a failed bundle meant a blank page.
  Entrances are the CSS `.reveal` class. Framer Motion is kept for steps 5 and 8.
- **The reduced-motion block deliberately exempts `.reveal`** so the opacity fade survives
  while the translate is dropped, per `DESIGN.md` §4.
- **`--color-border` is named `--color-hairline` in CSS** to avoid colliding with Tailwind's
  `border-*` utilities. Use `border-hairline`.
- **This project has its own git repo** at `Documents/malesan`, remote
  `github.com/vallendrino-vldr/Malesan`. It sits inside a second, unrelated repo rooted at the
  user's home folder whose remote is `github.com/vallendrino-vldr/duitkita` and which has no
  `.gitignore`. **Never run `git add -A` from a parent directory**; confirm
  `git rev-parse --show-toplevel` first.
- **There is a second Supabase project in the same org, `duitkitav2`** — a different product.
  Always pass `project_id = hjdctzrvnhvarxoxixrn`.
- `gh` (GitHub CLI) is **not installed**. Auth is a token in `.git/config`, untracked.
- **Two different language settings.** UI language and `creator_dna.output_language` are
  separate. Wiring them together is an easy and wrong shortcut.
- **`claim_daily_refill` sets `credits_free = 10`, it does not add 10.** Signup grants 5, the
  daily refill is 10 — different on purpose, not a typo.
- **Gemini quota resets ~14:00 WIB**, not local midnight, and is per Google Cloud *project*,
  not per key.
- **The quality floor is not step 13.** 360px, focus states, reduced motion and keyboard
  reachability ship with every component.
- **`DECISIONS.md` is append-only.** Reversals are new entries, never edits.
