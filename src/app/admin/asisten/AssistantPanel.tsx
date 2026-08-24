"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { LiveRefresh } from "@/components/LiveRefresh";

/**
 * The assistant screen.
 *
 * It runs itself on open rather than waiting to be asked. The question someone
 * has when they land here is almost always the same one — "what do I need to
 * deal with" — and making them type it first is asking them to do the easy part
 * of the job manually.
 *
 * Every recommendation renders as a link to the screen that does the thing, not
 * a button that does it. See the route for why.
 */

type Item = {
  severity: string;
  title: string;
  detail: string;
  action: string;
  href: string;
};

type Result = {
  headline: string;
  answer: string;
  attention: Item[];
  allClear: boolean;
};

const TONE: Record<string, string> = {
  tinggi: "border-danger/35 bg-danger/10 text-danger",
  sedang: "border-ember/40 bg-ember/10 text-ember",
  rendah: "border-hairline bg-surface-raised text-muted",
};

const QUICK = [
  "Apa yang perlu gue urus sekarang?",
  "Kondisi duit dan topup gimana?",
  "Ada yang error atau mau mentok kuota?",
  "Produknya kepakai gak? Modul mana yang laku?",
];

export function AssistantPanel() {
  const [question, setQuestion] = useState("");
  const [result, setResult] = useState<Result | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [asked, setAsked] = useState("");
  const ranOnce = useRef(false);

  const ask = useCallback(async (q: string) => {
    setLoading(true);
    setError("");
    setAsked(q);
    try {
      const res = await fetch("/api/admin/assistant", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question: q }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error ?? "Gagal nanya ke asisten.");
      setResult(json as Result);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Gagal nanya ke asisten.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (ranOnce.current) return;
    ranOnce.current = true;
    ask("Apa yang perlu gue urus sekarang?");
  }, [ask]);

  return (
    <div className="space-y-4">
      <LiveRefresh tables={["topups", "error_log"]} silent />

      <header>
        <h1 className="font-display text-xl font-bold text-ink">Asisten</h1>
        <p className="mt-1 text-sm leading-relaxed text-muted">
          Baca semua kondisi platform sekaligus, terus bilang mana yang perlu
          diurus. Dia cuma ngasih saran — yang mutusin dan ngeksekusi tetap lo.
        </p>
      </header>

      <div className="flex items-center gap-1.5 overflow-x-auto pb-1 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden sm:flex-wrap">
        {QUICK.map((q) => (
          <button
            key={q}
            onClick={() => ask(q)}
            disabled={loading}
            className="shrink-0 whitespace-nowrap min-h-9 sm:min-h-11 cursor-pointer rounded-full border border-hairline bg-surface px-3 sm:px-3.5 text-micro font-semibold text-muted transition-colors duration-[var(--duration-standard)] ease-heat hover:border-ember/40 hover:text-ember disabled:opacity-50"
          >
            {q}
          </button>
        ))}
      </div>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (question.trim()) ask(question.trim());
        }}
        className="flex gap-2"
      >
        <input
          value={question}
          onChange={(e) => setQuestion(e.target.value)}
          placeholder="Tanya apa aja soal platform lo…"
          aria-label="Pertanyaan buat asisten"
          className="min-h-11 min-w-0 flex-1 rounded-xl border border-hairline bg-obsidian px-3.5 text-sm text-ink placeholder:text-muted focus:border-ember focus:outline-none"
        />
        <button
          type="submit"
          disabled={loading || !question.trim()}
          className="btn-ember min-h-11 shrink-0 cursor-pointer rounded-xl px-4 font-display text-sm font-bold text-obsidian disabled:opacity-45"
        >
          Tanya
        </button>
      </form>

      {loading && (
        <div className="surface-card rounded-2xl border border-ember/25 bg-surface/90 p-5 space-y-3 shadow-sm" aria-busy="true">
          <div className="flex items-center gap-2">
            <span className="size-2 rounded-full bg-ember animate-ping" />
            <span className="eyebrow text-ember">Menganalisis data platform...</span>
          </div>
          <div className="space-y-2 pt-1">
            <div className="h-4 w-3/4 animate-pulse rounded-md bg-white/[0.08]" />
            <div className="h-3.5 w-full animate-pulse rounded-md bg-white/[0.05]" />
            <div className="h-3.5 w-5/6 animate-pulse rounded-md bg-white/[0.05]" />
          </div>
        </div>
      )}

      {error && !loading && (
        <div
          role="alert"
          className="rounded-xl border border-danger/25 bg-danger/10 px-4 py-3"
        >
          <p className="text-mini leading-relaxed text-danger">{error}</p>
          <button
            onClick={() => ask(asked || "Apa yang perlu gue urus sekarang?")}
            className="mt-2 min-h-11 cursor-pointer text-mini font-bold text-ink underline-offset-2 hover:underline"
          >
            Coba lagi
          </button>
        </div>
      )}

      {result && !loading && (
        <>
          <section className="surface-card rounded-2xl p-4">
            <p className="eyebrow text-ember">{asked}</p>
            <h2 className="mt-1.5 font-display text-base font-bold leading-snug text-ink">
              {result.headline}
            </h2>
            <p className="mt-2 text-sm leading-relaxed text-muted">{result.answer}</p>
          </section>

          {result.attention.length > 0 ? (
            <section>
              <h3 className="eyebrow mb-2 text-muted">Perlu diurus</h3>
              <ol className="space-y-2">
                {result.attention.map((a, i) => (
                  <li
                    key={i}
                    className={`rounded-xl border p-3.5 ${TONE[a.severity] ?? TONE.rendah}`}
                  >
                    <p className="font-display text-sm font-bold">{a.title}</p>
                    <p className="mt-1 text-mini leading-relaxed opacity-90">{a.detail}</p>
                    <Link
                      href={a.href}
                      className="mt-2.5 inline-flex min-h-11 items-center rounded-lg border border-current/35 px-3.5 text-mini font-bold"
                    >
                      {a.action} →
                    </Link>
                  </li>
                ))}
              </ol>
            </section>
          ) : (
            <p className="rounded-xl border border-dashed border-hairline px-4 py-8 text-center text-sm text-muted">
              Gak ada yang mendesak. Santai dulu.
            </p>
          )}

          <p className="text-micro leading-relaxed text-muted">
            Asisten ini cuma baca data dan ngasih saran. Dia gak bisa approve
            topup, nambah kredit, nge-ban, atau ubah setting — itu semua tetap
            lewat tangan lo, biar gak ada yang kejadian tanpa lo tau.
          </p>
        </>
      )}
    </div>
  );
}
