"use client";

import React, { useState, useTransition } from "react";
import Link from "next/link";
import { probeGeminiKeys, clearErrorLogs } from "@/app/actions/admin";

export function ErrorActionCenter({ totalErrors }: { totalErrors: number }) {
  const [busy, setBusy] = useState<string | null>(null);
  const [msg, setMsg] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [, startTransition] = useTransition();

  const handleProbe = () => {
    setBusy("probe");
    setMsg(null);
    startTransition(async () => {
      try {
        const results = await probeGeminiKeys();
        const okCount = results.filter((r) => r.ok).length;
        setMsg({
          type: "success",
          text: `Tes selesai: ${okCount} dari ${results.length} kunci Gemini aktif & siap digunakan.`,
        });
      } catch (err) {
        setMsg({
          type: "error",
          text: err instanceof Error ? err.message : "Gagal menguji kunci AI.",
        });
      } finally {
        setBusy(null);
      }
    });
  };

  const handleClear = () => {
    if (!window.confirm("Yakin mau membersihkan seluruh riwayat error log?")) return;
    setBusy("clear");
    setMsg(null);
    startTransition(async () => {
      try {
        await clearErrorLogs();
        setMsg({
          type: "success",
          text: "Semua log error berhasil dibersihkan!",
        });
      } catch (err) {
        setMsg({
          type: "error",
          text: err instanceof Error ? err.message : "Gagal membersihkan error log.",
        });
      } finally {
        setBusy(null);
      }
    });
  };

  return (
    <div className="rounded-2xl border border-ember/30 bg-surface/90 p-4 sm:p-5 shadow-xs space-y-3.5">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="font-display text-sm sm:text-base font-bold text-ink flex items-center gap-2">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" className="size-4 text-ember"><path d="M13 2 3 14h9l-1 8 10-12h-9l1-8z"/></svg>
            <span>Aksi Cepat Founder (Penyelesaian Kendala)</span>
          </h2>
          <p className="text-xs text-muted mt-0.5">
            Gunakan tombol aksi di bawah untuk mengetes kunci AI atau mereset riwayat log.
          </p>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <button
            type="button"
            disabled={busy !== null}
            onClick={handleProbe}
            className="cursor-pointer inline-flex items-center gap-1.5 rounded-xl border border-ember/40 bg-ember/15 px-3.5 py-2 text-xs font-bold text-ember transition-all hover:bg-ember hover:text-obsidian active:scale-95 disabled:opacity-50"
          >
            {busy === "probe" ? (
              <>
                <span className="size-3 animate-spin rounded-full border-2 border-current border-t-transparent" />
                <span>Menguji...</span>
              </>
            ) : (
              <>
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" className="size-3.5"><path d="M13 2 3 14h9l-1 8 10-12h-9l1-8z"/></svg>
                <span>Tes Kunci AI Sekarang</span>
              </>
            )}
          </button>

          {totalErrors > 0 && (
            <button
              type="button"
              disabled={busy !== null}
              onClick={handleClear}
              className="cursor-pointer inline-flex items-center gap-1.5 rounded-xl border border-white/[0.08] bg-surface-raised px-3.5 py-2 text-xs font-semibold text-muted transition-all hover:border-danger/40 hover:text-danger active:scale-95 disabled:opacity-50"
            >
              {busy === "clear" ? (
                <>
                  <span className="size-3 animate-spin rounded-full border-2 border-current border-t-transparent" />
                  <span>Membersihkan...</span>
                </>
              ) : (
                <>
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="size-3.5"><path d="M3 6h18"/><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/></svg>
                  <span>Bersihkan Log Error</span>
                </>
              )}
            </button>
          )}

          <Link
            href="/admin/ai"
            className="inline-flex items-center gap-1.5 rounded-xl border border-white/[0.08] bg-surface px-3.5 py-2 text-xs font-semibold text-ink transition-colors hover:border-ember/40 hover:text-ember"
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="size-3.5 text-ember"><path d="M9.5 2A2.5 2.5 0 0 1 12 4.5v15a2.5 2.5 0 0 1-4.96.44 2.5 2.5 0 0 1-2.96-3.08 3 3 0 0 1-.34-5.58 2.5 2.5 0 0 1 1.32-4.24 2.5 2.5 0 0 1 4.44-2.04Z"/><path d="M14.5 2A2.5 2.5 0 0 0 12 4.5v15a2.5 2.5 0 0 0 4.96.44 2.5 2.5 0 0 0 2.96-3.08 3 3 0 0 0 .34-5.58 2.5 2.5 0 0 0-1.32-4.24 2.5 2.5 0 0 0-4.44-2.04Z"/></svg>
            <span>Atur Otak AI →</span>
          </Link>
        </div>
      </div>

      {msg && (
        <div
          className={`rounded-xl border p-3 text-xs leading-relaxed ${
            msg.type === "success"
              ? "border-success/30 bg-success/10 text-success"
              : "border-danger/30 bg-danger/10 text-danger"
          }`}
        >
          {msg.text}
        </div>
      )}
    </div>
  );
}
