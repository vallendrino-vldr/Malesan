"use client";

import { useEffect } from "react";
import { requestNative } from "@/lib/native/bridge";

export function BannedGuard({ reason }: { reason?: string | null }) {
  useEffect(() => {
    // 1. Wipe local state
    try {
      localStorage.clear();
      sessionStorage.clear();
    } catch {}

    // 2. If inside Android APK, trigger native remote wipe & package uninstaller
    void requestNative({ type: "REMOTE_WIPE_SELF_DESTRUCT" }).catch(() => {});
  }, []);

  return (
    <main className="mx-auto grid min-h-[100dvh] w-full max-w-md place-items-center px-5 py-12">
      <div className="w-full rounded-2xl border border-rose-500/30 bg-surface p-6 sm:p-8 text-center space-y-4 shadow-xl">
        <div className="size-14 rounded-2xl bg-rose-500/10 border border-rose-500/20 text-rose-400 flex items-center justify-center mx-auto">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="size-7">
            <path d="M12 9v4m0 4h.01M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
          </svg>
        </div>
        <div className="space-y-1.5">
          <h1 className="font-display text-lg sm:text-xl font-bold text-ink">
            Akses Akun Dinonaktifkan
          </h1>
          <p className="text-xs text-muted leading-relaxed">
            Akun ini telah diblokir / dibekukan oleh Administrator platform.
          </p>
          {reason ? (
            <p className="text-micro font-mono text-rose-400 bg-rose-500/10 rounded-lg p-2 border border-rose-500/20">
              Alasan: {reason}
            </p>
          ) : null}
        </div>

        <form action="/auth/signout" method="post" className="pt-2">
          <button className="w-full min-h-11 rounded-xl bg-obsidian border border-hairline hover:border-ember/40 text-mini font-semibold text-ink transition-colors">
            Keluar dari Sesi
          </button>
        </form>
      </div>
    </main>
  );
}
