"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  VIBE_KIT_DOCS,
  VIBE_KIT_CREDIT_COST,
  type VibeKitOutput,
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

export function VibeCodingStudio() {
  const router = useRouter();
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

  async function generate() {
    setPending(true);
    setError(null);
    setKit(null);
    setStatus("Nyambungin...");

    try {
      const res = await fetch("/api/vibe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ idea, stack, audience }),
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
              if (msg.status) setStatus(msg.status);
              if (msg.progress) {
                setStatus(
                  `Lagi nulis dokumennya... ${Math.round(msg.progress / 1000)}k karakter`,
                );
              }
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
    <section className="space-y-6">
      <header>
        <p className="eyebrow text-ember">Buat yang mau vibe coding</p>
        <h2 className="mt-3 font-display text-[26px] font-bold leading-tight tracking-display-md text-ink sm:text-3xl">
          Ceritain aplikasinya. Speknya gue yang bikin.
        </h2>
        <p className="mt-3 max-w-2xl text-sm leading-relaxed text-muted">
          AI coding agent gak bakal ngasih hasil bagus kalau dikasih instruksi
          setengah mateng. Ini bikinin lo enam dokumen yang dia baca duluan —
          PRD, design system, roadmap, aturan agent, skema database, sama prompt
          pembukanya.
        </p>
      </header>

      {/* ---- input ---- */}
      <div className="surface-card rounded-2xl border border-hairline p-4 sm:p-5">
        <label htmlFor="vibe-idea" className="eyebrow block text-muted">
          Mau bikin apa
        </label>
        <textarea
          id="vibe-idea"
          value={idea}
          onChange={(e) => setIdea(e.target.value)}
          rows={4}
          placeholder="Contoh: aplikasi buat nyatet pengeluaran harian bareng pasangan, bisa split bill, ada grafik bulanan."
          className="mt-2 w-full resize-y rounded-xl border border-hairline bg-obsidian px-3.5 py-3 text-[15px] leading-relaxed text-ink outline-none transition-colors duration-[var(--duration-standard)] ease-heat placeholder:text-muted/60 focus:border-ember/50"
        />

        {/* A blank textarea is the hardest thing to face on this screen. These
            are deliberately specific — a vague seed produces a vague spec, and
            the point of the starters is to show what "enough detail" looks
            like, not just to fill the box. */}
        {!idea.trim() && (
          <div className="mt-2.5">
            <p className="text-[11px] text-muted">Belum kepikiran? Mulai dari sini:</p>
            <div className="mt-1.5 flex flex-wrap gap-1.5">
              {IDEA_STARTERS.map((s) => (
                <button
                  key={s.label}
                  type="button"
                  onClick={() => setIdea(s.seed)}
                  className="cursor-pointer rounded-full border border-hairline px-3 py-1.5 text-[11.5px] font-medium text-muted transition-colors duration-[var(--duration-standard)] ease-heat hover:border-ember/40 hover:text-ember-lo"
                >
                  {s.label}
                </button>
              ))}
            </div>
          </div>
        )}

        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          <div>
            <label htmlFor="vibe-stack" className="eyebrow block text-muted">
              Stack <span className="normal-case tracking-normal">(opsional)</span>
            </label>
            <input
              id="vibe-stack"
              value={stack}
              onChange={(e) => setStack(e.target.value)}
              placeholder="Next.js + Supabase, atau kosongin"
              className="mt-2 w-full rounded-xl border border-hairline bg-obsidian px-3.5 py-2.5 text-sm text-ink outline-none transition-colors duration-[var(--duration-standard)] ease-heat placeholder:text-muted/60 focus:border-ember/50"
            />
          </div>
          <div>
            <label htmlFor="vibe-audience" className="eyebrow block text-muted">
              Buat siapa{" "}
              <span className="normal-case tracking-normal">(opsional)</span>
            </label>
            <input
              id="vibe-audience"
              value={audience}
              onChange={(e) => setAudience(e.target.value)}
              placeholder="Pasangan muda di kota besar"
              className="mt-2 w-full rounded-xl border border-hairline bg-obsidian px-3.5 py-2.5 text-sm text-ink outline-none transition-colors duration-[var(--duration-standard)] ease-heat placeholder:text-muted/60 focus:border-ember/50"
            />
          </div>
        </div>

        <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <button
            type="button"
            onClick={generate}
            disabled={pending || idea.trim().length < 12}
            className="btn-ember inline-flex items-center justify-center rounded-xl px-5 py-3 font-display text-[15px] font-bold text-obsidian disabled:cursor-not-allowed disabled:opacity-50"
          >
            {pending ? "Lagi mikirin buat lo..." : "Males mikir. Bikinin speknya."}
          </button>
          <span className="text-xs text-muted">
            <span className="tabular font-mono text-ink">
              {VIBE_KIT_CREDIT_COST}
            </span>{" "}
            credit · 6 dokumen sekali jalan
          </span>
        </div>

        {status && (
          <p role="status" className="mt-3 text-sm text-ember-lo">
            {status}
          </p>
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

      {/* ---- what you get, shown before paying ---- */}
      {!kit && (
        <ul className="grid list-none gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {VIBE_KIT_DOCS.map((d) => (
            <li
              key={d.key}
              className="surface-card rounded-xl border border-hairline p-4"
            >
              <div className="flex items-baseline justify-between gap-2">
                <span className="font-display text-[15px] font-bold tracking-display-sm text-ink">
                  {d.label}
                </span>
                <span className="font-mono text-[11px] text-muted">{d.file}</span>
              </div>
              <p className="mt-1.5 text-[13px] leading-relaxed text-muted">
                {d.blurb}
              </p>
            </li>
          ))}
        </ul>
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
                className="shrink-0 rounded-xl border border-hairline bg-surface px-4 py-2.5 font-display text-[13px] font-semibold text-ink transition-colors duration-[var(--duration-standard)] ease-heat hover:border-ember/40 hover:text-ember-lo"
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
                  className={`whitespace-nowrap rounded-full border px-3.5 py-2 font-display text-[13px] font-semibold transition-colors duration-[var(--duration-standard)] ease-heat ${
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
              <pre className="max-h-[60vh] overflow-auto px-4 py-4 font-mono text-[12.5px] leading-relaxed text-ink/90">
                {kit.docs[d.key]}
              </pre>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
