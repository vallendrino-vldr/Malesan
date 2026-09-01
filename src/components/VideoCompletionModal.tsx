"use client";

import React, { useState } from "react";

interface VideoCompletionModalProps {
  isOpen: boolean;
  onClose: () => void;
  videoUrl?: string;
  videoTitle: string;
  isAPK: boolean;
  transcriptionText?: string;
  onShare?: () => void;
}

export function VideoCompletionModal({
  isOpen,
  onClose,
  videoUrl,
  videoTitle,
  isAPK,
  transcriptionText,
  onShare,
}: VideoCompletionModalProps) {
  const [copied, setCopied] = useState(false);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[99999] flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-in fade-in duration-200">
      <div className="relative w-full max-w-md overflow-hidden rounded-3xl border border-ember/30 bg-obsidian p-6 shadow-2xl ring-1 ring-white/10 space-y-5 animate-in zoom-in-95 duration-200">
        {/* Glow Accent */}
        <div className="pointer-events-none absolute -top-24 -left-24 size-48 rounded-full bg-ember/20 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-24 -right-24 size-48 rounded-full bg-ember/15 blur-3xl" />

        {/* Celebration Header */}
        <div className="text-center space-y-1.5 relative z-10">
          <div className="mx-auto flex size-14 items-center justify-center rounded-2xl bg-ember/20 text-ember border border-ember/40 shadow-lg shadow-ember/20">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="size-7">
              <path strokeLinecap="round" strokeLinejoin="round" d="m4.5 12.75 6 6 9-13.5" />
            </svg>
          </div>
          <h3 className="font-display text-xl font-extrabold text-white tracking-wide">
            Video Berhasil Di-render
          </h3>
          <p className="text-xs text-mist">
            Hasil video Full HD 1080p kamu sudah siap dipublikasikan ke TikTok, Reels, & Shorts.
          </p>
        </div>

        {/* Storage Location Card */}
        <div className="relative z-10 rounded-2xl border border-white/10 bg-white/5 p-4 space-y-2">
          <div className="flex items-center gap-2 text-xs font-bold text-white/90">
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
              {isAPK ? (
                <>
                  <p className="font-bold text-white">Galeri HP Android (DCIM)</p>
                  <p className="text-[11px] text-mist">Folder: <span className="text-ember">DCIM / Malesan / {videoTitle}.mp4</span></p>
                </>
              ) : (
                <>
                  <p className="font-bold text-white">Folder Unduhan Browser (Downloads)</p>
                  <p className="text-[11px] text-mist">File: <span className="text-ember">{videoTitle}.mp4</span></p>
                </>
              )}
            </div>
          </div>
        </div>

        {/* Ready-to-Post Caption & Viral Hashtags */}
        <div className="relative z-10 rounded-2xl border border-ember/30 bg-surface-raised/40 p-3.5 space-y-2">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-1.5">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" className="size-3.5 text-ember">
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                <polyline points="14 2 14 8 20 8" />
                <line x1="16" y1="13" x2="8" y2="13" />
                <line x1="16" y1="17" x2="8" y2="17" />
              </svg>
              <span className="font-display text-xs font-bold text-ink">Caption &amp; Tagar Siap Posting</span>
            </div>
            <button
              type="button"
              onClick={() => {
                const rawSnippet = transcriptionText?.trim() || videoTitle;
                const cleanSnippet = rawSnippet.replace(/\s+/g, " ").slice(0, 140);
                const autoCaption = `${cleanSnippet}...\n\n#kontenkreator #fyp #viral #podcast #malesan`;
                if (typeof navigator !== "undefined" && navigator.clipboard?.writeText) {
                  void navigator.clipboard.writeText(autoCaption);
                  setCopied(true);
                  setTimeout(() => setCopied(false), 2200);
                  if (typeof navigator.vibrate === "function") {
                    try { navigator.vibrate(12); } catch {}
                  }
                }
              }}
              className={`flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-bold transition-all cursor-pointer ${
                copied
                  ? "bg-emerald-500/20 text-emerald-300 border border-emerald-500/40"
                  : "bg-ember/20 text-ember hover:bg-ember/30 border border-ember/40"
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

          <p className="text-micro text-muted font-mono leading-relaxed bg-black/40 p-2 rounded-lg border border-white/5 line-clamp-3">
            {(transcriptionText?.trim() || videoTitle).slice(0, 140)}...{"\n\n"}#kontenkreator #fyp #viral #podcast #malesan
          </p>
        </div>

        {/* Video Preview if available */}
        {videoUrl && (
          <div className="relative z-10 overflow-hidden rounded-xl border border-white/10 bg-black aspect-video max-h-36 flex items-center justify-center">
            <video
              src={videoUrl}
              controls
              playsInline
              className="h-full w-full object-contain"
            />
          </div>
        )}

        {/* Action Buttons & Social Shortcuts */}
        <div className="relative z-10 space-y-2 pt-1">
          <div className="grid grid-cols-2 gap-2">
            <a
              href="https://www.tiktok.com/upload"
              target="_blank"
              rel="noreferrer"
              className="flex items-center justify-center gap-1.5 h-10 px-3 rounded-xl border border-white/15 bg-white/[0.05] hover:bg-white/10 text-white font-bold text-xs transition-all active:scale-95 text-center"
            >
              <svg viewBox="0 0 24 24" fill="currentColor" className="size-3.5 text-ember">
                <path d="M12.525.02c1.31-.02 2.61-.01 3.91-.02.08 1.53.63 3.09 1.75 4.17 1.12 1.11 2.7 1.62 4.24 1.79v4.03c-1.44-.05-2.89-.35-4.2-.97-.57-.26-1.1-.59-1.62-.93-.01 2.92.01 5.84-.02 8.75-.08 1.4-.54 2.79-1.35 3.94-1.31 1.92-3.58 3.17-5.91 3.21-1.43.08-2.86-.31-4.08-1.03-2.02-1.19-3.44-3.37-3.65-5.71-.02-.5-.03-1-.01-1.49.18-1.9 1.12-3.72 2.58-4.96 1.66-1.44 3.98-2.13 6.15-1.72.02 1.48-.04 2.96-.04 4.44-.99-.32-2.15-.23-3.02.37-.63.41-1.11 1.04-1.36 1.75-.21.51-.24 1.07-.14 1.61.24 1.64 1.82 2.89 3.5 2.76 1.46-.03 2.75-.98 3.18-2.38.16-.48.2-1 .19-1.51-.03-4.52-.02-9.04-.03-13.56z" />
              </svg>
              <span>Buka TikTok</span>
            </a>

            <a
              href="https://www.instagram.com"
              target="_blank"
              rel="noreferrer"
              className="flex items-center justify-center gap-1.5 h-10 px-3 rounded-xl border border-white/15 bg-white/[0.05] hover:bg-white/10 text-white font-bold text-xs transition-all active:scale-95 text-center"
            >
              <svg viewBox="0 0 24 24" fill="currentColor" className="size-3.5 text-ember">
                <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z" />
              </svg>
              <span>Buka Reels</span>
            </a>
          </div>

          <div className="flex gap-2">
            {videoUrl && (
              <a
                href={videoUrl}
                download={`${videoTitle}.mp4`}
                className="flex-1 flex items-center justify-center gap-1.5 h-10 px-4 rounded-xl bg-ember hover:bg-ember/90 text-obsidian font-extrabold text-xs shadow-lg shadow-ember/25 transition-all active:scale-95 text-center cursor-pointer"
              >
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="size-4">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75V16.5M16.5 12 12 16.5m0 0L7.5 12m4.5 4.5V3" />
                </svg>
                <span>Unduh Ulang MP4</span>
              </a>
            )}

            {onShare && (
              <button
                type="button"
                onClick={onShare}
                className="flex items-center justify-center gap-1.5 h-10 px-4 rounded-xl border border-white/15 bg-white/10 hover:bg-white/15 text-white font-bold text-xs transition-all active:scale-95 cursor-pointer"
              >
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="size-4 text-ember">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M7.217 10.907a2.25 2.25 0 1 0 0 2.186m0-2.186c.18.324.283.696.283 1.093s-.103.77-.283 1.093m0-2.186 9.566-5.314m-9.566 7.5 9.566 5.314m0 0a2.25 2.25 0 1 0 3.935 2.186 2.25 2.25 0 0 0-3.935-2.186Zm0-12.814a2.25 2.25 0 1 0 3.933-2.185 2.25 2.25 0 0 0-3.933 2.185Z" />
                </svg>
                <span>Bagikan</span>
              </button>
            )}
          </div>

          <button
            type="button"
            onClick={onClose}
            className="w-full h-9 px-4 rounded-xl border border-white/10 bg-white/5 hover:bg-white/10 text-mist hover:text-white font-bold text-xs transition-all cursor-pointer"
          >
            Tutup &amp; Lanjutkan Edit
          </button>
        </div>
      </div>
    </div>
  );
}
