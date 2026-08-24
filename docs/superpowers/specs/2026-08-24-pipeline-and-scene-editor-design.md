# Design Spec: Pipeline Polish, Context-Aware Timeline Alur & Interactive Scene Footage Editor

**Date:** 2026-08-24  
**Author:** Antigravity  
**Status:** Approved by User  

---

## 1. Executive Summary & Goals

This specification covers 4 core improvements to the Malesan Studio and Pipeline experience:
1. **Pipeline Action & Navigation Button Affordance**: Transform "Bikin hook", "Bikin script", and stage navigation buttons (`Draft →`, `← Ide`) from muted low-contrast elements into prominent, active, interactive components with solid brand ember styling and hover glow.
2. **Context-Aware Loading Timeline Engine**: Replace the single hardcoded loading timeline with module-specific timeline phases and companion dialogue for **Ide Hari Ini**, **Hook Lab**, **Script Engine**, **Pipeline Hook/Script**, **Vibe Coding**, and **Repurpose**.
3. **Glitch-Free Pipeline Stream Completion**: Ensure SSE streams in Pipeline immediately notify `completeStudioProcessing()` on completion without hanging at 95% during DB persistence.
4. **Interactive Scene Studio Editor & AI Footage Helper in Tab "Siap"**: Upgrade `ScriptView` into a fully editable workspace allowing creators to:
   - Edit voiceover text, on-screen text, and footage descriptions inline.
   - Input their own custom footage notes (e.g., "Gue punya rekaman layar laptop").
   - Click an AI assistant button (`✨ AI Footage`) to intelligently adapt footage directions to match what the creator actually has.
   - Automatically persist all modifications back to the pipeline card in Supabase.

---

## 2. Detailed Technical Design

### A. Pipeline Action & Navigation Buttons (`PipelineBoard.tsx`)
- **"Bikin hook · 2 kredit"**:
  - Class: `w-full rounded-xl bg-ember py-2.5 px-4 text-xs font-bold text-obsidian shadow-[0_0_20px_rgba(255,138,61,0.25)] hover:bg-ember/90 cursor-pointer active:scale-[0.98] transition-all`
- **Stage Navigation (`StageMover`)**:
  - `Draft →`, `← Ide`, `Siap →`: Styled with `bg-white/[0.06] border border-white/[0.08] text-ink font-semibold hover:border-ember/40 hover:bg-ember/10 hover:text-ember px-3 py-1.5 rounded-lg text-micro transition-all`.
  - Reorder arrows: High-contrast hover with ember active indicators.

---

### B. Module-Specific Timeline Phases & Companion Dialogue (`AIProcessingOverlay.tsx`, `ProcessingTimeline.tsx`, `LivingProcessingCompanion.tsx`)

A single registry `MODULE_TIMELINE_CONFIGS` maps each `moduleKey` or `actionType` to dedicated 4-phase steps and dialog messages:

| Module Key | Phase 1 (0-25%) | Phase 2 (25-55%) | Phase 3 (55-85%) | Phase 4 (85-100%) |
|---|---|---|---|---|
| **ide** / **ide-hari-ini** | **Membaca ide lo**<br>_Nyari pola terbaik topik._ | **Nyaring kemungkinan**<br>_Milih angle paling cocok._ | **Kurasi 3 ide terbaik**<br>_Nyiapin judul & format._ | **Siap dipakai**<br>_Ide konten pertama siap._ |
| **hook** / **pipeline-hook** | **Bedah inti cerita**<br>_Identifikasi problem audiens._ | **Racik 3 detik pertama**<br>_Bikin formula pembuka viral._ | **Uji daya pikat retensi**<br>_Kombinasi emosi & visual._ | **Hook siap dipilih**<br>_Pilihan hook terbaik siap._ |
| **script** / **pipeline-script** | **Analisis hook terpilih**<br>_Kunci fondasi naskah._ | **Bangun alur retensi**<br>_Struktur pacing & isi daging._ | **Tulis VO & footage**<br>_Pecah scene & arahan visual._ | **Naskah lengkap siap**<br>_Script siap untuk syuting._ |
| **vibe** / **app** | **Analisis kebutuhan app**<br>_Membaca instruksi fitur._ | **Susun arsitektur**<br>_Rancang struktur UI & state._ | **Generate kode & logic**<br>_Build komponen interaktif._ | **App siap preview**<br>_Aplikasi siap dicoba._ |
| **repurpose** | **Membaca transkrip**<br>_Ekstraksi pesan inti._ | **Format ulang media**<br>_Sesuaikan pola platform._ | **Optimasi tone & CTA**<br>_Poles gaya penyampaian._ | **Konten siap sebar**<br>_Multi-format selesai._ |

---

### C. Pipeline Generation Stream Completion Fix
- In `PipelineBoard.tsx` `handleGenerate`:
  - When `finalResult` is received via SSE `msg.done`, trigger `completeStudioProcessing()` before or in parallel with `updateCardContentAndStatus()`.
  - Pass the active `moduleKey` (`"hook"` or `"script"`) directly to `startStudioProcessing({ moduleKey: "pipeline-hook" })` so the overlay displays the matching timeline phases.

---

### D. Interactive Scene & Footage Studio (`ScriptView.tsx`)

#### 1. Data Structure & Persistence
- Card content stores `generated_script` (an object containing `script: ScriptScene[]`, `caption`, `hashtags`, `cta`).
- `ScriptView` receives `onSave?: (updatedScript: ScriptOutput) => Promise<void>` prop from `PipelineBoard`.

#### 2. Features per Scene in "Scene" Tab:
1. **Scene Header**: Timestamp badge (e.g. `0:00-0:04`) with quick edit option.
2. **Spoken Voiceover Textarea**: Editable text with live character/word counter.
3. **On-Screen Text Input**: Quick edit for graphics/text on screen.
4. **Footage Director Box**:
   - Displays the current visual instruction.
   - **User Custom Footage Input / Note**: A toggleable input: *"Punya rekaman sendiri? Ketik di sini..."* (e.g. *"Gue punya video pas unboxing sparepart"*).
   - **`✨ AI Sesuaikan Footage` Action**:
     - Calls `/api/generate` with a lightweight scene-refinement prompt taking the creator's available footage/context and rewriting the visual direction for that specific scene.
     - Seamless inline loader and instant replacement.
5. **Autosave / Save Changes Button**:
   - Changes are debounce-autosaved or saved with a clear "Simpan Perubahan" indicator.

---

## 3. Verification & Safety Plan

1. **`next build` Compilation**: 41 static & dynamic routes compile with zero TypeScript errors.
2. **`npm test`**: 11 invariant & video tests pass.
3. **Interactive Testing via Chrome DevTools**:
   - Test "Bikin hook" button in Pipeline: verify solid orange styling and active cursor.
   - Test loading overlay during Hook generation: verify it displays "Bedah inti cerita", "Racik 3 detik pertama", etc.
   - Test "Bikin script" generation: verify it uses script-specific phases and completes smoothly to 100% without sticking at 95%.
   - Test Tab "Siap": edit scene voiceover and footage, test AI Footage assistance, and verify persistence after page reload.
