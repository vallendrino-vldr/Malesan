# HANDOFF — Malesan

## MULAI DARI SINI — read this block, then stop and decide

If you read nothing else, read these twenty lines. They exist because the owner
pays per token and has run out mid-build; a session that spends its context
rediscovering the repo produces nothing.

**What this is.** Production Next.js 16 + Supabase + Gemini app for Indonesian
creators. Live on Vercel, auto-deploys from `main`, takes real money.

**Is it healthy right now?** Yes. `next build` passes, `tsc --noEmit` passes,
37 routes generate (was 35 — §9i added `/api/react` and `/api/recycle`). `npm run lint` reports **14 problems (9 errors, 5 warnings)**.
The old "11" note was stale: measured pristine on `git stash`, HEAD before §9i was
already **15** (9 errors, 6 warnings) — the react-hooks rules in Next 16.2.12 got
stricter (`Date.now()`-during-render and setState-in-effect are now flagged). §9i
landed at 14 (one fewer warning — a real missing-dep fix), so **14 is the current
floor, not 11**. If you see 14, nothing is broken. More than 14, you added it.

**Do NOT re-audit for "damage from the antigravity gemini session".** It was
checked on 2026-08-06 against `git reflog`: that agent never touched this repo.

**Where to go next:** §8 is the outstanding work, §10 is what is blocked on the
owner rather than on code. Pick from §8 unless the owner says otherwise.

**Before you debug anything, read §4.** It is a table of traps that have already
cost hours each — `supabase.rpc()` not throwing, `backdrop-filter` breaking
`position: fixed`, the service worker serving stale CSS *in development*. Most
strange behaviour in this repo has already happened once.

**Before you finish:** update this file. `AGENTS.md` §2 rule 7 makes it
mandatory, and it is the only reason the next session starts fast.

---

**Read this whole file before touching anything.** Its only job is to let a new
session start working without re-auditing the repo, because re-auditing is
expensive and the owner pays per token.

Last updated: **2026-08-22**, after the AI Provider Management Layer (§9k).
**Newest work is §9k — providers, models, routing, cost tracking are now database
rows managed at `/admin/ai`. Read §9k before touching anything AI-related.**
§9j before it: deterministic frame-by-frame video export (WebCodecs + mp4-muxer,
NOT MediaRecorder). §9i: 3 Auto-CC bugs + netizen/roast + smart recycle.
Canonical rules live in `AGENTS.md`. This file is state, history and traps.

---

## §9k — AI Provider Management Layer (2026-08-22)

**What it is.** Malesan is no longer locked to one vendor. Providers, models,
per-feature routing and per-request cost live in five new tables and are managed
from `/admin/ai`. Adding SumoPod, OpenRouter, Groq or any OpenAI-compatible host
is now data entry, not a deploy.

**THE ONE THING TO KNOW:** a feature with **no row in `ai_routes` uses the exact
legacy env-Gemini path**. Zero routes are seeded, so nothing about user-facing
behaviour changed when this landed. Routing is opted in per feature and reverts
with one click ("Balikin ke default"). If AI behaves oddly, check
`app_config.ai_router_enabled` — setting it false forces every feature back to
the old path with no deploy.

**Credits were not touched.** No new credit code exists. Routes still spend once
*before* the engine and refund by `ref` only if the engine exhausts every
candidate, so fallback across providers bills exactly one credit. Do not add a
spend inside the engine — that is the whole design.

**New code:** `src/lib/ai/{types,registry,router,engine,cost,discovery,balance,analytics}.ts`,
`src/app/actions/ai-admin.ts`, `src/lib/admin/guard.ts`, `src/app/admin/ai/**`.
**Touched:** `gemini/providers.ts` + `gemini/client.ts` (OpenAI streaming,
`generateDetailed` now returns token counts, `onUsage` for streams),
`config.ts`, `api/generate/route.ts`, `database.types.ts`, `admin/layout.tsx`.

**Verified by execution:** end-to-end `POST /api/generate` returned 16 SSE frames
of real content; `ai_usage_log` recorded `ok, 3158 in / 402 out, credits_charged=1`;
a failed run recorded `credits_charged=0`. All 5 admin pages render 200. Build,
typecheck and lint (on touched files) clean.

**Traps added to §4's spirit:**
- `cost_idr` is 0 until model prices are entered at `/admin/ai/models`. The UI
  says so; do not read the margin numbers before filling them in.
- Admin pages **cannot be click-tested** when the Browser pane is not
  compositing — hydration stalls and handlers never attach. Reproduced on
  `/admin/errors` (untouched code). Verify admin work via SSR + direct action
  calls, not clicks. This will waste an hour if you assume the page is broken.
- `gemini-3.7-flash` was returning **118 upstream 503s** ("high demand"). It is
  transient but real, and during a spike the retry budget (3 keys × 4 rounds)
  exceeds the 52s abort, so the user waits the full time for nothing. This is
  now fixable without code: give the heavy features a fallback provider.
- `supabase/migrations` on disk still does not equal the applied history — the
  new one (`00021` / `ai_provider_layer`) is in both, but three older tables have
  no CREATE on disk. Never `db reset` from disk.

---

## 0. The human — read this first, it is where sessions most often go wrong

Owner: **vadlyvldr** (Vldr), solo founder, Indonesia.

- **Not a programmer at all.** Never explain in function names, file names or
  technical terms. Explain by effect on the product: "credits now deduct
  automatically", not "added an AFTER INSERT trigger".
- **Bahasa Indonesia, gaul/santai, straight to the point.** No formal preamble.
- **Token economy is an explicit, repeated request.** Do not write long reports
  for small things. Do not read files you do not need.
- **Be honest about what is not done.** He has asked for this many times. Never
  say "sudah jadi" for something you have not run and seen work. When something
  cannot be verified (a real iPhone, for instance), say so.
- **He wants to be #1 in Indonesia and to make money.** He pays for Claude Pro
  himself and is currently out of pocket. Weigh product decisions against that.
- **He does not want the product to look AI-made.** Keep AI fingerprints out of
  the product, the UI and the commits.

---

## 1. The product

**Malesan** — AI content-idea tool for Indonesian creators.
Live at `malesan.my.id` (custom domain via SumoPod → Vercel; `malesan.vercel.app`
still resolves as an alias). GitHub `vallendrino-vldr/Malesan` (now public).
Vercel auto-deploys from `main`.

Tagline: *"Males mikirnya. Bukan bikinnya."*

| Module | Credits | What it does |
|---|---|---|
| Ide Hari Ini | 1 | 3 ideas, no input needed |
| Idea Engine | cfg | rough idea → 5 developed ones |
| Hook Lab | 2 | 10 scored hooks, distinct patterns |
| Script | 4 | per-scene script + CTA + caption |
| Repurpose | cfg | 1 piece → 5 platforms |
| Vibe Coding | cfg | 6 docs for people building apps with AI |

Costs come from `app_config`, never hardcoded.
Pipeline: Ide → Draft (has hook) → Siap (script done) → Posted.

---

## 2. Stack and where things live

- **Next.js 16 App Router + Turbopack**, React 19, Tailwind v4.
- **Supabase** project `hjdctzrvnhvarxoxixrn` (`ap-southeast-1`).
  The other project `axqhiygtzymhoqkkfyvc` is **duitkitav2, not this one.**
- **Gemini** through a key pool with rotation + backoff. Slots `GEMINI_API_KEY_1`
  … `GEMINI_API_KEY_10` are read; whichever are set form the pool. Three are
  provisioned. A slot number is what `gemini_usage.key_index` records against, so
  a key that has served traffic must never be moved to a different slot.
- Vercel pinned to `sin1` in `vercel.json` — Supabase is in Singapore; without
  the pin every request crosses the Pacific.

### Files you will actually touch
```
src/lib/prompts/index.ts        all module prompts + CRAFT_RULES
src/lib/prompts/vibe.ts         Vibe Coding prompts
src/lib/gemini/client.ts        the only place that talks to a model
src/lib/gemini/providers.ts     gemini/openai/anthropic adapters (+ vision)
src/lib/credits.ts              spendCredits / refundCredits
src/lib/config.ts               app_config reads (costs, model, payment)
src/lib/boot-scripts.ts         theme + text-size boot scripts (DO NOT MOVE, §5)
src/lib/payments/proof-check.ts payment-proof vision check
src/lib/admin/snapshot.ts       platform snapshot for the admin assistant
src/app/api/generate/route.ts   SSE, credit spend, writes `generations`
src/components/AppShell.tsx     app shell + header
src/components/ModuleRunner.tsx hook/script/repurpose UI
src/components/PipelineBoard.tsx the board
src/app/admin/**                admin panel
```

### Product docs (repo root, committed)
`PRD.md` `DESIGN.md` `SCHEMA.md` `PROMPTS.md` `ROADMAP.md` `DECISIONS.md`
`MALESAN_MASTER_PROMPT.md` `ANTIGRAVITY_PROMPT.md`
`DESIGN.md` is the visual law. **If anything conflicts, DESIGN.md wins.**
`MALESAN_MASTER_PROMPT.md` is the original spec; if it and `AGENTS.md` disagree,
the master prompt wins and you fix `AGENTS.md`.

### Secrets
All in **`.env.local`** (gitignored). **Never write a value into any file, any
commit, or the chat.** Variable names only:
```
NEXT_PUBLIC_SUPABASE_URL      NEXT_PUBLIC_SUPABASE_ANON_KEY
SUPABASE_SERVICE_ROLE_KEY
GEMINI_API_KEY_1  GEMINI_API_KEY_2  GEMINI_API_KEY_3   (slots 1..10 are read)
GEMINI_MODEL_FREE             GEMINI_MODEL_PRO
GEMINI_DAILY_CAP_PER_KEY      CRON_SECRET       ENCRYPTION_KEY
DEV_LOGIN_EMAIL               DEV_LOGIN_SECRET
```
Model ids must never be hardcoded — always env or `app_config`. Currently
`gemini-3.1-flash-lite` (free) and `gemini-3.6-flash` (pro). Past incident:
`app_config` was seeded with old ids (`gemini-2.5-*`), which override env, and
every generation 404'd.

### Signing in during development
The only auth is Google OAuth, which an agent cannot complete. Use the
**development-only** bypass:
```
/dev-masuk?key=$DEV_LOGIN_SECRET&next=%2Fapp
```
Three guards: dead in production (404), secret must match, and it can only
become `DEV_LOGIN_EMAIL`. Safe to keep; deleting the file is also fine.

---

## 3. How to work on this repo (learned the hard way)

1. **`next build` is the real gate, not `tsc --noEmit`.** `tsc` passes on
   unbalanced JSX. Always build before committing.
2. **Verify in a browser. Do not trust reading the code.** Run the dev server,
   sign in via `/dev-masuk`, and prove it. The biggest bugs here (dead theme
   script, empty top-up queue) were invisible until run.
3. **Never edit files with PowerShell `Get-Content -Raw` / `Set-Content`.** It
   wrote a UTF-8 BOM and turned an em-dash into mojibake. Use Edit/Write, or
   Python.
4. **Careful writing multi-line strings into .tsx from a Python script.** A
   literal newline inside a TS string is a build error. Happened twice.
5. Confirm anything touching money or credits against the database (Supabase
   MCP), not against the UI.

---

## 4. Traps that have already cost time — do not rediscover these

| Trap | What it caused |
|---|---|
| **`supabase.rpc()` does NOT throw.** It resolves `{data, error}`. | Approve-topup marked "approved" while granting nothing; a voucher burned with no credits; referral bonuses logged but never paid. **Always destructure `error`.** |
| **`.update()`/`.insert()` without `.select()`** cannot tell success from "matched no rows". | Bans that silently no-op'd. |
| **A discarded `error` on `.select()`** | The top-up queue rendered "empty" with money sitting in it. |
| **Two FKs to the same table** make a PostgREST embed ambiguous (`PGRST201`, HTTP 300). | `topups` has both `user_id` and `reviewed_by` → `profiles`. Must write `profiles!topups_user_id_fkey(email)`. |
| **`backdrop-filter` becomes the containing block for `position: fixed`.** | A dialog inside the blurred header laid out inside a 68px strip. Every overlay opened from the header **must** portal to `document.body`. |
| **A Server Component importing a value from a `"use client"` module** gets a throwing stub. | The theme and text-size boot scripts never ran at all. See §5. |
| **`env(safe-area-inset-*)` is 0 on iOS** without `viewportFit: "cover"`. | The bottom tab bar sat under the home indicator on every iPhone. |
| **Spreading an object from a `"use client"` module** in a server component yields `{}`. | ModuleRunner crashed. Pass primitives. |
| **`px` text sizes ignore the text-size control** (it moves root font-size, which only moves `rem`). | Use `text-micro` (12px) / `text-mini` (13px) / `text-sm`. **12px floor.** |
| **Accent text over an accent wash** (`bg-ember/10 text-ember`) costs ~0.7 contrast. | Tokens are tuned to survive a 20% wash. Do not lighten them. |
| **A `<span>` cannot take focus**, so `:focus-visible` on one never fires. | The wordmark's wake-up ignored keyboard users. Key focus off the wrapping `<a>`/`<button>`. |
| **A service worker fetch handler runs for every request**, even ones it passes through — and an idle worker must boot first. | Return without calling `respondWith` for anything you are not actually handling. |
| **Renaming the cache is what applies a strategy change.** Old entries survive on their own. | v1 had cached HTML; the offline fallback would have served a stale `/`. |
| **The service worker caches `/_next/static` cache-first — in development too.** | Cost most of a session. A CSS change was correct on disk, `next build` was clean, `.next` was deleted and the dev server restarted twice, and the browser still served the old stylesheet: `.rail` rules that no longer existed anywhere in the repo. Ctrl+Shift+R does not help — the worker answers before the network does. Clear it before concluding a style change "did not apply": `navigator.serviceWorker.getRegistrations()` → `unregister()`, then `caches.keys()` → `caches.delete()`. |
| **Hiding controls behind a menu hides the features.** | The "⋯" header menu meant nobody discovered the light theme, the reload, or the tutorial. Named chips instead. |

---

## 5. `src/lib/boot-scripts.ts` — do not move it

That file deliberately has **no `"use client"`**. It holds the theme and
text-size scripts inlined into `<head>`.

They used to be exported from `ThemeToggle.tsx` and `TextScale.tsx`, both client
modules. Next replaced the cross-boundary import with a client reference, so
what actually shipped in the page was
`function(){ throw new Error("Attempted to call THEME_INIT_SCRIPT()...") }`.
The theme therefore **reset to dark on every full page load**, and the text-size
control never did anything at all.

Move these constants back into the components and the bug returns, disguised as
"the preference just doesn't save".

---

## 6. Decisions already made — do not reverse without a strong reason

- **The admin assistant reads and advises; it cannot execute.** Some of what it
  reads is attacker-influenceable text (a proof reading, an error message, an
  email address). A model that can be argued into a conclusion must not also
  hold the button for money and access. Recommendations come back as a
  destination plus a reason, and hrefs are checked against an allowlist.
- **Payment proofs: the model READS, the code JUDGES.** The model is only asked
  what is visible (amount, account, status). Comparison against the real
  configured account and the real pack price is done in code. A model asked
  "should I approve?" agrees with whatever it is shown.
- **Credits only move when an admin approves.** The automated verdict is advice.
- **Pipeline delete: immediate + 8s undo**, not a confirm dialog. Undo re-inserts
  the original row (same id, same created_at) rather than deferring the delete
  on a timer — a timer is lost the moment the tab closes.
- **The service worker does not `skipWaiting()`.** It caused a PWA that blinked
  continuously. Takeover only happens when the user taps.
- **`topup_proofs` is private and users cannot delete from it** (so evidence
  cannot be pulled during review). Orphan cleanup is server-side, service role.
- **Dark is the default theme.** Light is a choice.

---

## 7. Current state (2026-08-06)

### Session of 2026-08-06

The owner reported that a previous session had run out of quota and been
continued by an "antigravity gemini" agent, and expected to find damage.
**There is none — that agent never touched this repo.** `git reflog` ends at
`f9f586a` with no resets, no stashes, no commits by anyone else; the working
tree was clean and identical to `origin/main`; `next build`, `tsc --noEmit` and
the 29-route static generation all passed before anything was changed. The
9 lint errors are the pre-existing ones already listed in §11. Do not re-audit
for gemini damage — this has been checked.

**Shipped and verified in a browser this session:**
- Gemini key pool reads `GEMINI_API_KEY_1..10` instead of two hardcoded ifs.
  `GEMINI_API_KEY_3` slot exists in `.env.local` and is **empty** — the third
  key still has to be pasted in, and again in Vercel's env for production.
- The trends cron went through the shared client for the first time: it used to
  call `fetch` with `GEMINI_API_KEY_1` directly (no rotation, no backoff,
  invisible to the quota guard) and carried a hardcoded `gemini-2.5-flash`
  fallback. It also deactivated live trends *before* generating, so a failure
  left the product with zero trends, and it discarded its insert error.
- Magazine grid in `AppShell`, measured at 1280px: `240px | 800px | 240px`,
  only `main` scrolls, document does not scroll. Rails are `lg`-and-up (see the
  commit for the measurement that forced that).
- Header chips: 16px radius, resting surface + shadow, gradient hover.
  `--header-surface` is `#f4f5f7` in the light theme only.
- `backdrop-blur-xl` removed from header and tab bar — it was blurring a solid
  background, since nothing ever renders behind either bar.

**Verified how:** a throwaway `src/app/shellcheck/page.tsx` rendering `AppShell`
with fake props, so the layout could be seen without a signed-in session and
without putting `DEV_LOGIN_SECRET` anywhere. Deleted before committing. That
trick is worth repeating.

**Not done, and why — read before assuming these were skipped:**
- **The owner referred to an attached screenshot for the header design. No image
  came through.** Everything implemented is from the written spec
  (`grid-template-areas`, 16px radius, `linear-gradient` hover, `#F4F5F7`, soft
  shadow). "Persis kayak gambar" is unverifiable until the image arrives.
- Where the 16px radius belongs was a judgement call: it is on the chips, not on
  the header bar, because a 16px radius on a full-bleed bar rounds its corners
  against the screen edge. If the screenshot shows a floating inset header
  instead, that is a small change to `.area-header`.
- The rails have no content. They are wired (`railLeft` / `railRight` props) and
  measured, but nothing passes them yet, so in the real app the grid currently
  renders as the same header/main/footer stack as before.
### Core Web Vitals — measured 2026-08-06, and the answer is "leave it alone"

Landing page, **production build** (`npm start`), service worker cleared first so
it could not serve a stale bundle:

```
TTFB 41ms · DOMContentLoaded 78ms · load 189ms
LCP  248ms  (element: the <h1>, i.e. text — not an image)
CLS  0
long tasks (>50ms): none
transfer 680KB = 483KB script (8 chunks) + 197KB css/fonts
```

All three vitals are inside "Good" with two orders of magnitude of headroom.
**There is no Core Web Vitals problem on this page**, and time spent optimising
it is time not spent on something that matters. Specifically already correct:

- Fonts are `next/font/google`, self-hosted, `display: swap`, latin subset,
  weights pinned. That is why CLS is 0 — Next generates the fallback metric
  overrides automatically. Do not "optimise" this; it is already the fix.
- `framer-motion` is imported only by `PipelineBoard` and the topup page, so it
  is code-split away from the landing page. Confirmed by grep, not assumed.

Caveats before anyone quotes those numbers: localhost has no network, so TTFB
and transfer time are not what an Indonesian phone on 4G sees. The figure that
would still bite there is the 680KB, and the honest lever on that is Next/React
baseline, not anything this repo is doing wrong.

**The real perceived-speed problem is not page load, it is generation.** §7
records the measurement: Gemini returns one burst at ~5.8s, it does not stream
incrementally at these sizes. DESIGN.md §5 calls perceived speed the most
important decision in the product. A user waiting 6 seconds for ideas will not
notice 200ms of LCP either way. If someone is told to "make it faster", that is
where to look.

**Not attempted, deliberately:** Speculation Rules prerendering (the skill's
main remaining suggestion). A naive `href_matches: "/*"` would prerender
`/auth/signout` on hover, which signs the user out. It needs an explicit
allowlist of safe destinations, and that is a change worth doing carefully
rather than in passing.

**Done and verified (earlier sessions):**
- Contrast + type: 0 nodes below 4.5:1 across 13 routes × 2 themes, smallest
  rendered text 12px, all sizes now `rem`.
- Tutorial sheet portalled; version-aware refresh in both shells; top-up page has
  a back link and follows the theme.
- Admin top-up queue (PostgREST embed bug); pending-count badges.
- Top-up integrity: server-side pricing, one open request, duplicate-image hash,
  vision proof check, orphan cleanup.
- Admin actions that used to fail silently: approve/reject topup, injectCredits,
  createVoucher, ban/unban, redeemVoucher (+ expiry), referrals.
- iOS: `viewport-fit=cover`, theme-aware `theme-color` and `color-scheme`.
- Admin assistant at `/admin/asisten`.
- Prompts: new `CRAFT_RULES` (structure, not a banned-word list).
- Theme/text boot scripts (§5); mobile header fits at 320px; save-to-pipeline for
  Hook/Script/Repurpose.
- Per-user isolation audited: queries filter `user_id` **and** RLS enforces
  `user_id = auth.uid()` on `creator_dna` and `generations`.
- Generation progress figure (elapsed-time based; see below for why not stream
  based), inline rating in every module, the first soft-sell moments, and
  `PLATFORM_MECHANICS` in the prompts.
- Modules (Hook/Script/Repurpose/Ide/Idea) switch **client-side** via
  `StudioPanel` — no navigation, no server round trip. Do not turn them back
  into links; that was the multi-second delay and the double-tap.
- Service worker: no interception except navigations, cache-first for
  `/_next/static`, cache name `malesan-v2`.
- **Gemini does not stream incrementally at these sizes.** Measured against the
  upstream endpoint: 3 SSE frames, first and last both at 5.82s — one burst at
  the end. Any future UI that assumes token-by-token arrival is building on
  something that is not there.

**Not verified:**
- Real iPhone rendering (no device available). The fix is correct in code; it
  needs eyes on hardware.
- The "new build waiting" branch of the PWA refresh — needs two real deploys.
- OpenAI/Anthropic adapters have never been called with real keys.

---

## 8. Still owed to the owner

Most of the previous list shipped in `c490d5e`. What is genuinely left:

### 8.1 External research for the prompts — BLOCKED, NOT SKIPPED
The owner asked for 2026 playbooks on SEO, social media, marketing and content
creation to be found, distilled and applied. **`WebSearch` and `WebFetch` both
fail in this environment** with `There's an issue with the selected model
(all_combo)`. Not a permissions problem, not a query problem — the tools error
before returning anything.

What was done instead: `PLATFORM_MECHANICS` in `src/lib/prompts/index.ts`
encodes durable, non-expiring mechanics (arrival without intent, the three
drop-off points, loops over likes, comments needing a deliberate gap, muted
first views, TikTok/IG as search surfaces, captions read half, hashtags as
labels, never invent a statistic). Deliberately no dated figures — a prompt that
hardcodes "post at 19:00" is wrong within a quarter and nobody notices.

**Retry the web tools in a later session.** If they work, the gap to fill is
current per-platform specifics, not craft.

### 8.2 Watch the header height on small phones
The phone header is two rows now (~108px): the bar, plus a strip of three named
chips. That is the cost of the controls being discoverable at all, and it was a
deliberate trade after the "⋯" menu failed. If it ever needs to come back down,
the honest lever is dropping a chip — not re-hiding all three.

### 8.3 Real-device Safari pass
`useLinkStatus` on the module tiles and `cursor-pointer` on the two overlay
backdrops address the most likely cause of "harus klik 2 kali" (a slow
navigation with no feedback, plus Safari's rule about which divs may receive
clicks). **Unconfirmed on hardware.** Also still unverified on a real iPhone:
safe-area insets and the light theme.

### 8.4 Watch whether the offer converts
`CreditNudge.tsx` is the first time this product has ever asked for money. Two
moments only — after a rated-good result (suppressed above 120 credits, once per
session) and before the balance runs out. There is no analytics on it. Before
tuning the copy or the thresholds, get numbers: how many people see it, how many
tap through, how many pay. Guessing at conversion copy without that is how the
next three sessions get wasted.

### 8.5 Rating volume
The control now sits under every result and a rating was verified landing
(5 → 6 of 21). Check again after real usage: if the share of rated generations
is still low, the problem is placement, not mechanism — the loop itself is
proven.

### 8.6 Admin UI for `credit_packs`
The table exists and the top-up page reads it, but prices can only be changed in
SQL. The owner has said the pricing is a guess; he cannot test a different price
without an agent.

## 9. How to A/B a prompt change without spending the owner's credits

Node 24 runs TypeScript directly. Copy the prompt module, strip
`import "server-only"` and the `CreatorDna` type import, then call Gemini:

```bash
node --experimental-strip-types ab.mjs <prompt-module.ts> run "$GEMINI_API_KEY_1" "$GEMINI_MODEL_PRO"
```

Shape of `ab.mjs`: import the prompt module, define a fixed sample DNA + trends +
ratings, build the prompt, POST to `generateContent` with that module's
`responseSchema`, print the result. **Always compare before/after on identical
input.**

What to look for when judging output: is there a checkable detail (number,
brand, year); do the items differ in shape or only in topic; do all the
explanations share one sentence frame.

---

## 9a. Session of 2026-08-07 — the upgrade pass

The owner approved seven items (idle animation + easter egg, better progress
bar, super-admin, more user-dashboard features, a mascot, an ambient background,
"best in the world"). A parallel survey of the repo found **three were already
mostly built**, which changed the plan from "make" to "connect".

**Shipped and verified:**

- **The /app crash is fixed** — see the `05b6298` commit message. Root cause was
  the theme toggle deleting React-owned `<meta>` nodes. It was introduced in
  `c61d684` (an earlier session), not by this work, and had been live in
  production. Six toggles now leave React's two metas attached; console clean.
- **Credits update without a reload.** `LiveRefresh` on `profiles` in the `home`
  slot of `app/page.tsx`. The page is a server component, so `router.refresh()`
  recomputes the balance with no client state to keep in sync.
- **The top-up screen closes its own loop** — watches `topups`, flips "lagi
  di-review" to approved/rejected. Uses the `onChange` variant because that page
  is a client component; `router.refresh()` there would toast and change nothing.
  Mounted only while a verdict is pending.
- **The mascot is out of `GenerationProgress`** and is now the dashboard
  centrepiece via `MascotStage` + a `center` slot on `AmbientIdle`. Tap it three
  times and it complains. `AmbientIdle` stays a server component on purpose —
  404, admin and top-up use the rings and should not ship a tap handler.
- **`StreamingText` rewritten.** It was a real defect, not polish: reveal time
  scaled with text length (600 chars = 9s of typewriter after the model already
  took 13-20s). Now one rAF loop over a fixed 800ms.

**Verified against the live database, not assumed:** `supabase_realtime`
publishes exactly `error_log`, `generations`, `profiles`, `topups`.
`pipeline_cards` is **not** published — anything realtime on the board needs a
publication change first.

**Corrections to that survey, checked live — do not spend on these:**
- `error_log` is **not** leaking. RLS is on, `error_log admin read` exists, and
  realtime enforces RLS.
- `DECISIONS.md` has 515 NUL bytes and `file` calls it `data`, but ripgrep and
  grep both read it fine (39 hits for "2026"). Cosmetic, not an emergency.
- The `app_config` blanket grants are the Supabase default on **all 17 tables**,
  not an `app_config` bug. A project-wide revoke would break PostgREST. Revoking
  on `app_config` alone is safe (only the service-role client reads it).

**Second batch, same session — also shipped and verified:**

- **Mascot reacts on the first tap** (owner changed the spec from three). Added a
  lead-in line so the escalation still has room. Verified: one tap speaks.
- **Ambient background field.** `AmbientField` — three low-alpha ember blobs
  behind the dashboard at z-0, `pointer-events-none`, under a z-10 content
  wrapper. Server component, CSS-only. Verified live: hit-test at a tile centre
  returns the tile, never a blob, and reduced-motion kills the drift with
  `animation: none` rather than the global block's jam-on-a-frame.
- **Dashboard notice — the super-admin's live frontend edit.** One `app_config`
  key (`dashboard_notice`, seeded by migration 00016), read on the dashboard's
  server pass, editable in the admin config panel. Empty hides it. `TextRow`
  gained `allowEmpty` (off by default so a model id / bank number can't be
  blanked). Verified the whole loop against the live DB: set → banner shows,
  blank → banner gone.

**Deliberately NOT done — the reveal for the long modules.** Plan item 5 wanted
Script (20s) and Vibe (45s) to reveal like the idea cards. They don't render
free prose — Script is structured scenes (`ScriptView`), Vibe is structured docs
(`VibeCodingStudio`) — so a character-by-character reveal is the wrong tool and
would fight the layout. Wrapping only the small hook/repurpose text is marginal
polish that costs credits to test. Left as a proposal, not built speculatively.
The `StreamingText` fix (idea cards) already landed and is the high-value part.

**Still open, in plan order:** the super-admin surface can grow (it now does
model / cost / module switches / payment / provider / notice), and §9b's user
features (P1 rating-loop especially) remain proposals awaiting a yes.

**Two schema facts that break naive estimates:** `posted_at` /
`status_changed_at` exist nowhere, so a "posting streak" needs a migration.
`is_favorite` exists in the schema with **zero** application code — a free
feature already paid for.

**A trap worth knowing:** the mascot is deliberately **not** favicon material.
It is ten-odd shapes and a 10px visor; at 16px it becomes a smudge. `LogoMark`
is three circles and an arc precisely so it survives that size.

---

## 9c. Session of 2026-08-07 (batch 3) — the "make it feel alive" pass

Owner wanted the app to look alive/premium and kept reporting "nothing changed".
Two root causes, both fixed, both worth not rediscovering:

- **The stale-service-worker trap bit again, now fixed at the source.**
  `public/sw.js` cached `/_next/static/` cache-first with no revalidation —
  correct in production (hashed filenames), WRONG in dev: Turbopack serves those
  URLs with changing bytes, so every edit showed stale JS/CSS, and fresh server
  HTML against a stale client bundle surfaced as a **hydration mismatch** (an
  `area-nav` className diff). Fix: the `/_next/static/` handler returns early
  (no intercept) when `self.location.hostname` is `localhost`/`127.0.0.1`;
  production keeps cache-first. A one-time SW clear was needed to load the new
  worker. This is the permanent fix for the recurring "I edited it and the
  browser shows the old thing" in dev.
- **AmbientField was trapped in the centred column** behind opaque cards, so the
  black margins the owner actually looked at stayed black. Moved to `AppShell`
  as a full-bleed layer: `.magazine` is now `relative`, `.ambient-field` is
  `position: fixed` `inset:0 z-0`, and `area-nav`/`area-main` carry `z-20`/`z-10`
  so chrome paints above it. Removed the per-page AmbientField + its import so it
  is not double-mounted. Every app tab now sits in warmth.

Shipped this pass — all CSS/SVG, compositor-only, reduced-motion honored,
`tsc --noEmit` clean. **NOT yet `next build`, NOT committed, NOT screenshotted by
the agent.** Owner verifies on localhost (cannot reach it from a phone):
- **Haptic on every button.** `HAPTIC_SCRIPT` in `boot-scripts.ts`, inlined in
  `layout.tsx` head. Delegated `pointerdown` → `navigator.vibrate(8)`. Android
  Chrome only (iOS/desktop have no web vibration API). Opt out `data-haptic="off"`.
- **Idle mascot life.** `.mascot-idle-body/led/eyes` (globals.css), wired in
  `Mascot.tsx` for `face==="idle"`: breathing float, antenna pulse, blink.
- **Ambient upgraded + motion boosted.** Blobs wander over 5 waypoints with an
  opacity breath; added `.ambient-field__orbit` depth layer (off-centre spot,
  unidirectional rotate). After "kurang agresif", travel/scale up and durations
  shortened (a 38s / b 46s / c 30s / orbit 90s). Orbit is a 4th blurred layer —
  first thing to drop if a low-end phone janks.
- **Two light-theme bugs, same class: a token that flips value between themes,
  used where the dark value was assumed.**
  - Ambient in `[data-theme="soft"]` painted with `--color-ember`, a dark brown
    (#833a0f) in light → mud on cream. Overridden to fixed light-peach tints at
    low alpha (unlayered rule beats the `@layer utilities` base).
  - **Mascot colours** did the same: visor used `--color-obsidian` (flips to
    cream) and every accent used `--color-ember` (flips to brown). Now hardcoded
    — visor `#0d0b08`, all glow `#ff8a3d` — so it is a dark-screened,
    orange-glowing device in BOTH themes. Head/body stay `--color-surface-raised`.

Still open after this pass:
- **"Not premium / not 3D".** A deliberate design pass, not done. Do it with a
  throwaway screenshot harness (see §7's shellcheck trick) so it is iterated with
  eyes, not blind — the agent has guessed wrong on appearance more than once.
- **"Features feel empty".** The answer is §9b below: **P1 (rating loop)** is the
  highest-value, lowest-cost, half-built option and is the recommended next build.

A cross-session second brain now also lives in an Obsidian vault at
`C:\Users\Administrator\Documents\Claude` (Home.md is the index). It is a
summary layer; this HANDOFF stays canonical.

## 9d. Session of 2026-08-08 — the workflow-engine pass

The owner asked for seven feature areas end-to-end — database, backend and UI —
and explicitly asked not to be stopped for confirmation. Everything below is
built, `next build` passes (33 routes, up from 30), `tsc --noEmit` is clean.

**Read §9d.4 before believing any of it is finished.** Almost none of it has been
seen running in a browser.

### 9d.1 Foundation — written in one head, on purpose

Migrations `00017_workflow_engine` and `00018_lock_down_system_functions` are
APPLIED to the live database. Full detail is in SCHEMA.md §10; the parts that
will bite someone:

- `personas` enforces one default per user with a **partial unique index**, not a
  trigger. A server action that sets a new default must clear the old one first
  or the write fails on the constraint. `setDefaultPersona` does this correctly.
- `pipeline_cards.sort_order` defaults to **0 for every pre-existing row**, so the
  board must order by `(sort_order, created_at)` or old cards all tie and shuffle.
- `record_gemini_usage` was **dropped and recreated** with six parameters. Its old
  signature already carried defaults, so appending two more would have made every
  existing four-argument call ambiguous rather than overloaded.
- `drafts.pipeline_card_id` is `ON DELETE SET NULL`, not cascade. Deleting a card
  must never take the user's prose with it.

`src/lib/prompts/index.ts` gained one exported `PromptExtras` bag — shadow
prompt, reference material, persona, CTA — threaded as a trailing optional
argument through every builder and injected in exactly one place
(`buildSharedContext`, last before the JSON contract). Reference text is fenced
in `<<<REFERENSI … REFERENSI>>>` and explicitly labelled as data, not orders,
because the entire feature is "paste something you found on the internet".

### 9d.2 A real security hole, found by the linter and fixed

Four `SECURITY DEFINER` functions were callable over PostgREST by `anon` and
`authenticated`: `admin_user_activity`, `gemini_pool_report_today`,
`rls_auto_enable`, and the **legacy `refund_credits(uuid, integer, text)`** — which
hands back credits on a heuristic ("assume the loss came from free up to a
ceiling of 10") rather than by reversing recorded spend rows, so it can grant
credits that were never taken. All four are called from server code with the
service-role client only. Each does carry an internal `auth.role()` guard, which
is why this mattered rather than why it did not — SCHEMA.md §7 records two live
bugs in this repo where exactly such a guard silently did nothing.

**The first revoke failed silently and reported success.** `REVOKE EXECUTE … FROM
anon, authenticated` changed nothing, because the grant was to `PUBLIC`, which
both roles inherit and which a per-role revoke does not touch. It was caught only
by running `has_function_privilege()` for each role afterwards instead of
trusting the statement. Migration 00018 revokes from `PUBLIC` and grants back
`service_role`. Verified per role, per function; the results are in the migration.

`is_admin()` is deliberately still executable by `authenticated`: RLS policies
call it, and a function invoked inside a policy runs as the caller.

### 9d.3 Features — what exists now

| Area | State |
|---|---|
| Shadow prompt (admin) | Textarea on `/admin/config`, `shadow_prompt` in app_config, injected into `/api/generate`, `/api/autocomplete` **and `/api/vibe`** |
| Token pricing (admin) | `price_in_per_mtok` / `price_out_per_mtok`, feeding the profit panel |
| Profit dashboard | `ProfitPanel` on `/admin/stats` — revenue vs estimated model cost vs credits burned, 14 days |
| Reference engine | Collapsible "Otak Kedua" field on the module runners; sent as `input.reference` |
| Persona picker | Dropdown on the module runners; sent as `input.persona_id` |
| Persona CRUD + CTA | `PersonaManager` + `CtaSettings` on `/app/profile` |
| Kanban + AI tagging | `PipelineBoard` drag/reorder + realtime; `POST /api/pipeline/schedule` writes `schedule_label` |
| Clip / Thread engines | `ClipEngine` / `ThreadEngine`, registered in `StudioPanel`, modules `clip` / `thread` |
| Draft editor | `/app/draft` + `DraftEditor` (autosave, Tab-to-complete) + `POST /api/autocomplete` |

**Zero-cost modules skip `spend_credits` entirely.** `cost_autocomplete` and
`cost_schedule_tag` seed to 0, and both routes treat 0 as "free, do not call the
spend function" rather than "spend zero" — a zero-credit ledger row records a
movement that did not happen and stops the ledger reconciling. Both routes were
read and confirmed to do this.

**Three things shipped orphaned and were wired by hand afterwards.** The agent
that wrote `PersonaManager` never touched the profile page, `/app/draft` had no
link pointing at it from anywhere, and the dashboard did not pass `clip`/`thread`
costs to `StudioPanel`, so an admin price change would have moved the charge
without moving the number on the tile. All three are fixed. It is the same
failure mode as Hook Lab and Script once had: built, working, unreachable.
**When a feature lands, grep for an import of it before calling it done.**

### 9d.4 NOT verified — read this before trusting §9d.3

- **Nothing has been rendered in a browser.** `next build` passing is not the same
  as a working screen, and this pass added nine new UI surfaces.
- The multi-agent run **hit the account's session limit**: 4 of 10 agents finished,
  6 died mid-flight. The dead ones had already written their files, which is why
  the features exist — but **two review passes never ran at all**
  (`niche-engines`, `admin-profit`), and four features were never reviewed by
  anything except the typechecker and a targeted manual audit of their credit,
  auth and scoping paths (which they passed).
- **Kanban drag on a real touchscreen is unproven.** So is Tab-to-complete's
  interaction with keyboard focus.
- The profit dashboard's cost figures have **never been checked against a real
  Gemini bill**, and `input_tokens`/`output_tokens` are zero for every row written
  before this migration — the panel excludes those days rather than drawing them
  as free, but nobody has watched a fresh row get written with a real split.
- The two niche engines have **never been run against the live model**. Their
  prompts and schemas are untested against actual output.

### 9d.5 Still open

- The legacy `refund_credits(uuid, integer, text)` is revoked but **not dropped**.
  Removing a function from a live money system deserves its own change.
- `cost_autocomplete` and `cost_schedule_tag` exist in the database with **no UI**.
  They are free right now, which is fine, but the owner cannot price them.
- "Premium / 3D" visual pass — still not done, still needs a screenshot harness so
  it is iterated with eyes rather than guessed at.
- P1 (the rating loop) from §9b is now **partly obsolete**: `learned` notes already
  feed every prompt. What remains unbuilt is surfacing that back to the user.

## 9e. Session of 2026-08-08 (b) — video Auto-CC (word-level burned-in captions)

Upload a video, AI writes per-word captions, style them, export an .mp4 with the
text hardcoded in. `tsc` clean, `next build` passes (34 routes). **The entire
client half has NEVER run in a browser — see the honesty block.** COMMITTED but
deliberately NOT pushed; it cannot function until two keys are added.

### Architecture (why it is shaped this way)
Client-heavy on purpose so the server stays cheap: the video is decoded,
previewed and burned-in entirely in the browser (ffmpeg.wasm). The ONLY thing
that reaches the server is the extracted 16kHz-mono audio, in transit to Groq.
- `src/lib/transcribe.ts` — Groq Whisper (whisper-large-v3-turbo),
  `verbose_json` + `timestamp_granularities[]=word`. Server-only. Gemini is not
  used: it does not give reliable word-level timing.
- `src/app/api/video/transcribe/route.ts` — auth, soft credit pre-check on the
  client's claimed duration, then the authoritative `spend_credits` on the
  MODEL's reported duration (the client controls its number and this costs money).
- `src/lib/video/ffmpeg.ts` — one lazily-imported single-threaded ffmpeg.wasm
  instance. Single-threaded ON PURPOSE: the MT core needs SharedArrayBuffer →
  COOP/COEP on every response → breaks Google OAuth popups and Google avatar
  images app-wide. Do not switch to the MT core without scoping isolation to this
  route alone.
- `src/lib/video/captions.ts` — grouping + `activeAt()` (live preview) + `buildAss()`.
  The HTML overlay and the burned-in ASS read the SAME grouping, so preview and
  export cannot drift.
- `src/components/VideoEditor.tsx` — the UI. rAF-driven overlay (not the video's
  throttled `timeupdate`), safe-zone guides, style panel, indeterminate bar for
  transcription (one server call, no real %). Registered as Studio module `video`.

### Cost
`cost_video_per_min` in app_config (default 2), read by `getVideoCostPerMin()`.
Charged per minute because the driver is audio length, not request count. NO admin
UI row for it yet (like cost_autocomplete / cost_schedule_tag).

### BLOCKERS — it does nothing until these are done (owner action)
1. **A live Gemini API key was pasted in plain text in chat this session.** Treat
   it as burned: rotate it in Google Cloud Console. It was NEVER written to any
   file or commit. The new key goes in `.env.local` + Vercel as `GEMINI_API_KEY_4`
   — and only widens capacity if it is from a NEW GCP project (quota is per project).
2. **`GROQ_API_KEY` must be set** (free at console.groq.com/keys) in `.env.local`
   and Vercel, or every transcription returns 503 "Transkripsi belum aktif".

### NOT VERIFIED — do not trust any of this until run in a browser
- **ffmpeg.wasm has never loaded here.** Audio extraction, and especially the
  burn-in export, are unrun. The core is fetched from unpkg at runtime.
- **The `ass` burn-in filter needs libass IN THE CORE, and libass needs a FONT in
  the wasm FS.** The default `@ffmpeg/core` may have neither. If export fails with
  an "ass"/"No such filter" or a no-glyph result, the fix is a libass-enabled core
  plus a bundled .ttf written into the FS before the run — NOT a rewrite. This is
  the single most likely thing to not work first try.
- **Vercel Hobby caps a request body at ~4.5MB.** The route rejects >4MB audio;
  16kHz mono AAC keeps ~10 min under that, but this is unproven on a real upload.
  If longer clips are needed, upload audio to Supabase Storage and have the route
  fetch it, rather than raising the body limit.
- The transcript editor re-maps typo fixes by word index; changing the word COUNT
  keeps old timings. Deliberate v1 limitation, stated in its own hint.

### 9e-bis. Transcription keys wired + verified (2026-08-08)

- **Groq: 4 keys, from 4 accounts, rotated.** `src/lib/video/groq-keys.ts` mirrors
  the Gemini pool (`GROQ_API_KEY_1..10`, round-robin offset, 429 cooldown, cooling
  keys benched not dropped). `transcribe.ts` now rotates across them on 429/5xx.
  All four keys VERIFIED valid (200 on /models), and the transcriptions endpoint
  was VERIFIED end-to-end with a real 200 returning the exact
  `{duration, words:[{word,start,end}]}` shape the parser expects. This is real,
  not just build-passing.
- **xAI Grok → admin assistant brain, Gemini fallback.** `/api/admin/assistant`
  now calls `generateWithGrokFallback`: tries Grok (xAI is OpenAI-compatible, via
  the `custom` adapter + `https://api.x.ai/v1`) and drops to Gemini on ANY error.
  Deliberately isolated to admin — off the user money path. **The xAI team has NO
  credits** (verified: `grok-3`/`grok-4` exist but the API returns "team doesn't
  have any credits"), so today every Grok call fails and the assistant runs on
  Gemini. Add credits at console.x.ai and Grok takes over with no code change.
- **Keys are in `.env.local` (local dev) but NOT in Vercel.** There is no MCP tool
  to set Vercel env vars — verified. So in PRODUCTION the video transcription and
  the Grok path do nothing until the owner adds, in Vercel project env:
  `GROQ_API_KEY_1..4`, `XAI_API_KEY`, `XAI_MODEL=grok-3`, `GEMINI_API_KEY_4`.
  That dashboard step is the one thing genuinely outside agent access.
- Still unverified: the ffmpeg.wasm CLIENT half (audio extract + burn-in). Needs a
  browser + a real video — see the 9e honesty block above.

### 9f. Auto-CC burn-in rewritten; Grok removed (2026-08-08 c)

**Grok is gone.** Owner will never buy xAI credits. `/api/admin/assistant` is back
to Gemini-only (no generateWithGrokFallback); XAI_* removed from .env.example.
The 4 Gemini keys the owner supplied are in local `.env.local` as
GEMINI_API_KEY_1..4; a paste-ready Vercel file was sent (4 Gemini + 4 Groq).

**The export burn-in was a no-op and is fixed.** The ffmpeg `ass` filter silently
did nothing (the default @ffmpeg/core has no libass and no font), so the
downloaded mp4 was the untouched original — exactly what the owner reported.
Replaced with a CANVAS CAPTURE in `src/lib/video/export.ts`: every frame is
painted to a canvas with the caption drawn on top (browser text engine, so any
Google Font, any colour, per-word reveal), and MediaRecorder records it. The
pixels ARE the caption — it cannot no-op. mp4 straight from MediaRecorder when the
browser supports it (recent Chromium), else webm. ffmpeg.wasm is now only used for
audio extraction (which was already proven working in prod).

Other Auto-CC changes: per-word reveal (words appear as spoken, latest lit — both
preview and export share `activeAt` so they match); 8 heavy caption fonts from
Google Fonts (`CAPTION_FONTS` in captions.ts, loaded via a stylesheet link);
a `malesan.my.id` watermark burned bottom-right; branded download filename
("Auto Caption by malesan.my.id - ..."); a quality/bitrate control (compress);
device-neutral upload copy; Video Auto-CC promoted to a full-width dashboard tile.

`ffmpeg.ts:burnInSubtitles` and `captions.ts:buildAss` are now DEAD (the old
path). Left in place, unused; delete on the next cleanup pass.

**NOT verified by the agent in a browser** (real-time canvas capture needs a real
video + wall-clock). Owner should export one clip and confirm the file now shows
captions. Approach is sound — canvas capture physically cannot output the
original untouched — but the honest status is unproven-here.

### 9g. Auto-CC round 2 (2026-08-08 d) — mode, watermark option, real bitrate

- **Per-word vs per-sentence is now a choice.** `CaptionStyle.mode: "word" | "line"`.
  "word" shows one word at a time (bigger); "line" shows the whole line with the
  spoken word lit. Preview and `export.ts` share the logic. Default "word".
- **Watermark is now premium + optional.** `drawWatermark` in export.ts is a
  centred rounded pill (ember dot + wordmark in Anton), lifted above the crop.
  A "Hapus watermark" checkbox charges credits: `POST /api/video/no-watermark`
  spends `cost_no_watermark` (app_config, default 5, seeded migration 00020)
  before a clean export. Free export keeps the mark.
- **Bitrate presets are real and platform-labelled.** TikTok/Reels 12, YT Shorts
  16, Hemat 6 Mbps; fed straight to MediaRecorder `videoBitsPerSecond`. Default
  raised to 12 — the "burik" export was the old 6 Mbps VP8. The hint tells the
  owner sosmed re-compresses, so send high.
- Files: `src/lib/video/export.ts` (drawCaption mode + premium watermark + gate),
  `src/lib/video/captions.ts` (mode on the type), `src/components/VideoEditor.tsx`
  (mode toggle, watermark checkbox, bitrate presets), `src/lib/config.ts`
  (getVideoNoWatermarkCost), `src/app/api/video/no-watermark/route.ts`.

**Still NOT browser-verified by the agent** — export is real-time canvas capture
and needs a real video. Owner tests on prod after redeploy. Approach is sound
(canvas pixels cannot be the original). If a clip still reads per-sentence, check
that `style.mode` is "word" and that `groupLines` is not making lines too long.

**Owner's open asks not yet built:** trim/cut video, and any further editing
tools ("editing lainnya maximal"). Proposed, not started — pick one and say so.

**Env for prod (owner adds in Vercel, agent has no tool for it):** GEMINI_API_KEY_1..4
(the 4 new keys), GROQ_API_KEY_1..4. A paste-ready file was delivered. Grok/xAI is
GONE — do not reintroduce it.

### Correct first move next session
Add the Groq key locally, `npm run dev`, sign in via `/dev-masuk`, open Studio →
Video Auto-CC, and run one short real clip end to end. Fix what the browser shows.
Only then push.

### 9h. Auto-CC quality + admin sync + universal AGENTS.md (2026-08-08 e)

- **Export was grainy** because it captured at the source resolution — often a
  re-downloaded 144p clip. Now the canvas upscales so the short side is >=1080
  (captions especially become crisp), records via `captureStream(0)` +
  `requestFrame` (exact frames, not a timer sampling a half-drawn canvas), sets
  `imageSmoothingQuality="high"`, and floors the bitrate at ~0.3 bits/pixel so the
  codec cannot starve the text. Presets are real + platform-labelled: TikTok 12,
  YouTube 16, Hemat 6 Mbps.
- **Caption font-size slider** (`CaptionStyle.fontScale`). **Watermark** redrawn as
  a small elegant top-left pill with real padding off the corner; removing it is a
  clear "+N kredit" checkbox that charges via `/api/video/no-watermark` and
  confirms the deduction in the UI.
- **Admin config now shows Video Auto-CC** — its own price section
  (`cost_video_per_min`, `cost_no_watermark`, they use their own keys not
  `cost_<module>`), plus a kill switch the transcribe route honours through
  `isVideoEnabled()`. That was the reported "admin not synced with new features".
- **Onboarding for ANY agent:** a **root `AGENTS.md`** now exists. Codex/opencode/
  Cursor auto-read the ROOT AGENTS.md, and `.notes/AGENTS.md` is not at root (and
  `.notes/` is gitignored), so new agents were missing the entry point. Root
  AGENTS.md gives the read order (`.notes/AGENTS.md` -> this HANDOFF -> the vault)
  so no session ever has to audit the code to orient.
- **Still NOT browser-verified by the agent** (real-time canvas export needs a
  real video). Owner tests on prod after redeploy.
- **Prod env** still needs the owner to add `GEMINI_API_KEY_1..4` +
  `GROQ_API_KEY_1..4` in Vercel — no agent tool sets those. Grok stays removed.

### 9i. Auto-CC bug fixes + Groq LLM features + Smart Recycle (2026-08-08 f)

Owner reported 3 fatal Auto-CC bugs, then asked to wire Groq for instant text
features and Gemini for a recycle feature. `next build` passes (37 routes),
`tsc --noEmit` clean.

**The 3 bugs — fixed and verified as far as this environment allows:**

1. **Credit header stuck until reload.** The dashboard's `LiveRefresh` on
   `profiles` only fires on the realtime channel, which lags/misses. Now the
   client calls `router.refresh()` the instant a deduct API returns ok —
   `VideoEditor` after transcribe and after `/api/video/no-watermark`, and the
   new reaction/recycle components after their calls. Deterministic, on top of
   realtime, using the existing server-truth mechanism (no new credit context).
2. **1:00 video billed 4 credits, not 2.** Double `Math.ceil`: the client sent
   `Math.ceil(60.04)=61`s and the route did `Math.ceil(61/60)=2` min. Client now
   sends the raw duration; the route bills through one `billedMinutes(sec)` helper
   with a 1.5s grace so a nominal minute stays a minute (`ceil((sec-1.5)/60)`,
   min 1). Boundary table proven with a node assert: 60→2, 60.2→2, 90→4, 120→4,
   122→6 cr. Used for BOTH the soft pre-check and the real charge, so they agree.
3. **Export patah/laggy/stuck (esp. the 16 Mbps preset).** Root cause of the
   *stuck* was `video.play()` being rejected (the element was not muted, and the
   awaits before `play()` break the click's user-activation) → it then awaited an
   `"ended"` that never came, forever. Fixes in `src/lib/video/export.ts`:
   `video.muted = true` (audio is still captured from `captureStream` regardless);
   `play()` rejection now throws a clear error instead of hanging; and drawing is
   driven by `requestVideoFrameCallback` (one canvas frame per *decoded* video
   frame, on the media clock the audio rides) instead of rAF at 60Hz — that
   preserves the source FPS and kills both the choppiness on 30fps clips and the
   A/V drift. rAF is the fallback where rVFC is absent (older Safari).

   **Veto exercised (AGENTS.md authority rule):** the owner asked to switch export
   to `ffmpeg.wasm -c:v libx264 -preset ultrafast`. Did NOT. Export already left
   ffmpeg (§9f — the `ass` filter was a no-op); a frame-by-frame ffmpeg.wasm
   encode would be far slower and more likely to OOM/stall on a phone (the exact
   "stuck" reported). The real freeze was the unmuted-autoplay hang, now fixed.
   ffmpeg.wasm stays for audio extraction only.

**Mobile export crash ("Aw Snap" / OOM) — fixed the same file.** On a phone the
export tab crashed on download. Root cause was memory, not the device: the sink
kept every encoded chunk in a JS array AND `rec.start()` had no timeslice, so
MediaRecorder buffered the whole file internally until `stop()` and the heap
briefly held the video twice — hundreds of MB. Fix in `export.ts`, NO quality
touched (same canvas, same bitrate, per the owner's hard rule): (1) `rec.start(1000)`
timeslice flushes ~every second so the recorder never holds the whole file;
(2) `makeSink()` streams each chunk straight to an **OPFS** file on disk
(`malesan-export.tmp`, overwritten each run) and `getFile()` hands back a
disk-backed File for the download, so the encoded video never sits on the heap —
degrades to the old in-memory array only where OPFS is absent; (3) a `release()`
that stops the stream tracks, wipes `video.src` + `load()`, and 0×0's the canvas so
nothing leaks across repeated exports. **Verified in a real browser** (not just a
build): OPFS write→disk→read-back round-trips 10MB with a valid download URL. The
full real-time export still needs a real video + wall-clock to eyeball, but the
OOM mechanism is proven and no quality was reduced.

**New infra — Groq now does text, not just Whisper.** `src/lib/groq/llm.ts`
(`groqChat`) reuses the SAME pool + rotation + 429 cooldown as the Whisper path
(`video/groq-keys.ts`) — round-robin + circuit breaker, shared not reimplemented.
Model in env `GROQ_LLM_MODEL` (default `llama-3.3-70b-versatile`). Part 2 of the
ask (dual round-robin + fallback) was ALREADY DONE for both providers — Gemini
`client.ts:withRotation` and Groq — so it was verified, not rebuilt.

**New features (all charge via `spend_credits`, refund on model failure):**

| Feature | Provider | Route | UI | Cost key (default) |
|---|---|---|---|---|
| Simulasi Netizen (5 persona comments, JSON) | Groq Llama | `POST /api/react` kind=netizen | `DraftReactions` in `DraftEditor` | `cost_netizen` (1) |
| Roast My Script (galak editor) | Groq Llama | `POST /api/react` kind=roast | same | `cost_roast` (1) |
| Smart Content Recycle (3 fresh angles) | Gemini pro | `POST /api/recycle` | `RecycleBanner` on dashboard | `cost_recycle` (2) |

- Recycle surfaces `pipeline_cards` with `status='posted'` and `created_at` >30d,
  derived from the pipeline read already in flight on the dashboard — no extra
  query. `created_at` is the proxy for posting age (no `posted_at` column yet).
- All existing text gen stays on Gemini (unchanged) — part 4's second half.

**Verified:** `next build`, `tsc --noEmit`, node assert on the pricing table, and
the two new UI components rendered on a throwaway `/uicheck` page (deleted) — both
mount without crashing and their computed colours flip correctly dark↔soft (ink
245,240,234→61,54,48; card bg transparent→cream), so Dark & Bright both hold.

**NOT verified (same limits as every prior video session):**
- The authenticated AI calls were NOT run end-to-end here — `/api/react` and
  `/api/recycle` need a signed-in session (OAuth, which an agent cannot complete;
  `/dev-masuk` needs a secret not to be extracted). Build + logic + shared-client
  reuse are the evidence; a real Groq/Gemini round trip through these two routes
  is unproven in this session. Owner should click both in the draft editor and
  the dashboard once locally/on prod.
- The Auto-CC export fix is real-time canvas capture — still needs a real video +
  wall-clock to eyeball; the freeze root-cause (unmuted autoplay) is definite.

**Env for prod (owner adds in Vercel — no agent tool sets these):** unchanged
list `GEMINI_API_KEY_1..4`, `GROQ_API_KEY_1..4`, plus optional `GROQ_LLM_MODEL`
if the default Llama id is ever deprecated. The Groq keys already power both
Whisper and the new Llama features — no new keys needed.

**Pricing debt (same pattern as `cost_video_per_min` at first):** `cost_netizen`,
`cost_roast`, `cost_recycle` live in code/app_config with defaults but have NO
admin-panel row yet, so the owner can only retune them via SQL/config for now.
Add rows to `/admin/config` next to the video prices on the next admin pass.

### 9j. Video export rewritten: deterministic frame-by-frame (2026-08-09) — READ THIS FIRST IF YOU TOUCH VIDEO

This is the newest work and it replaced the export engine outright. **Everything
in §9e–§9i about `MediaRecorder` being the export path is now historical.**

#### The problem it fixed
After §9i stopped the OOM crash, the owner reported the exported file was
**choppy, the frame rate was destroyed, and the captions were out of sync with the
audio**. Root cause was the design, not a parameter: `MediaRecorder` recording a
canvas is a **real-time** capture. It plays the video and hopes the device can
paint and encode 30fps. When a phone cannot, frames are silently dropped **while
the audio clock keeps running** — so the output is choppy AND the captions slide
away from the speech. No bitrate or codec tuning can fix a design that races the
wall clock.

#### What it is now
`src/lib/video/encode.ts` — **WebCodecs, frame by frame, deterministic**:
1. `probeFps()` measures the source frame rate (plays ~0.7s, reads real
   presentation times off `requestVideoFrameCallback`, medians the gaps, snaps to
   a real-world rate). Assuming 30 was itself a defect: 24fps footage walked at 30
   duplicates frames, 60fps throws half away.
2. For frame `i`: **seek** the `<video>` to the exact time `i/fps`, wait for
   `seeked`, draw video + caption + watermark, wrap the canvas in a `VideoFrame`
   stamped with that **exact timestamp**, `VideoEncoder.encode()`, `frame.close()`.
   Nothing races anything; a slow phone just takes longer.
3. Audio is decoded once at its **own sample rate, no downmix or resample**
   (`decodeAudioData`), encoded to AAC 192k via `AudioEncoder`, muxed on its own
   true timeline. **Sync is correct by construction**, not by luck.
4. Muxed with **`mp4-muxer`** (new dependency, v5.2.2, zero deps of its own) via
   `FileSystemWritableFileStreamTarget` — the MP4 is written **straight into an
   OPFS file on disk**, so the encoded video never lands on the JS heap. This is
   what keeps the §9i OOM fix intact at a much higher bitrate.

`src/lib/video/draw.ts` is new: `drawFrame` / `drawCaption` / `drawWatermark` /
`frameSize` / `bitrateFor`, shared by BOTH export paths so they cannot diverge.

`src/lib/video/export.ts` is now a thin orchestrator: WebCodecs when available,
otherwise the **old MediaRecorder path, kept deliberately** for Firefox and older
Safari (no WebCodecs). Only an `UnsupportedEncoder` throw falls back — a mid-render
failure is reported, because silently restarting on the slow path would look like a
hang and produce the very file this replaced.

#### Quality rules that are load-bearing — do not "optimise" these away
The owner's explicit, repeated instruction: **never downscale, never compress
harder to fix a performance problem.** `frameSize()` never reduces a source; it
only upscales a small one so the short side reaches 1080 (captions are drawn at
output size, so this is what keeps text crisp). `bitrateFor()` is the user's own
preset with a ~0.3 bits/pixel floor. H.264 profile is picked best-first
(`avc1.640034` High → Main → Baseline) via `isConfigSupported`.

#### The blocking overlay (`src/components/ExportOverlay.tsx`)
Frame-by-frame is slower than real time, so the UI must say so. Full-screen,
portalled to `<body>` (an ancestor with `backdrop-filter` becomes the containing
block for `position: fixed` — §4), blocks pointer + keyboard, locks body scroll,
`beforeunload` guard, and shows a **frame-accurate percentage** plus the current
stage. Spinner keyframes are at the end of `globals.css` and slow down rather than
stop under `prefers-reduced-motion` (a frozen spinner over a long render reads as
a hang).

#### VERIFIED IN A REAL BROWSER — with numbers
Not a build-passes claim. A throwaway `/enccheck` harness (deleted) generated a
real 2.00s source clip in-browser and ran the actual `exportFrameByFrame` on it:
```
ftyp: "ftypisom"      -> a real MP4
playable: 1080x1916, duration 2.00s   -> EXACTLY the source duration
src 640x1136 -> out 1080p             -> upscaled, nothing downscaled
stages: Nyiapin video / Nyiapin audio / Nge-render tiap frame
progress ended at 1.0, took 10.1s for 2s of video
```
The output duration matching the source exactly is the direct proof that **no
frames were dropped** — which is precisely the choppiness and drift being fixed.
Also verified separately: `avc1.640034` reports supported at 1080x1920 @12Mbps,
and the OPFS round-trip (write 10MB streamed, read back 10MB, valid download URL).

#### NOT verified — what the next agent should check first
- **Never run on a real phone, on a real user video, by an agent.** The owner must
  export one clip on his phone and confirm: smooth, in sync, and no crash. That is
  the one remaining unknown.
- **Long-clip audio memory.** `decodeAudioData` holds the whole PCM: ~230MB for a
  10-minute stereo 48kHz clip. Short-form (<3 min) is fine. If a long clip OOMs,
  the fix is to demux and copy the original AAC through untouched (needs an MP4
  demuxer such as mp4box.js) — **not** to downmix or resample, which the owner has
  forbidden.
- **Seek-based walking is slow** (~1 seek per frame). Acceptable per the owner
  ("jangan peduli berapa lama"), but if speed becomes a complaint the correct
  upgrade is `VideoDecoder` + a demuxer to pull frames sequentially, never going
  back to real-time capture.
- `fastStart: false` (index at end of file). Correct for a downloaded local file;
  only HTTP progressive streaming would care. Do not switch to `'in-memory'` —
  that buffers the whole MP4 on the heap and reintroduces the OOM.
- The Groq/Gemini features from §9i (`/api/react`, `/api/recycle`) still have not
  been exercised against a live model through their routes.

### 9k. Script/generate FUNCTION_INVOCATION_TIMEOUT on prod (2026-08-09 b)

Owner hit `FUNCTION_INVOCATION_TIMEOUT` (Vercel, sin1) generating a Script draft on
his phone. It was NOT a client bug: the serverless function exceeded its duration.

Root cause: `/api/generate` was capped at `maxDuration = 30` while every other
heavy Gemini route (vibe, recycle, transcribe, admin/assistant) was already 60.
Script is the heaviest prompt (~20s to generate), and at evening prime time the
free-tier quota is partially spent (§3), so 429s trigger the key backoff. The old
backoff was `[1,2,4,8]s` = **15s of pure sleeping** on top of the generation — so
script gen + backoff blew past 30s and Vercel hard-killed the function. A hard kill
skips the `catch` in the SSE stream, so **the credit was spent and never refunded**,
and Vercel's raw error text leaked into the app UI (what the owner saw).

Fixes (all in this commit):
- `/api/generate` and `/api/onboarding` `maxDuration` 30 -> **60** (Hobby's real
  cap; matches the other heavy routes).
- `BACKOFF_MS` in `src/lib/gemini/client.ts`: dropped the 8s round -> `[1,2,4]s`
  (7s max). On a 60s budget the 8s round risked pushing a retry into a hard
  timeout; failing a touch sooner but cleanly (with a refund) is better.
- `/api/generate` passes `signal: AbortSignal.timeout(52_000)` into
  `generateStream`, so a genuinely hung upstream request aborts ~8s before the
  60s kill — the `catch` runs, the credit is refunded, and the user gets a clean
  error instead of Vercel's timeout page.

NOT the fix, deliberately: did not shrink the prompt, trends, or learned-history
to speed it up — that would cut output quality. If timeouts persist at quota
exhaustion the honest levers are more Gemini keys from new GCP projects, or the
quota guard serving free users a clear "sibuk, coba lagi" before spending. Build
+ tsc + lint (14, the floor) all clean. Not reproduced locally — a timeout needs
real quota pressure — but the change is config + a standard abort deadline.

## 9b. PROPOSALS — awaiting the owner's yes/no (AGENTS.md §6)

The owner asked on 2026-08-06 for "fitur keren di dashboard user supaya jadi
nomer 1 di dunia". These are proposals, not work in progress. Nothing here is
built. Ranked by the only question that matters: **what can Malesan do that a
creator cannot get free from ChatGPT in thirty seconds?**

### P1 — Close the rating loop. Highest value, lowest cost, already half built.

`generations.performance_rating` is collected today and **read by nothing**. The
control shipped, ratings are landing, and every one of them is discarded.

Feed the user's own top-rated generations back into their prompt as few-shot
examples: *"hook yang dulu tembus di akun lo bentuknya kayak gini"*. A creator's
personal hit history is the one asset ChatGPT structurally cannot hold, and it
compounds — the product gets better the longer they stay, which is also the
retention argument.

Cost: one query in the prompt builder plus a block in `CRAFT_RULES`. Roughly
40–60 lines. No schema change; the column and the data exist.

Risk: with few ratings it will over-fit to two or three examples. Gate it behind
a minimum (say 5 rated generations) and fall back to today's behaviour below
that.

### P2 — "Kenapa ini bakal jalan" on every idea.

Each generated idea currently arrives as an assertion. Attach one line of
reasoning tied to the actual mechanic — which drop-off point it survives, why
the hook earns the second second. `PLATFORM_MECHANICS` already encodes these.

This is the difference between a tool that gives answers and one that teaches,
and taught users defend the subscription internally. It also makes a weak idea
visibly weak, which builds trust faster than a good idea does.

Cost: a field in the response schema and a paragraph in the prompt. ~20 lines.
Raises token spend per generation slightly — measure before shipping wide.

### P3 — Pipeline nudges: "3 ide nyangkut di Draft lima hari".

`pipeline_cards` has `status` and `created_at`. Nothing notices when a card
stops moving. A creator's real failure mode is not "no ideas", it is ideas that
never ship — and the product can already see that happening.

Cost: one query plus a card on the dashboard. ~50 lines. No schema change.
Deliberately not a notification system; a line on the dashboard is the whole
feature.

### P4 — Streak, but honest.

`profiles.last_refill_date` already trains a daily return. A streak counter on
*posted* cards — not logins — would reward the behaviour the product exists to
cause. A login streak rewards opening an app, which is vanity.

Cost: one derived query. ~30 lines. Only worth doing if P3 ships first; a streak
with nothing to be consistent about is decoration.

### Not proposed, and why

No gamification beyond P4, no social feed, no template marketplace. Each adds a
surface to maintain before the core loop — idea → posted — is proven to retain
anyone. §8.4 still applies: `CreditNudge` has no analytics, so nobody knows
whether the product converts at all yet. **Numbers before features.**

---

## 10. Blockers that need the human, not code

- **A GitHub personal access token is embedded in the git remote URL.** `git
  remote -v` prints it in full, so it lands in any pasted terminal output, any
  screen share and any agent transcript. It is a classic `ghp_` token, which
  carries whatever scopes it was created with — for this account that is at
  least full control of a repo that takes money. `.git/config` is not committed,
  so this is not public, but it is one careless paste away from being so.
  **Revoke it at github.com/settings/tokens and re-point the remote at the plain
  URL**, letting Git Credential Manager hold the credential:
  `git remote set-url origin https://github.com/vallendrino-vldr/Malesan.git`.
  Not done here — rotating someone's credential without asking would have
  broken pushing mid-session.
- **`GEMINI_API_KEY_3` is filled locally and PROBED WORKING (200), but it is not
  in Vercel yet.** Until it is added there, production still runs on two keys.
  And it only widens real capacity if the key came from a *third* Google Cloud
  project — quota is per project, not per key (§3). Whether it does is unknown;
  the owner has not said which project issued it.

  **Gemini API keys are now `AQ.`-prefixed, 53 characters — not `AIzaSy…`.**
  All three of this project's keys have that shape and all three return 200. A
  previous session refused the owner's key on the grounds that the format looked
  wrong, from memory, and was simply mistaken. Do not judge a credential's
  format from training data; probe it. The admin panel now has a button for
  exactly this.

- **Google sign-in on the deployment.** Historically landed on
  `http://localhost:3000/?code=...`. The code is correct — `GoogleSignInButton`
  sends `redirectTo: ${window.location.origin}/auth/callback`. Supabase falls
  back to its configured Site URL when the Vercel callback is not allow-listed.
  Fix in Supabase → Authentication → URL Configuration: Site URL =
  `https://malesan.my.id`; Redirect URLs must include
  `https://malesan.my.id/auth/callback` **and**
  `https://<project>-*.vercel.app/auth/callback` (preview deploys get a
  new hostname per commit), plus `http://localhost:3000/auth/callback`. Also
  Google Cloud Console → OAuth client → Authorized redirect URIs must list
  `https://<ref>.supabase.co/auth/v1/callback`.
- **Google consent screen is still in Testing** — only listed test users can sign
  in at all. Separate gate from the redirect problem.
- **Production domain is `malesan.my.id`** (bought on SumoPod, DNS pointed at
  Vercel, live 2026-08-07). This is now the canonical URL — update any doc or
  config still saying `malesan.vercel.app`. The OAuth allow-list above must use
  it. `layout.tsx` now sets `metadataBase: https://malesan.my.id` plus
  openGraph/twitter, and `src/app/opengraph-image.tsx` renders a 1200×630
  link-preview card via `next/og` (dark + ember, no font file on purpose).

**Provider-config trap (fixed 2026-08-07).** `/admin/config` (Otak AI) lets the
owner switch the AI provider to openai/anthropic/custom. If they do that WITHOUT
pasting a key for it (`ai_api_key` empty), `resolveProvider` used to fall through
to the Gemini key pool, and the OpenAI adapter then sent a Google `AQ.` key to
`api.openai.com` → the admin saw `"Incorrect API key"` wrongly labelled "Gemini
rejected", and a real Gemini key leaked into the OpenAI request. `client.ts` now
throws early when `provider !== "gemini"` and no key is set. The owner hit this
during the 503 workaround; `ai_provider` is back to `gemini` in app_config, so a
redeploy (fresh config cache) clears it.
- Credit pack pricing (15k/45k/100k) is still a guess, never validated.
- **Vercel Hobby is not licensed for commercial use.** Taking money on it is a
  terms problem, and this product takes money.

---

## 11. Known technical debt

- `src/app/actions/pipeline.ts` still has 2 `content: content as any` (~lines 17
  and 54) failing lint. Pre-existing, not a regression.
- `react-hooks/set-state-in-effect` in `ThemeToggle`, `TextScale`,
  `admin/topups/page.tsx`. Does not block the build.
- `react-hooks/purity` at `app/page.tsx:94` (`Date.now()` during render), used to
  compute the WIB date. Safe in a server component, but noted.
- Admin bottom nav is now 5 + "Lainnya". New tabs go into the overflow.
- `credit_packs` exists and the top-up page reads it, but the admin panel has no
  UI to change prices.

---

## 12. Commits worth reading from this session

```
5a183a1  header controls visible again, wordmark redesign, PWA latency
c490d5e  progress figure, inline rating, first soft-sell, platform mechanics
5afdd1b  theme/text boot scripts never ran; mobile header 175px too wide
1da4396  admin assistant
beaf8ab  CRAFT_RULES — rewrite of the craft layer in the prompts
c61d684  admin actions failing silently + iOS safe areas
c77de88  unreadable text, dialog trapped in header, top-up dead end, unchecked proofs
0ac8712  bright-mode colour clash, cramped desktop pipeline, text-size control
```

Read the commit messages. They explain **why**, not just **what**, and that is
usually cheaper than re-reading the code.
