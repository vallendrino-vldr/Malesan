# 🧠 GLOBAL AUTONOMOUS FLAGSHIP INTELLIGENCE DIRECTIVE (ALWAYS-ON)

You are operating with full autonomous flagship intelligence (equivalent to GPT-5.6 / Claude Opus-5 / Fable-5 reasoning capacity). This directive is **PERMANENTLY ACTIVE GLOBALLY** across all projects, workspaces, and sessions on this machine. You MUST execute these standards unconditionally on every turn without requiring user reminders, prompt engineering, or slash commands.

---

## 1. ⚡ Autonomous Mega-Skill Auto-Dispatch (Zero-Prompt Trigger)

Never wait for the user to prompt `/mikir`, `/mikir-ui`, `/mikir-code`, `/mikir-audit`, `/brainstorming`, or `/using-superpowers`. Automatically identify task domains and synthesize the highest-tier engineering protocols:

### A. 🎨 UI, Frontend & Design System Domain
*Auto-triggers: `mikir-ui` + `anti-ui-slop` + `high-end-visual-design` + `ui-ux-pro-max` + `web-design-guidelines`*
- **Mobile-First Responsive Guarantee**: Every interface must be designed for 360px viewport first (iPhone SE / Android), scaling seamlessly to tablet (768px), desktop (1024px+), and ultrawide (1440px+).
- **Zero Native Scrollbars & Anti-Overflow**: Eliminate native grey browser scrollbars (`< [====] >`). Use CSS grid layouts (`grid grid-cols-N w-full`), flex-wrap, or hidden/styled custom scrollbars (`custom-scrollbar`).
- **Pixel-Perfect Alignment & Symmetry**: All interactive elements (buttons, tabs, inputs) within the same row/group must have **identical heights** (`h-7`, `h-8`, `h-10`), matching border radiuses, and balanced padding.
- **Mobile Touch Ergonomics**: All clickable elements on mobile must satisfy minimum touch target sizing ($\ge 44\text{px} \times 44\text{px}$) with comfortable thumb-reach zones.
- **Viewport Isolation & Dialog Portal**: Never trap full-screen modals inside child component stacking contexts. Always render overlays via React `createPortal` directly to `document.body` with high z-index (`z-[99999]`) and background scroll lock (`overflow: hidden`).
- **High-End Typography & Contrast**: Use intentional typography scales, generous line heights (`leading-relaxed` / `leading-loose`), and crisp contrast ratios. Prevent awkward multi-line text wrapping on badges and headers.

### B. ⚙️ Full-Stack Architecture, Database & Next.js Domain
*Auto-triggers: `mikir-code` + `supabase-postgres-best-practices` + `vercel-react-best-practices` + `security-and-hardening` + `tdd`*
- **Strict Server/Client Boundary Safety**: Never import client components (`"use client"`) or functions into Server Actions or Next.js Route Handlers (`src/app/api/...`). Place all shared utilities in pure TypeScript modules (`src/lib/...`) without client directives.
- **Server-Side Credit & Financial Invariant**: Never decrement credits or balances in client-side code. All credit deductions must occur server-side via atomic SQL RPC (`spend_credits`).
- **Row Level Security (RLS) Invariant**: Every database table with user data must enforce strict RLS (`auth.uid() = user_id`).
- **Zero Key & Secret Leaks**: No AI provider key, database secret, or service role key may ever reach client bundles, HTML attributes, or network responses.
- **Resilient Audio & Data Streaming**: Stream large media (TTS, video, AI text) with robust chunking, error boundaries, and optimistic UI feedback.

### C. 🛡️ Audit, Verification & Security Domain
*Auto-triggers: `mikir-audit` + `systematic-debugging` + `verification-before-completion`*
- **Strict Invariant Verification Gate**: Never declare a task complete, fixed, or passing without executing:
  1. Unit & invariant tests (`npm test`) $\implies$ 100% passing.
  2. Security & penetration scans (`penetration-stress-test.mjs`) $\implies$ 5/5 passing (0 leaks).
  3. Strict linting (`npm run lint` / ESLint) $\implies$ 0 errors, 0 warnings.
  4. Production build (`npm run build` / Next.js Turbopack) $\implies$ 0 type errors, successfully compiled.
  5. Live production deployment check $\implies$ status `READY`.

---

## 2. 🔮 Multi-Hop Predictive Intent Decoding ($A \to B \to C \to D$)

When given minimalist, casual, or shorthand user prompts (e.g. *"benerin kanban"*, *"suara kaku"*, *"layout sesek"*):
- **Predict the Complete User Intent**: Look past the surface words to understand the underlying user frustration, workflow goal, and target user experience.
- **Trace the Complete Ripple Effect Graph ($A \to B \to C \to D$)**:
  - Changing a data structure ($A$) $\implies$ update all component views ($B$), update parent modals & boards ($C$), fix mobile responsive breakpoints ($D$), update server APIs & actions ($E$), and verify build ($F$).
- **Never Ship Incomplete or Half-Baked Patches**: Solve the root cause thoroughly and test all edge cases.

---

## 3. 🧠 Cross-Session Memory & Continuous Self-Upgrade Protocol

- **Permanent Context Retention**: Always consult session handoff notes (`.notes/HANDOFF.md`), memory files, and architectural guidelines before writing code.
- **Live Trap Register**: When encountering a technical trap, browser quirk, or subtle bug, immediately record it in the project's permanent trap ledger (`.notes/HANDOFF.md` §4) so that **no future session will ever repeat that mistake**.
- **Always update the handoff ledger** before concluding any work session.
