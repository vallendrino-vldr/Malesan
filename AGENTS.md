# AGENTS.md — start here, whatever agent you are

Universal entry point for **any** coding agent working on this repo — Claude Code,
Codex, opencode, Cursor, Antigravity, Aider, or anything else. Read this first,
then follow the order below. **Do not audit the codebase file-by-file to orient
yourself.** These docs exist precisely so you don't have to, because the owner
pays per token and a session that burns its context rediscovering the repo
produces nothing.

## Read in this exact order

1. **`.notes/AGENTS.md`** — the canonical rules. Non-negotiables live here
   (credits, RLS, model ids in env, no keys in the browser, commit discipline,
   "update HANDOFF before ending a turn").
2. **`.notes/HANDOFF.md`** — live state: what works, what is in flight, and a
   table of traps that have each already cost hours. Its **"MULAI DARI SINI"**
   block at the top is the 20-line catch-up; read that even if you read nothing
   else.
3. **`ROADMAP.md`, `SCHEMA.md`, `DESIGN.md`, `DECISIONS.md`, `PROMPTS.md`** — pull
   in only the one you need for the task at hand.
4. **Obsidian vault at `Documents/Claude`** (`Home.md` is the index) — a
   cross-session "second brain": fast summaries and a per-session log. It is a
   convenience layer; if it and `.notes/HANDOFF.md` ever disagree, **HANDOFF
   wins**.

> `.notes/` is gitignored — it lives on the owner's machine, which is where every
> agent runs, so all agents see it locally. If you cloned fresh and it is missing,
> ask the owner rather than guessing.

## What this is (30-second version)

**Malesan** — a production **Next.js 16 + Supabase + Gemini** app for Indonesian
content creators. Live at **malesan.my.id**, auto-deploys from `main`, and takes
real money. The owner is **not a programmer**: explain work by its effect on the
product, in casual Bahasa Indonesia, and never claim something works until you
have run it and seen it.

## Current feature surface (updated 2026-08-08)

- **Studio modules:** Ide Hari Ini, Idea Engine, Hook Lab, Script, Repurpose,
  Vibe Coding, **Clip Engine**, **Thread Engine**, **Video Auto-CC** (word-level
  captions burned into the video client-side via canvas capture; audio extracted
  with ffmpeg.wasm and transcribed by **Groq Whisper**, key pool rotated).
- **Personalisation:** saved persona voices, reference material ("Otak Kedua"),
  CTA link injection, draft editor with autosave + Tab-to-complete.
- **Pipeline:** kanban board with AI posting-slot tagging.
- **Admin:** per-module credit pricing + kill switches (incl. Video), shadow
  prompt, token pricing + profit dashboard, read-only assistant.

## Non-negotiables (summary — full list in `.notes/AGENTS.md`)

- **Autonomous Mega-Skill Dispatch:** Never wait for the user to prompt `/mikir`, `/mikir-ui`, `/mikir-code`, or `/mikir-audit`. Automatically apply deep architectural reasoning, mobile-first anti-slop design (360px responsive, no scrollbars, equal button heights), server-side credit security, and comprehensive verification on every turn.
- **Predictive Intent Decoding ($A \to B \to C \to D$):** When receiving minimalist prompts, trace all connected components, modals, scripts, mobile layouts, and server actions before acting.
- Credits are spent **server-side only**, through the `spend_credits` SQL function (via `spendCredits` in `src/lib/credits.ts`). Never in client code.
- **RLS on every user table.** A user only ever reads/writes their own rows.
- **No AI provider key reaches the browser.** Model ids come from env/`app_config`, never hardcoded.
- **`next build` is the real gate**, not `tsc`. Verify in a browser before saying "done". `.notes/HANDOFF.md` §4 lists traps — read it before debugging anything.
- **Update `.notes/HANDOFF.md`** before ending any turn that changed a file.
- Provider keys go in **Vercel env** (an agent cannot set those — hand the exact variable names to the owner) and in local **`.env.local`** (gitignored).

<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
