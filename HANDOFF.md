# HANDOFF

Last updated: 2026-07-28T16:10:00Z
Last agent: Claude Code
Last commit: `<pending — filled in immediately after the step 4 commit>`
Current step: 4 of 13 — **complete**

## WHAT I JUST DID

**Migration** `gemini_usage_and_byok_keys`:
- `gemini_usage` (per day / key / model) with `record_gemini_usage()` (upsert, race-safe) and
  `gemini_pool_used_today()`. Both `service_role` only, RLS admin-read. **This table is an
  addition to the master spec, approved by the human** — see `SCHEMA.md` §9.
- `user_api_keys` for BYOK, verbatim from `SCHEMA.md`, with no INSERT/UPDATE policy.

**`src/lib/gemini/`** — all four files marked `server-only`, so importing any of them from a
client component is a build error rather than a code-review question:
- `keys.ts` — pool, per-call rotation offset, 60s cooldown on a 429'd key.
- `client.ts` — `generate`, `generateStream`, `parseJson`, `modelFor`. Rotation before
  backoff; 1s/2s/4s/8s between rounds; 4xx fails fast because retrying cannot fix it.
- `quota.ts` — `getPoolStatus`, `checkPoolAdmission`, `recordUsage`. Fails **open**.
- `crypto.ts` — AES-256-GCM for BYOK keys, `iv.tag.ciphertext` base64url.

**`.env.local`** — both Gemini keys, chosen model IDs, plus generated `ENCRYPTION_KEY`,
`CRON_SECRET` and `GEMINI_DAILY_CAP_PER_KEY=1000`. Still gitignored.

## WHAT WORKS — VERIFIED, NOT ASSUMED

Every model was **called**, not read off `ListModels`:

| Model | Result |
|---|---|
| `gemini-3.1-flash-lite` | 200 in **1.1s** → `GEMINI_MODEL_FREE` |
| `gemini-3.5-flash-lite` | 200 in **29.1s** — newer, 26× slower |
| `gemini-2.5-flash-lite` | **404** despite being listed |
| `gemini-3.6-flash` | 200 in **3.3s** → `GEMINI_MODEL_PRO` |
| `gemini-3.5-flash` | **503** |
| `gemini-2.5-flash` | **404** despite being listed |

Then the wrapper itself, through a temporary route since deleted:

| Check | Result |
|---|---|
| Structured JSON output (`responseSchema`) | valid schema-conforming JSON, natural Indonesian, 1.6–2.1s |
| Streaming | 2 chunks, **first chunk 729ms**, 34 chars |
| `parseJson` repair on a fenced ```` ```json ```` blob | parsed |
| BYOK encrypt → decrypt round trip | true; ciphertext does not contain the plaintext |
| Usage recorded | `gemini_usage` incremented on every call |
| **Key rotation actually happened** | usage landed on **both** keys: key 1 → 7 requests/326 tokens, key 2 → 1 request/38 tokens |
| Quota guard at 14.7% remaining | `guardEngaged: true` |
| ↳ free user | **denied**, with the Indonesian top-up message |
| ↳ pro user | allowed |
| ↳ BYOK user | allowed |

- `npm run lint`, `typecheck`, `build` all clean. Smoke route deleted; synthetic guard row
  deleted. Database holds one real profile and genuine usage counts only.

**One real bug caught by that testing:** `generateStream` returned **zero chunks** for a
response `curl` could see perfectly well. The read loop split SSE frames on `\n\n` and left
the tail in a buffer that was never drained after the stream ended — and a short reply
usually arrives as a single chunk with no trailing blank line, so the common case was the
broken one. Fixed by draining on close and normalising CRLF.

## WHAT IS BROKEN OR UNFINISHED

- **Nobody knows whether the two Gemini keys are from two different Google Cloud projects.**
  The whole two-key design rests on this and the keys do not reveal it. If they share a
  project they share a quota and `GEMINI_DAILY_CAP_PER_KEY` is double-counting capacity.
  The human was asked to check in AI Studio; unanswered.
- **`GEMINI_DAILY_CAP_PER_KEY=1000` is a guess.** Gemini never reports remaining quota. Retune
  it the first time real 429s appear in `gemini_usage.error_count`.
- **The 429 backoff path has never actually fired.** No real rate limit was hit, so rotation
  under 429 and the 1s/2s/4s/8s ladder are verified by construction, not by execution.
  Rotation *between* calls was observed; rotation *because of* a 429 was not.
- `claim_daily_refill` is still wired to nothing. Free credits never come back. This is a bug,
  not a proposal — fold it into step 5.
- `/app` has still never been seen rendering real data, and sign-out is still untested.
- **No page has been looked at visually, at any point in this build.** The browser pane will
  not composite frames here.
- Migrations still live only on the hosted project, not in this repo.
- No rate limiting, no ban enforcement, no disposable-email blocking.

## THE REVIEW PASS (every fourth step — this is it)

**What would make a creator choose this over ChatGPT?** Right now: almost nothing, and that is
the honest answer. The infrastructure is genuinely good — atomic credits, real RLS, key
rotation, streaming at 0.7s — but a user cannot yet do a single thing. The three things that
are supposed to differentiate it (Creator DNA, daily trends, performance ratings) are all
still unbuilt, while the landing page already promises them.

**The single weakest part of the product right now:** `IDE_HARI_INI` is the front door, and on
day one it will have empty Creator DNA and an empty `trends` table. In that state its prompt
degrades to a generic "give me content ideas" — which is exactly what ChatGPT does for free,
except ChatGPT does not charge a credit. The differentiator is not the model, the UI, or the
credits; it is the context injected into the prompt. **Everything that matters is downstream
of `trends` having rows and Creator DNA having answers.** Step 9 (the trend cron) is currently
scheduled *four steps after* the module that depends on it. That ordering should be
reconsidered before step 5 rather than after.

**Second concern: the economics are unproven.** At 1 credit per Ide Hari Ini and 10 free
credits a day, one free user can consume 10 Gemini calls daily. With an assumed 1000/day/key
cap, roughly 200 daily active free users exhaust the pool before anyone pays. The quota guard
handles the symptom; nothing yet tests whether the free tier is affordable at all. Worth
modelling before launch, not after.

## NEXT ACTION — START HERE

1. Read `AGENTS.md`, then this file, then `ROADMAP.md`.
2. **Step 5 — Ide Hari Ini + Idea Engine.** The first real product surface.
   - `generations` and `creator_dna` tables (both already specified in `SCHEMA.md` §2).
   - Server route: verify session → `checkPoolAdmission` → `spend_credits` **server-side with
     the service-role client** → `generateStream` → persist to `generations`.
   - **Wire `claim_daily_refill` into session load.** Until this happens the free tier is
     broken.
   - Stream the output token by token. Everything is in place for it.
   - If a generation fails to parse, **do not charge the credit** (`PROMPTS.md` §1). Nothing
     currently records a failed attempt — see PROPOSALS.
3. Settle the trend-ordering question in the review pass above before building the prompt.

## BLOCKERS — NEEDS THE HUMAN

- **Confirm the two Gemini keys are in two separate Google Cloud projects** (AI Studio → API
  Keys shows the project per key). If not, create a second project and reissue one key.
- **Confirm `/app` renders and sign-out works** — one look in the browser you signed in with.
- **Domain not confirmed.** `malesan.app` is unverified; `metadataBase` is deliberately absent.
- **Credit pack IDR pricing** — step 11.
- **Vercel Hobby is not licensed for commercial use.** Resolve before a monetized launch.
- **Publish the Google consent screen before launch.** It is in "Testing" mode, so only listed
  test users can sign in. Scopes are non-sensitive, so no verification review is needed.
- Credential rotation was raised and declined as a deliberate working method. Recorded in
  `DECISIONS.md`. Do not raise it again.

## PROPOSALS — NOT IMPLEMENTED, AWAITING APPROVAL

- **Move the trend cron (step 9) before step 5**, or seed `trends` manually. See the review
  pass — the front door is generic without it, and generic is the one thing this product
  cannot afford to be.
- **`rate_limits` is specified but not built.** `PRD.md` §7 requires 10 generations/minute/user
  server-side. Right now one script can drain the entire Gemini pool through one account.
  Natural home is step 5, alongside the first real generation route.
- **A `generation_failures` log, or a `status` column on `generations`.** A failed parse must
  not charge the user, but nothing records that an attempt happened — so the admin pool-health
  screen cannot show a real failure rate and prompt regressions stay invisible.
- **Ban enforcement has no owner.** `is_banned` exists; nothing reads it. ~20 lines.
- **A `credit_packs` table** — `PRD.md` forbids hardcoding pack prices but nothing holds them.
- **i18n has no home.** Every string so far is hardcoded Indonesian.
- **Migrate to the `sb_publishable_…` key** and rename the env var.

## GOTCHAS FOR THE NEXT AGENT

- **`ListModels` is not an availability check.** `gemini-2.5-flash` and `gemini-2.5-flash-lite`
  were both listed and both returned 404. **Call a model before trusting it.**
- **Newer is not faster.** `gemini-3.5-flash-lite` took 29s where `3.1-flash-lite` took 1.1s.
  Model IDs are pinned, not `-latest`, so a silent upgrade cannot multiply latency.
- **SSE parsing must drain its buffer when the stream closes.** A short reply arrives as one
  chunk with no trailing blank line; splitting on `\n\n` alone silently yields nothing.
- **`current_user` vs `auth.role()` — two inverse traps, both live bugs in this repo.**

  | Function kind | `current_user` is | Identify the caller with |
  |---|---|---|
  | `SECURITY INVOKER` | the caller | `current_user` |
  | `SECURITY DEFINER` | the owner | `auth.role()` |

  Written the wrong way round, `protect_profile_columns` let any user make themselves admin.
  Full write-up in `SCHEMA.md` §6–§7.
- **Re-run `node scripts/race-test.mjs` after any change to `spend_credits`.** A sequential
  test passes even with the `FOR UPDATE` removed.
- **The quota guard fails open on purpose.** A broken `gemini_usage` must not take the product
  offline for free users. `recordUsage` swallows errors for the same reason.
- **BYOK is `key_index = 0`** so it never pollutes pool accounting, is never rotated onto our
  keys, and never triggers a cooldown.
- **`gemini_usage.usage_date` is a UTC date, not the quota day.** Gemini resets ~14:00 WIB.
- **A folder named `_foo` in `src/app` is a private folder** and is not routable. A route
  placed in one silently 404s.
- **Next.js 16 renamed `middleware.ts` to `proxy.ts`.** The old name builds but 404s every
  matched route in dev.
- **Never enable `FORCE ROW LEVEL SECURITY` on `profiles`** — `is_admin()` would recurse.
- **`is_admin()` must keep `EXECUTE` for `authenticated`** — the linter flags it; false
  positive. `rls_auto_enable()` is a Supabase platform function, also a false positive.
- **Regenerate `src/lib/supabase/database.types.ts` after every migration.**
- **Tailwind v4 has no `--duration-*` theme namespace** — a duration in `@theme` vanishes with
  a green build. Use `duration-[var(--duration-standard)]`.
- **No Framer Motion entrances on server-rendered pages** — hydration mismatch and `opacity:0`
  in SSR HTML. Use the CSS `.reveal` class.
- **`--color-border` is `--color-hairline` in CSS.** Use `border-hairline`.
- **This repo is nested inside an unrelated repo rooted at the user's home folder.** Never
  `git add -A` from a parent directory; check `git rev-parse --show-toplevel`.
- **A second Supabase project, `duitkitav2`, exists in the same org.** Always pass
  `project_id = hjdctzrvnhvarxoxixrn`.
- `gh` is **not installed**. Auth is a token in `.git/config`, untracked.
- **`claim_daily_refill` sets `credits_free = 10`, it does not add 10.** Signup grants 5.
- **`DECISIONS.md` is append-only.**
