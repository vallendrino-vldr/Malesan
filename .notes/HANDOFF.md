# HANDOFF — Malesan

**Read this whole file before touching anything.** Its only job is to let a new
session start working without re-auditing the repo, because re-auditing is
expensive and the owner pays per token.

Last updated: **2026-08-06**, after commit `31d240d`.
Canonical rules live in `AGENTS.md`. This file is state, history and traps.

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
Live at `malesan.vercel.app`. GitHub `vallendrino-vldr/Malesan` (now public).
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
- Core Web Vitals: only the `backdrop-blur` removal is real work. No Lighthouse
  run, no field data, no bundle analysis. Do not report this as done.

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
- **`GEMINI_API_KEY_3` is an empty slot.** The code reads it; there is no value
  in it. It also has to be added to Vercel's environment variables, or
  production keeps running on two keys. And it only widens real capacity if the
  key came from a *third* Google Cloud project — quota is per project, not per
  key (§3).

- **Google sign-in on the deployment.** Historically landed on
  `http://localhost:3000/?code=...`. The code is correct — `GoogleSignInButton`
  sends `redirectTo: ${window.location.origin}/auth/callback`. Supabase falls
  back to its configured Site URL when the Vercel callback is not allow-listed.
  Fix in Supabase → Authentication → URL Configuration: Site URL = the Vercel
  production URL; Redirect URLs must include `https://<prod>/auth/callback`
  **and** `https://<project>-*.vercel.app/auth/callback` (preview deploys get a
  new hostname per commit), plus `http://localhost:3000/auth/callback`. Also
  Google Cloud Console → OAuth client → Authorized redirect URIs must list
  `https://<ref>.supabase.co/auth/v1/callback`.
- **Google consent screen is still in Testing** — only listed test users can sign
  in at all. Separate gate from the redirect problem.
- `malesan.app` domain unconfirmed.
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
