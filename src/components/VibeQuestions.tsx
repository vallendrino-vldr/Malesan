"use client";

import { useState } from "react";
import type { VibeQuestion } from "@/lib/prompts/vibe";

/**
 * The clarifying-question step.
 *
 * A one-sentence idea produces a one-sentence-deep spec. The model has to invent
 * the user, the constraint and the priority, and invented context is what
 * "generic output" is made of — no prompt tuning fixes missing information.
 *
 * Three deliberate choices:
 *
 *  - **Suggestions are tappable.** Five open textareas is a form people abandon,
 *    and an abandoned form teaches the model nothing. Every question ships with
 *    answers generated for *this* idea, so the whole step can be thumbed through.
 *  - **Every question is skippable, and so is the whole step.** A required step
 *    between someone and the thing they came for is a step they resent.
 *  - **Each question says why it is being asked.** Otherwise it reads as a form
 *    standing between the user and their documents, rather than the reason those
 *    documents will be any good.
 */
export function VibeQuestions({
  questions,
  onDone,
  onSkipAll,
  busy,
}: {
  questions: VibeQuestion[];
  onDone: (answers: { q: string; a: string }[]) => void;
  onSkipAll: () => void;
  busy: boolean;
}) {
  const [answers, setAnswers] = useState<Record<number, string[]>>({});
  const [custom, setCustom] = useState<Record<number, string>>({});

  const toggle = (i: number, value: string, multi: boolean) => {
    setAnswers((prev) => {
      const cur = prev[i] ?? [];
      if (cur.includes(value)) return { ...prev, [i]: cur.filter((v) => v !== value) };
      return { ...prev, [i]: multi ? [...cur, value] : [value] };
    });
  };

  const collect = () =>
    questions.map((q, i) => {
      const picked = answers[i] ?? [];
      const typed = (custom[i] ?? "").trim();
      const all = typed ? [...picked, typed] : picked;
      return { q: q.q, a: all.join("; ") };
    });

  const answered = questions.filter(
    (_, i) => (answers[i]?.length ?? 0) > 0 || (custom[i] ?? "").trim(),
  ).length;

  return (
    <div className="space-y-4">
      <div className="surface-card rounded-2xl p-5">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="eyebrow text-ember">Biar hasilnya nggak generik</p>
            <h3 className="mt-1.5 font-display text-lg font-bold text-ink">
              Jawab dulu, {questions.length} pertanyaan aja
            </h3>
          </div>
          <span className="shrink-0 rounded-full bg-obsidian px-2.5 py-1 font-mono text-[11px] text-muted">
            {answered}/{questions.length}
          </span>
        </div>
        <p className="mt-2 text-[12.5px] leading-relaxed text-muted">
          Tinggal tap jawabannya. Kalau dilewatin, AI-nya bakal nebak sendiri — dan
          tebakan itu yang bikin hasilnya kerasa umum.
        </p>
      </div>

      {questions.map((q, i) => {
        const picked = answers[i] ?? [];
        return (
          <div key={i} className="surface-card rounded-2xl p-4">
            <p className="text-sm font-semibold leading-snug text-ink">
              <span className="text-muted">{i + 1}.</span> {q.q}
            </p>
            {q.why && (
              <p className="mt-1 text-[11px] leading-relaxed text-ember-lo">{q.why}</p>
            )}

            {q.suggestions.length > 0 && (
              <div className="mt-2.5 flex flex-wrap gap-1.5">
                {q.suggestions.map((s) => {
                  const on = picked.includes(s);
                  return (
                    <button
                      key={s}
                      type="button"
                      onClick={() => toggle(i, s, q.multi)}
                      aria-pressed={on}
                      className={`skeu-press cursor-pointer rounded-full border px-3 py-1.5 text-[12px] font-medium transition-colors duration-[var(--duration-standard)] ease-heat ${
                        on
                          ? "border-ember/45 bg-ember/10 text-ember"
                          : "border-hairline bg-surface-raised text-muted hover:border-ember/25 hover:text-ink"
                      }`}
                    >
                      {s}
                    </button>
                  );
                })}
              </div>
            )}

            <input
              value={custom[i] ?? ""}
              onChange={(e) => setCustom((p) => ({ ...p, [i]: e.target.value }))}
              placeholder={q.multi ? "Atau tulis sendiri..." : "Atau jawab pakai kata lo sendiri..."}
              className="skeu-inset mt-2.5 w-full rounded-lg border border-hairline bg-obsidian px-3 py-2 text-[13px] text-ink placeholder:text-muted focus:border-ember focus:outline-none"
            />

            {q.multi && (
              <p className="mt-1.5 text-[10.5px] text-muted">Boleh pilih lebih dari satu.</p>
            )}
          </div>
        );
      })}

      <div className="flex gap-2 pb-2">
        <button
          type="button"
          onClick={onSkipAll}
          disabled={busy}
          className="cursor-pointer rounded-xl border border-hairline px-4 py-3 text-[13px] font-semibold text-muted transition-colors hover:text-ink disabled:opacity-50"
        >
          Lewatin
        </button>
        <button
          type="button"
          onClick={() => onDone(collect())}
          disabled={busy}
          className="btn-ember flex-1 cursor-pointer rounded-xl px-5 py-3 font-display text-sm font-bold text-obsidian disabled:opacity-60"
        >
          {busy
            ? "Bentar..."
            : answered === 0
              ? "Generate tanpa jawaban"
              : `Generate pakai ${answered} jawaban`}
        </button>
      </div>
    </div>
  );
}
