# DECISIONS — Malesan

**Append-only.** Never delete an entry, even when a decision is later reversed — record the
reversal as a **new** entry that references the old one. Future agents need to know what was
already tried and rejected.

Format: `## <date> — <decision>` followed by **Why** and, where relevant, **Cost / tradeoff**.

The entries below were made in the master specification before the first line of code. They
are recorded here so the reasoning survives the master prompt.

---

## 2026-07-28 — Google OAuth only; no email/password, no magic links

**Why:** anti-abuse. Email/password and magic links make account farming trivial; requiring a
Google account raises the cost of a throwaway account enough to matter, without adding
friction for real users (the market already lives on Google accounts).

**Cost:** loses users who refuse Google sign-in. Accepted.

---

## 2026-07-28 — Two credit buckets: `credits_free` resets, `credits_paid` never expires

**Why:** `credits_free` refills **to** a ceiling daily rather than accumulating. This prevents
hoarding and makes multi-account farming pointless — you cannot bank a week of free credits.
`credits_paid` never expires because expiring purchased goods is hostile.

**Spend order:** free first, then paid.

---

## 2026-07-28 — Signup bonus is deliberately small (5 credits)

**Why:** if signup granted a large bonus, farming accounts would be worth the effort. At 5
credits, with 10 free every day anyway, creating a second account costs more effort than
simply waiting.

**Consequence:** the *economy design* is the primary anti-abuse mechanism. Fingerprinting,
IP hashing and rate limits are the backstop, not the front line.

---

## 2026-07-28 — Credits spend only through an atomic `SECURITY DEFINER` SQL function

**Why:** a plain `UPDATE` from application code allows a double-spend under concurrent
requests. `spend_credits` takes `SELECT ... FOR UPDATE` on the profile row first, which
serialises the check-and-deduct.

**Consequence:** client code may never decrement credits. This is `AGENTS.md` rule 2 and is
tested explicitly at step 3.

---

## 2026-07-28 — Two Gemini API keys from two separate Google Cloud projects

**Why:** Gemini free-tier quota is enforced **per Google Cloud project, not per API key**.
Adding more keys inside one project buys no additional quota. Two projects genuinely doubles
the pool.

**Consequence:** key rotation logic must be project-aware, and adding a third key means
creating a third GCP project.

---

## 2026-07-28 — Quota guard at 20% pool remaining

**Why:** Gemini's daily quota resets at midnight Pacific ≈ **14:00 WIB**, not local midnight.
Indonesian prime time (19:00–23:00 WIB) therefore runs on a partially-consumed pool — the
worst possible alignment. Without a guard, free users would exhaust the pool and paying users
would hit failures.

**Rule:** below 20% remaining, serve paid and BYOK users only; show free users a clear message
with a top-up path.

---

## 2026-07-28 — BYOK (bring your own key) is a Phase 1 feature, not a later add-on

**Why:** two reasons. It removes the quota ceiling for power users at zero cost to us, and
free-tier prompts may be used by Google for model training — so "pakai key sendiri, data lo
aman" is a genuine selling point, not a workaround.

**Consequence:** the training-data fact must be stated honestly in the Terms of Service.

---

## 2026-07-28 — Plus Jakarta Sans as the body typeface

**Why:** it is Jakarta's own typeface, and this is an Indonesian product. The choice is
narrative, not just aesthetic — it signals the product was built for this market rather than
localised into it.

Paired with Archivo for display (industrial, engineered) and Geist Mono for data and system
labels.

---

## 2026-07-28 — Warm-tinted black, not blue-black

**Why:** the accent is amber (`#FF8A3D`). A cool blue-black under an amber accent reads as a
clash. The base (`#0B0A09`) is warm-tinted so the ember glow sits in the same temperature
family.

---

## 2026-07-28 — No heavy 3D / WebGL scenes

**Why:** they contradict the "fast and smooth" requirement, especially on the mid-range
Android devices most of the Indonesian market uses. Depth is achieved with layered shadows,
warm ambient glow, subtle parallax and CSS 3D transforms instead.

**Allowance:** at most one lightweight ambient WebGL accent, and only if it costs nothing
perceptible on mid-range Android.

---

## 2026-07-28 — Stream AI output token by token

**Why:** a four-second generation that streams feels instant; the same generation behind a
spinner feels broken. This does more for the "premium" feel than any visual effect.

**Consequence:** streaming is established at step 4, before any module depends on it —
retrofitting streaming later is painful.

---

## 2026-07-28 — One free generation before the Creator DNA form

**Why:** forcing a form before first value kills signups; skipping the form entirely makes
output generic. Showing value first and asking second solves both.

**Consequence:** every prompt must degrade gracefully when Creator DNA is empty.

---

## 2026-07-28 — Trend digest runs once per day for the whole platform, not per user

**Why:** cost and quota. A per-user trend call would multiply Gemini usage by the user count
for information that is identical for everyone. One call per day, results shared via the
`trends` table.

---

## 2026-07-28 — Accept that automated TikTok trend detection is not achievable on a free tier

**Why:** Google Trends reveals what people **search**, not which TikTok sounds are rising. The
TikTok API is paid, and scraping gets blocked. Pretending otherwise would ship a feature that
silently does not work.

**Compensating mechanism:** `generations.performance_rating` — as users rate what actually
performed after posting, the platform accumulates a private signal no competitor has. Surface
this aggregate in the trend context once there is enough volume.

**This is recorded as a known limitation in `PRD.md` §8 and `PROMPTS.md` §10.**

---

## 2026-07-28 — Fingerprint collisions are flagged, never auto-banned

**Why:** shared computers, offices, internet cafés and family devices are common in the target
market. Auto-banning on a shared fingerprint would punish legitimate users. Admin gets a flag
above two accounts per fingerprint and decides.

---

## 2026-07-28 — Referral credits land in `credits_paid`, and pay out only after first generation

**Why:** landing them in `credits_free` would delete them at the next daily reset, making the
reward worthless. Paying out only after the referee's **first generation** (not at signup)
means a farmed account has to do real work to be worth anything.

Same fingerprint on both sides → `voided`, neither side earns, logged. Cap: 10 credited
referrals per account.

---

## 2026-07-28 — `AGENTS.md` is canonical; `CLAUDE.md` is a one-line pointer

**Why:** the human switches between Claude Code, Antigravity and other IDEs when rate limits
hit. A single canonical file read by every agent avoids drift between per-IDE instruction
files.

---

## 2026-07-28 — Step 0 executed as specified: nine files, no application code

**Why:** the master prompt (§1, §14) requires the spec and handoff files to exist and be
accurate *before* any application code, because context windows run out and sessions die.
These files are the project's memory.

**What was created:** `AGENTS.md`, `CLAUDE.md`, `HANDOFF.md`, `DECISIONS.md`, `PRD.md`,
`SCHEMA.md`, `DESIGN.md`, `PROMPTS.md`, `ROADMAP.md`.

---

## 2026-07-28 — Malesan gets its own git repo at `Documents/malesan`

**Why:** the directory was already inside a repo whose root is the **user's entire home
folder**, with a remote pointing at `github.com/vallendrino-vldr/duitkita` — an unrelated
project — and no `.gitignore` anywhere. Committing Malesan into that repo would mix two
products into one history and would make deployment impossible: Vercel builds from a repo
root, and the repo root was `C:\Users\Administrator`.

**Cost / tradeoff:** nested repositories are mildly unusual, and the outer repo will see
`Documents/malesan` as an opaque directory. Accepted — the alternative is worse.

**Not done, deliberately:** the outer repo was left completely untouched. It belongs to
another project. Its missing `.gitignore` (with `.ssh/` and `.git-credentials` sitting
untracked next to a live remote) was reported to the human rather than silently "fixed".

---

## 2026-07-28 — Secrets are never pasted into chat and never written to the repo by an agent

**Why:** on this date the human shared a GitHub PAT and two Supabase admin credentials
(`sb_secret_` and the `service_role` JWT) in a chat message. Chat transcripts persist, so any
secret that passes through one must be treated as burned. The `service_role` key bypasses
every RLS policy in `SCHEMA.md` §4 — the entire authorisation model is void if it leaks.

**Rule adopted:**
- `.env.example` holds placeholders only and **is** committed.
- `.env.local` holds real values, is gitignored, and is filled in **by the human**, locally.
- An agent never needs a production secret to do its job. Steps 1–2 need none at all.
- GitHub auth goes through `gh auth login` or a credential helper — never a token in a file.

**Consequence:** those three credentials must be rotated. Tracked in `HANDOFF.md` BLOCKERS
until confirmed done.

**Reversed the same day, by the human:** they stated this is a deliberate working method so
an agent can operate autonomously — push to GitHub and administer Supabase without waiting
for a human to run each command. Their call, and it is recorded rather than argued. The
mechanical parts of the rule still stand because they cost nothing: `.env.local` stays
gitignored, `.env.example` holds placeholders only, and no live secret is written into a
tracked file. The GitHub token lives in `.git/config` (untracked) so pushes work unattended.

---

## 2026-07-28 — Tailwind v4 has no `--duration-*` theme namespace

**Why it matters:** `--duration-standard: 180ms` was declared inside `@theme`, following the
same pattern as the colors and `--ease-heat`. Tailwind v4 recognises `--color-*`, `--font-*`,
`--tracking-*`, `--ease-*` and friends, but **not** `--duration-*`. The variable was silently
dropped from the output and the `duration-standard` class was never generated — so every
transition fell back to Tailwind's 150ms default instead of the 180ms in `DESIGN.md`.

Silently, with a green build. `next build`, `eslint` and `tsc` all passed.

**Resolution:** duration tokens are declared on `:root` inside `@layer base` (so they always
emit) and consumed as `duration-[var(--duration-standard)]`. `--ease-heat` stays in `@theme`
because `--ease-*` *is* a real namespace and generates `ease-heat` correctly.

**Gotcha for later:** a token in `@theme` that produces no utility fails without an error.
When adding one, verify the class actually exists in the compiled CSS rather than trusting
that the build passed.

---

## 2026-07-28 — Landing-page entrances are CSS, not Framer Motion

**Why:** the first implementation used a Framer Motion `whileInView` wrapper. It produced a
React hydration mismatch, and the deeper problem was worse than the warning: server-rendered
markup carried `opacity: 0`, so if the JS bundle failed to arrive, the entire page would stay
invisible. Reading `useReducedMotion()` during render also made the server and client disagree
about the initial transform.

**Resolution:** a `.reveal` class in `globals.css` — `reveal-in` keyframes (240ms,
`--ease-heat`, 8px translate) with a per-element `--reveal-delay` for the 60ms stagger. Under
`prefers-reduced-motion: reduce` it swaps to a `reveal-fade` keyframe that animates opacity
only, which is precisely what `DESIGN.md` §4 asks for — the blanket rule that flattens all
animation explicitly exempts `.reveal` so the fade survives.

`Reveal` is now a server component: no client bundle, no hydration boundary, content is never
hidden by a script that did not load.

**Framer Motion stays in the stack.** It is the right tool for the ember bloom on generation
start (step 5) and the pipeline drag (step 8) — things that respond to interaction. It was
simply the wrong tool for a static entrance on a marketing page.

---

## 2026-07-28 — Referral codes are 8 characters from an unambiguous alphabet

**Why:** `profiles.referral_code` is `not null unique` with no default and the master spec
never said how to generate one. `gen_referral_code()` draws 8 characters from
`ABCDEFGHJKMNPQRSTUVWXYZ23456789` — I, L, O, 0 and 1 are excluded because referral codes get
typed by hand and read off screenshots, and every ambiguous glyph is a support ticket.

About 8.5×10¹¹ combinations. `handle_new_user()` retries up to 10 times on
`unique_violation`, so collisions are handled rather than merely improbable, and it returns
early when the profile already exists so a replayed signup is idempotent.

---

## 2026-07-28 — The profiles column guard is `SECURITY INVOKER`, and that is load-bearing

**Why:** it discriminates on `current_user`. A client update through PostgREST runs as
`authenticated` and gets its privileged columns reverted; an update from inside a
`SECURITY DEFINER` function like `spend_credits` runs as `postgres` and passes through. That
is exactly the boundary `AGENTS.md` rule 2 describes, expressed in one condition.

**The bug this replaced, recorded because it is the kind that ships:** the first version was
`SECURITY DEFINER`. Inside a `SECURITY DEFINER` function `current_user` is the function owner,
not the caller — so `current_user in ('authenticated','anon')` was false on every invocation
and the guard never fired once. An ordinary user could set `credits_free = 999999` and
`role = 'admin'` on their own row, and once `role` was `admin`, `is_admin()` returned true and
the SELECT/UPDATE policies opened across every user's row.

Nothing detected this: no error, no warning, no failing build. It surfaced only because the
RLS verification was performed as a real attack, which is what `ROADMAP.md` demands and why
that wording exists.

**Rejected alternative:** `auth.role()`. It reads the JWT claim, which still reports
`authenticated` inside a `SECURITY DEFINER` function — the guard would then silently revert
the credit deduction `spend_credits` had just performed.

**Related constraint:** `FORCE ROW LEVEL SECURITY` must never be enabled on `profiles`.
`is_admin()` reads `profiles` from inside a policy defined on `profiles`, and avoids infinite
recursion only because the `SECURITY DEFINER` owner bypasses RLS.

---

## 2026-07-28 — `middleware.ts` renamed to `proxy.ts` (Next.js 16)

**Why:** Next.js 16 deprecated the `middleware` file convention in favour of `proxy`. The old
name still compiles and even shows up in the build output, but in dev it fails with "Cannot
find the middleware module" and **every matched route 404s** — including `/app`, which made
the auth gate look broken rather than misconfigured.

`src/proxy.ts` now exports a default `proxy` function. Do not rename it back.

---

## 2026-07-28 — The app uses the legacy `anon` JWT, not the new publishable key

**Why:** `AGENTS.md` fixes the environment variable as `NEXT_PUBLIC_SUPABASE_ANON_KEY`, and
the spec was written against the anon-key model. The project also has a modern
`sb_publishable_…` key, which is independently rotatable and is what Supabase now recommends.

Sticking to the spec for now rather than silently diverging. **Proposal, not yet approved:**
migrate to the publishable key and rename the variable, ideally before launch — rotating an
anon JWT means rotating the project's JWT secret, which invalidates every live session.

---

## 2026-07-28 — `SECURITY DEFINER` caller checks must use `auth.role()`, not `current_user`

**Why:** the first version of `spend_credits`, `claim_daily_refill` and `grant_credits`
guarded with `current_user = 'authenticated'`. These functions are `SECURITY DEFINER`, where
`current_user` is always the owner (`postgres`) — so the condition could never be true and
the guards never ran.

This is the **exact inverse** of the `protect_profile_columns` bug recorded above. Both traps
are real and they point opposite ways:

| Function kind | `current_user` is | Identify the caller with |
|---|---|---|
| `SECURITY INVOKER` | the caller | `current_user` |
| `SECURITY DEFINER` | the owner | `auth.role()` |

`auth.role()` reads the role claim out of `request.jwt.claims`, a session GUC, so it survives
into a `SECURITY DEFINER` body.

**No hole was actually open** — `EXECUTE` on all three is granted to `service_role` alone. It
was fixed anyway, because a guard that silently does nothing is worse than no guard: the next
reader trusts it and builds on it.

---

## 2026-07-28 — Credit functions are `service_role` only, not a client API

**Why:** `EXECUTE` is revoked from `anon` and `authenticated` on all three. Server routes call
them with the service-role client *after* establishing who the user is. Exposing
`spend_credits` to the client would let a user burn their own credits without generating
anything, and `grant_credits` would be an open till.

**Consequence:** every generation route must verify the session itself, then call
`spend_credits` server-side. There is no path where the browser touches a credit.

---

## 2026-07-28 — `claim_daily_refill` writes a ledger row even when the delta is negative

**Why:** a user sitting above the 10-credit ceiling (from an admin grant, say) *loses* the
excess at the next refill, because the rule is "set to, not add to". Recording that as a
negative ledger row is ugly, but an unexplained drop in a balance is far worse — the ledger's
purpose is that any balance can be reconstructed from it.

Observed in testing: `credits_free` 37 → 10 wrote `delta = -27, reason = 'daily_refill'`.

---

## 2026-07-28 — `credit_ledger.balance_after` holds the TOTAL balance, not the bucket balance

**Why:** the spec did not say which. A spend that crosses both buckets writes two rows, and
storing per-bucket balances would make neither row show the user's actual balance. Total is
what an admin or a user actually wants to read. The intermediate row of a cross-bucket spend
therefore shows a mid-operation total; read the later row for the settled figure.

---

## 2026-07-28 — Admins bypass credit checks and write no ledger row

**Why:** `PRD.md` §5 states admin accounts bypass credit checks entirely. `spend_credits`
returns the current balance untouched for an admin. No ledger row is written because no
credits moved, and the ledger is a record of movements, not of intentions.

**Consequence:** admin usage is invisible in the credit ledger. If admin activity ever needs
auditing, that belongs in `audit_log` (step 12), not here.

---

## 2026-07-28 — Gemini model IDs: `gemini-3.1-flash-lite` (free) and `gemini-3.6-flash` (pro)

**Why, measured rather than assumed.** Every candidate was called for real before choosing:

| Model | Result |
|---|---|
| `gemini-3.1-flash-lite` | 200 in **1.1s** — chosen for `GEMINI_MODEL_FREE` |
| `gemini-flash-lite-latest` | 200 in 1.3s |
| `gemini-3.5-flash-lite` | 200 in **29.1s** — newer and far slower |
| `gemini-2.5-flash-lite` | **404** |
| `gemini-3.6-flash` | 200 in **3.3s** — chosen for `GEMINI_MODEL_PRO` |
| `gemini-flash-latest` | 200 in 4.0s |
| `gemini-3.5-flash` | **503** |
| `gemini-2.5-flash` | **404** |

**Two lessons worth keeping.** First, `ListModels` is not a availability check — it advertised
both 2.5 models that then returned 404. Always call a model before trusting it. Second, newer
is not faster: 3.5-flash-lite was 26× slower than 3.1-flash-lite, which would destroy the
"feels instant" requirement in `DESIGN.md` §5 on the tier most users see.

**Pinned, not `-latest`.** The aliases resolve fine today, but a silent upgrade to something
like 3.5-flash-lite would multiply latency without a deploy. `AGENTS.md` rule 5 already makes
swapping a one-line env change, so pinning costs nothing.

---

## 2026-07-28 — Gemini structured output is used; defensive parsing is kept as a fallback

**Why:** this resolves the "decide the JSON-mode strategy at step 4, not step 7" proposal.
Passing `responseMimeType: application/json` plus a `responseSchema` was verified to return
valid, schema-conforming JSON in natural Indonesian on `gemini-3.6-flash`. That removes most
of the risk `PROMPTS.md` §1 was written to defend against.

`parseJson()` is kept anyway — it strips markdown fences and extracts the first JSON object —
because not every prompt can express a schema, and a model can still ignore one. Cheap
insurance, not duplicated effort.

---

## 2026-07-28 — Key rotation happens before backoff, not after

**Why:** a second key from a *different* Google Cloud project has its own quota. On a 429 the
cheapest correct move is to try the other key immediately; sleeping first would waste a key
that was never rate-limited. So the retry loop iterates all keys, *then* backs off 1s, 2s, 4s,
8s between rounds.

A 429'd key is put on a 60s cooldown and moved to the back of the order rather than removed —
if every key is cooling, it is better to try them all than to fail without an attempt.

**Caveat:** the cooldown map is per-process, so on serverless each instance keeps its own.
Worst case is one wasted 429 per cold instance. The durable count the guard reads lives in
Postgres.

---

## 2026-07-28 — A broken usage counter must not engage the quota guard

**Why:** `getPoolStatus()` returns "plenty remaining" if `gemini_usage` cannot be read. The
alternative — failing closed — would mean a metrics table outage takes the product offline for
every free user. Failing open degrades to the pre-guard behaviour, which is the status quo,
not an outage. `recordUsage()` swallows its errors for the same reason: undercounting is
recoverable, failing a generation the user already paid for is not.

---

## 2026-07-28 — BYOK users bypass both the quota guard and key rotation

**Why:** they are not spending our quota, so blocking them would be arbitrary. Their key is a
pool of exactly one and is never rotated onto our keys — that would be billing theft in
reverse. Their 429s are their own ceiling and do not put anything on cooldown. BYOK calls are
recorded with `key_index = 0` so they never pollute our pool accounting.
