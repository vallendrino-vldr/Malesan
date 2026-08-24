# Design Specification: Clean Minimalist Scene Footage Editor (Option A: Unified Slim Input Bar)

## 1. Overview & Goals
Redesign the custom footage input box in `ScriptView.tsx` to be ultra-compact, slim, and space-efficient. Replace the bulky stacked layout with a unified input bar containing an inline end-adornment action button `Sesuaikan`, cutting vertical height by over 50% and preventing text wrapping on mobile screens.

## 2. Design Details (Option A)

### 2.1 Trigger Button
- **Style:** Border dashed `border-white/15 hover:border-ember/40 bg-white/[0.02] hover:bg-ember/[0.06] text-ink/80 hover:text-ember`.
- **Icon:** 14px vector film strip SVG line art.
- **Label:** `+ Tambah rekaman atau footage sendiri`

### 2.2 Expanded Footage Box (Ultra-Compact 2-Line Layout)
- **Line 1 (Header):**
  - Left: Monospace micro label with 12px film icon: `BAHAN REKAMAN PRIBADI`
  - Right: Minimalist `Tutup` button.
- **Line 2 (Unified Input Bar):**
  - An input wrapper `relative flex items-center rounded-lg border border-white/10 bg-obsidian/90 p-1 focus-within:border-ember/60 transition-colors`.
  - Text input: `flex-1 bg-transparent px-2.5 py-1 text-xs text-ink placeholder:text-muted/40 outline-none` with placeholder `"Ketik rekaman yang kamu punya..."`.
  - Inline Action Button: `inline-flex shrink-0 items-center gap-1 rounded-md bg-ember px-2.5 py-1.5 text-micro font-bold text-obsidian shadow-sm hover:bg-ember-lo transition-all disabled:opacity-40 active:scale-95`.
    - Label: `Sesuaikan` (or loading indicator when adapting).
- **Result:** Compact 2-line footprint, zero redundant helper text, zero vertical waste.

## 3. Verification Plan
- `npm run build` (0 errors across 41 routes)
- `npm test` (11 tests pass)
- Visual capture via DevTools MCP on `http://localhost:3001/app?tab=pipeline` at mobile 390x844.
