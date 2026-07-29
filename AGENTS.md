# AGENTS.md — Canonical Instructions for Malesan

> This is the **canonical instruction file** for this repository. Every agent — Claude Code,
> Antigravity IDE, Cursor, or anything else — reads this file first, before touching code.
> `CLAUDE.md` exists only to point here.

**Source of truth:** `MALESAN_MASTER_PROMPT.md` is the original specification. This file is the
operational distillation of it. If the two ever disagree, the master prompt wins — and you fix
this file to match.

---

## 0. Reading order at the start of every session

1. `AGENTS.md` (this file) — the rules
2. `HANDOFF.md` — where we are right now
3. `ROADMAP.md` — what step we are on and what "done" means for it

When the human types only **"lanjut"**, read those three files and continue from
`HANDOFF.md` → NEXT ACTION. Do not ask questions those files already answer.

### Token discipline — this project runs on a hard budget

The human is on a capped plan and has run out mid-build before. Burning context
on rediscovery is not neutral; it is the thing most likely to end the session
before the work lands. Obey these in order:

1. **Query the code graph before reading source.** `graphify-out/graph.json`
   holds every symbol in `src/` and how they connect (193 nodes / 412 edges,
   rebuilt by AST with **zero LLM tokens**). To find what calls what, run
   `graphify query "<question>"` — do not grep-and-read your way to the same
   answer. Rebuild after big refactors with:
   `graphify-out/.graphify_python -m graphify update` (still free — `src/` is a
   code-only corpus, so the semantic/subagent pass never runs).
2. **Never `Read` a whole file to change ten lines.** Grep for the anchor, read
   with `offset`/`limit`, then `Edit`. Reading a 400-line component to patch one
   handler costs more than the patch.
3. **Do not spawn subagents or workflows unless the human asks.** Each one starts
   cold and re-derives context this session already has.
4. **Do not re-read a file you just edited to check it landed.** The edit tool
   errors if it did not.
5. **Batch independent tool calls into one message.** Round trips cost context.
6. **Verify by execution, not by re-reading.** `tsc --noEmit` and a targeted test
   prove more per token than any amount of re-inspection.

If context is running out, **commit what works and write `HANDOFF.md` before
starting anything new.** A session that dies with uncommitted work has produced
nothing — that is exactly how the Antigravity session failed.

---

## 1. What Malesan is

A production web app for Indonesian content creators that removes the blank-page moment.
Tagline: *"Males mikirnya. Bukan bikinnya."*

**Positioning — do not drift from this.** Malesan is for people who are lazy about the
*thinking*, not lazy about the *craft*. The user still films, edits, and performs. Never let
copy imply the product makes low-effort or low-quality content.

This is not a prototype. It will be publicly launched and monetized. Treat every decision as
if real paying users depend on it, because they will.

---

## 2. Hard rules — non-negotiable

Violating any of these is a critical defect.

1. **No AI provider key ever reaches the browser.** All Gemini calls go through server-side
   code only (Next.js route handlers or Supabase Edge Functions). If a key would be readable
   in a network tab or a client bundle, you have failed.
2. **Credits are spent server-side, atomically, via the `spend_credits` SQL function only.**
   Never decrement credits in client code. Never decrement with a plain `UPDATE`. Parallel
   requests must not be able to double-spend.
3. **Admin role is read from the database, never from a hardcoded email in the frontend.**
   Authorisation is enforced by RLS and server checks, not by hiding UI.
4. **Row Level Security is enabled on every table with user data.** No exceptions. A user can
   only ever read or write their own rows. Admins pass through a `SECURITY DEFINER` role
   check function.
5. **Model IDs live in environment variables**, never hardcoded. Google changes model names
   and quotas frequently. Swapping a model must be a one-line env change.
6. **Never invent a feature that is not in this spec or in `ROADMAP.md`.** Propose it in
   `HANDOFF.md` under PROPOSALS and wait for human approval.
7. **Update `HANDOFF.md` before ending any turn in which you changed a file.** Not optional.
   A session that changes code without updating `HANDOFF.md` is an incomplete session.
8. **Commit at every checkpoint** with a clear message. Small commits, not one giant one.
9. **Quality floor, unannounced:** responsive to 360px, visible keyboard focus states,
   `prefers-reduced-motion` respected, all interactive elements reachable by keyboard.
10. **If a spec instruction conflicts with reality** (an API changed, a library is deprecated),
    stop, write the conflict in `HANDOFF.md` under BLOCKERS, and ask. Do not guess and proceed.

---

## 3. Tech stack — fixed

| Layer | Choice |
|---|---|
| Framework | Next.js (App Router), TypeScript |
| Styling | Tailwind CSS |
| Motion | Framer Motion |
| Backend / DB / Auth | Supabase (free tier) |
| Auth method | Google OAuth **only** — no email/password, no magic links (anti-abuse decision) |
| AI | Google Gemini API, free tier, two keys from **two separate Google Cloud projects** |
| Deploy | Vercel |
| Cron | Vercel Cron (or `pg_cron` in Supabase if Vercel Hobby limits bite) |

### Environment variables

```
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=      # server only, never exposed
GEMINI_API_KEY_1=               # project A
GEMINI_API_KEY_2=               # project B
GEMINI_MODEL_FREE=              # e.g. the current free Flash-Lite model id
GEMINI_MODEL_PRO=               # e.g. the current free Flash model id
CRON_SECRET=
ENCRYPTION_KEY=                 # for encrypting user BYOK keys at rest
```

Anything prefixed `NEXT_PUBLIC_` is world-readable. Nothing secret may ever carry that prefix.

### Platform constraints — build around these, do not rediscover them

- Gemini free-tier quota is enforced **per Google Cloud project, not per API key**. Two keys
  only help because they come from two separate projects. Adding more keys to the same
  project buys nothing.
- Gemini daily quota resets at **midnight Pacific ≈ 14:00 WIB**, not local midnight.
  Indonesian prime time (19:00–23:00 WIB) therefore runs on partially-consumed quota.
  Implement a **quota guard**: below 20% pool remaining, serve paid and BYOK users only, and
  show free users a clear message with a top-up path.
- Free-tier prompts may be used by Google for model training. Must be stated in the ToS, and
  is a selling point for BYOK ("pakai key sendiri, data lo aman").
- Vercel Hobby is not licensed for commercial use. Flag to the human before launch.
- Handle HTTP 429 with exponential backoff (1s, 2s, 4s, 8s) and automatic key rotation.

---

## 4. Brand voice — applies to every string you write

Casual, warm, a little funny. Premium execution underneath. The contrast is the point
(precedent: Slack — a casual name on a serious tool).

Register-setting examples:

| Context | Copy |
|---|---|
| Loading | `Lagi mikirin buat lo...` |
| Empty state | `Belum ada apa-apa. Ya udah, gue yang mulai.` |
| Primary CTA | `Males mikir. Kasih ide.` |
| Zero credits | `Credit abis. Besok refill jam 00:00, atau top up biar gak nunggu.` |

Rules: sentence case, active voice, no corporate filler, never apologise for an error. An
error says what broke and what to do next. An empty state is an invitation, not a mood.

**Two separate language settings — never conflate them.** UI language is a bilingual ID/EN
toggle. AI output language is a per-user Creator DNA setting, defaulting to Indonesian.

---

## 5. Working protocol

### The loop
Complete **one** step from `ROADMAP.md`. Self-test it. Update `HANDOFF.md`. Commit.
**Stop and report.** Then wait for the human to say "lanjut". Do not chain two steps in one
turn unless explicitly told to.

### Definition of done for any step
- The deliverable in `ROADMAP.md` is met, and you **ran it and saw it work**
- `HANDOFF.md` is rewritten and accurate
- Any decision made is appended to `DECISIONS.md` with date and reasoning
- Committed with a clear, scoped message

### `HANDOFF.md` honesty rule
"WHAT WORKS" means you executed it and observed the result. Never list something you believe
*should* work. Hiding a broken thing costs the next agent hours.

### `DECISIONS.md` append-only rule
Never delete an entry, even when a decision is later reversed — record the reversal as a new
entry. Future agents need to know what was already tried and rejected.

### Commit message convention
```
<type>: <scope> — <what changed>
```
Types: `feat`, `fix`, `chore`, `docs`, `refactor`, `test`, `db`.
Example: `feat: credits — atomic spend_credits fn + ledger`

---

## 6. Continuous improvement mandate — and its brake

The human's goal is for Malesan to become the leading tool of its kind in Indonesia, and
eventually to compete globally. You are expected to contribute to that, not just execute
tickets.

**After each step**, add to PROPOSALS in `HANDOFF.md`:
- anything in the existing implementation you think is weak, and specifically why
- an improvement that would meaningfully widen the gap against competitors
- any place the product feels generic — where a user could just use ChatGPT instead
- performance, cost, or quota risks you noticed while working

**Every fourth step**, do a full review pass with fresh eyes and write a short, candid
assessment: what would make a creator choose this over the free alternatives, and what is the
single weakest part of the product right now.

**The brake — as important as the mandate.** You **propose**. You do **not** implement
unapproved ideas. Every unrequested feature is scope creep, and scope creep is the most
common way ambitious projects die before launch.

A proposal is worth more when it is specific and honest about cost. "Add gamification" is
noise. "Add a 3-day streak counter — roughly 40 lines, one column, likely lifts day-3
retention because the daily refill already trains a return habit" is useful.

---

## 7. File map

| File | Purpose | Volatility |
|---|---|---|
| `AGENTS.md` | Permanent rules every agent must obey | Rarely changes |
| `CLAUDE.md` | Pointer to this file | Never changes |
| `HANDOFF.md` | Live session state — where we are, what's next | **Every session** |
| `DECISIONS.md` | Append-only log of *why* choices were made | Grows only |
| `PRD.md` | Product requirements | Occasionally |
| `SCHEMA.md` | Database schema, RLS policies, SQL functions | Occasionally |
| `DESIGN.md` | Design tokens, typography, motion, copy voice | Occasionally |
| `PROMPTS.md` | AI system prompts (Indonesian) | Occasionally |
| `ROADMAP.md` | Build phases and status | Every phase |
| `MALESAN_MASTER_PROMPT.md` | Original specification — the source of truth | Frozen |

**Why this matters:** context windows run out, sessions die, and the human switches IDEs when
rate limits hit. These files are your memory. If they are not accurate, work is lost.
