# Design Specification: Clean Minimalist Scene Footage Editor (No Emojis)

## 1. Overview & Goals
Remove unicode emojis (`📹`, `🎬`, `✨`, `⚡`, etc.) from the scene footage editing UI and pipeline controls in `ScriptView.tsx` and `PipelineBoard.tsx`. Replace them with clean, refined typography, subtle vector SVG icons (14px monochrome line art), and Linear-grade minimalist dark UI styling.

## 2. Design Details

### 2.1 Trigger Button
- **Style:** Border dashed `border-white/15 hover:border-ember/40 bg-white/[0.02] hover:bg-ember/[0.06] text-ink/80 hover:text-ember`.
- **Icon:** Clean 14px vector film strip / video camera line icon SVG (`stroke-width="1.5"`).
- **Label:** `+ Tambah rekaman atau footage sendiri`

### 2.2 Expanded Footage Box
- **Header:** Monospace eyebrow `BAHAN REKAMAN PRIBADI` with a clean `Tutup` button.
- **Input:** Sleek input field with placeholder: `"Deskripsikan bahan rekaman yang kamu punya untuk scene ini..."`
- **Helper text:** `"AI akan menyesuaikan arahan visual di atas berdasarkan rekaman milikmu."`
- **Action CTA:** Solid brand button `Sesuaikan Arahan Visual` with optional clean 12px spark/wand SVG icon or pure typography.

### 2.3 Top Quick Action Button
- In the `Arahan Footage & Visual` section header, replace `✨ AI Sesuaikan Footage` with `Sesuaikan dengan AI` accompanied by a 12px clean vector SVG.

## 3. Verification Plan
- `npm run build` (0 errors across 41 routes)
- `npm test` (11 tests pass)
- Browser inspection in DevTools on `http://localhost:3001/app?tab=pipeline`
