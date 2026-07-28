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
