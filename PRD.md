# PRD — Malesan

**Tagline:** *"Males mikirnya. Bukan bikinnya."*
**Domain of intent:** malesan.app — **not confirmed.** Do not hardcode anywhere until the
human confirms. See BLOCKERS in `HANDOFF.md`.

---

## 1. Problem

Content creators open their editor and stare at nothing. The bottleneck is not filming,
editing, or posting — it is deciding *what* to make, *how* to hook, and *what* to say.
Malesan removes the blank-page moment.

## 2. Positioning

Malesan is for people who are **lazy about the thinking**, not lazy about the craft. The user
still films, edits, and performs. Malesan only kills the staring-at-a-blank-screen part.

This constrains all copy: never imply the product makes low-effort or low-quality content.

## 3. Market

Indonesia first. UI is bilingual (ID/EN toggle). AI output language is a separate per-user
setting, defaulting to Indonesian. These are two different settings and must not be conflated.

## 4. Who it is for

Indonesian short-form creators — TikTok, Instagram Reels, YouTube Shorts — plus text-platform
creators on X and Threads. They post often enough that ideation is a recurring cost, and they
are price-sensitive enough that a free daily allowance is the acquisition mechanism.

---

## 5. Phase 1 feature scope

### User-facing

| # | Feature | Note |
|---|---|---|
| 1 | **Ide Hari Ini** | Works with **zero input**. This is the front door, not a side feature. |
| 2 | **Idea Engine** | Rough thought in, 5 developed ideas out |
| 3 | **Hook Lab** | 10 scored hooks across distinct patterns |
| 4 | **Script Builder** | Timestamped script, visuals, on-screen text, CTA, caption, hashtags |
| 5 | **Repurpose** | One piece adapted across platforms in a single call |
| 6 | **Pipeline** | Kanban: ide → draft → siap → posted, with post-hoc performance rating |
| 7 | **Creator DNA** | Onboarding form — niche, audience, tone, platforms, banned words, brand notes |
| 8 | **Trend feed** | Read-only view of today's auto-generated cards |
| 9 | **BYOK** | User supplies their own Gemini key, stored encrypted, unlimited generations |
| 10 | **Referral** | Share code, track status |
| 11 | **Top-up** | Bank transfer with proof upload, plus voucher redemption |

### Onboarding flow — deliberate conversion design

A new user gets **one free generation before being asked for anything.** Creator DNA is
requested only *after* they have seen the product work.

Forcing a form before first value kills signups; skipping the form entirely makes output
generic. This ordering solves both. Do not reorder it.

### Admin dashboard

`role = 'admin'` → redirected here automatically on login. Admin accounts bypass credit
checks entirely.

- User list: search, filter, view generation history, edit credits, ban/unban, delete
- Top-up approval queue: view proof, approve/reject, credits granted automatically on approve
- Voucher generator: create batches, view redemption status
- API key pool health: today's usage per key, quota remaining, current model in use
- Analytics: signups, DAU, generations by module, credits spent, conversion rate
- Trend override: pin, hide, or manually add trend cards (optional — the cron is the default)
- Every admin action writes to `audit_log`

---

## 6. Credit economy

### Cost per action

| Action | Cost |
|---|---|
| Ide Hari Ini | 1 |
| Idea Engine | 1 |
| Hook Lab | 2 |
| Script Builder | 4 |
| Repurpose | 1 |
| Creator DNA analysis | 2 |

### Tiers

| | Free | Pro (paid credits) |
|---|---|---|
| Daily refill | 10, resets (does **not** stack) | — |
| Signup bonus | 5 | — |
| Model | `GEMINI_MODEL_FREE` (Flash-Lite) | `GEMINI_MODEL_PRO` (Flash) |
| History retained | last 50 generations | unlimited |
| Priority when quota is low | no | yes |

### Two buckets, deliberately

`credits_free` refills **to** a fixed ceiling daily and does not stack — this prevents
hoarding and makes multi-account farming pointless. `credits_paid` never expires. Spend free
first, then paid.

### Packs

100 / 350 / 1000 credits. **The human sets IDR pricing.** Keep prices configurable in an
admin-editable table or config file — never hardcode a price in a component.

### Why the signup bonus is small

If signup granted a large bonus, farming accounts would be worth the effort. At 5 credits,
with 10 free every day anyway, creating a second account costs more effort than simply
waiting. **The economy design is the primary anti-abuse mechanism**; the technical checks
below are the backstop.

---

## 7. Anti-abuse

- Google OAuth only. No email/password, no magic links.
- Block known disposable-email domains at signup.
- Store a **hashed** device fingerprint and a **hashed** signup IP. Never plaintext.
- Flag in admin when one fingerprint maps to more than two accounts. **Flag, do not auto-ban**
  — shared computers and offices exist.
- Per-user rate limit: max 10 generation requests per minute, enforced server-side.
- Log every generation request. Give admin a ban button.

### Referral rules — both sides earn, so guard carefully

- Referee earns credits **after completing their first generation**, not at signup.
- Referrer earns only **after** the referee's first generation clears.
- Same fingerprint hash on both accounts → status `voided`, neither side earns, log it.
- Maximum 10 successfully credited referrals per account.
- Referral credits land in `credits_paid` so they do not vanish at daily reset.

---

## 8. Known product limitation — be honest about it

Google Trends reveals what people **search**, not which TikTok sounds are rising. Automated
TikTok trend detection is not achievable on a free tier — the API is paid and scraping gets
blocked.

The compensating mechanism is the `performance_rating` field on `generations`: as users rate
what actually performed, the platform accumulates a private signal no competitor has. Surface
this aggregate in the trend context once there is enough volume.

---

## 9. Out of scope for Phase 1

Anything not listed in §5. If you think something belongs here, write it in PROPOSALS in
`HANDOFF.md` and wait for approval. See `AGENTS.md` §6.

---

## 10. Vibe Coding Kit — approved scope addition, 2026-07-29

**Not in `MALESAN_MASTER_PROMPT.md`.** The original specification covers content creators
only. This was requested directly by the product owner and is recorded here as an explicit
extension, not folded in silently.

### Why it belongs

The product thesis is *"males mikirnya, bukan bikinnya"* — kill the blank page, not the craft.
There is a second blank page with exactly the same shape: someone opens an empty repo, opens
Claude Code or Cursor, and has to write instructions for a problem they have not thought
through yet. They are not lazy about building. They are stuck on deciding.

### What it produces

One generation, six files, written together so they agree with each other:

| File | Contents |
|---|---|
| `PRD.md` | Problem, audience, phase-1 features, and what is deliberately excluded |
| `DESIGN.md` | Colour tokens with hex, typography, motion, copy voice, quality floor |
| `ROADMAP.md` | Numbered steps with **testable** definitions of done |
| `AGENTS.md` | Hard rules for the AI agent, plus the handoff protocol |
| `SCHEMA.md` | Runnable SQL, relationships, row-level access rules |
| `MASTER_PROMPT.md` | The kickoff prompt to paste into the agent |

They are generated in a single call on purpose. Split across calls they drift, and a roadmap
that references tables the schema never defines is worse than no roadmap at all.

### Cost

**6 credits** — the most expensive module in the product, above Script Builder at 4. It is six
long documents and the heaviest single call the platform makes.

### Why this is a genuine moat

The document set is not invented for the feature. It is the set this repository runs on, and
it is the reason this build survived a mid-project agent handoff, a fabricated status report,
and a rebuild. That is a product claim we can actually stand behind.
