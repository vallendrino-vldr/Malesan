"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { VibeQuestions } from "./VibeQuestions";
import LancarNgodingRoot from "./LancarNgoding/LancarNgodingRoot";
import {
  VIBE_KIT_DOCS,
  type VibeKitOutput,
  type VibeQuestion,
} from "@/lib/prompts/vibe";

type DocKey = (typeof VIBE_KIT_DOCS)[number]["key"];

/**
 * Idea starters.
 *
 * Each seed is a full sentence with a user, a job and a constraint — the same
 * shape the prompt needs to produce a spec worth reading. Short prompts like
 * "aplikasi keuangan" generate generic documents, so the starters double as a
 * worked example of how much detail to give.
 */
const STARTERS: { label: string; seed: string }[] = [
  {
    label: "Kasir warung",
    seed: "Aplikasi kasir buat warung kecil: catat penjualan harian, stok barang yang tinggal dikit dikasih peringatan, dan rekap untung rugi per minggu. Dipakai sambil berdiri, satu tangan, HP murah.",
  },
  {
    label: "Absensi karyawan",
    seed: "Absensi karyawan pakai foto selfie dan lokasi, buat usaha yang punya beberapa cabang. Owner bisa lihat siapa telat dan rekap jam kerja tiap akhir bulan buat hitung gaji.",
  },
  {
    label: "Katalog jualan",
    seed: "Katalog produk online yang tinggal share linknya ke WhatsApp. Pembeli pilih barang, checkout-nya langsung jadi pesan WhatsApp yang rapi ke penjual. Gak perlu bikin akun.",
  },
  {
    label: "Tracker kebiasaan",
    seed: "Pencatat kebiasaan harian yang gak bikin ngerasa bersalah kalau bolong. Fokus ke tren mingguan, bukan streak. Ada satu grafik yang gampang dibaca dan pengingat yang bisa dimatiin.",
  },
  {
    label: "Split bill",
    seed: "Aplikasi patungan buat teman-teman yang sering makan bareng: siapa bayar apa, siapa utang ke siapa, dan hitung siapa harus transfer ke siapa biar paling sedikit transaksinya.",
  },
  {
    label: "Jadwal les",
    seed: "Pengatur jadwal buat guru les privat: jadwal per murid, catatan tiap pertemuan, dan tagihan bulanan otomatis yang bisa dikirim ke orang tua.",
  },
];

export function VibeCodingStudio({ cost = 6 }: { cost?: number }) {
  const router = useRouter();
  const [hubMode, setHubMode] = useState<"learn" | "vibe">("learn");
  const [idea, setIdea] = useState("");
  const IDEA_STARTERS = STARTERS;
  const [stack, setStack] = useState("");
  const [audience, setAudience] = useState("");
  const [pending, setPending] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [kit, setKit] = useState<VibeKitOutput | null>(null);
  const [active, setActive] = useState<DocKey>("prd");
  const [copied, setCopied] = useState<DocKey | null>(null);
  const [step, setStep] = useState<{ done: number; total: number } | null>(null);
  // The clarifying-question step lives between the idea and the generation.
  const [questions, setQuestions] = useState<VibeQuestion[] | null>(null);
  const [asking, setAsking] = useState(false);

  /**
   * Step one: ask. A one-line idea makes a one-line-deep spec, so the questions
   * are worth the extra few seconds — and they are free, unlike the kit.
   *
   * Failure here is never a blocker: if the questions cannot be produced we go
   * straight to generating, because the user came for documents, not a form.
   */
  async function ask() {
    if (idea.trim().length < 12) {
      setError("Ceritain dulu mau bikin apa, minimal satu kalimat.");
      return;
    }
    setAsking(true);
    setError(null);
    try {
      const res = await fetch("/api/vibe/questions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ idea }),
      });
      const j = await res.json();
      if (j?.questions?.length) setQuestions(j.questions as VibeQuestion[]);
      else await runGenerate([]);
    } catch {
      await runGenerate([]);
    } finally {
      setAsking(false);
    }
  }

  async function runGenerate(answers: { q: string; a: string }[]) {
    setQuestions(null);
    setPending(true);
    setError(null);
    setKit(null);
    setStep(null);
    setStatus("Nyambungin...");

    try {
      const res = await fetch("/api/vibe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ idea, stack, audience, answers }),
      });

      if (!res.ok && res.headers.get("Content-Type")?.includes("json")) {
        const j = await res.json();
        throw new Error(j.error ?? "Gagal.");
      }
      const reader = res.body?.getReader();
      if (!reader) throw new Error("Gak ada respons dari server.");

      const decoder = new TextDecoder();
      let buffer = "";

      const drain = (flush: boolean) => {
        const frames = buffer.replace(/\r\n/g, "\n").split("\n\n");
        buffer = flush ? "" : (frames.pop() ?? "");
        for (const frame of frames) {
          for (const line of frame.split("\n")) {
            if (!line.startsWith("data:")) continue;
            const payload = line.slice(5).trim();
            if (!payload) continue;
            try {
              const msg = JSON.parse(payload);
              // The route reports real steps now ("SCHEMA.md kelar", 4 of 7).
              // The old character counter measured a single giant response that
              // no longer exists, and told the user nothing they could act on.
              if (typeof msg.step === "number" && typeof msg.total === "number") {
                setStep({ done: msg.step, total: msg.total });
              }
              if (msg.status) setStatus(msg.status);
              if (msg.error) setError(msg.error);
              if (msg.done && msg.kit) {
                setKit(msg.kit as VibeKitOutput);
                setStatus(null);
                // The header's credit count is rendered on the server. Without
                // this it kept showing the pre-generation balance, so a spend
                // that did happen looked like it had not.
                router.refresh();
              }
            } catch {
              /* partial frame mid-stream */
            }
          }
        }
      };

      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        drain(false);
      }
      // A short reply can arrive as one chunk with no trailing blank line, so
      // the tail must be drained on close or the last frame is lost.
      buffer += decoder.decode();
      drain(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Gagal bikin kit-nya.");
    } finally {
      setPending(false);
      setStatus(null);
      setStep(null);
    }
  }

  async function copyDoc(key: DocKey) {
    if (!kit) return;
    await navigator.clipboard.writeText(kit.docs[key]);
    setCopied(key);
    setTimeout(() => setCopied(null), 1600);
  }

  function downloadDoc(key: DocKey, file: string) {
    if (!kit) return;
    const blob = new Blob([kit.docs[key]], { type: "text/markdown" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = file;
    a.click();
    URL.revokeObjectURL(url);
  }

  function downloadAll() {
    if (!kit) return;
    for (const d of VIBE_KIT_DOCS) downloadDoc(d.key, d.file);
  }

  return (
    <section className="space-y-5">
      {/* Creation Hub Mode Switcher */}
      <div className="surface-card rounded-2xl border border-hairline/80 p-1 flex items-center gap-1 shadow-xs max-w-md mx-auto">
        <button
          type="button"
          onClick={() => setHubMode("learn")}
          className={`flex-1 h-8.5 flex items-center justify-center gap-1.5 rounded-xl text-xs font-semibold transition-all ${
            hubMode === "learn"
              ? "bg-ember text-obsidian font-bold shadow-xs"
              : "text-muted hover:text-ink"
          }`}
        >
          <span>🧠</span>
          <span className="font-display">Lancar Ngoding</span>
        </button>

        <button
          type="button"
          onClick={() => setHubMode("vibe")}
          className={`flex-1 h-8.5 flex items-center justify-center gap-1.5 rounded-xl text-xs font-semibold transition-all ${
            hubMode === "vibe"
              ? "bg-ember text-obsidian font-bold shadow-xs"
              : "text-muted hover:text-ink"
          }`}
        >
          <span>⚡</span>
          <span className="font-display">Bikin App AI</span>
        </button>
      </div>

      {hubMode === "learn" ? (
        <LancarNgodingRoot />
      ) : (
        <div className="space-y-6 animate-fadeIn">
          <header>
            <div className="inline-flex items-center gap-1.5 rounded-full bg-ember/15 px-3 py-1 text-micro font-bold tracking-wider text-ember border border-ember/30 uppercase">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="size-3.5 text-ember">
                <path d="m12 3-1.912 5.813a2 2 0 0 1-1.275 1.275L3 12l5.813 1.912a2 2 0 0 1 1.275 1.275L12 21l1.912-5.813a2 2 0 0 1 1.275-1.275L21 12l-5.813-1.912a2 2 0 0 1-1.275-1.275L12 3Z" />
                <path d="M5 3v4" />
                <path d="M19 17v4" />
                <path d="M3 5h4" />
                <path d="M17 19h4" />
              </svg>
              <span>AI Builder Studio</span>
            </div>
            <h2 className="mt-3 font-display text-2xl font-bold leading-tight tracking-display-md text-ink sm:text-3xl">
              Ceritain aplikasi yang mau lo bikin.
            </h2>
            <p className="mt-2 max-w-2xl text-xs sm:text-sm leading-relaxed text-muted">
              AI coding agent butuh instruksi matang. Malesan bakal racik seluruh Blueprint Arsitektur siap koding — PRD, design system, roadmap, aturan agent, skema database, dan prompt pembuka.
            </p>
          </header>

          {/* ---- input hero ---- */}
          <div className="surface-card rounded-3xl border border-ember/35 bg-gradient-to-b from-surface-raised/80 via-surface to-obsidian p-5 sm:p-6 shadow-md">
            <label htmlFor="vibe-idea" className="eyebrow block text-ember font-bold">
          Ide &amp; Konsep Aplikasi
        </label>
        <textarea
          id="vibe-idea"
          value={idea}
          onChange={(e) => setIdea(e.target.value)}
          rows={4}
          placeholder="Contoh: Aplikasi buat nyatet pengeluaran harian bareng pasangan, bisa split bill, ada grafik bulanan, dan gampang dipakai sambil jalan."
          className="mt-2.5 w-full resize-y skeu-inset rounded-2xl border border-hairline bg-obsidian px-4 py-3.5 text-sm sm:text-base leading-relaxed text-ink outline-none transition-colors duration-[var(--duration-standard)] ease-heat placeholder:text-muted/60 focus:border-ember/50"
        />

        {!idea.trim() && (
          <div className="mt-3">
            <p className="text-micro text-muted font-medium">Belum kepikiran? Mulai dari ide cepat ini:</p>
            <div className="mt-1.5 flex flex-wrap gap-1.5">
              {IDEA_STARTERS.map((s) => (
                <button
                  key={s.label}
                  type="button"
                  onClick={() => setIdea(s.seed)}
                  className="flex h-11 sm:h-auto items-center cursor-pointer rounded-full border border-hairline/80 bg-surface-raised/60 px-3.5 sm:px-3 sm:py-1.5 text-mini font-medium text-muted transition-colors duration-[var(--duration-standard)] ease-heat hover:border-ember/40 hover:text-ember-lo"
                >
                  {s.label}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Secondary options in clean subtle grid */}
        <div className="mt-4 grid gap-3 border-t border-hairline/60 pt-4 sm:grid-cols-2">
          <div>
            <label htmlFor="vibe-stack" className="eyebrow block text-muted">
              Tech Stack <span className="normal-case tracking-normal text-muted/70">(opsional)</span>
            </label>
            <input
              id="vibe-stack"
              value={stack}
              onChange={(e) => setStack(e.target.value)}
              placeholder="Next.js + Supabase, Flutter, dll."
              className="mt-1.5 w-full skeu-inset rounded-xl border border-hairline bg-obsidian px-3.5 py-2.5 text-xs sm:text-sm text-ink outline-none transition-colors duration-[var(--duration-standard)] ease-heat placeholder:text-muted/60 focus:border-ember/50"
            />
          </div>
          <div>
            <label htmlFor="vibe-audience" className="eyebrow block text-muted">
              Target User <span className="normal-case tracking-normal text-muted/70">(opsional)</span>
            </label>
            <input
              id="vibe-audience"
              value={audience}
              onChange={(e) => setAudience(e.target.value)}
              placeholder="Pasangan muda, UMKM, mahasiswa"
              className="mt-1.5 w-full skeu-inset rounded-xl border border-hairline bg-obsidian px-3.5 py-2.5 text-xs sm:text-sm text-ink outline-none transition-colors duration-[var(--duration-standard)] ease-heat placeholder:text-muted/60 focus:border-ember/50"
            />
          </div>
        </div>

        <div className="mt-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <button
            type="button"
            onClick={ask}
            disabled={pending || asking || idea.trim().length < 12}
            className="btn-ember inline-flex min-h-12 items-center justify-center rounded-xl px-6 font-display text-sm sm:text-base font-bold text-obsidian shadow-md transition-transform active:scale-[0.99] hover:brightness-105 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {asking ? "Nyiapin pertanyaan..." : pending ? "Lagi meracik blueprint..." : "Males mikir. Bikinin Blueprint App →"}
          </button>
          <span className="text-xs text-muted">
            <span className="tabular font-mono font-bold text-ember">{cost}</span> kredit · 6 dokumen arsitektur lengkap
          </span>
        </div>

        {questions && (
          <div className="mt-5 border-t border-hairline pt-5">
            <VibeQuestions
              questions={questions}
              busy={pending}
              onDone={runGenerate}
              onSkipAll={() => runGenerate([])}
            />
          </div>
        )}

        {status && (
          <div role="status" aria-live="polite" className="mt-4">
            <div className="flex items-center gap-3">
              <span className="lava size-8 shrink-0" aria-hidden="true" />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold text-ember-lo">{status}</p>
                {step && (
                  <p className="mt-0.5 font-mono text-micro text-muted">
                    {step.done} dari {step.total} dokumen
                  </p>
                )}
              </div>
            </div>
            {step && (
              <div className="mt-2 h-1 overflow-hidden rounded-full bg-surface">
                <div
                  className="h-full bg-ember transition-[width] duration-500 ease-heat"
                  style={{ width: `${Math.round((step.done / step.total) * 100)}%` }}
                />
              </div>
            )}
          </div>
        )}
        {error && (
          <p
            role="alert"
            className="mt-3 rounded-xl border border-danger/40 bg-danger/10 px-4 py-3 text-sm leading-relaxed text-ink"
          >
            {error}
          </p>
        )}
      </div>

      {/* ---- what you get: AI Build Blueprint ---- */}
      {!kit && (
        <section className="space-y-3">
          <div className="flex items-center justify-between px-0.5">
            <h3 className="eyebrow text-muted font-bold tracking-wider">AI Build Blueprint</h3>
            <span className="text-micro font-mono text-muted">6 dokumen standar industri</span>
          </div>
          <ul className="grid list-none gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {VIBE_KIT_DOCS.map((d) => (
              <li
                key={d.key}
                className="surface-card rounded-2xl border border-hairline p-4 transition-all hover:border-ember/40 hover:shadow-xs"
              >
                <div className="flex items-baseline justify-between gap-2">
                  <span className="font-display text-sm sm:text-[0.9375rem] font-bold tracking-display-sm text-ink">
                    {d.label}
                  </span>
                  <span className="font-mono text-micro text-ember bg-surface-raised px-1.5 py-0.5 rounded border border-hairline">{d.file}</span>
                </div>
                <p className="mt-1.5 text-xs leading-relaxed text-muted">
                  {d.blurb}
                </p>
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* ---- result ---- */}
      {kit && (
        <div className="space-y-4">
          <div className="surface-card rounded-2xl border border-hairline p-4 sm:p-5">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="min-w-0">
                <h3 className="font-display text-xl font-bold tracking-display-sm text-ink">
                  {kit.project_name}
                </h3>
                <p className="mt-1 text-sm leading-relaxed text-muted">
                  {kit.one_liner}
                </p>
                <p className="mt-2 text-xs text-muted">{kit.stack_summary}</p>
              </div>
              <button
                type="button"
                onClick={downloadAll}
                className="shrink-0 rounded-xl border border-hairline bg-surface px-4 py-2.5 font-display text-sm font-semibold text-ink transition-colors duration-[var(--duration-standard)] ease-heat hover:border-ember/40 hover:text-ember-lo"
              >
                Download semua
              </button>
            </div>
          </div>

          {/* Horizontal scroll rather than wrapping: on a phone a wrapped tab
              row becomes three ragged lines and pushes the content off screen. */}
          <div className="-mx-5 overflow-x-auto px-5 sm:mx-0 sm:px-0">
            <div
              role="tablist"
              aria-label="Dokumen"
              className="flex w-max gap-2 pb-1"
            >
              {VIBE_KIT_DOCS.map((d) => (
                <button
                  key={d.key}
                  role="tab"
                  aria-selected={active === d.key}
                  onClick={() => setActive(d.key)}
                  className={`whitespace-nowrap rounded-full border px-3.5 py-2 font-display text-sm font-semibold transition-colors duration-[var(--duration-standard)] ease-heat ${
                    active === d.key
                      ? "border-ember/50 bg-ember/10 text-ember-lo"
                      : "border-hairline bg-surface text-muted hover:text-ink"
                  }`}
                >
                  {d.label}
                </button>
              ))}
            </div>
          </div>

          {VIBE_KIT_DOCS.filter((d) => d.key === active).map((d) => (
            <div
              key={d.key}
              className="surface-card overflow-hidden rounded-2xl border border-hairline"
            >
              <div className="flex items-center justify-between gap-3 border-b border-hairline px-4 py-3">
                <span className="font-mono text-xs text-muted">{d.file}</span>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => copyDoc(d.key)}
                    className="rounded-lg border border-hairline px-3 py-1.5 text-xs font-semibold text-muted transition-colors duration-[var(--duration-standard)] ease-heat hover:text-ink"
                  >
                    {copied === d.key ? "Kesalin" : "Salin"}
                  </button>
                  <button
                    type="button"
                    onClick={() => downloadDoc(d.key, d.file)}
                    className="rounded-lg border border-hairline px-3 py-1.5 text-xs font-semibold text-muted transition-colors duration-[var(--duration-standard)] ease-heat hover:text-ink"
                  >
                    Unduh
                  </button>
                </div>
              </div>
              <pre className="max-h-[60vh] overflow-auto px-4 py-4 font-mono text-mini leading-relaxed text-ink/90">
                {kit.docs[d.key]}
              </pre>
            </div>
          ))}
        </div>
      )}
        </div>
      )}
    </section>
  );
}
