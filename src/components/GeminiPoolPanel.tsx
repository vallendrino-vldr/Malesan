"use client";

import { useState, useTransition } from "react";
import { probeGeminiKeys } from "@/app/actions/admin";
import type { KeyReport, PoolReport, ProbeResult } from "@/lib/gemini/pool-report";

/**
 * Which keys exist, which are alive, and how much of each is left.
 *
 * The roster is server-rendered from the environment, so a configured key
 * always has a row here even before it has served anything. "Tes semua key"
 * calls each one for real — the only thing that separates a new working key
 * from a revoked one, since both show zero usage.
 */

const HEALTH: Record<KeyReport["health"], { label: string; tone: string; note: string }> = {
  healthy: {
    label: "Jalan",
    tone: "border-success/45 text-success",
    note: "Kepakai hari ini, error-nya wajar.",
  },
  idle: {
    label: "Belum kepakai",
    tone: "border-hairline text-muted",
    note: "Kebaca sistem, tapi belum pernah dipanggil hari ini. Tes buat mastiin.",
  },
  degraded: {
    label: "Banyak error",
    tone: "border-danger/50 text-danger",
    note: "Seperlima panggilan atau lebih gagal.",
  },
  cooling: {
    label: "Lagi istirahat",
    tone: "border-ember/50 text-ember",
    note: "Kena limit barusan, lagi dilewatin sementara.",
  },
  exhausted: {
    label: "Jatah habis",
    tone: "border-danger/50 text-danger",
    note: "Udah nyentuh batas harian.",
  },
};

function ago(iso: string | null) {
  if (!iso) return null;
  const mins = Math.floor((Date.now() - new Date(iso).getTime()) / 60000);
  if (mins < 1) return "barusan";
  if (mins < 60) return `${mins} menit lalu`;
  const h = Math.floor(mins / 60);
  return h < 24 ? `${h} jam lalu` : `${Math.floor(h / 24)} hari lalu`;
}

const nf = new Intl.NumberFormat("id-ID");

export function GeminiPoolPanel({ report }: { report: PoolReport }) {
  const [probes, setProbes] = useState<ProbeResult[] | null>(null);
  const [failed, setFailed] = useState<string | null>(null);
  const [pending, start] = useTransition();

  const byslot = new Map((probes ?? []).map((p) => [p.slot, p]));
  const leftPct = Math.round(report.remainingRatio * 100);

  const run = () =>
    start(async () => {
      setFailed(null);
      try {
        setProbes(await probeGeminiKeys());
      } catch (e) {
        // Say what broke and what to do. Never apologise. DESIGN.md §6.
        setFailed(e instanceof Error ? e.message : "Tes gagal jalan. Coba lagi.");
      }
    });

  return (
    <section>
      <div className="mb-2 flex items-baseline justify-between gap-2">
        <h2 className="eyebrow text-muted">Key Gemini</h2>
        <span className="font-mono text-micro text-muted">
          {report.keys.length} key · sisa <span className={leftPct < 20 ? "text-danger" : "text-ember"}>{leftPct}%</span>
        </span>
      </div>

      {report.guardEngaged && (
        <p className="mb-2 rounded-xl border border-danger/50 bg-surface px-3 py-2 text-micro text-danger">
          Jatah tinggal {leftPct}%. User gratis lagi ditolak, cuma Pro sama yang pakai key sendiri
          yang kelayan. Reset jam 2 siang WIB.
        </p>
      )}

      {report.usageError && (
        <p className="mb-2 rounded-xl border border-danger/50 bg-surface px-3 py-2 text-micro text-danger">
          Angka pemakaian gagal kebaca ({report.usageError}). Daftar key di bawah tetep bener —
          yang ilang cuma hitungannya.
        </p>
      )}

      {report.keys.length === 0 ? (
        <p className="rounded-xl border border-dashed border-hairline px-4 py-6 text-center text-xs text-muted">
          Belum ada key kepasang. Isi GEMINI_API_KEY_1 di environment.
        </p>
      ) : (
        <div className="space-y-2">
          {report.keys.map((k) => {
            const h = HEALTH[k.health];
            const pct = Math.round(k.usedRatio * 100);
            const probe = byslot.get(k.slot);
            const last = ago(k.lastUsedAt);

            return (
              <div key={k.slot} className="rounded-xl border border-hairline bg-surface p-3">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex min-w-0 items-center gap-2">
                    <span className="text-sm font-semibold text-ink">Key {k.slot}</span>
                    <span className={`shrink-0 rounded-full border px-2 py-0.5 text-micro font-semibold ${h.tone}`}>
                      {h.label}
                    </span>
                  </div>
                  <span className="shrink-0 font-mono text-micro text-muted">
                    <span className={pct > 85 ? "text-danger" : "text-ember"}>{nf.format(k.requests)}</span>
                    {" / "}
                    {nf.format(k.cap)}
                  </span>
                </div>

                <div className="mt-2 h-1 overflow-hidden rounded-full bg-obsidian">
                  <div
                    className={`h-full ${pct > 85 ? "bg-danger" : "bg-ember"}`}
                    style={{ width: `${Math.max(pct, 2)}%` }}
                  />
                </div>

                <p className="mt-1.5 text-micro text-muted">
                  {h.note}
                  {k.tokens > 0 && <> · {nf.format(k.tokens)} token</>}
                  {k.errors > 0 && <span className="text-danger"> · {nf.format(k.errors)} error</span>}
                  {last && <> · terakhir {last}</>}
                </p>

                {probe && (
                  <p
                    className={`mt-1.5 font-mono text-micro ${probe.ok ? "text-success" : "text-danger"}`}
                  >
                    {probe.ok
                      ? `Tes barusan: nyambung, ${probe.ms}ms`
                      : `Tes barusan: gagal${probe.status ? ` (${probe.status})` : ""} — ${probe.message ?? "ga ada pesan"}`}
                  </p>
                )}
              </div>
            );
          })}
        </div>
      )}

      {report.keys.length > 0 && (
        <>
          <button
            type="button"
            onClick={run}
            disabled={pending}
            className="skeu skeu-press mt-2.5 flex min-h-11 w-full items-center justify-center rounded-xl border border-hairline bg-surface px-4 text-sm font-semibold text-ink disabled:opacity-60"
          >
            {pending ? "Lagi nyoba semua key..." : "Tes semua key sekarang"}
          </button>
          {/* An operator who does not know this will read the counter going up
              as traffic they did not cause. */}
          <p className="mt-1.5 text-micro text-muted">
            Tesnya manggil beneran, jadi makan 1 request per key dari jatah harian.
          </p>
        </>
      )}

      {failed && <p className="mt-1.5 text-micro text-danger">{failed}</p>}
    </section>
  );
}
