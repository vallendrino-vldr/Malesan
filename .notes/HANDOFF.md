# HANDOFF — Malesan

**Read this whole file before touching anything.** Its only job is to let a new
session start working without re-auditing the repo, because re-auditing is
expensive and the owner pays per token.

Last updated: **2026-07-31**, after commit `5afdd1b`.
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
- **Gemini** through 2 keys with rotation + backoff.
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
SUPABASE_SERVICE_ROLE_KEY     GEMINI_API_KEY_1  GEMINI_API_KEY_2
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

## 7. Current state (2026-07-31)

**Done and verified:**
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

**Not verified:**
- Real iPhone rendering (no device available). The fix is correct in code; it
  needs eyes on hardware.
- The "new build waiting" branch of the PWA refresh — needs two real deploys.
- OpenAI/Anthropic adapters have never been called with real keys.

---

## 8. Still owed to the owner — requested, not finished

Ordered by impact on revenue. These are specs, not ideas.

### 8.1 Progress bar + animated mascot during generation
Generation currently shows only a "Lagi mikirin..." button, which reads as
frozen. Asked for: a real-time progress indicator plus an animated
humanoid/robot mascot visibly working through the actual stages.

Already available: `/api/generate` **is** already SSE and already emits text
chunks while streaming (`readSSE` in `src/lib/sse.ts`), so real progress can be
derived from tokens received rather than faked. `LavaLoader.tsx` and
`AmbientIdle.tsx` are existing animation references. Honest stage labels:
"Baca profil lo" → "Nyusun angle" → "Nulis" → "Ngerapiin". Respect
`prefers-reduced-motion`.

### 8.2 Deeper prompt research and upgrade
Owner's ask: find 2026 skills/playbooks on SEO, social media, marketing and
content creation; distil the best; adapt to Indonesian context; apply. The
premise is sound — a free model with a much better prompt can beat an expensive
model with a lazy one.

Present: `CRAFT_RULES` in `src/lib/prompts/index.ts` (structural rules, discard
your first answer, mandatory checkable detail, worked bad-vs-good example).
Missing: the external research, and real domain knowledge — per-platform
retention mechanics, proven hook taxonomies, caption structure, keyword research
for TikTok/YouTube search, posting timing. **The test harness already exists**
(§9). Do not change a prompt without an A/B.

### 8.3 Credit logic and monetisation
The thing that decides whether this makes money.

Today: daily free credits reset at 00:00 WIB, purchased credits never expire.
Packs 100/15k, 350/45k, 1000/100k IDR. **There is not a single soft-sell moment
anywhere in the product.** Nothing tells a user their credits are running low,
nothing offers at the moment they are happy with a result, and the top-up page is
only reachable if they go looking.

Worth thinking through (and discussing with the owner before building): when to
offer (after a good result, not when credits hit zero), how to show value (hours
saved), and tone — **anak-tongkrongan, polite, never pushy**. Never paywall work
already in progress.

### 8.4 Make ratings actually accumulate
The loop works: ratings land in `generations.performance_rating`, are read by
`buildLearned()`, and reach the prompt. Per-user isolation audited. The problem
is **volume**: only 5 of 19 generations are rated, because the control is buried
(only on "Posted" pipeline cards and in Riwayat). Rating needs to sit right after
the result appears, in every module.

### 8.5 Safari needing two taps — reported, root cause not found
Reported in Safari and in places on mobile. Some of it may already be gone with
the theme fix (§5) — a page that changes theme mid-load feels like a tap that
did not register. **Unconfirmed.** Next suspects: `:hover` states that need a
first tap on iOS, and `<Link>`s triggering a full RSC navigation across the
Pacific. Needs testing on real Safari.

---

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
5afdd1b  theme/text boot scripts never ran; mobile header 175px too wide
1da4396  admin assistant
beaf8ab  CRAFT_RULES — rewrite of the craft layer in the prompts
c61d684  admin actions failing silently + iOS safe areas
c77de88  unreadable text, dialog trapped in header, top-up dead end, unchecked proofs
0ac8712  bright-mode colour clash, cramped desktop pipeline, text-size control
```

Read the commit messages. They explain **why**, not just **what**, and that is
usually cheaper than re-reading the code.
