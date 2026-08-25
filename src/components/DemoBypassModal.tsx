"use client";

import React, { useState, useEffect, useRef } from "react";
import { createPortal } from "react-dom";

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
  const [isTestModeActive, setIsTestModeActive] = useState(false);
  const [mounted, setMounted] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (isOpen) {
      setPassword("");
      setErrorMessage(null);
      setIsSuccess(false);

      // Check current test mode status
      const active =
        typeof window !== "undefined" &&
        (document.cookie.includes("malesan_test_mode=1") ||
          localStorage.getItem("malesan_test_mode") === "1");
      setIsTestModeActive(active);

      if (!active) {
        setTimeout(() => {
          inputRef.current?.focus();
        }, 50);
      }
    }
  }, [isOpen]);

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape" && isOpen) {
        onClose();
      }
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen || !mounted) return null;

  async function handleActivate(e: React.FormEvent) {
    e.preventDefault();
    const enteredPassword = (password || inputRef.current?.value || "").trim();

    if (!enteredPassword) {
      setErrorMessage("Silakan masukkan kata sandi.");
      return;
    }

    setIsLoading(true);
    setErrorMessage(null);

    // Verify password "vadlyvldr"
    if (enteredPassword !== "vadlyvldr") {
      setErrorMessage("Kata sandi salah. Akses ditolak.");
      setIsLoading(false);
      return;
    }

    try {
      if (typeof window !== "undefined") {
        localStorage.setItem("malesan_test_mode", "1");
        document.cookie = "malesan_test_mode=1; path=/; max-age=604800; SameSite=Lax";
        document.cookie = "malesan_demo_mode=1; path=/; max-age=604800; SameSite=Lax";
      }

      setIsSuccess(true);
      setIsTestModeActive(true);
      setIsLoading(false);

      setTimeout(() => {
        onClose();
      }, 1200);
    } catch {
      setErrorMessage("Terjadi kesalahan. Coba lagi.");
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

      setIsTestModeActive(false);
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
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-ember/15 border border-ember/30 text-ember text-base">
              ⚡
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
            className="rounded-lg p-1 text-muted hover:bg-obsidian hover:text-ink transition-colors"
          >
            ✕
          </button>
        </div>

        {/* State 1: Test Mode is ALREADY ACTIVE (Option to turn OFF) */}
        {isTestModeActive ? (
          <div className="mt-5 space-y-4">
            <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-3 text-xs">
              <div className="flex items-center gap-2 font-bold text-emerald-400">
                <span className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse" />
                <span>Status: Mode Tester Sedang Aktif</span>
              </div>
              <p className="mt-1 text-micro text-muted">
                Google OAuth di-bypass & nama akun disamarkan sebagai "Kreator" untuk rekaman tutorial.
              </p>
            </div>

            {isSuccess && (
              <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-2.5 text-micro text-emerald-400 font-medium flex items-center gap-2">
                <span>✓</span>
                <span>Mode Tester berhasil dinonaktifkan. Memuat ulang...</span>
              </div>
            )}

            {errorMessage && (
              <div className="rounded-xl border border-red-500/30 bg-red-500/10 p-2.5 text-micro text-red-400 font-medium">
                ⚠️ {errorMessage}
              </div>
            )}

            <div className="flex flex-col gap-2 pt-2">
              <button
                type="button"
                onClick={handleDeactivate}
                disabled={isLoading}
                className="w-full rounded-xl border border-red-500/40 bg-red-500/15 py-2.5 font-display text-xs font-bold text-red-400 hover:bg-red-500/25 active:scale-[0.99] transition-all disabled:opacity-50"
              >
                {isLoading ? "Memproses..." : "🔴 Nonaktifkan Mode Tester"}
              </button>
              <button
                type="button"
                onClick={onClose}
                className="w-full rounded-xl border border-hairline bg-surface py-2 text-xs font-medium text-muted hover:text-ink transition-colors"
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
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-micro text-muted hover:text-ink"
                >
                  {showPassword ? "Sembunyi" : "Lihat"}
                </button>
              </div>
            </div>

            {/* Error Message */}
            {errorMessage && (
              <div className="rounded-xl border border-red-500/30 bg-red-500/10 p-2.5 text-micro text-red-400 font-medium">
                ⚠️ {errorMessage}
              </div>
            )}

            {/* Success Message */}
            {isSuccess && (
              <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-2.5 text-micro text-emerald-400 font-medium flex items-center gap-2">
                <span>✓</span>
                <span>Mode Tester Aktif! Silakan mulai rekaman dari landing page.</span>
              </div>
            )}

            {/* Submit Button */}
            <button
              type="submit"
              disabled={isLoading || isSuccess}
              className="w-full rounded-xl bg-ember py-2.5 font-display text-xs font-bold text-obsidian shadow-sm transition-all hover:bg-ember-lo active:scale-[0.99] disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {isLoading ? (
                <>
                  <span className="h-3.5 w-3.5 rounded-full border-2 border-obsidian border-t-transparent animate-spin" />
                  <span>Memverifikasi...</span>
                </>
              ) : isSuccess ? (
                <span>Siap Merekam!</span>
              ) : (
                <span>Aktifkan Mode Tester →</span>
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
