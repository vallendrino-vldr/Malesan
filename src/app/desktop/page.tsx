import React from "react";
import Link from "next/link";
import { Metadata } from "next";

export const metadata: Metadata = {
  title: "Malesan Desktop (.EXE) - Download untuk Windows 10 & 11",
  description: "Download Malesan Studio Desktop untuk Windows. Akselerasi GPU lokal untuk auto-clip YouTube dan video studio tanpa ribet.",
};

export default function DesktopDownloadPage() {
  return (
    <div className="min-h-screen bg-obsidian text-ink font-sans selection:bg-ember selection:text-obsidian flex flex-col justify-between">
      {/* Background Ambience Glow */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden">
        <div className="absolute -top-40 left-1/2 -translate-x-1/2 size-[600px] rounded-full bg-ember/15 blur-[120px]" />
        <div className="absolute top-1/3 -left-40 size-[400px] rounded-full bg-ember/10 blur-[100px]" />
      </div>

      {/* Header Bar */}
      <header className="relative z-10 border-b border-white/10 bg-obsidian/60 backdrop-blur-xl px-4 py-3 sm:px-8">
        <div className="max-w-6xl mx-auto flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2.5 group">
            <div className="size-8 rounded-xl bg-gradient-to-tr from-ember to-amber-500 p-0.5 shadow-lg shadow-ember/20 group-hover:scale-105 transition-transform">
              <div className="size-full rounded-[10px] bg-obsidian flex items-center justify-center">
                <span className="font-display font-black text-ember text-sm">M</span>
              </div>
            </div>
            <span className="font-display font-extrabold text-white text-base tracking-tight group-hover:text-ember transition-colors">
              malesan<span className="text-ember">.</span>
            </span>
            <span className="rounded-md border border-white/15 bg-white/5 px-2 py-0.5 text-[10px] font-bold text-mist">
              Desktop Edition
            </span>
          </Link>

          <div className="flex items-center gap-3">
            <Link
              href="/app"
              className="h-8 px-3 rounded-xl border border-white/15 bg-white/5 hover:bg-white/10 text-white font-bold text-xs flex items-center gap-1.5 transition-all"
            >
              <span>Buka Web App</span>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="size-3.5">
                <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5 21 12m0 0-7.5 7.5M21 12H3" />
              </svg>
            </Link>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <main className="relative z-10 max-w-4xl mx-auto px-4 py-12 sm:py-16 text-center space-y-8 flex-1 flex flex-col items-center justify-center">
        {/* Badge */}
        <div className="inline-flex items-center gap-2 rounded-full border border-ember/40 bg-ember/10 px-4 py-1.5 shadow-lg shadow-ember/10">
          <span className="size-2 rounded-full bg-emerald-400 animate-pulse" />
          <span className="font-mono text-xs font-bold text-ember">
            OFFICIAL DESKTOP APP • WINDOWS 10 &amp; 11
          </span>
        </div>

        {/* Headlines */}
        <div className="space-y-4 max-w-2xl mx-auto">
          <h1 className="font-display text-3xl sm:text-5xl font-black text-white tracking-tight leading-tight">
            Malesan Studio untuk <span className="bg-gradient-to-r from-ember via-amber-400 to-orange-500 bg-clip-text text-transparent">Windows PC</span>
          </h1>
          <p className="text-sm sm:text-base text-mist leading-relaxed">
            Potong klip YouTube 1080p dan olah video konten dengan akselerasi GPU lokal di PC kamu.
            Zero setup bridge, super enteng, dan hemat baterai di semua prosesor.
          </p>
        </div>

        {/* Download Hero Card */}
        <div className="w-full max-w-md rounded-3xl border border-ember/40 bg-gradient-to-b from-surface-raised/80 to-obsidian p-6 shadow-2xl shadow-ember/20 ring-1 ring-white/10 space-y-4 backdrop-blur-xl">
          <a
            href="/Malesan-Setup.exe"
            download="Malesan-Setup.exe"
            className="group w-full h-14 rounded-2xl bg-gradient-to-r from-ember via-amber-500 to-orange-500 hover:opacity-95 text-obsidian font-black text-sm sm:text-base flex items-center justify-center gap-3 shadow-xl shadow-ember/30 active:scale-95 transition-all cursor-pointer"
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="size-5 group-hover:translate-y-0.5 transition-transform">
              <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75V16.5M16.5 12 12 16.5m0 0L7.5 12m4.5 4.5V3" />
            </svg>
            <span>Download Malesan-Setup.exe</span>
          </a>

          <div className="flex items-center justify-between text-xs text-mist pt-1 border-t border-white/10">
            <span>Versi: <strong className="text-white">v2.1.0</strong></span>
            <span>Ukuran: <strong className="text-white">~226 MB</strong></span>
            <span>OS: <strong className="text-emerald-400">Windows 10/11 64-bit</strong></span>
          </div>
        </div>

        {/* 3 Core Highlights */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 w-full text-left pt-4">
          <div className="rounded-2xl border border-white/10 bg-white/5 p-4 space-y-2">
            <div className="flex size-9 items-center justify-center rounded-xl bg-ember/20 text-ember">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="size-4.5">
                <path strokeLinecap="round" strokeLinejoin="round" d="m3.75 13.5 10.5-11.25L12 10.5h8.25L9.75 21.75 12 13.5H3.75Z" />
              </svg>
            </div>
            <h4 className="font-display text-sm font-bold text-white">Zero Bridge Setup</h4>
            <p className="text-xs text-mist leading-relaxed">
              yt-dlp &amp; FFmpeg sudah tertanam di dalam aplikasi. Tidak perlu install Node.js atau buka terminal CMD.
            </p>
          </div>

          <div className="rounded-2xl border border-white/10 bg-white/5 p-4 space-y-2">
            <div className="flex size-9 items-center justify-center rounded-xl bg-ember/20 text-ember">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="size-4.5">
                <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 3v1.5M4.5 8.25H3m18 0h-1.5M4.5 12H3m18 0h-1.5m-15 3.75H3m18 0h-1.5M8.25 19.5V21M12 3v1.5m0 15V21m3.75-18v1.5m0 15V21m-9-1.5h10.5a2.25 2.25 0 0 0 2.25-2.25V6.75a2.25 2.25 0 0 0-2.25-2.25H6.75A2.25 2.25 0 0 0 4.5 6.75v10.5a2.25 2.25 0 0 0 2.25 2.25Zm.75-12h9v9h-9v-9Z" />
              </svg>
            </div>
            <h4 className="font-display text-sm font-bold text-white">Akselerasi GPU Cerdas</h4>
            <p className="text-xs text-mist leading-relaxed">
              Otomatis memakai AMD AMF (Radeon/Vega), Intel QuickSync, atau NVIDIA NVENC dengan proteksi Anti-Freeze.
            </p>
          </div>

          <div className="rounded-2xl border border-white/10 bg-white/5 p-4 space-y-2">
            <div className="flex size-9 items-center justify-center rounded-xl bg-ember/20 text-ember">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="size-4.5">
                <path strokeLinecap="round" strokeLinejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0 3.181 3.183a8.25 8.25 0 0 0 13.803-3.7M4.031 9.865a8.25 8.25 0 0 1 13.803-3.7l3.181 3.182m0-4.991v4.99" />
              </svg>
            </div>
            <h4 className="font-display text-sm font-bold text-white">Auto-Update 1-Klik</h4>
            <p className="text-xs text-mist leading-relaxed">
              Pembaruan otomatis terdeteksi di dalam aplikasi. Cukup klik 1 tombol, aplikasi me-restart ke versi terbaru.
            </p>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="relative z-10 border-t border-white/10 py-6 text-center text-xs text-mist">
        <div className="max-w-4xl mx-auto px-4 flex flex-col sm:flex-row items-center justify-between gap-3">
          <p>© 2026 Malesan Studio. Platform AI Kreator Konten Indonesia.</p>
          <div className="flex items-center gap-4">
            <Link href="/" className="hover:text-white transition-colors">Home</Link>
            <Link href="/app" className="hover:text-white transition-colors">Studio</Link>
            <a href="/malesan.apk" className="hover:text-white transition-colors">Download Android APK</a>
          </div>
        </div>
      </footer>
    </div>
  );
}
