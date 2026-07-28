# HANDOFF

Last updated: 2026-07-28T09:37:34Z
Last agent: Claude Code
Last commit: `<pending — filled in immediately after the step 0 commit>`
Current step: 0 of 13 — **complete**

## WHAT I JUST DID
- Read `MALESAN_MASTER_PROMPT.md` (the frozen source-of-truth spec, 726 lines)
- Created `AGENTS.md` — canonical agent instructions: reading order, the 10 hard rules
  verbatim, tech stack + env vars, platform constraints, brand voice, working protocol,
  commit convention, the improvement mandate and its brake, file map
- Created `CLAUDE.md` — single line pointing at `AGENTS.md`
- Created `PRD.md` — problem, positioning, market, Phase 1 scope (11 user features + admin
  dashboard), onboarding order, credit economy, anti-abuse, referral rules, known limitation
- Created `SCHEMA.md` — all 12 tables verbatim from spec, the 4 required SQL functions with
  their contracts, RLS policy table, plus an "open schema questions" section
- Created `DESIGN.md` — concept, 11 color tokens, 3 typefaces, motion specs, the streaming
  decision, copy voice, quality floor
- Created `PROMPTS.md` — shared context block, `IDE_HARI_INI`, `IDEA_ENGINE`, `HOOK_LAB`,
  `SCRIPT_BUILDER`, `REPURPOSE`, `TREND_DIGEST`, all in Indonesian, plus the JSON parse
  contract and repair-retry rule
- Created `ROADMAP.md` — the 14-step build order with per-step notes and status column
- Created `DECISIONS.md` — 17 entries backfilled from the spec so the *reasoning* survives
  independently of the master prompt
- Created this file

No application code was written. That is per master prompt §14: *"Do not build application
code in this first turn."*

## WHAT WORKS — VERIFIED, NOT ASSUMED
- All nine spec files exist in the repo root and are committed. Verified by listing the
  directory and by `git show --stat` on the commit.
- Nothing else is claimed. There is no app, no build, no database, no deployment.

## WHAT IS BROKEN OR UNFINISHED
- Nothing is broken, because nothing has been built yet.
- Two spec gaps carried forward deliberately, both recorded in-file:
  - `profiles.referral_code` is `not null unique` with **no default** and no generation
    strategy. Must be solved in the signup trigger at step 2. See `SCHEMA.md` §5.
  - `CREATOR_DNA_ANALYSIS` costs 2 credits in the economy table but has **no prompt** in the
    master spec. Do not invent it — propose at step 6. See `PROMPTS.md` §9.
- Credit pack IDR pricing has no home in the schema. `PRD.md` requires it be admin-editable,
  which implies a `credit_packs` table that the master prompt never specified. Flagged in
  `SCHEMA.md` §5 as needing a proposal before it is added.

## NEXT ACTION — START HERE
1. Read `AGENTS.md`, then this file, then `ROADMAP.md`.
2. Begin **step 1**: scaffold Next.js (App Router, TypeScript) + Tailwind + Framer Motion in
   the repo root.
3. Put the `DESIGN.md` §2 color tokens and §3 typefaces into the Tailwind config — as real
   tokens, not scattered arbitrary values.
4. Build the landing page. It is the first test of the "cold obsidian that heats up" concept.
   Copy in brand voice; primary CTA is `Males mikir. Kasih ide.`
5. Verify against the quality floor before calling it done: renders at **360px**, visible
   keyboard focus states, `prefers-reduced-motion` respected, everything keyboard-reachable.
6. Update this file, commit, stop and report.

Do **not** touch Supabase, auth or Gemini in step 1.

## BLOCKERS — NEEDS THE HUMAN
None are blocking step 1. These block later steps and are worth resolving early:

- **Domain not confirmed.** Master prompt says "malesan.app (or similar — confirm with human
  before hardcoding)". Nothing hardcodes it yet. Needed before deploy.
- **Supabase project** — not created. URL, anon key and service role key needed for step 2.
- **Google OAuth credentials** — client ID/secret and authorised redirect URIs needed for step 2.
- **Two Google Cloud projects with Gemini API keys** — needed for step 4. They must be *two
  separate projects*; two keys in one project share one quota and buy nothing.
- **Current Gemini model IDs** for `GEMINI_MODEL_FREE` and `GEMINI_MODEL_PRO`. Google renames
  these often — confirm the live IDs at step 4 rather than trusting any value written earlier.
- **Credit pack IDR pricing** — needed for step 11.
- **Vercel Hobby is not licensed for commercial use.** Not urgent, but must be resolved before
  a public monetized launch.

## PROPOSALS — NOT IMPLEMENTED, AWAITING APPROVAL
Per `AGENTS.md` §6, these are written down and **not built**.

- **A `credit_packs` table (approx. 6 columns, one admin screen).** `PRD.md` requires pack
  pricing to be admin-editable and explicitly forbids hardcoding prices in components, but no
  table exists to hold them. Without this, step 11 will be forced to either hardcode or invent
  a table on the spot. Cheap now, awkward later.
- **A `generation_failures` log, or a `status` column on `generations`.** The repair-retry rule
  in `PROMPTS.md` says a failed parse must not charge the user — but there is currently nowhere
  to record that a generation was attempted and failed. Without it, the admin "API key pool
  health" screen cannot show a real failure rate, and prompt regressions will be invisible.
  Roughly one table or one column.
- **Decide the JSON-mode strategy at step 4, not step 7.** Gemini supports a structured-output
  / response-schema mode. If it is used, most of the defensive parsing and repair-retry logic
  in `PROMPTS.md` becomes unnecessary; if it is not, that logic must be solid. Choosing late
  means writing the parsing layer twice.
- **Where the product could feel generic:** `IDE_HARI_INI` is the front door and the whole
  differentiator, yet a brand-new user reaches it with empty Creator DNA and, on day one, an
  empty `trends` table. In that state the prompt has no personalisation context at all and
  will produce output a user could have gotten from ChatGPT for free. Suggest seeding the
  `trends` table before launch, and considering a lightweight "what do you make?" one-liner at
  first run that costs the user three seconds. Worth deciding before step 5, not after.
- **Quota-guard observability.** The 20% threshold rule exists, but nothing specifies how pool
  usage is *measured*. Gemini does not expose remaining quota directly, so it has to be
  counted locally. That counter needs to exist from step 4 or the guard is guesswork.

## GOTCHAS FOR THE NEXT AGENT
- **`PROMPTS.md` uses four-backtick code fences on purpose.** The prompt text contains a
  literal triple-backtick sequence (`Tanpa ```json`). Editing those fences down to three
  backticks will silently break the file's rendering.
- The master prompt itself has this same fence bug at line 463 — it is left alone because
  `MALESAN_MASTER_PROMPT.md` is treated as frozen.
- **Two different language settings.** UI language (bilingual ID/EN toggle) and AI output
  language (`creator_dna.output_language`, defaults to `id`) are separate. Wiring them to one
  piece of state is an easy and wrong shortcut.
- **`claim_daily_refill` sets `credits_free = 10`, it does not add 10.** "Set to, not add to"
  is the entire anti-hoarding mechanism. An `+= 10` here quietly breaks the economy design.
- **Signup grants 5 credits; the daily refill is 10.** These differ on purpose (`PRD.md` §6);
  it is not a typo to be "fixed".
- **Gemini quota resets ~14:00 WIB, not local midnight** — so Indonesian prime time
  (19:00–23:00 WIB) always runs on a partially-consumed pool. Any capacity reasoning that
  assumes a fresh pool in the evening is wrong.
- **Gemini free-tier quota is per Google Cloud *project*, not per key.** Adding a third key to
  an existing project buys zero additional quota.
- **The quality floor is not step 13.** 360px, focus states, reduced-motion and keyboard
  reachability ship with every component starting at step 1. Step 13 is only the sweep for
  what slipped through.
- **`DECISIONS.md` is append-only.** If a decision is reversed, add a new entry referencing the
  old one. Never edit or delete history.
- The repo had exactly one prior commit (`bac9bcb first commit`) containing only the master
  prompt. There is no scaffold, no `package.json`, no `node_modules` — step 1 starts from bare.
