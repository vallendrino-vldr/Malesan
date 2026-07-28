# HANDOFF

Last updated: 2026-07-28T10:12:00Z
Last agent: Claude Code
Last commit: `046e2d3` — feat: step 1 — next.js scaffold, design tokens, landing page
Current step: 1 of 13 — **complete**

## WHAT I JUST DID
- Scaffolded Next.js 16.2.12 (App Router, TypeScript, `src/`, `@/*` alias) with Tailwind v4,
  ESLint and React 19.2.4. Added `framer-motion`. Added a `typecheck` script.
- `src/app/globals.css` — the whole design system from `DESIGN.md`: 11 colour tokens, three
  font families, three tracking steps, `--ease-heat`, duration tokens, base layer (dark
  `color-scheme`, `:focus-visible` ring, `::selection`, `.tabular`), `.glow-ember` and
  `.text-gradient-ember` utilities, `.reveal` entrance, and the reduced-motion block.
- `src/app/layout.tsx` — Archivo (display), Plus Jakarta Sans (body), Geist Mono (data) via
  `next/font`; `lang="id"`; Indonesian metadata; `themeColor` set to obsidian.
- `src/components/Reveal.tsx` — CSS-driven entrance wrapper, 60ms stagger. Server component.
- `src/app/page.tsx` — the landing page: hero, five module cards with credit costs, a
  three-panel "bedanya sama nge-prompt sendiri" section, footer. Copy in brand voice.
- `README.md`, `.claude/launch.json` (dev server config).
- Set the GitHub remote and pushed. Repo: `github.com/vallendrino-vldr/Malesan`.

## WHAT WORKS — VERIFIED, NOT ASSUMED
Everything below was measured in a real browser at `localhost:3000`, not inferred.

- `npm run build` — compiles clean, `/` and `/_not-found` both prerendered static.
- `npm run lint` and `npm run typecheck` — both clean, no output.
- **Tokens actually applied**, read back from computed style: body background
  `rgb(11,10,9)` = `#0B0A09`; body text `#F5F0EA`; CTA background `rgb(255,138,61)` =
  `#FF8A3D`; `.glow-ember` compiles to real ember hexes.
- **Fonts resolve**: body = Plus Jakarta Sans, h1 = Archivo at weight 800 with
  `letter-spacing: -1.44px` (= the `-0.04em` display-lg step), credit chips = Geist Mono.
- **Responsive to 360px**: viewport 360 → `scrollWidth` 360, **zero** elements overflowing
  the viewport. Also checked at 375 and desktop. Primary CTA is 51px tall (above the 44px
  touch-target floor).
- **Reduced motion**: the browser under test reports `prefers-reduced-motion: reduce`, so this
  path was exercised live — `.reveal` swaps to the `reveal-fade` keyframe (opacity only, no
  translate) and every other transition flattens to 0.01ms. **No element is left stuck
  invisible** (checked all 16 `.reveal` nodes: opacity 1).
- Entrance timing verified in compiled CSS and computed style: 240ms,
  `cubic-bezier(0.22, 1, 0.36, 1)`, stagger 0 / 60 / 120 / 180 / 240ms.
- `:focus-visible { outline: 2px solid var(--color-ember); outline-offset: 3px }` is present in
  the compiled stylesheet. **Not** confirmed by an actual keyboard tab — see below.
- **Console is clean.** Zero errors, zero warnings after a hard reload.
- Structure: exactly one `<h1>`, heading order h1 → h2 → h3 with no skips, `header`/`main`/
  `footer` landmarks present, no images missing `alt`, both links resolve to real anchors.

## WHAT IS BROKEN OR UNFINISHED
- **`:focus-visible` was never confirmed by a real keypress.** The rule is in the CSS and the
  colour is right, but synthetic `Tab` in the test browser did not move focus into the page,
  and programmatic `.focus()` does not reliably trigger `:focus-visible`. Someone should tab
  through the landing page in a normal browser once and confirm the ember ring appears.
- **The 180ms transition duration was never observed at its real value** — the test browser
  forces reduced motion, which flattens it to 0.01ms. Verified structurally instead: the
  compiled CSS contains `.duration-\[var\(--duration-standard\)\] { transition-duration:
  var(--duration-standard) }` and `:root { --duration-standard: .18s }`. Worth one visual
  check on a machine without reduced motion enabled.
- **No screenshot was ever taken.** The browser pane would not composite frames in this
  environment, so every visual claim above rests on computed styles and compiled CSS, not on
  looking at the page. **Nobody has actually seen this design yet.** Look at it before
  building step 2 on top of it.
- The two landing CTAs are in-page anchors (`#modul`, `#beda`). There is no `/masuk` route to
  point them at yet — deliberate, not an oversight. Rewire them at step 2.
- No bilingual ID/EN toggle. The landing page is Indonesian only. i18n is not in any roadmap
  step; it needs one, or it needs to be folded into step 13.
- `npm install` blocked two postinstall scripts (`sharp`, `unrs-resolver`). Nothing currently
  depends on them — no images are optimised and lint passes — but `sharp` will matter if
  `next/image` is used with remote images later.
- 1 low-severity npm audit advisory, untouched.

## NEXT ACTION — START HERE
1. Read `AGENTS.md`, then this file, then `ROADMAP.md`.
2. Look at the landing page in a real browser first. Confirm the focus ring and the 180ms
   transitions, and form an opinion on whether "cold obsidian that heats up" actually reads.
3. Begin **step 2**: Supabase Google OAuth, the `profiles` table, and RLS.
   - Project already exists: `hjdctzrvnhvarxoxixrn`, region `ap-southeast-1`, URL
     `https://hjdctzrvnhvarxoxixrn.supabase.co`. No schema applied yet.
   - Create `profiles` exactly as specified in `SCHEMA.md`, as a **migration**, not by hand in
     the dashboard.
   - Solve `referral_code` — it is `not null unique` with no default. The signup trigger has
     to generate it and retry on collision. See `SCHEMA.md` §5.
   - Auto-create the profile row on signup via a trigger on `auth.users`.
   - Enable RLS and **verify it by trying to read another user's row**, not by reading the
     policy and assuming.
4. Update this file, commit, stop and report.

Google OAuth only — no email/password, no magic links. That is an anti-abuse decision, not a
default. See `DECISIONS.md`.

## BLOCKERS — NEEDS THE HUMAN
- **Google OAuth credentials** — client ID/secret and authorised redirect URIs. Required for
  step 2; nothing else blocks it.
- **`.env.local` does not exist yet.** Copy `.env.example` and fill in at least
  `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY` before step 2.
- **Domain not confirmed.** `malesan.app` is unverified. Nothing hardcodes it; `metadataBase`
  is deliberately absent from `layout.tsx` until it is settled.
- **Two Google Cloud projects with Gemini keys** — needed for step 4. Must be two *separate*
  projects; two keys in one project share one quota.
- **Current Gemini model IDs** for `GEMINI_MODEL_FREE` / `GEMINI_MODEL_PRO`. Confirm live at
  step 4 rather than trusting anything written earlier — Google renames these often.
- **Credit pack IDR pricing** — needed for step 11.
- **Vercel Hobby is not licensed for commercial use.** Resolve before a monetized launch.
- Credential rotation was raised and the human declined it as a deliberate working method.
  Recorded in `DECISIONS.md`. Do not raise it again.

## PROPOSALS — NOT IMPLEMENTED, AWAITING APPROVAL
- **i18n has no home in the roadmap.** `PRD.md` promises a bilingual ID/EN toggle but no step
  owns it. Retrofitting translation across 13 steps of hardcoded Indonesian strings is far
  more expensive than extracting them as they are written. Cheapest fix: adopt a message
  catalogue at step 5 when the first real UI copy appears. Roughly a day now versus a week at
  step 13.
- **A `credit_packs` table** (~6 columns + one admin screen). `PRD.md` forbids hardcoding
  pack prices, but no table holds them. Step 11 will otherwise be forced to improvise.
- **A `generation_failures` log, or a `status` column on `generations`.** `PROMPTS.md` says a
  failed JSON parse must not charge the user, but nothing records that an attempt happened
  and failed. Without it the admin "API key pool health" screen cannot show a real failure
  rate and prompt regressions stay invisible.
- **Decide the Gemini JSON-mode strategy at step 4, not step 7.** If structured output is
  used, most of the defensive parsing and repair-retry logic in `PROMPTS.md` is unnecessary.
  Choosing late means writing the parsing layer twice.
- **The weakest point in the product right now, stated plainly:** `IDE_HARI_INI` is the front
  door and the entire differentiator, yet a brand-new user reaches it with empty Creator DNA
  *and*, on launch day, an empty `trends` table. In that state the prompt has no
  personalisation context whatsoever and produces exactly what ChatGPT would produce for free.
  The landing page now makes a promise ("kenal gaya lo", "tau hari ini") that day-one reality
  cannot keep. Suggest seeding `trends` before launch and adding a three-second "lo bikin
  konten apa?" step at first run. Decide before step 5, not after.
- **Quota-guard observability.** The 20%-remaining rule exists but nothing specifies how pool
  usage is *measured*. Gemini does not expose remaining quota, so it must be counted locally.
  That counter has to exist from step 4 or the guard is guesswork.

## GOTCHAS FOR THE NEXT AGENT
- **Tailwind v4 has no `--duration-*` theme namespace.** A duration declared in `@theme` is
  dropped silently and its utility class never exists — with a green build. This already
  happened once: transitions were running at Tailwind's 150ms default instead of the 180ms in
  `DESIGN.md`, and `build`, `lint` and `tsc` all passed. Durations now live on `:root` in
  `@layer base` and are used as `duration-[var(--duration-standard)]`. **When adding any new
  token, grep the compiled CSS for the class before believing it works.**
- **Do not put Framer Motion entrances on server-rendered pages.** The first version of
  `Reveal` used `whileInView` plus `useReducedMotion()`; it caused a hydration mismatch and,
  worse, shipped `opacity: 0` in the SSR HTML — meaning a failed JS bundle would leave the
  page blank. Entrances are CSS now. Framer Motion stays for the ember bloom (step 5) and the
  pipeline drag (step 8).
- **The reduced-motion block deliberately exempts `.reveal`** (`*:not(.reveal)`), so the
  opacity fade survives while the translate is dropped — exactly what `DESIGN.md` §4 asks.
  A blanket `*` rule would flatten the fade too. Lightning CSS compiles the selector to
  `:not(.reveal)`; that is the same thing, not a bug.
- **`--color-border` was renamed to `--color-hairline`.** Naming it `border` collides
  confusingly with Tailwind's `border-*` utilities. `DESIGN.md` still calls the token
  `border`; the CSS name is `hairline`. Use `border-hairline`.
- **This project has its own git repo** at `Documents/malesan`, remote
  `github.com/vallendrino-vldr/Malesan`. It sits inside a *second, unrelated* repo rooted at
  the user's home folder (`C:\Users\Administrator`) whose remote is
  `github.com/vallendrino-vldr/duitkita` and which has **no `.gitignore`**, with `.ssh/` and
  `.git-credentials` untracked beside it. That outer repo was left untouched on purpose — it
  is another project. **Never run `git add -A` from a parent directory.** Confirm
  `git rev-parse --show-toplevel` before staging.
- `gh` (GitHub CLI) is **not installed**. Auth is a token embedded in `.git/config`, which is
  untracked. Anything assuming `gh` will fail.
- **Two different language settings.** UI language (bilingual toggle) and AI output language
  (`creator_dna.output_language`, default `id`) are separate. Wiring them together is an easy
  and wrong shortcut.
- **`claim_daily_refill` sets `credits_free = 10`, it does not add 10.** "Set to, not add to"
  is the entire anti-hoarding mechanism.
- **Signup grants 5 credits; the daily refill is 10.** Different on purpose. Not a typo.
- **Gemini quota resets ~14:00 WIB**, not local midnight, so Indonesian prime time always runs
  on a partially-consumed pool. Free-tier quota is per Google Cloud *project*, not per key.
- **The quality floor is not step 13.** 360px, focus states, reduced motion and keyboard
  reachability ship with every component, starting now.
- **`DECISIONS.md` is append-only.** Reversals are new entries, never edits.
