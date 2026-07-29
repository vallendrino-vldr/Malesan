# HANDOFF

Last updated: 2026-07-29
Last agent: Claude Code (studio repair, pipeline, graph, admin batch 1+2, DNA depth)
Last commit: `f43b957` — feat: admin batch 2

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

### Script generation blamed the user for a field-name mismatch

`HOOK_LAB_SCHEMA` returns each hook as `text`. The card read `script_segment`,
so the hook resolved to `""` and Script Builder answered *"Idea, hook, and
duration inputs are required"* — a contract error naming three fields the user
never typed. Same wrong field is why the preview only said "Hook udah jadi".

All ten hooks are now shown, ranked by the model's own `score`, selectable, and
the pick is persisted as `chosen_hook` and is what the script is written
against. Preflight validates locally so the route's 400 never reaches the UI.

### Admin batch 1 — done

`setProStatus`, `setAdminRole` (refuses to strip the last admin), `deleteUser`
(refuses admins and self), plus `recentAuditLog`. Every mutation now writes to
`audit_log`, which had never been written to since it was created.

The UI ran on `prompt()`/`confirm()`/`alert()` and a table that pushed its
actions column off-screen on a phone. Replaced with cards + a bottom sheet;
confirmation is inline and in plain language. Removed the last `divide-zinc-800`.

### The generated script was never rendered

A card in "Siap" said "syuting, posting" and showed nothing to shoot from. Six
scenes, a CTA, a caption and hashtags were in the row, invisible. New
`ScriptView`: a **Baca** tab (continuous voice-over, hook → body → CTA →
closing) and a **Scene** tab (timestamp, spoken, on-screen text, footage), plus
copy and Markdown download.

### Creator DNA now captures point of view

Migration `creator_dna_depth` adds `work_context` (sendiri | klien | brand),
`client_brief`, `industry`, `goals`, `persona_style`, `experience_level`,
`content_pillars`, `posting_frequency`, `reference_creators`, `humor_level`.

`buildSharedContext` switches narrative POV on `work_context` — "gue" for a
personal brand, "kami" in-house, behind-the-camera for client work. Previously
everything defaulted to first-person-owner, so client work read wrong in a way
tone tuning could not fix.

Prompts also gained an explicit anti-AI-voice section naming the tells (banned
opener phrases, no definition intros, varied rhythm, concrete detail, no
emoji-as-content, no lecturing). Asking for "natural" does not work; naming the
list does.

The onboarding form was rebuilt into three steps and now collects all of it,
with a completeness meter counting exactly the fields that reach the prompt.

### Two more instances of the "guess the refund bucket" bug

`/api/onboarding` refunded a failed DNA analysis with `grant_credits` into
`free`. Now carries a ref and calls `refund_credits`. **If you find another
`grant_credits` used as a refund anywhere, it is the same bug.**

### Admin batch 2 — runtime config

`app_config` + `lib/config`: model per tier, credit cost per module, and a
per-module kill switch, all read on every generation with the old hardcoded
values as fallbacks. Editable at `/admin/config`. A disabled module returns 503
and the user is not charged.

**Trap worth remembering:** config now wins over env. The seeded model ids were
`gemini-2.5-*`; the ids actually in use are `gemini-3.1-flash-lite` and
`gemini-3.6-flash`. Shipping the seed would have 404'd every generation. If you
add a config key that overrides an env var, read the env value first.

### Admin overview and nav

2×2 stat grid, quota as bars, and the last 8 `audit_log` entries — the table's
first surface. Nav gained icons and a 52px touch target; it was four bare
labels clipping against the browser chrome.

### `trends` is no longer empty

Ran `/api/cron/trends` for real: **5 active rows**. Every prompt had been
running trend-blind until now. This is also the first end-to-end proof this
session that the Gemini layer works on a live route.

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

1. Confirm Ide Hari Ini, Idea Engine and pipeline hook→script actually complete
   and deduct credits, on a phone. Still never observed by an agent.
2. **Batch 3 — charts.** The activity feed shipped on `/admin/overview`; the
   time-series side did not. Generations per day, credits burned, error rate
   per module. `gemini_usage` and `credit_ledger` already hold the data.
3. **Batch 4** — storage/data browser, `topup_proofs` review and delete.
   Remember the bucket is private now; use signed URLs, do not make it public.
4. **Vibe Coding Kit output quality.** The human's word is "kurang maksimal".
   Not yet diagnosed — read `src/lib/prompts/vibe.ts` against a real run before
   changing anything. The anti-AI-voice rules added to `lib/prompts/index.ts`
   are **not** applied to the vibe prompt; that is probably the first fix.
5. **Premium UI pass.** Dashboard still needs the "why this is useful" copy —
   gaul, humble, no swipes at anyone. `/admin/topups`, `/admin/vouchers`,
   profile, topup and the pipeline's desktop board still carry old layouts.
   `ui-ux-pro-max` suggested accent `#DC2626`; **rejected** — AGENTS.md §2
   forbids colours not in `DESIGN.md`. Ember stays.
6. `verifyAdmin()` gates every admin action and is degree 8 in the graph. It
   is now also the gate on runtime config. Audit it before extending further.

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
