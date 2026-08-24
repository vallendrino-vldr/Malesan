# Design Specification: Compact Kanban Layout for Scene Footage Editor (Option 1)

## 1. Overview & Goals
Fix desktop 4-column kanban layout overflow and offside button collision in `ScriptView.tsx`. In narrow ~240px desktop kanban cards, prevent flex child overflow with `min-w-0`, streamline headers to single-line labels (`ARAHAN VISUAL`, `REKAMAN SENDIRI`), and make action buttons compact (`[ AI ]`, `[ Sesuaikan ]`) so they never wrap into multiple awkward lines or overflow horizontally.

## 2. Design Details (Option 1)

### 2.1 Streamlined Headers
- **Visual Section Header:**
  - Label: `ARAHAN VISUAL` with 12px `FilmIcon`. (Fits in 1 single line on desktop & mobile).
  - Quick Helper Button: `[ AI ]` with 10px `SparkleIcon` (fits in 44px width, single-line).
- **Custom Footage Box Header:**
  - Label: `REKAMAN SENDIRI` with 12px `FilmIcon`.
  - Right: `Tutup` button.

### 2.2 Fluid Flexbox Input Bar with `min-w-0`
- **Container:** `w-full min-w-0 flex items-center gap-1.5 rounded-lg border border-white/10 bg-obsidian p-1 focus-within:border-ember/60 transition-colors`.
- **Input:** `min-w-0 flex-1 bg-transparent px-2 py-1 text-xs text-ink placeholder:text-muted/40 outline-none` with placeholder `"Ketik rekaman yang kamu punya..."`.
  - Adding `min-w-0` removes HTML input's default 180px intrinsic min-width floor, allowing it to flex naturally inside any card width.
- **Action Button:** `shrink-0 inline-flex items-center gap-1 rounded-md bg-ember px-2 py-1 text-micro font-bold text-obsidian whitespace-nowrap shadow-sm hover:bg-ember-lo transition-all disabled:opacity-30 active:scale-95`.
  - Label: `Sesuaikan` (with 10px `SparkleIcon`).

### 2.3 Container Guardrail
- `ScriptView` container: `overflow-x-hidden w-full` to strictly forbid horizontal scrolling in kanban columns.

## 3. Verification Plan
- `npm run build` (0 errors across 41 routes)
- `npm test` (11 tests pass)
- Visual capture via DevTools MCP on `http://localhost:3001/app?tab=pipeline` at desktop 1440x900 and mobile 390x844.
