# ROADMAP — Malesan

**The loop:** complete one step → self-test it → update `HANDOFF.md` → commit → **stop and
report** → wait for the human to say "lanjut". Do not chain two steps in one turn.

---

## Build order

| Step | Deliverable | Definition of done | Status |
|---|---|---|---|
| 0 | Spec files | All nine files exist and are accurate | ✅ **done** — 2026-07-28 |
| 1 | Next.js scaffold, design tokens, landing page | Landing renders, tokens applied, responsive to 360px | ✅ **done** — 2026-07-28 |
| 2 | Supabase Google OAuth, `profiles`, RLS | Sign in/out works, profile row auto-created, RLS verified | ✅ **done** — 2026-07-28. Real Google sign-in produced a profile with 5 credits and a referral code |
| 3 | Credit system | `spend_credits` is race-safe under parallel calls, ledger correct, daily refill works | ✅ **done** — 2026-07-28. Race test passed at 12 and 20 parallel requests |
| 4 | Gemini server layer | Key rotation, 429 backoff, quota guard, streaming, BYOK path | ✅ **done** — 2026-07-28. Rotation observed across both keys, guard verified engaging, streaming first byte 0.73s |
| 5 | Ide Hari Ini + Idea Engine | Zero-input generation works end to end, credits deducted correctly | ✅ **done** — 2026-07-28. Stream working, quota/credit guards verified |
| 6 | Creator DNA + onboarding gate | First generation free, form appears after, DNA injected into prompts | 🟡 next |
| 7 | Hook Lab + Script Builder + Repurpose | All modules produce valid parsed JSON | ⬜ |
| 8 | Pipeline | Kanban with drag, performance rating captured | ⬜ |
| 9 | Trend cron | Daily job populates `trends`, one Gemini call, injected into prompts | ⬜ |
| 10 | Referral | Both-sides credit with fingerprint voiding verified | ⬜ |
| 11 | Top-up + vouchers | Bank transfer flow, proof upload, admin approval grants credits | ⬜ |
| 12 | Admin dashboard | All admin features working, audit log populated | ⬜ |
| 13 | Polish | Streaming everywhere, error states, empty states, reduced-motion, keyboard nav | ⬜ |

Legend: ⬜ not started · 🟡 in progress · ✅ done and verified

---

## Step 3 carries a mandatory test

**Test the race condition explicitly.** Fire concurrent generation requests from one account
with only **one** credit remaining. Exactly one must succeed.

If two succeed, the atomic function is wrong and **everything downstream is unsafe.** Do not
proceed to step 4 until this passes. Record the test and its result in `HANDOFF.md` under
WHAT WORKS.

---

## Review cadence

**Every fourth step** (i.e. after steps 4, 8, 12), do a full review pass: read the whole repo
with fresh eyes and write a short, candid assessment in `HANDOFF.md`:

- What would make a creator choose this over the free alternatives?
- What is the single weakest part of the product right now?

---

## Notes per step

**Step 1** — design tokens go into the Tailwind config from `DESIGN.md` §2–4, not into
scattered arbitrary values. The landing page is the first test of the "cold obsidian that
heats up" concept.

**Step 2** — the signup trigger must generate `profiles.referral_code` (unique, not null, no
default). Strategy is still open; see `SCHEMA.md` §5.

**Step 4** — quota guard, key rotation and backoff all live here. Get this right before any
module depends on it. Streaming is established here too, because retrofitting streaming later
is painful.

**Step 5** — Ide Hari Ini is the front door. It must work with zero input from a user with no
Creator DNA yet.

**Step 6** — the onboarding order is deliberate: one free generation *before* the form. Do not
reorder it. See `PRD.md` §5.

**Step 9** — one Gemini call per day for the whole platform, not per user.

**Step 11** — credit pack IDR pricing must be admin-editable, never hardcoded in a component.
This likely needs a `credit_packs` table that is not in the base schema — propose before adding.

**Step 13** — the quality floor (360px, focus states, reduced-motion, keyboard nav) is *not*
deferred to this step. It ships with every component from step 1. Step 13 is the sweep for
what slipped through.
