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
  onShare,
}: VideoCompletionModalProps) {
  const [selectedStyle, setSelectedStyle] = useState<CaptionStylePreset>("viral");
  const [copied, setCopied] = useState(false);
  const [toastMsg, setToastMsg] = useState<string | null>(null);
  const [isSharing, setIsSharing] = useState(false);
  const [hasNativeShare, setHasNativeShare] = useState(false);

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

      // 4. Fallback
      if (onShare) {
        onShare();
      } else {
        showToast("Caption tersalin! Video sudah ada di DCIM / Malesan.");
      }
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
            Hasil video Full HD 1080p siap diposting langsung ke medsos.
          </p>
        </div>

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

        {/* Video Preview if available */}
        {videoUrl && (
          <div className="relative z-10 overflow-hidden rounded-xl border border-white/10 bg-black aspect-video max-h-32 flex items-center justify-center">
            <video
              src={videoUrl}
              controls
              playsInline
              className="h-full w-full object-contain"
            />
          </div>
        )}

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
    </div>
  );
}
