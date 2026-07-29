# PASTE THIS ENTIRE FILE AS YOUR FIRST MESSAGE TO THE NEXT AGENT

> **For Vldr:** open Antigravity (or any other IDE/agent) in
> `C:\Users\Administrator\Documents\malesan`, then paste everything below the line as your
> first message. After that you only ever need to type **"lanjut"**.
>
> The agent will read the repo and know exactly where to continue. It will also log what it
> does, so when your Claude limit refreshes, Claude can pick up without losing anything.

---

## YOU ARE THE LEAD ENGINEER ON A PRODUCTION APP CALLED MALESAN

You are taking over mid-build from another agent (Claude Code) that ran out of its usage
budget. **The repository is the single source of truth.** Everything you need is in it.

### Step 1 — read these four files, in this order, before writing any code

1. **`AGENTS.md`** — the permanent rules. Non-negotiable. Read all of it.
2. **`HANDOFF.md`** — exactly where the build stands right now, what is verified, what is
   broken, and what the next action is.
3. **`ROADMAP.md`** — the 14-step build order and which steps are done.
4. **`AGENT_LOG.md`** — the chronological record of every agent session so far.

Then skim `SCHEMA.md` §6–§9 and `DECISIONS.md`. They contain security traps that have already
caused real bugs in this repo. Do not rediscover them the hard way.

### Step 2 — before you touch anything, confirm your environment

```bash
cd C:/Users/Administrator/Documents/malesan
git rev-parse --show-toplevel   # MUST print .../Documents/malesan
git log --oneline -5
npm install
npm run build
```

`git rev-parse --show-toplevel` matters more than it looks. This project sits **inside**
another, unrelated git repository rooted at the user's home folder (`C:\Users\Administrator`,
remote `duitkita`, no `.gitignore`, with `.ssh/` and `.git-credentials` sitting untracked).
**Never run `git add -A` from a parent directory.** You would publish the user's private keys.

---

## WHERE THE CREDENTIALS LIVE

You will need these. **They already exist — do not ask the user for them, and do not paste any
secret value into a chat message, a commit, or any tracked file.**

| What | Where | Notes |
|---|---|---|
| Supabase URL, anon key, **service role key** | `.env.local` in the repo root | Gitignored. This is the vault. |
| `GEMINI_API_KEY_1`, `GEMINI_API_KEY_2` | `.env.local` | Confirmed to be from **two separate** Google Cloud projects, so their quotas are independent. |
| `GEMINI_MODEL_FREE`, `GEMINI_MODEL_PRO` | `.env.local` | Already chosen by measurement. See GOTCHAS before changing. |
| `ENCRYPTION_KEY`, `CRON_SECRET`, `GEMINI_DAILY_CAP_PER_KEY` | `.env.local` | Generated. **Never rotate `ENCRYPTION_KEY`** — every stored BYOK key becomes undecryptable. |
| **GitHub push token** | `.git/config`, embedded in the `origin` remote URL | Untracked. `git push` just works; you do not need to log in. |
| Google OAuth client ID + secret | Supabase Dashboard → Authentication → Providers → Google | Already configured and working. Not in the repo. |

`.env.example` documents every variable with comments but holds no values. If `.env.local` is
ever missing, copy `.env.example` and ask the user to refill it.

**Supabase project id: `hjdctzrvnhvarxoxixrn`** (name: Malesan, region ap-southeast-1).
There is a second project in the same organisation called `duitkitav2` — **that is a different
product. Never touch it.**

---

## WHAT IS ALREADY BUILT AND VERIFIED

Steps 0–4 of 13 are complete. Everything below was tested by execution, not assumed:

- **Landing page** at `/` — full design system, responsive to 360px, zero horizontal overflow.
- **Google OAuth sign-in** at `/masuk` — works end to end. A real sign-in created a real
  profile row.
- **`profiles` table with RLS**, verified by *attacking* it: cross-user reads return 0 rows,
  privilege escalation is reverted, forged inserts are blocked.
- **Atomic credit system** — `spend_credits`, `claim_daily_refill`, `grant_credits`,
  `credit_ledger`. The mandatory double-spend race test passes: 12 parallel requests against
  an account holding 1 credit → exactly 1 succeeded.
- **Gemini server layer** — key rotation across both projects, 429 backoff, quota guard,
  token-by-token streaming (first chunk ~0.73s), BYOK encryption.

**`HANDOFF.md` has the full verified/broken breakdown. Trust it over this summary.**

---

## YOUR TASK: STEP 5 — IDE HARI INI + IDEA ENGINE

This is the first thing a user will actually be able to *do*. Everything under it already
works; you are wiring it together.

### 5.0 — First, close two gaps left open (do these before the feature)

1. **Export the migrations into the repo.** They currently live only on the hosted Supabase
   project, which contradicts `AGENTS.md` §0. Run `supabase db pull` into
   `supabase/migrations/` and commit. If the Supabase CLI is not installed, copy each
   migration's SQL out of the Supabase dashboard (Database → Migrations) into numbered files.
2. **Wire `claim_daily_refill` into session load.** It is written and tested but *called by
   nothing*, which means free credits never come back and the entire free tier is broken.
   Call it server-side (service-role client) when a signed-in user loads the app.

### 5.1 — Tables

Create `creator_dna` and `generations` exactly as specified in `SCHEMA.md` §2. Enable RLS on
both: owner-only, admin read. Regenerate `src/lib/supabase/database.types.ts` afterwards.

### 5.2 — The generation route

Server route (Next.js route handler). The order of operations is not negotiable:

1. Verify the session with `supabase.auth.getUser()` — never `getSession()`.
2. Load the profile. **Reject if `is_banned`** (see PROPOSALS in `HANDOFF.md` — this is
   currently unenforced anywhere).
3. `checkPoolAdmission({ isPro, hasByok })` from `@/lib/gemini/quota`.
4. `spend_credits` **server-side with the service-role client** — never from the browser, and
   never a plain `UPDATE`. This is `AGENTS.md` rule 2.
5. `generateStream` from `@/lib/gemini/client`, streaming to the browser.
6. Persist the result into `generations`.
7. **If the JSON fails to parse, do not charge the credit** (`PROMPTS.md` §1). Since the
   credit is spent before generation, this means refunding via `grant_credits`, or restructure
   so the spend commits only on success. Decide, and write the decision into `DECISIONS.md`.

### 5.3 — The prompts

Use `IDE_HARI_INI` and `IDEA_ENGINE` from `PROMPTS.md`, verbatim, in Indonesian. Inject Creator
DNA and trend cards as specified. Pass a Gemini `responseSchema` — structured output is
already proven to work and removes most parsing risk.

**Empty-context warning:** a brand-new user has no Creator DNA, and the `trends` table is
empty because the trend cron is step 9. In that state the prompt has no personalisation and
returns exactly what free ChatGPT returns. This is the single biggest product risk in the
build and it is documented in the review pass in `HANDOFF.md`. Raise it with the user before
building the prompt, or seed `trends` with a handful of manual rows so day one is not generic.

### 5.4 — The UI

Follow `DESIGN.md`. **Stream the output token by token** — the layer already supports it, and
`DESIGN.md` §5 calls this the single most important decision for perceived quality. Skeletons
for structure, streaming for text. Respect the quality floor: 360px, visible focus states,
`prefers-reduced-motion`, full keyboard reach.

---

## THE RULES YOU MUST NOT BREAK

Full list in `AGENTS.md` §2. The ones most likely to bite you here:

1. **No AI provider key ever reaches the browser.** Everything in `src/lib/gemini/` is marked
   `server-only`; importing it from a client component is a build error. Keep it that way.
2. **Credits move only through the SQL functions**, server-side, never a plain `UPDATE`.
3. **RLS on every table with user data. No exceptions.**
4. **Model IDs come from env**, never hardcoded.
5. **Never invent a feature that is not in `ROADMAP.md`.** Write it into PROPOSALS in
   `HANDOFF.md` and wait for the user to approve it.
6. **One roadmap step per session.** Finish it, self-test it, update the docs, commit, then
   **stop and report.** Do not chain steps.
7. **If the spec conflicts with reality**, stop, write it under BLOCKERS in `HANDOFF.md`, and
   ask. Do not guess.

---

## HOW TO HAND BACK — THIS PART IS NOT OPTIONAL

The user alternates between agents when usage limits hit. Claude Code will read your work
later and must understand it completely. **Before ending any turn in which you changed a file:**

1. **Rewrite `HANDOFF.md`.** Keep its exact section structure. "WHAT WORKS" means *you ran it
   and watched it work* — never list something you believe should work. Be specific and
   file-level.
2. **Append to `AGENT_LOG.md`.** Follow the format at the top of that file exactly: one entry
   per session, never edit or delete an existing entry. This is how the next agent knows what
   you did and why.
3. **Append any decision to `DECISIONS.md`** with the date and the reasoning. Append-only —
   if you reverse an earlier decision, add a new entry referencing it, never edit the old one.
4. **Update the status column in `ROADMAP.md`.**
5. **If you changed the database**, update `SCHEMA.md` and list the migration names.
6. **Commit and push.** Small commits with clear messages. Format:
   `<type>: <scope> — <what changed>` using `feat`, `fix`, `chore`, `docs`, `refactor`,
   `test`, `db`.

**Before every commit, run this and confirm it prints nothing:**

```bash
git diff --cached | grep -nE "AQ\.Ab8RN6|ghp_|sb_secret_|eyJhbGciOiJIUzI1NiIs"
```

If it prints anything, a live secret is about to enter git history. Unstage it and fix
`.gitignore`.

---

## GOTCHAS THAT HAVE ALREADY COST REAL TIME

Read these. Each one was a live bug or a wasted hour in this repo.

- **`ListModels` is not an availability check.** `gemini-2.5-flash` and `gemini-2.5-flash-lite`
  are still advertised by the API and both return **404**. Call a model before trusting it.
- **Newer is not faster.** `gemini-3.5-flash-lite` answered in **29s**;
  `gemini-3.1-flash-lite` in **1.1s**. Model IDs are pinned deliberately, not `-latest`.
- **`current_user` vs `auth.role()` — two inverse traps:**

  | Function kind | `current_user` is | Identify the caller with |
  |---|---|---|
  | `SECURITY INVOKER` | the caller | `current_user` |
  | `SECURITY DEFINER` | the owner (`postgres`) | `auth.role()` |

  Getting this backwards produced a guard that silently never fired, letting any user set
  `role = 'admin'` on themselves and then read and rewrite every other user's row. Full
  write-up in `SCHEMA.md` §6–§7.
- **Never enable `FORCE ROW LEVEL SECURITY` on `profiles`** — `is_admin()` reads `profiles`
  from inside a policy on `profiles` and would recurse forever.
- **`is_admin()` must keep `EXECUTE` for `authenticated`.** The Supabase linter flags it; that
  is a false positive. Policy expressions run as the querying role. `rls_auto_enable()` is a
  Supabase platform function, also a false positive.
- **SSE parsing must drain its buffer when the stream closes.** A short reply arrives as one
  chunk with no trailing blank line; splitting on `\n\n` alone silently yields zero chunks.
- **Next.js 16 renamed `middleware.ts` to `proxy.ts`.** The old name still builds but in dev
  throws "Cannot find the middleware module" and **every matched route 404s**.
- **A folder named `_foo` under `src/app` is a private folder** and is not routable. A route
  placed inside one silently 404s.
- **Tailwind v4 has no `--duration-*` theme namespace.** A duration declared in `@theme` is
  dropped silently *with a green build*. Durations live on `:root`; usage is
  `duration-[var(--duration-standard)]`. Grep the compiled CSS before believing a new token
  works.
- **No Framer Motion entrances on server-rendered pages** — it caused a hydration mismatch and
  shipped `opacity: 0` in the SSR HTML, meaning a blank page if the bundle failed. Use the CSS
  `.reveal` class. Framer Motion is reserved for the ember bloom (step 5 UI) and the pipeline
  drag (step 8).
- **`--color-border` is named `--color-hairline` in CSS** to avoid colliding with Tailwind's
  `border-*` utilities. Use `border-hairline`.
- **`claim_daily_refill` SETS `credits_free = 10`; it does not add 10.** That is the entire
  anti-hoarding mechanism. Signup grants 5 and the daily refill is 10 — different on purpose.
- **Re-run `node scripts/race-test.mjs` after any change to `spend_credits`.** A sequential
  test passes even with the `FOR UPDATE` removed.
- **Regenerate `src/lib/supabase/database.types.ts` after every migration.** A stale copy
  type-checks against a database that no longer exists.
- **`gh` (GitHub CLI) is not installed** on this machine.
- **Gemini quota resets ~14:00 WIB**, not local midnight, and is enforced per Google Cloud
  *project*, not per key.

---

## THINGS THE USER STILL NEEDS TO DECIDE

Do not decide these for them. They are listed in `HANDOFF.md` under BLOCKERS and PROPOSALS.

- Whether to move the trend cron (step 9) earlier, or seed `trends` manually — otherwise the
  product's front door is generic on day one.
- The domain name (`malesan.app` is unconfirmed; nothing hardcodes it).
- Credit pack IDR pricing (step 11).
- Vercel Hobby is not licensed for commercial use — must be resolved before a paid launch.
- The Google OAuth consent screen is still in "Testing" mode; only listed test users can sign
  in until it is published.

One standing instruction from the user, already recorded in `DECISIONS.md`: they deliberately
share credentials in chat so an agent can work autonomously. **Do not lecture them about it
again.** Just never write a secret into a tracked file.

---

## START NOW

1. Read `AGENTS.md`, `HANDOFF.md`, `ROADMAP.md`, `AGENT_LOG.md`.
2. Do §5.0 (export migrations, wire the daily refill).
3. Build step 5.
4. Self-test it. Update `HANDOFF.md`, `AGENT_LOG.md`, `DECISIONS.md`, `ROADMAP.md`.
5. Commit, push, **stop and report**.
