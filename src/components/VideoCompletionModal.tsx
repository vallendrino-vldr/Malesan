"use client";

import React, { useEffect, useMemo, useState } from "react";
import { getNativeShell, requestNative } from "@/lib/native/bridge";

interface VideoCompletionModalProps {
  isOpen: boolean;
  onClose: () => void;
  videoUrl?: string;
  videoFile?: File | null;
  videoTitle: string;
  isAPK: boolean;
  transcriptionText?: string;
  onShare?: () => void;
}

type CaptionStylePreset = "viral" | "discuss" | "short";

function formatTime(sec: number): string {
  if (isNaN(sec) || !isFinite(sec) || sec <= 0) return "0:00";
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return `${m}:${s.toString().padStart(2, "0")}`;
}

function formatCleanTitle(raw: string): string {
  const noExt = raw.replace(/\.[^.]+$/, "");
  const spaced = noExt.replace(/[-_]+/g, " ").trim();
  if (!spaced) return "Konten Video Baru";
  return spaced
    .split(" ")
    .map((w) => (w ? w.charAt(0).toUpperCase() + w.slice(1).toLowerCase() : ""))
    .join(" ");
}

function extractHashtags(rawTitle: string): string[] {
  const stopWords = new Set([
    "dan", "atau", "yang", "pada", "di", "ke", "dari", "ini", "itu",
    "untuk", "dengan", "pas", "saat", "cut", "video", "full", "banget",
    "the", "and", "for", "with"
  ]);
  const words = rawTitle
    .toLowerCase()
    .replace(/[^a-z0-9\s]/gi, " ")
    .split(/\s+/)
    .filter((w) => w.length > 2 && !stopWords.has(w));

  const tags = new Set<string>();
  words.slice(0, 3).forEach((w) => tags.add(`#${w.replace(/[^a-z0-9]/g, "")}`));
  tags.add("#fyp");
  tags.add("#viral");
  tags.add("#trending");
  tags.add("#reels");
  tags.add("#malesan");
  return Array.from(tags).slice(0, 6);
}

export function VideoCompletionModal({
  isOpen,
  onClose,
  videoUrl,
  videoFile,
  videoTitle,
  isAPK = false,
  onShare,
}: VideoCompletionModalProps) {
  const [selectedStyle, setSelectedStyle] = useState<CaptionStylePreset>("viral");
  const [copied, setCopied] = useState(false);
  const [toastMsg, setToastMsg] = useState<string | null>(null);
  const [isSharing, setIsSharing] = useState(false);
  const [hasNativeShare, setHasNativeShare] = useState(false);
  const [showShareSheet, setShowShareSheet] = useState(false);

  // Custom Studio Video Player State
  const [showResultPlayer, setShowResultPlayer] = useState(false);
  const [isResultPlaying, setIsResultPlaying] = useState(false);
  const [resultCurrentTime, setResultCurrentTime] = useState(0);
  const [resultDuration, setResultDuration] = useState(0);
  const [isResultMuted, setIsResultMuted] = useState(false);
  const resultVideoRef = React.useRef<HTMLVideoElement | null>(null);

  const toggleResultPlay = () => {
    if (!resultVideoRef.current) return;
    if (resultVideoRef.current.paused) {
      void resultVideoRef.current.play();
      setIsResultPlaying(true);
    } else {
      resultVideoRef.current.pause();
      setIsResultPlaying(false);
    }
  };

  const toggleResultMute = () => {
    if (!resultVideoRef.current) return;
    const nextMute = !resultVideoRef.current.muted;
    resultVideoRef.current.muted = nextMute;
    setIsResultMuted(nextMute);
  };

  useEffect(() => {
    void getNativeShell().then((shell) => {
      setHasNativeShare(!!shell?.capabilities?.includes("share-video"));
    });
  }, []);

  const cleanTitle = useMemo(() => formatCleanTitle(videoTitle), [videoTitle]);
  const hashtags = useMemo(() => extractHashtags(videoTitle).join(" "), [videoTitle]);

  const activeCaption = useMemo(() => {
    switch (selectedStyle) {
      case "discuss":
        return `Menurut kalian wajar gak sih kalau kayak gini? 🤔\n\nSimak baik-baik videonya: "${cleanTitle}"\n\nTulis tanggapan kalian di bawah ya, kita diskusi santai! 👇\n\n${hashtags}`;
      case "short":
        return `Momen "${cleanTitle}"... 🥺 Simak selengkapnya!\n\n${hashtags}`;
      case "viral":
      default:
        return `${cleanTitle} 🥺\n\nBeneran gak nyangka sama momen ini... Menurut kalian gimana tanggapannya? Tonton sampai habis ya! 👇\n\nDrop pendapat kalian di kolom komentar! 💬\n\n${hashtags}`;
    }
  }, [cleanTitle, hashtags, selectedStyle]);

  const showToast = (msg: string) => {
    setToastMsg(msg);
    setTimeout(() => setToastMsg(null), 3200);
  };

  const copyCaption = async () => {
    if (typeof navigator !== "undefined" && navigator.clipboard?.writeText) {
      try {
        await navigator.clipboard.writeText(activeCaption);
        setCopied(true);
        setTimeout(() => setCopied(false), 2200);
        if (typeof navigator.vibrate === "function") {
          try { navigator.vibrate(14); } catch {}
        }
        showToast("Caption tersalin ke clipboard!");
        return true;
      } catch {}
    }
    return false;
  };

  const handleShareToApp = async (targetApp: "system" = "system") => {
    void targetApp;
    setIsSharing(true);
    try {
      // 1. Always copy caption to clipboard with haptic feedback
      await copyCaption();

      // 2. If running on updated APK with native share capability
      if (hasNativeShare) {
        try {
          await requestNative({
            type: "SHARE_VIDEO",
            target: "system",
            text: activeCaption,
          }, 3_000);
          showToast("Membuka menu bagikan video...");
          return;
        } catch (nativeErr) {
          console.warn("Native share request error", nativeErr);
        }
      }

      // 3. Web Share API with File (if supported by the browser)
      if (videoFile && typeof navigator !== "undefined" && navigator.canShare && navigator.canShare({ files: [videoFile] })) {
        try {
          await navigator.share({
            files: [videoFile],
            title: cleanTitle,
            text: activeCaption,
          });
          return;
        } catch (shareErr: unknown) {
          if ((shareErr as { name?: string })?.name === "AbortError") return;
        }
      }

      // 4. Guaranteed Action Sheet Fallback: Never leave user stranded without response
      setShowShareSheet(true);
      showToast("Caption tersalin! Pilih aplikasi di bawah untuk posting.");
      if (onShare) onShare();
    } finally {
      setIsSharing(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[99999] flex items-center justify-center p-3 sm:p-4 bg-black/85 backdrop-blur-md animate-in fade-in duration-200">
      <div className="relative w-full max-w-md max-h-[92vh] overflow-y-auto custom-scrollbar rounded-3xl border border-ember/30 bg-obsidian p-5 sm:p-6 shadow-2xl ring-1 ring-white/10 space-y-4 animate-in zoom-in-95 duration-200 text-ink">
        {/* Glow Accent */}
        <div className="pointer-events-none absolute -top-24 -left-24 size-48 rounded-full bg-ember/20 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-24 -right-24 size-48 rounded-full bg-ember/15 blur-3xl" />

        {/* Dynamic Toast Feedback */}
        {toastMsg && (
          <div className="sticky top-0 z-50 flex items-center justify-center">
            <div className="flex items-center gap-1.5 rounded-full border border-emerald-500/40 bg-emerald-950/90 px-3 py-1 text-xs font-semibold text-emerald-200 shadow-xl backdrop-blur-md animate-in fade-in slide-in-from-top-2">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="size-3.5 text-emerald-400">
                <polyline points="20 6 9 17 4 12" />
              </svg>
              <span>{toastMsg}</span>
            </div>
          </div>
        )}

        {/* Celebration Header */}
        <div className="text-center space-y-1 relative z-10">
          <div className="mx-auto flex size-12 items-center justify-center rounded-2xl bg-ember/20 text-ember border border-ember/40 shadow-lg shadow-ember/20">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="size-6">
              <path strokeLinecap="round" strokeLinejoin="round" d="m4.5 12.75 6 6 9-13.5" />
            </svg>
          </div>
          <h3 className="font-display text-lg sm:text-xl font-extrabold text-white tracking-wide">
            Video Berhasil Di-render
          </h3>
          <p className="text-xs text-mist">
            Hasil video Full HD 1080p siap diputar &amp; diposting langsung ke medsos.
          </p>
        </div>

        {/* Tombol Buka Pop-up Preview Video Hasil Render (Custom Studio Player) */}
        {videoUrl && (
          <button
            type="button"
            onClick={() => setShowResultPlayer(true)}
            className="group relative z-10 w-full overflow-hidden rounded-2xl border border-ember/40 bg-gradient-to-r from-ember/20 via-black/60 to-obsidian p-3.5 shadow-xl transition-all hover:border-ember/70 hover:shadow-ember/20 active:scale-[0.98] cursor-pointer text-left flex items-center justify-between gap-3"
          >
            <div className="flex items-center gap-3">
              <div className="relative flex size-11 shrink-0 items-center justify-center rounded-xl bg-ember text-obsidian shadow-lg shadow-ember/30 group-hover:scale-105 transition-transform">
                <svg viewBox="0 0 24 24" fill="currentColor" className="size-5 translate-x-0.5"><path d="M8 5v14l11-7z"/></svg>
              </div>
              <div>
                <div className="flex items-center gap-1.5">
                  <span className="font-display text-sm font-extrabold text-white group-hover:text-ember transition-colors">
                    Lihat Hasil Video
                  </span>
                  <span className="rounded-md bg-emerald-500/20 px-1.5 py-0.5 text-[9px] font-bold text-emerald-300 border border-emerald-500/30">
                    1080p Siap
                  </span>
                </div>
                <p className="text-[11px] text-mist">
                  Tap untuk memutar video dengan custom player studio
                </p>
              </div>
            </div>

            <div className="flex size-7 shrink-0 items-center justify-center rounded-full bg-white/10 text-white/80 group-hover:bg-ember/20 group-hover:text-ember transition-colors">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="size-3.5">
                <path strokeLinecap="round" strokeLinejoin="round" d="m8.25 4.5 7.5 7.5-7.5 7.5" />
              </svg>
            </div>
          </button>
        )}

        {/* Storage Location Card */}
        <div className="relative z-10 rounded-2xl border border-white/10 bg-white/5 p-3 space-y-1.5">
          <div className="flex items-center gap-1.5 text-xs font-bold text-white/90">
            <span className="flex size-5 items-center justify-center rounded-md bg-ember/20 text-ember text-[11px]">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="size-3.5">
                <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 12.75V12A2.25 2.25 0 0 1 4.5 9.75h15A2.25 2.25 0 0 1 21.75 12v.75m-8.69-6.44-2.12-2.12a1.5 1.5 0 0 0-1.061-.44H4.5A2.25 2.25 0 0 0 2.25 6v12a2.25 2.25 0 0 0 2.25 2.25h15A2.25 2.25 0 0 0 21.75 18V9a2.25 2.25 0 0 0-2.25-2.25h-5.379a1.5 1.5 0 0 1-1.06-.44Z" />
              </svg>
            </span>
            <span>Lokasi Penyimpanan File:</span>
          </div>

          <div className="rounded-xl bg-black/60 p-2.5 border border-white/10 font-mono text-xs text-ember break-all flex items-start gap-2">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="size-4 shrink-0 mt-0.5 text-mist">
              <path strokeLinecap="round" strokeLinejoin="round" d="m2.25 12 8.954-8.955c.44-.439 1.152-.439 1.591 0L21.75 12M4.5 9.75v10.125c0 .621.504 1.125 1.125 1.125H9.75v-4.875c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125V21h4.125c.621 0 1.125-.504 1.125-1.125V9.75M8.25 21h8.25" />
            </svg>
            <div>
              <p className="font-bold text-white text-[11px]">Galeri HP Android (DCIM)</p>
              <p className="text-[10px] text-mist">Folder: <span className="text-ember">DCIM / Malesan / {videoTitle}.mp4</span></p>
            </div>
          </div>
        </div>

        {/* Content-Aware Caption & Viral Hashtags */}
        <div className="relative z-10 rounded-2xl border border-ember/30 bg-surface-raised/40 p-3.5 space-y-2.5">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-1.5">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" className="size-3.5 text-ember">
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                <polyline points="14 2 14 8 20 8" />
                <line x1="16" y1="13" x2="8" y2="13" />
                <line x1="16" y1="17" x2="8" y2="17" />
              </svg>
              <span className="font-display text-xs font-bold text-ink">Caption Siap Posting</span>
            </div>

            <button
              type="button"
              onClick={copyCaption}
              className={`flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-bold transition-all cursor-pointer ${
                copied
                  ? "bg-emerald-500/20 text-emerald-300 border border-emerald-500/40"
                  : "bg-ember/20 text-ember hover:bg-ember/30 border border-ember/40 active:scale-95"
              }`}
            >
              {copied ? (
                <>
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="size-3"><polyline points="20 6 9 17 4 12" /></svg>
                  <span>Tersalin!</span>
                </>
              ) : (
                <>
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="size-3"><rect width="14" height="14" x="8" y="8" rx="2" ry="2" /><path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2" /></svg>
                  <span>Salin Caption</span>
                </>
              )}
            </button>
          </div>

          {/* Caption Style Switcher */}
          <div className="grid grid-cols-3 gap-1.5 p-1 rounded-xl bg-black/40 border border-white/10">
            <button
              type="button"
              onClick={() => setSelectedStyle("viral")}
              className={`h-7 rounded-lg text-[10px] font-bold transition-all cursor-pointer flex items-center justify-center gap-1 ${
                selectedStyle === "viral"
                  ? "bg-ember text-obsidian shadow-sm"
                  : "text-mist hover:text-white"
              }`}
            >
              <span>Viral &amp; Hook</span>
            </button>

            <button
              type="button"
              onClick={() => setSelectedStyle("discuss")}
              className={`h-7 rounded-lg text-[10px] font-bold transition-all cursor-pointer flex items-center justify-center gap-1 ${
                selectedStyle === "discuss"
                  ? "bg-ember text-obsidian shadow-sm"
                  : "text-mist hover:text-white"
              }`}
            >
              <span>Diskusi Netizen</span>
            </button>

            <button
              type="button"
              onClick={() => setSelectedStyle("short")}
              className={`h-7 rounded-lg text-[10px] font-bold transition-all cursor-pointer flex items-center justify-center gap-1 ${
                selectedStyle === "short"
                  ? "bg-ember text-obsidian shadow-sm"
                  : "text-mist hover:text-white"
              }`}
            >
              <span>Singkat</span>
            </button>
          </div>

          <div className="relative rounded-xl bg-black/50 p-2.5 border border-white/5 font-sans text-xs text-white/90 leading-relaxed max-h-32 overflow-y-auto custom-scrollbar whitespace-pre-line">
            {activeCaption}
          </div>

          <p className="text-[10px] text-muted flex items-center gap-1">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="size-3 text-ember shrink-0"><circle cx="12" cy="12" r="10"/><path d="M12 16v-4M12 8h.01"/></svg>
            <span>Caption otomatis tersalin saat kamu tap tombol bagikan di bawah.</span>
          </p>
        </div>

        {/* Step-by-Step Posting Guidance */}
        <div className="relative z-10 rounded-2xl border border-ember/30 bg-ember/10 p-3 space-y-1.5">
          <div className="flex items-center gap-1.5 text-xs font-bold text-ember">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" className="size-4 shrink-0">
              <path strokeLinecap="round" strokeLinejoin="round" d="m11.25 11.25.041-.02a.75.75 0 0 1 1.063.852l-.708 2.836a.75.75 0 0 0 1.063.853l.041-.021M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Zm-9-3.75h.008v.008H12V8.25Z" />
            </svg>
            <span>Panduan Posting Mudah:</span>
          </div>
          <ol className="text-[11px] text-mist space-y-1 pl-4 list-decimal leading-relaxed">
            <li>
              <strong className="text-white">Caption otomatis tersalin</strong> ke clipboard saat kamu tap tombol di bawah.
            </li>
            <li>
              <strong className="text-white">Video sudah tersimpan di Galeri HP</strong> (<span className="text-ember font-mono">DCIM / Malesan</span>).
            </li>
            <li>
              Tap <strong className="text-white">Bagikan File Video ke Aplikasi Lain</strong> untuk langsung mengirim ke TikTok, Instagram, WhatsApp, atau medsos lainnya!
            </li>
          </ol>
        </div>

        {/* Smart Share Action Sheet for WebView / Older APKs */}
        {showShareSheet && (
          <div className="relative z-10 rounded-2xl border border-ember/40 bg-ember/15 p-3.5 space-y-3 animate-in fade-in duration-150">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5 text-xs font-extrabold text-white">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="size-4 text-ember">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M7.217 10.907a2.25 2.25 0 1 0 0 2.186m0-2.186c.18.324.283.696.283 1.093s-.103.77-.283 1.093m0-2.186 9.566-5.314m-9.566 7.5 9.566 5.314m0 0a2.25 2.25 0 1 0 3.935 2.186 2.25 2.25 0 0 0-3.935-2.186Zm0-12.814a2.25 2.25 0 1 0 3.933-2.185 2.25 2.25 0 0 0-3.933 2.185Z" />
                </svg>
                <span>Pilih Aplikasi untuk Posting:</span>
              </div>
              <button
                type="button"
                onClick={() => setShowShareSheet(false)}
                className="text-muted hover:text-white p-1 rounded-md transition-colors cursor-pointer"
              >
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="size-3.5"><path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" /></svg>
              </button>
            </div>

            <p className="text-[11px] text-mist leading-relaxed">
              Caption <span className="text-white font-semibold">sudah tersalin</span> ke clipboard. Video kamu sudah ada di folder <span className="text-ember font-mono font-bold">DCIM / Malesan</span> pada urutan teratas galeri.
            </p>

            <div className="grid grid-cols-3 gap-2">
              <button
                type="button"
                onClick={() => {
                  showToast("Caption tersalin! Buka TikTok dan pilih video paling atas.");
                  window.open("https://www.tiktok.com", "_blank");
                }}
                className="flex flex-col items-center justify-center gap-1.5 h-16 rounded-xl border border-white/10 bg-black/50 hover:bg-black/80 text-white font-bold text-[11px] transition-all active:scale-95 text-center cursor-pointer shadow-sm"
              >
                <svg viewBox="0 0 24 24" fill="currentColor" className="size-5 text-ember">
                  <path d="M12.525.02c1.31-.02 2.61-.01 3.91-.02.08 1.53.63 3.09 1.75 4.17 1.12 1.11 2.7 1.62 4.24 1.79v4.03c-1.44-.05-2.89-.35-4.2-.97-.57-.26-1.1-.59-1.62-.93-.01 2.92.01 5.84-.02 8.75-.08 1.4-.54 2.79-1.35 3.94-1.31 1.92-3.58 3.17-5.91 3.21-1.43.08-2.86-.31-4.08-1.03-2.02-1.19-3.44-3.37-3.65-5.71-.02-.5-.03-1-.01-1.49.18-1.9 1.12-3.72 2.58-4.96 1.66-1.44 3.98-2.13 6.15-1.72.02 1.48-.04 2.96-.04 4.44-.99-.32-2.15-.23-3.02.37-.63.41-1.11 1.04-1.36 1.75-.21.51-.24 1.07-.14 1.61.24 1.64 1.82 2.89 3.5 2.76 1.46-.03 2.75-.98 3.18-2.38.16-.48.2-1 .19-1.51-.03-4.52-.02-9.04-.03-13.56z" />
                </svg>
                <span>TikTok</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  showToast("Caption tersalin! Buka Instagram dan pilih video paling atas.");
                  window.open("https://www.instagram.com", "_blank");
                }}
                className="flex flex-col items-center justify-center gap-1.5 h-16 rounded-xl border border-white/10 bg-black/50 hover:bg-black/80 text-white font-bold text-[11px] transition-all active:scale-95 text-center cursor-pointer shadow-sm"
              >
                <svg viewBox="0 0 24 24" fill="currentColor" className="size-5 text-ember">
                  <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z" />
                </svg>
                <span>Instagram</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  showToast("Membuka WhatsApp dengan caption...");
                  window.open(`https://api.whatsapp.com/send?text=${encodeURIComponent(activeCaption)}`, "_blank");
                }}
                className="flex flex-col items-center justify-center gap-1.5 h-16 rounded-xl border border-white/10 bg-black/50 hover:bg-black/80 text-white font-bold text-[11px] transition-all active:scale-95 text-center cursor-pointer shadow-sm"
              >
                <svg viewBox="0 0 24 24" fill="currentColor" className="size-5 text-emerald-400">
                  <path d="M12.04 2c-5.46 0-9.91 4.45-9.91 9.91 0 1.75.46 3.45 1.32 4.95L2.05 22l5.25-1.38c1.45.79 3.08 1.21 4.74 1.21 5.46 0 9.91-4.45 9.91-9.91 0-2.65-1.03-5.14-2.9-7.01A9.816 9.816 0 0 0 12.04 2m.01 1.67c2.2 0 4.26.86 5.82 2.42a8.225 8.225 0 0 1 2.41 5.83c0 4.54-3.7 8.24-8.24 8.24-1.48 0-2.93-.4-4.2-1.15l-.3-.18-3.12.82.83-3.04-.2-.31a8.196 8.196 0 0 1-1.26-4.38c0-4.54 3.7-8.24 8.24-8.24m4.52 11.66c-.25-.13-1.47-.72-1.7-.81-.23-.08-.39-.13-.56.13-.17.25-.64.81-.79.97-.14.17-.29.19-.54.06-.25-.13-1.06-.39-2.02-1.25-.75-.67-1.26-1.5-1.41-1.75-.15-.25-.02-.39.11-.51.11-.11.25-.29.37-.44.13-.14.17-.25.25-.42.08-.17.04-.31-.02-.44-.06-.13-.56-1.34-.76-1.84-.2-.48-.4-.42-.56-.43h-.47c-.17 0-.44.06-.67.31-.23.25-.88.86-.88 2.1 0 1.24.9 2.44 1.03 2.61.13.17 1.78 2.71 4.3 3.8.6.26 1.07.41 1.44.53.6.19 1.15.16 1.58.1.48-.07 1.47-.6 1.68-1.18.21-.58.21-1.08.15-1.18-.06-.1-.23-.17-.48-.29z" />
                </svg>
                <span>WhatsApp</span>
              </button>
            </div>

            {isAPK && !hasNativeShare && (
              <div className="pt-1 flex items-center justify-between gap-2 rounded-xl bg-black/40 border border-white/5 p-2">
                <span className="text-[10px] text-mist">
                  Ingin menu share bawaan HP langsung 1-klik?
                </span>
                <a
                  href="/malesan.apk"
                  download="malesan.apk"
                  className="shrink-0 h-6 px-2.5 rounded-lg bg-ember/20 hover:bg-ember/30 text-ember font-bold text-[10px] flex items-center gap-1 transition-colors cursor-pointer"
                >
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="size-3"><path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75V16.5M16.5 12 12 16.5m0 0L7.5 12m4.5 4.5V3" /></svg>
                  <span>Update APK</span>
                </a>
              </div>
            )}
          </div>
        )}

        {/* Action Buttons & Social Dispatch */}
        <div className="relative z-10 space-y-2 pt-1">
          {/* Primary Action: Direct Share with Video File Attachment */}
          <button
            type="button"
            disabled={isSharing}
            onClick={() => handleShareToApp("system")}
            className="w-full flex items-center justify-center gap-2 h-11 px-4 rounded-2xl bg-ember hover:bg-ember/90 text-obsidian font-extrabold text-xs shadow-lg shadow-ember/25 transition-all active:scale-95 text-center cursor-pointer disabled:opacity-50"
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="size-4">
              <path strokeLinecap="round" strokeLinejoin="round" d="M7.217 10.907a2.25 2.25 0 1 0 0 2.186m0-2.186c.18.324.283.696.283 1.093s-.103.77-.283 1.093m0-2.186 9.566-5.314m-9.566 7.5 9.566 5.314m0 0a2.25 2.25 0 1 0 3.935 2.186 2.25 2.25 0 0 0-3.935-2.186Zm0-12.814a2.25 2.25 0 1 0 3.933-2.185 2.25 2.25 0 0 0-3.933 2.185Z" />
            </svg>
            <span>Bagikan File Video ke Aplikasi Lain</span>
          </button>

          <div className="flex gap-2">
            {videoUrl && (
              <a
                href={videoUrl}
                download={`${videoTitle}.mp4`}
                className="flex-1 flex items-center justify-center gap-1.5 h-9 px-3 rounded-xl border border-white/10 bg-white/5 hover:bg-white/10 text-mist hover:text-white font-bold text-[11px] transition-all active:scale-95 text-center cursor-pointer"
              >
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="size-3.5">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75V16.5M16.5 12 12 16.5m0 0L7.5 12m4.5 4.5V3" />
                </svg>
                <span>Unduh Ulang MP4</span>
              </a>
            )}

            <button
              type="button"
              onClick={onClose}
              className="flex-1 h-9 px-3 rounded-xl border border-white/10 bg-white/5 hover:bg-white/10 text-mist hover:text-white font-bold text-[11px] transition-all cursor-pointer"
            >
              Tutup &amp; Selesai
            </button>
          </div>
        </div>
      </div>

      {/* Custom Studio Video Player Modal (Pop-up Pop-over Eksklusif) */}
      {showResultPlayer && videoUrl && (
        <div className="fixed inset-0 z-[100000] flex flex-col items-center justify-center p-3 sm:p-4 bg-black/95 backdrop-blur-xl animate-in fade-in duration-200">
          <div className="relative w-full max-w-sm flex flex-col items-center gap-3 animate-in zoom-in-95 duration-200">
            {/* Player Header */}
            <div className="w-full flex items-center justify-between px-1">
              <button
                type="button"
                onClick={() => setShowResultPlayer(false)}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white/10 hover:bg-white/20 text-white font-bold text-xs transition-colors cursor-pointer"
              >
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="size-3.5">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5 8.25 12l7.5-7.5" />
                </svg>
                <span>Kembali</span>
              </button>

              <div className="flex items-center gap-1.5 text-xs font-bold text-white">
                <span className="size-2 rounded-full bg-emerald-400 animate-pulse" />
                <span className="text-ember font-mono">1080p Studio Ultra-HD</span>
              </div>

              <button
                type="button"
                onClick={() => setShowResultPlayer(false)}
                className="flex size-8 items-center justify-center rounded-xl bg-white/10 hover:bg-white/20 text-white/80 hover:text-white transition-colors cursor-pointer"
              >
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="size-4">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* Custom Video Viewport */}
            <div
              onClick={toggleResultPlay}
              className="relative w-full aspect-[9/16] max-h-[62vh] sm:max-h-[68vh] rounded-2xl overflow-hidden bg-black ring-1 ring-white/20 shadow-2xl flex items-center justify-center cursor-pointer group"
            >
              <video
                ref={resultVideoRef}
                src={videoUrl}
                playsInline
                loop
                preload="auto"
                onPlay={() => setIsResultPlaying(true)}
                onPause={() => setIsResultPlaying(false)}
                onTimeUpdate={(e) => {
                  setResultCurrentTime(e.currentTarget.currentTime);
                }}
                onLoadedMetadata={(e) => {
                  setResultDuration(e.currentTarget.duration);
                }}
                className="h-full w-full object-contain"
              />

              {/* Frosted Play Icon Overlay when Paused */}
              {!isResultPlaying && (
                <div className="pointer-events-none absolute inset-0 flex items-center justify-center bg-black/25 backdrop-blur-[1px] transition-all">
                  <div className="flex size-14 items-center justify-center rounded-full bg-ember text-obsidian shadow-2xl ring-4 ring-ember/40">
                    <svg viewBox="0 0 24 24" fill="currentColor" className="size-7 translate-x-0.5"><path d="M8 5v14l11-7z"/></svg>
                  </div>
                </div>
              )}
            </div>

            {/* Custom Control Bar */}
            <div className="w-full rounded-2xl border border-white/10 bg-obsidian p-3 space-y-2.5 shadow-xl">
              {/* Scrubber / Seek Slider */}
              <div className="flex items-center gap-2">
                <span className="font-mono text-[10px] text-mist w-9 text-right">
                  {formatTime(resultCurrentTime)}
                </span>
                <input
                  type="range"
                  min={0}
                  max={resultDuration || 100}
                  step={0.05}
                  value={resultCurrentTime}
                  onChange={(e) => {
                    const target = parseFloat(e.target.value);
                    setResultCurrentTime(target);
                    if (resultVideoRef.current) {
                      resultVideoRef.current.currentTime = target;
                    }
                  }}
                  className="flex-1 h-1.5 rounded-lg appearance-none bg-white/20 accent-ember cursor-pointer"
                />
                <span className="font-mono text-[10px] text-mist w-9">
                  {formatTime(resultDuration)}
                </span>
              </div>

              {/* Controls & Quick Actions */}
              <div className="flex items-center justify-between pt-0.5">
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={toggleResultPlay}
                    className="flex size-9 items-center justify-center rounded-full bg-ember hover:bg-ember/90 text-obsidian shadow-md active:scale-95 transition-transform cursor-pointer"
                  >
                    {isResultPlaying ? (
                      <svg viewBox="0 0 24 24" fill="currentColor" className="size-4.5"><path d="M6 4h4v16H6zm8 0h4v16h-4z"/></svg>
                    ) : (
                      <svg viewBox="0 0 24 24" fill="currentColor" className="size-4.5 translate-x-0.5"><path d="M8 5v14l11-7z"/></svg>
                    )}
                  </button>

                  <button
                    type="button"
                    onClick={toggleResultMute}
                    className="flex size-8 items-center justify-center rounded-xl bg-white/10 hover:bg-white/20 text-white/90 transition-colors cursor-pointer"
                    title={isResultMuted ? "Bunyikan" : "Bisukan"}
                  >
                    {isResultMuted ? (
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="size-4 text-red-400">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M17.25 9.75 19.5 12m0 0 2.25 2.25M19.5 12l2.25-2.25M19.5 12l-2.25 2.25m-10.5-6 4.72-4.72a.75.75 0 0 1 1.28.53v15.88a.75.75 0 0 1-1.28.53l-4.72-4.72H4.51c-.414 0-.75-.336-.75-.75V10.5c0-.414.336-.75.75-.75h4.24Z" />
                      </svg>
                    ) : (
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="size-4">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M19.114 5.636a9 9 0 0 1 0 12.728M16.463 8.288a5.25 5.25 0 0 1 0 7.424M6.75 8.25l4.72-4.72a.75.75 0 0 1 1.28.53v15.88a.75.75 0 0 1-1.28.53l-4.72-4.72H4.51c-.414 0-.75-.336-.75-.75V10.5c0-.414.336-.75.75-.75h4.24Z" />
                      </svg>
                    )}
                  </button>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setShowResultPlayer(false);
                      handleShareToApp("system");
                    }}
                    className="h-8 px-3 rounded-xl bg-ember hover:bg-ember/90 text-obsidian font-extrabold text-[11px] flex items-center gap-1.5 shadow-md active:scale-95 transition-all cursor-pointer"
                  >
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="size-3.5">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M7.217 10.907a2.25 2.25 0 1 0 0 2.186m0-2.186c.18.324.283.696.283 1.093s-.103.77-.283 1.093m0-2.186 9.566-5.314m-9.566 7.5 9.566 5.314m0 0a2.25 2.25 0 1 0 3.935 2.186 2.25 2.25 0 0 0-3.935-2.186Zm0-12.814a2.25 2.25 0 1 0 3.933-2.185 2.25 2.25 0 0 0-3.933 2.185Z" />
                    </svg>
                    <span>Bagikan</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setShowResultPlayer(false)}
                    className="h-8 px-3 rounded-xl bg-white/10 hover:bg-white/20 text-white font-bold text-[11px] transition-colors cursor-pointer"
                  >
                    Tutup
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
