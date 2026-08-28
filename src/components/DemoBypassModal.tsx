"use client";

import React, { useState, useEffect, useRef, useSyncExternalStore } from "react";
import { createPortal } from "react-dom";

const emptySubscribe = () => () => {};

export function DemoBypassModal({
  isOpen,
  onClose,
}: {
  isOpen: boolean;
  onClose: () => void;
}) {
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isSuccess, setIsSuccess] = useState(false);
  const isMounted = useSyncExternalStore(emptySubscribe, () => true, () => false);
  const inputRef = useRef<HTMLInputElement>(null);

  // Derive test mode status directly from environment/browser state
  const isTestModeActive =
    isMounted &&
    typeof window !== "undefined" &&
    (document.cookie.includes("malesan_test_mode=1") ||
      localStorage.getItem("malesan_test_mode") === "1");

  useEffect(() => {
    if (isOpen && !isTestModeActive) {
      inputRef.current?.focus();
    }
  }, [isOpen, isTestModeActive]);

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape" && isOpen) {
        onClose();
      }
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen || !isMounted) return null;

  async function handleActivate(e: React.FormEvent) {
    e.preventDefault();
    const enteredPassword = (password || inputRef.current?.value || "").trim();

    if (!enteredPassword) {
      setErrorMessage("Silakan masukkan kata sandi.");
      return;
    }

    setIsLoading(true);
    try {
      const res = await fetch("/api/auth/demo-bypass", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password: enteredPassword }),
      });

      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setErrorMessage(data.error || "Kata sandi salah. Akses ditolak.");
        setIsLoading(false);
        return;
      }

      if (typeof window !== "undefined") {
        localStorage.setItem("malesan_test_mode", "1");
      }

      setIsSuccess(true);
      setIsLoading(false);

      setTimeout(() => {
        onClose();
        window.location.href = data.redirect || "/app";
      }, 1000);
    } catch {
      setErrorMessage("Terjadi kesalahan koneksi ke server. Coba lagi.");
      setIsLoading(false);
    }
  }

  async function handleDeactivate() {
    setIsLoading(true);
    try {
      // Clear server cookies
      await fetch("/api/auth/demo-bypass", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "deactivate" }),
      });

      // Clear client storage
      if (typeof window !== "undefined") {
        localStorage.removeItem("malesan_test_mode");
        document.cookie = "malesan_test_mode=; path=/; max-age=0";
        document.cookie = "malesan_demo_mode=; path=/; max-age=0";
      }

      setIsSuccess(true);
      setIsLoading(false);

      setTimeout(() => {
        onClose();
        window.location.reload();
      }, 800);
    } catch {
      setErrorMessage("Gagal menonaktifkan mode tester.");
      setIsLoading(false);
    }
  }

  const modalContent = (
    <div
      aria-modal="true"
      role="dialog"
      className="fixed inset-0 z-[999999] flex min-h-screen w-screen items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-in fade-in duration-200"
      onClick={onClose}
    >
      <div
        className="relative w-full max-w-sm m-auto rounded-2xl border border-ember/40 bg-surface/95 p-6 shadow-[0_25px_70px_rgba(0,0,0,0.95)] backdrop-blur-xl animate-in zoom-in-95 duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-2.5">
            <div className="flex size-9 items-center justify-center rounded-xl bg-ember/15 border border-ember/30 text-ember">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" className="size-4 text-ember">
                <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z" />
              </svg>
            </div>
            <div>
              <h3 className="font-display text-base font-bold text-ink">
                Akses Mode Demo / Tester
              </h3>
              <p className="text-micro text-muted">
                Pengaturan mode rekaman tutorial
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Tutup modal"
            className="flex size-8 items-center justify-center rounded-lg text-muted hover:bg-obsidian hover:text-ink transition-colors cursor-pointer"
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" className="size-4">
              <path d="M18 6L6 18M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* State 1: Test Mode is ALREADY ACTIVE (Option to turn OFF) */}
        {isTestModeActive ? (
          <div className="mt-5 space-y-4">
            <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-3 text-xs">
              <div className="flex items-center gap-2 font-bold text-emerald-400">
                <span className="size-2 rounded-full bg-emerald-400 animate-pulse" />
                <span>Status: Mode Tester Sedang Aktif</span>
              </div>
              <p className="mt-1 text-micro text-muted">
                Google OAuth di-bypass & nama akun disamarkan sebagai &ldquo;Kreator&rdquo; untuk rekaman tutorial.
              </p>
            </div>

            {isSuccess && (
              <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-2.5 text-micro text-emerald-400 font-medium flex items-center gap-2">
                <svg viewBox="0 0 20 20" fill="currentColor" className="size-3.5 shrink-0">
                  <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                </svg>
                <span>Mode Tester berhasil dinonaktifkan. Memuat ulang...</span>
              </div>
            )}

            {errorMessage && (
              <div className="rounded-xl border border-red-500/30 bg-red-500/10 p-2.5 text-micro text-red-400 font-medium flex items-center gap-2">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="size-4 shrink-0">
                  <circle cx="12" cy="12" r="10" />
                  <line x1="12" y1="8" x2="12" y2="12" />
                  <line x1="12" y1="16" x2="12.01" y2="16" />
                </svg>
                <span>{errorMessage}</span>
              </div>
            )}

            <div className="flex flex-col gap-2 pt-2">
              <button
                type="button"
                onClick={handleDeactivate}
                disabled={isLoading}
                className="w-full flex items-center justify-center gap-2 rounded-xl border border-red-500/40 bg-red-500/15 h-11 font-display text-xs font-bold text-red-400 hover:bg-red-500/25 active:scale-[0.99] transition-all disabled:opacity-50 cursor-pointer"
              >
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="size-3.5">
                  <path d="M18.36 6.64a9 9 0 1 1-12.73 0" />
                  <line x1="12" y1="2" x2="12" y2="12" />
                </svg>
                <span>{isLoading ? "Memproses..." : "Nonaktifkan Mode Tester"}</span>
              </button>
              <button
                type="button"
                onClick={onClose}
                className="w-full rounded-xl border border-hairline bg-surface h-10 text-xs font-medium text-muted hover:text-ink transition-colors cursor-pointer"
              >
                Tutup
              </button>
            </div>
          </div>
        ) : (
          /* State 2: Test Mode is INACTIVE (Enter Password to ACTIVATE) */
          <form onSubmit={handleActivate} className="mt-5 space-y-4">
            <div>
              <label className="block text-micro font-semibold uppercase tracking-wider text-muted mb-1.5">
                Kata Sandi Rahasia
              </label>
              <div className="relative">
                <input
                  ref={inputRef}
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Masukkan kata sandi..."
                  disabled={isLoading || isSuccess}
                  className="w-full rounded-xl border border-hairline bg-obsidian/80 px-3.5 py-2.5 pr-10 text-xs font-mono text-ink placeholder:text-muted/60 focus:border-ember focus:outline-none focus:ring-1 focus:ring-ember disabled:opacity-50"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-micro text-muted hover:text-ink cursor-pointer"
                >
                  {showPassword ? "Sembunyi" : "Lihat"}
                </button>
              </div>
            </div>

            {/* Error Message */}
            {errorMessage && (
              <div className="rounded-xl border border-red-500/30 bg-red-500/10 p-2.5 text-micro text-red-400 font-medium flex items-center gap-2">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="size-4 shrink-0">
                  <circle cx="12" cy="12" r="10" />
                  <line x1="12" y1="8" x2="12" y2="12" />
                  <line x1="12" y1="16" x2="12.01" y2="16" />
                </svg>
                <span>{errorMessage}</span>
              </div>
            )}

            {/* Success Message */}
            {isSuccess && (
              <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-2.5 text-micro text-emerald-400 font-medium flex items-center gap-2">
                <svg viewBox="0 0 20 20" fill="currentColor" className="size-3.5 shrink-0">
                  <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                </svg>
                <span>Mode Tester Aktif! Silakan mulai rekaman dari landing page.</span>
              </div>
            )}

            {/* Submit Button */}
            <button
              type="submit"
              disabled={isLoading || isSuccess}
              className="w-full rounded-xl bg-ember h-11 font-display text-xs font-bold text-obsidian shadow-sm transition-all hover:bg-ember-lo active:scale-[0.99] disabled:opacity-50 flex items-center justify-center gap-2 cursor-pointer"
            >
              {isLoading ? (
                <>
                  <span className="size-3.5 rounded-full border-2 border-obsidian border-t-transparent animate-spin" />
                  <span>Memverifikasi...</span>
                </>
              ) : isSuccess ? (
                <span>Siap Merekam!</span>
              ) : (
                <>
                  <span>Aktifkan Mode Tester</span>
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" className="size-3.5">
                    <path d="M5 12h14M12 5l7 7-7 7" />
                  </svg>
                </>
              )}
            </button>
          </form>
        )}

        <div className="mt-4 pt-3 border-t border-hairline/40 text-center">
          <span className="font-mono text-[10px] text-muted">
            Klik 5x Logo Malesan kapan saja untuk membuka menu ini
          </span>
        </div>
      </div>
    </div>
  );

  return createPortal(modalContent, document.body);
}
