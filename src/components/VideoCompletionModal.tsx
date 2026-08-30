"use client";

import React from "react";

interface VideoCompletionModalProps {
  isOpen: boolean;
  onClose: () => void;
  videoUrl?: string;
  videoTitle: string;
  isAPK: boolean;
  onShare?: () => void;
}

export function VideoCompletionModal({
  isOpen,
  onClose,
  videoUrl,
  videoTitle,
  isAPK,
  onShare,
}: VideoCompletionModalProps) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[99999] flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-in fade-in duration-200">
      <div className="relative w-full max-w-md overflow-hidden rounded-3xl border border-ember/30 bg-obsidian p-6 shadow-2xl ring-1 ring-white/10 space-y-5 animate-in zoom-in-95 duration-200">
        {/* Glow Accent */}
        <div className="pointer-events-none absolute -top-24 -left-24 size-48 rounded-full bg-ember/20 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-24 -right-24 size-48 rounded-full bg-ember/15 blur-3xl" />

        {/* Celebration Header */}
        <div className="text-center space-y-1.5 relative z-10">
          <div className="mx-auto flex size-14 items-center justify-center rounded-2xl bg-ember/20 text-ember border border-ember/40 shadow-lg shadow-ember/20 animate-bounce">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="size-7">
              <path strokeLinecap="round" strokeLinejoin="round" d="m4.5 12.75 6 6 9-13.5" />
            </svg>
          </div>
          <h3 className="font-display text-xl font-extrabold text-white tracking-wide">
            🎉 Video Berhasil Di-render!
          </h3>
          <p className="text-xs text-mist">
            Hasil video Full HD 1080p kamu sudah siap dipublikasikan ke TikTok, Reels, & Shorts.
          </p>
        </div>

        {/* Storage Location Card */}
        <div className="relative z-10 rounded-2xl border border-white/10 bg-white/5 p-4 space-y-2">
          <div className="flex items-center gap-2 text-xs font-bold text-white/90">
            <span className="flex size-5 items-center justify-center rounded-md bg-ember/20 text-ember text-[11px]">📁</span>
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

        {/* Video Preview if available */}
        {videoUrl && (
          <div className="relative z-10 overflow-hidden rounded-xl border border-white/10 bg-black aspect-video max-h-40 flex items-center justify-center">
            <video
              src={videoUrl}
              controls
              playsInline
              className="h-full w-full object-contain"
            />
          </div>
        )}

        {/* Action Buttons */}
        <div className="relative z-10 space-y-2 pt-1">
          <div className="flex gap-2">
            {videoUrl && (
              <a
                href={videoUrl}
                download={`${videoTitle}.mp4`}
                className="flex-1 flex items-center justify-center gap-1.5 py-3 px-4 rounded-xl bg-ember hover:bg-ember/90 text-obsidian font-extrabold text-xs shadow-lg shadow-ember/25 transition-all active:scale-95 text-center"
              >
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="size-4">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75V16.5M16.5 12 12 16.5m0 0L7.5 12m4.5 4.5V3" />
                </svg>
                <span>Unduh File MP4</span>
              </a>
            )}

            {onShare && (
              <button
                type="button"
                onClick={onShare}
                className="flex items-center justify-center gap-1.5 py-3 px-4 rounded-xl border border-white/15 bg-white/10 hover:bg-white/15 text-white font-bold text-xs transition-all active:scale-95"
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
            className="w-full py-2.5 px-4 rounded-xl border border-white/10 bg-white/5 hover:bg-white/10 text-mist hover:text-white font-bold text-xs transition-all"
          >
            Tutup & Lanjutkan Edit
          </button>
        </div>
      </div>
    </div>
  );
}
