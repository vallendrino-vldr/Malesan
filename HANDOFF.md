# HANDOFF

Last updated: 2026-07-29
Last agent: Claude Code (studio repair, pipeline redesign, code graph)
Last commit: `4617b67` — fix: pipeline had one layout for every screen

---

## READ THIS FIRST

Start cheap. `graphify-out/graph.json` indexes every symbol in `src/` (193
nodes, 412 edges) and rebuilds for **zero LLM tokens**. Query it before
reading source — see `AGENTS.md` §0 "Token discipline". The human is on a
capped plan and has already lost one build to running out mid-session.

Two earlier handoffs on this project were fabricated. The rule that fixed it
still stands: **✅ means you ran it and watched it work.** Nothing else.

---

## WHAT I FIXED THIS SESSION

### Studio was dead — three stacked bugs, build green throughout

1. **`buffer.split("\\n\\n")`** — in TS source that is a literal backslash-n
   backslash-n, not two newlines, so it never matched an SSE frame separator.
   The reader drained the whole stream and yielded nothing: "Ide Hari Ini"
   sat on its loading state forever and reported no error, because the error
   frames were not parsed either. Same escape bug in the ```json fence regex.
2. **`IdeaEngine` posted `input` as a bare string**; the route reads
   `input.text`. Every call 400'd with a plain-text body.
3. **The error handler called `res.json()` then `res.text()` in its catch.**
   A body is a one-shot stream, so the fallback threw *"body stream already
   read"*, masking the real 400 from (2). That is the message the user saw.

`VibeCodingStudio` was unaffected — it already had a correct `drain()`. That
is the only reason Vibe worked while everything else failed.

The working parser is now `src/lib/sse.ts`, shared by all callers.

### Pipeline

Rebuilt. Was one layout for every viewport (four 280px columns at 70vh in a
horizontal scroller) with `drag` inside `overflow-x-auto` — a gesture the
scroll container wins. No empty states, no guidance. Dragging Ide → Draft
skipped hook generation and then offered "Bikin Script", the next stage's
action on an incomplete stage. That was the reported dead end.

Now: phones get a stage switcher and one stage at a time with button moves;
`md`+ keeps the kanban with drag. Every stage and every card states its next
action. Script generation now receives the real generated hook instead of
`hook_seed`.

### Admin

Layout was a fixed `w-64` sidebar with no mobile branch — about 96px of
content on a phone. Now sidebar from `md` up, bottom nav below it. Its entry
point in the header was a muted hairline pill that read as decoration; it now
carries the accent.

---

## VERIFIED BY EXECUTION

- `src/lib/sse.ts`: 13 assertions green — frames split mid-token, CRLF frames,
  plain-text vs JSON error bodies, empty body fallback, fence stripping, and
  the double-read case reproduced directly.
- `tsc --noEmit` exit 0 after every change.
- Tunnel serves `/`, `/app`, `/admin` (200 through Cloudflare).
- DB state read directly: `profiles.role` for VLDR **is** `admin`, 14
  generations, 6 ledger rows, `trends` **0**, `pipeline_cards` **0**.

## NOT VERIFIED — BE HONEST ABOUT THIS

- **No generation has been run end to end by me.** Navigating to the
  `/dev-masuk` URL is blocked by the host's security classifier (secret in a
  query string), so I could not hold a session in a browser. The SSE fixes are
  proven at the parser level, not on the live route. **This is the first thing
  to confirm.**
- Admin pages have still never been opened by an agent.
- Top-up, onboarding gate, referral, vouchers: never walked through.
- `trends` is empty, so every prompt runs without trend context.

---

## NEXT ACTION — START HERE

1. Confirm Ide Hari Ini and Idea Engine actually complete and deduct credits.
2. **Admin batch 1 — user control.** Role free↔paid, manual credit edit with
   a reason written to the ledger, ban/unban, delete, per-user detail
   (generations, ledger, referrals, topups). `verifyAdmin()` is the only gate
   on every admin action and has degree 8 in the graph — audit it before
   extending it.
3. **Seed `trends`** (8–10 rows, or run `/api/cron/trends` once). Single
   biggest quality lever available; every prompt is currently trend-blind.
4. **Admin batch 2 — AI control.** Needs a new `app_config` table first:
   model per tier, key rotation, per-module credit cost, editable prompts.
   All hardcoded in env today.
5. Batch 3 (charts, activity feed), batch 4 (storage/data browser).
6. Dashboard needs the "why this is useful" copy the human asked for — gaul,
   humble, no swipes at anyone.

## STILL OPEN FROM BEFORE

- Admin/topup/profil/onboarding screens had their colours migrated but their
  **layouts were never redesigned**.
- 8 `any` lint errors, all in Antigravity-era files.
- Migrations 00010–00012 applied outside the tracker; reconcile before relying
  on migration history.

## BLOCKERS — NEEDS THE HUMAN

- `malesan.app` unconfirmed.
- Credit pack IDR pricing (15k/45k/100k) still the previous agent's guess.
- Vercel Hobby is not licensed for commercial use.
- Google consent screen still in Testing — only listed test users can sign in.
- The tunnel URL changes every restart; it is not a permanent address.

---

## RULES FOR WHOEVER WORKS ON THIS NEXT

1. Commit at every checkpoint, and push. A session ending with uncommitted
   work has produced nothing.
2. "WHAT WORKS" means you ran it and watched it work.
3. A green build proves nothing about runtime.
4. Never invent colours. If it is not in `DESIGN.md`, it does not ship.
5. Money code does not guess.
6. Respect the token budget in `AGENTS.md` §0 — it is not advisory here.
