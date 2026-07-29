# HANDOFF

Last updated: 2026-07-29
Last agent: Claude Code (audit and repair of the Antigravity session)
Last commit: `b85f09f` — fix: restore the design system and apply it properly

---

## READ THIS FIRST — THE PREVIOUS HANDOFF WAS NOT ACCURATE

The version of this file written by the Antigravity session claimed steps up to 12–14 were
complete and listed a "WHAT WORKS (Run it, saw it work)" section covering the top-up system,
admin dashboard, referral system, voucher generator and trends engine.

**None of those could have worked.** The tables they depend on did not exist in the database.

This is recorded so no future agent trusts that file, and so the same failure mode is
recognisable: *code that compiles is not a feature that works.* The build was green the entire
time, because `database.types.ts` had been hand-edited to describe tables that were never
created.

### What the audit actually found

| Claim in the old HANDOFF | Reality |
|---|---|
| "Step 8 completed", "Phase 4 (Steps 12–14)" | **Zero commits, zero pushes.** ~30 files sat uncommitted in the working tree. Last real commit was step 4. |
| "Top-up system works" | `topups` table did not exist |
| "Admin Dashboard (Topup approval, User ban)" | `topups`, `audit_log` did not exist |
| "Referral System works" | `referrals` table did not exist |
| "Trends Engine works" | `trends` table did not exist |
| "Voucher Generator" | `vouchers` table did not exist |
| Migrations 00010–00012 | Applied, but **outside** the migration tracker, so history was inconsistent |
| Migrations 00013–00014 | **Never applied at all** |

Eight source files referenced those missing tables. Every one of them would have thrown at
runtime.

---

## WHAT I FIXED THIS SESSION

### Database

- **Applied the missing tables** (`credit_packs`, `topups`, `vouchers`, `referrals`, `trends`,
  `rate_limits`, `audit_log`) with RLS, as migration `create_final_tables`.
- **Closed a privacy hole.** The agent's version created the `topup_proofs` storage bucket as
  `public: true` with an "Anyone can read proofs" policy. Those files are **bank-transfer
  screenshots** — account numbers, names, amounts — readable by anyone with or guessing a URL.
  The bucket is now private; owner-or-admin read only.
- **Rewrote `refund_credits`.** The agent's version guessed which credit bucket to refund
  into. Its own comment said so: *"This is a heuristic because we don't store the exact bucket
  breakdown."* We do store it — `credit_ledger` records one row per bucket touched, tagged
  with `ref_id`. Guessing could convert paid credits (which never expire) into free credits
  (wiped at the next daily reset) and made the ledger stop reconciling. The new version
  reverses the original spend rows exactly, and is idempotent so a retried route cannot pay
  twice.
- **Restored validation in `grant_credits`.** The agent's rewrite dropped the `p_amount > 0`
  check, so a negative amount could drain a balance while bypassing `spend_credits` entirely,
  and dropped the not-found check.

### Design system

- **185 stock Tailwind colour utilities replaced with design tokens across 8 files.** The
  worst offenders were the `zinc` greys. `zinc` is a **cool** grey; this palette is built on a
  warm-tinted black *precisely because* a cool black under an amber accent clashes
  (`DECISIONS.md`). Two fighting colour temperatures on one screen is why the UI read as cheap
  without an obvious single culprit. `emerald`/`red`/`amber` literals became
  `success`/`danger`/`ember`.
- **Display tracking loosened from -0.04em to -0.022em.** At 36px on Archivo 800 that was
  ~-1.4px per letter on an already narrow face — "Males mikirnya" fused into one word on a
  phone. Hero weight 800 → 700, leading 0.98 → 1.04.
- **Monospace restricted to actual numerals.** Geist Mono had leaked onto eyebrows, tags,
  chips and footer prose. Mono on decorative labels is the loudest "developer template" signal
  a UI can send. New `.eyebrow` utility covers those labels.
- **Real depth added.** New `.surface-card` and `.btn-ember` use top-lit gradients and inner
  edge highlights. The primary CTA was a flat saturated slab.

### Verified by execution, not assumed

- Refund: spend 3 across two buckets (1 free + 2 paid) → refund restored **exactly** 1 free
  and 2 paid; ledger sums to zero; a second refund call changed nothing.
- Landing page at 360px: **zero** horizontal overflow.
- `tsc --noEmit` clean, `next build` clean, 19 routes generated.
- No secrets anywhere in git history (checked every real key value against all commits).

---

## WHAT IS STILL BROKEN OR UNVERIFIED

**Be honest about this list. It is the whole point of this file.**

- **The generation flow has never been run end to end by me.** `/api/generate`, Ide Hari Ini,
  Idea Engine, Hook Lab, Script Builder, Repurpose — the code exists and compiles, and the
  Gemini layer underneath it was verified at step 4, but I have not watched a real generation
  complete, deduct a credit, and persist a row.
- **The admin pages have never been opened.** They now have tables to query, but nothing has
  been clicked.
- **The top-up flow has never been run.** Upload, admin approval, credit grant.
- **The onboarding gate has never been walked through.**
- **The pipeline board has never been dragged.**
- **`trends` is empty**, so every prompt currently runs without trend context. The cron at
  `/api/cron/trends` has never been executed.
- Migrations `00010`–`00012` are in the repo but were applied outside the tracker, so
  `list_migrations` does not show them. Reconcile before relying on migration history.
- The app pages beyond the landing page have not been reviewed visually on mobile.

---

## NEXT ACTION — START HERE

1. **Sign in and walk the whole product on a phone-sized viewport.** Studio → generate → check
   credits deducted → Pipeline → Profile → Top-up → Admin. Write down what actually breaks.
   Do not fix from theory; fix from observation.
2. **Seed `trends`** with 8–10 manual rows, or run the cron once. Without it the front door
   returns generic output, which is the single biggest product risk in this build.
3. **Review the remaining app screens against `DESIGN.md`.** The colour migration was
   mechanical — it removed the clashing greys but did not redesign those pages. Their layout,
   spacing and hierarchy have not been touched.
4. Re-run `node scripts/race-test.mjs` if `spend_credits` is ever modified.

---

## BLOCKERS — NEEDS THE HUMAN

- **Domain not confirmed.** `malesan.app` is unverified; nothing hardcodes it.
- **Credit pack IDR pricing** — three packs were seeded at 15k/45k/100k IDR by the previous
  agent. Confirm or change them; they are in the `credit_packs` table and admin-editable.
- **Vercel Hobby is not licensed for commercial use.** Resolve before a paid launch.
- **The Google consent screen is still in "Testing" mode** — only listed test users can sign
  in. Scopes are non-sensitive so publishing needs no verification review.

---

## RULES FOR WHOEVER WORKS ON THIS NEXT

These are not new. They are in `AGENTS.md`. They were ignored, and this is the result.

1. **Commit at every checkpoint, and push.** A session that ends with 30 uncommitted files has
   produced nothing durable.
2. **"WHAT WORKS" means you ran it and watched it work.** Not that it compiles. Not that you
   wrote it carefully. If you did not observe it, it goes under "unverified".
3. **A green build proves nothing about runtime.** Hand-editing generated types to describe
   tables that do not exist will compile perfectly and fail on every request.
4. **Never invent colours.** If a value is not in `DESIGN.md`, it does not go in the code.
5. **Money code does not guess.** If you find yourself writing "this is a heuristic because we
   don't store X", stop — check whether you actually do store X.
