# Malesan

**Males mikirnya. Bukan bikinnya.**

AI content-ideation tool for Indonesian creators. It removes the blank-page moment — the
bottleneck is not filming or editing, it is deciding *what* to make, *how* to hook, and *what*
to say.

Malesan is for people who are lazy about the **thinking**, not the craft. The user still
films, edits and performs.

---

## Status

Step **1 of 13**. Landing page and design system only — no auth, no database, no AI yet.
See [`ROADMAP.md`](ROADMAP.md) for the build order and [`HANDOFF.md`](HANDOFF.md) for exactly
where things stand.

## Stack

Next.js 16 (App Router) · TypeScript · Tailwind CSS v4 · Framer Motion · Supabase ·
Google Gemini · Vercel

## Running it

```bash
npm install
npm run dev
```

Then open http://localhost:3000.

```bash
npm run build      # production build
npm run lint       # eslint
npm run typecheck  # tsc --noEmit
```

## Configuration

Copy `.env.example` to `.env.local` and fill it in. `.env.local` is gitignored and must stay
that way — no key of any kind belongs in a commit.

Nothing in the app is runnable against real services yet; steps 2–4 wire up Supabase and
Gemini.

## For agents

**Read [`AGENTS.md`](AGENTS.md) first.** It is the canonical instruction file — the hard
rules, the working protocol, and the reading order. `CLAUDE.md` only points there.

The short version: one roadmap step per session, self-test it, update `HANDOFF.md`, commit,
stop. Never invent a feature that is not in `ROADMAP.md` — write it in PROPOSALS instead.

| File | What it holds |
|---|---|
| [`AGENTS.md`](AGENTS.md) | Rules every agent must obey |
| [`HANDOFF.md`](HANDOFF.md) | Live session state — start here, then next action |
| [`DECISIONS.md`](DECISIONS.md) | Append-only log of *why* choices were made |
| [`PRD.md`](PRD.md) | Product requirements, credit economy, anti-abuse |
| [`SCHEMA.md`](SCHEMA.md) | Tables, SQL functions, RLS policies |
| [`DESIGN.md`](DESIGN.md) | Tokens, typography, motion, copy voice |
| [`PROMPTS.md`](PROMPTS.md) | AI prompt library (Indonesian) |
| [`ROADMAP.md`](ROADMAP.md) | 14 build steps and their status |
