"use client";

import React, { useState } from "react";
import type { ManualKeyframe } from "@/lib/video/keyframe-engine";

interface VideoKeyframeControlsProps {
  currentTime: number;
  duration: number;
  keyframes: ManualKeyframe[];
  currentPanX: number;
  currentZoom: number;
  splitTopPanX?: number;
  splitBottomPanX?: number;
  onPanChange: (panX: number) => void;
  onZoomChange: (zoom: number) => void;
  onSplitPanChange?: (speaker: "top" | "bottom", panX: number) => void;
  onAddKeyframe: (keyframe: Omit<ManualKeyframe, "id">) => void;
  onRemoveKeyframe: (id: string) => void;
  onSeek: (time: number) => void;
  framingMode: "auto_ai" | "podcast_split" | "manual_keyframe" | "preset_left" | "preset_center" | "preset_right";
  onFramingModeChange: (mode: "auto_ai" | "podcast_split" | "manual_keyframe" | "preset_left" | "preset_center" | "preset_right") => void;
  onRunAITrack: () => void;
  isAITracking: boolean;
}

function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  const ms = Math.floor((seconds % 1) * 10);
  return `${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}.${ms}`;
}

export function VideoKeyframeControls({
  currentTime,
  duration,
  keyframes,
  currentPanX,
  currentZoom,
  splitTopPanX,
  splitBottomPanX,
  onPanChange,
  onZoomChange,
  onSplitPanChange,
  onAddKeyframe,
  onRemoveKeyframe,
  onSeek,
  framingMode,
  onFramingModeChange,
  onRunAITrack,
  isAITracking,
}: VideoKeyframeControlsProps) {
  const [panInput, setPanInput] = useState(currentPanX);
  const [zoomInput, setZoomInput] = useState(currentZoom);

  // Check if there is already a keyframe near currentTime (within 0.3s)
  const activeKeyframe = keyframes.find((k) => Math.abs(k.time - currentTime) <= 0.35);

  const handlePan = (val: number) => {
    setPanInput(val);
    onPanChange(val);
  };

  const handleZoom = (val: number) => {
    setZoomInput(val);
    onZoomChange(val);
  };

  const handleSaveKeyframe = () => {
    onAddKeyframe({
      time: Number(currentTime.toFixed(2)),
      panX: panInput,
      panY: 0.45,
      zoom: zoomInput,
      label: `Shot ${formatTime(currentTime)}`,
    });
  };

  return (
    <div className="space-y-4 rounded-2xl border border-white/10 bg-obsidian-subtle/80 p-4 shadow-xl backdrop-blur-md">
      {/* Header with Relatable Branding */}
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-white/10 pb-3">
        <div className="flex items-center gap-2">
          <div className="flex size-7 items-center justify-center rounded-lg bg-ember/15 text-ember ring-1 ring-ember/30">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" className="size-4">
              <path strokeLinecap="round" strokeLinejoin="round" d="m15.75 10.5 4.72-4.72a.75.75 0 0 1 1.28.53v11.38a.75.75 0 0 1-1.28.53l-4.72-4.72M4.5 18.75h9a2.25 2.25 0 0 0 2.25-2.25v-9a2.25 2.25 0 0 0-2.25-2.25h-9A2.25 2.25 0 0 0 2.25 7.5v9a2.25 2.25 0 0 0 2.25 2.25Z" />
            </svg>
          </div>
          <div>
            <h4 className="font-display text-sm font-bold text-white tracking-wide flex items-center gap-1.5">
              <span>Kamera Pintar AI</span>
              <span className="rounded-full bg-ember/20 px-2 py-0.5 text-[10px] font-bold text-ember border border-ember/30">Smart Framing</span>
            </h4>
            <p className="text-[11px] text-mist">Atur posisi kamera & sudut pandang agar wajah pembicara presisi</p>
          </div>
        </div>

        {/* Current Time Badge */}
        <div className="flex items-center gap-1 rounded-lg border border-white/10 bg-black/40 px-2.5 py-1 text-xs font-mono text-white/90">
          <span className="size-1.5 rounded-full bg-ember animate-pulse" />
          <span>{formatTime(currentTime)}</span>
          <span className="text-mist">/ {formatTime(duration)}</span>
        </div>
      </div>

      {/* Compact Mode Selector Bar */}
      <div className="grid grid-cols-3 gap-1 p-1 rounded-xl bg-black/60 border border-white/10">
        <button
          type="button"
          onClick={() => {
            onFramingModeChange("auto_ai");
            onRunAITrack();
          }}
          className={`flex items-center justify-center gap-1.5 py-2 px-2 rounded-lg text-xs font-bold transition-all ${
            framingMode === "auto_ai"
              ? "bg-ember text-obsidian shadow-sm font-extrabold"
              : "text-mist hover:text-white hover:bg-white/5"
          }`}
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" className="size-3.5">
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 19.128a9.38 9.38 0 0 0 2.625.372 9.337 9.337 0 0 0 4.121-.952 4.125 4.125 0 0 0-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 0 1 8.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0 1 11.964-3.07M12 6.375a3.375 3.375 0 1 1-6.75 0 3.375 3.375 0 0 1 6.75 0Zm8.25 2.25a2.625 2.625 0 1 1-5.25 0 2.625 2.625 0 0 1 5.25 0Z" />
          </svg>
          <span>Auto AI</span>
        </button>

        <button
          type="button"
          onClick={() => onFramingModeChange("podcast_split")}
          className={`flex items-center justify-center gap-1.5 py-2 px-2 rounded-lg text-xs font-bold transition-all ${
            framingMode === "podcast_split"
              ? "bg-ember text-obsidian shadow-sm font-extrabold"
              : "text-mist hover:text-white hover:bg-white/5"
          }`}
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" className="size-3.5">
            <rect x="3" y="3" width="18" height="8" rx="2" strokeLinecap="round" strokeLinejoin="round" />
            <rect x="3" y="13" width="18" height="8" rx="2" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          <span>Split Podcast</span>
        </button>

        <button
          type="button"
          onClick={() => onFramingModeChange("manual_keyframe")}
          className={`flex items-center justify-center gap-1.5 py-2 px-2 rounded-lg text-xs font-bold transition-all ${
            framingMode === "manual_keyframe" || framingMode.startsWith("preset")
              ? "bg-ember text-obsidian shadow-sm font-extrabold"
              : "text-mist hover:text-white hover:bg-white/5"
          }`}
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" className="size-3.5">
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 13.5V3.75m0 9.75a1.5 1.5 0 0 1 0 3m0-3a1.5 1.5 0 0 0 0 3m0 3.75V16.5m12-.75V3.75m0 12a1.5 1.5 0 0 1 0 3m0-3a1.5 1.5 0 0 0 0 3m0 3.75V16.5m-6-9V3.75m0 3.75a1.5 1.5 0 0 1 0 3m0-3a1.5 1.5 0 0 0 0 3m0 9.75V10.5" />
          </svg>
          <span>Manual Angle</span>
        </button>
      </div>

      {/* Manual / Keyframe Controls Sub-panel */}
      {(framingMode === "manual_keyframe" || framingMode.startsWith("preset")) && (
        <div className="space-y-4 pt-1">
          {/* Quick Preset Buttons */}
          <div className="flex items-center gap-2">
            <span className="text-[11px] font-bold text-mist whitespace-nowrap">Sudut Cepat:</span>
            <div className="grid grid-cols-3 gap-1.5 flex-1">
              <button
                type="button"
                onClick={() => {
                  handlePan(0.2);
                  onFramingModeChange("preset_left");
                }}
                className={`flex items-center justify-center gap-1.5 py-2 px-2 rounded-lg border text-xs font-bold transition-all ${
                  Math.abs(panInput - 0.2) < 0.05
                    ? "border-ember bg-ember/20 text-ember"
                    : "border-white/10 bg-white/5 text-mist hover:text-white"
                }`}
              >
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" className="size-3.5">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 19.5 3 12m0 0 7.5-7.5M3 12h18" />
                </svg>
                <span>Kiri (Host)</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  handlePan(0.5);
                  onFramingModeChange("preset_center");
                }}
                className={`flex items-center justify-center gap-1.5 py-2 px-2 rounded-lg border text-xs font-bold transition-all ${
                  Math.abs(panInput - 0.5) < 0.05
                    ? "border-ember bg-ember/20 text-ember"
                    : "border-white/10 bg-white/5 text-mist hover:text-white"
                }`}
              >
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" className="size-3.5">
                  <circle cx="12" cy="12" r="9" />
                  <circle cx="12" cy="12" r="3" fill="currentColor" />
                </svg>
                <span>Tengah</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  handlePan(0.8);
                  onFramingModeChange("preset_right");
                }}
                className={`flex items-center justify-center gap-1.5 py-2 px-2 rounded-lg border text-xs font-bold transition-all ${
                  Math.abs(panInput - 0.8) < 0.05
                    ? "border-ember bg-ember/20 text-ember"
                    : "border-white/10 bg-white/5 text-mist hover:text-white"
                }`}
              >
                <span>Kanan (Tamu)</span>
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" className="size-3.5">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5 21 12m0 0-7.5 7.5M21 12H3" />
                </svg>
              </button>
            </div>
          </div>

          {/* Pan Slider */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between text-xs">
              <label htmlFor="pan-horizontal-slider" className="font-bold text-white/90 flex items-center gap-1.5">
                <span>Geser Kamera Horizontal (Pan X)</span>
              </label>
              <span className="font-mono text-ember font-bold">
                {panInput < 0.45 ? `Kiri (${Math.round((0.5 - panInput) * 200)}%)` : panInput > 0.55 ? `Kanan (${Math.round((panInput - 0.5) * 200)}%)` : "Tengah (0%)"}
              </span>
            </div>
            <input
              id="pan-horizontal-slider"
              type="range"
              min="0"
              max="1"
              step="0.01"
              value={panInput}
              onChange={(e) => handlePan(parseFloat(e.target.value))}
              aria-label="Geser Kamera Horizontal"
              className="w-full accent-ember cursor-pointer"
            />
            <div className="flex justify-between text-[10px] text-mist px-0.5">
              <span>Host / Kiri Penuh</span>
              <span>Center</span>
              <span>Tamu / Kanan Penuh</span>
            </div>
          </div>

          {/* Zoom Slider */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between text-xs">
              <label htmlFor="zoom-scale-slider" className="font-bold text-white/90">Zoom Skala Kamera</label>
              <span className="font-mono text-ember font-bold">{zoomInput.toFixed(2)}x</span>
            </div>
            <input
              id="zoom-scale-slider"
              type="range"
              min="1.0"
              max="1.8"
              step="0.05"
              value={zoomInput}
              onChange={(e) => handleZoom(parseFloat(e.target.value))}
              aria-label="Zoom Skala Kamera"
              className="w-full accent-ember cursor-pointer"
            />
          </div>

          {/* Keyframe Actions */}
          <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-white/10">
            <button
              type="button"
              onClick={handleSaveKeyframe}
              className="flex-1 flex items-center justify-center gap-1.5 py-2 px-3 rounded-xl bg-ember/20 hover:bg-ember/30 border border-ember/40 text-ember font-bold text-xs shadow-md transition-all active:scale-95"
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="size-4">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
              </svg>
              <span>{activeKeyframe ? "Perbarui Keyframe di Detik Ini" : `Kunci Keyframe di ${formatTime(currentTime)}`}</span>
            </button>

            {activeKeyframe && (
              <button
                type="button"
                onClick={() => onRemoveKeyframe(activeKeyframe.id)}
                className="py-2 px-3 rounded-xl bg-red-500/20 hover:bg-red-500/30 border border-red-500/40 text-red-300 font-bold text-xs transition-all active:scale-95"
              >
                Hapus Keyframe
              </button>
            )}
          </div>

          {/* Keyframes Timeline List */}
          {keyframes.length > 0 && (
            <div className="space-y-1.5 pt-2">
              <span className="text-[11px] font-bold text-mist">Keyframe Tersimpan ({keyframes.length}):</span>
              <div className="flex flex-wrap gap-1.5 max-h-24 overflow-y-auto custom-scrollbar p-1">
                {keyframes.map((kf) => (
                  <button
                    key={kf.id}
                    type="button"
                    onClick={() => {
                      onSeek(kf.time);
                      handlePan(kf.panX);
                      handleZoom(kf.zoom);
                    }}
                    className={`flex items-center gap-1.5 py-1 px-2 rounded-lg text-[11px] font-mono border transition-all ${
                      Math.abs(kf.time - currentTime) <= 0.35
                        ? "border-ember bg-ember/25 text-ember font-bold ring-1 ring-ember/40"
                        : "border-white/10 bg-white/5 text-mist hover:text-white"
                    }`}
                  >
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="size-3 text-ember">
                      <circle cx="12" cy="12" r="10"/>
                      <polyline points="12 6 12 12 16 14"/>
                    </svg>
                    <span>{formatTime(kf.time)}</span>
                    <span className="text-[10px] text-white/50">({kf.panX < 0.45 ? "Kiri" : kf.panX > 0.55 ? "Kanan" : "Tgh"})</span>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Split Podcast Dual-Camera Angle Controls */}
      {framingMode === "podcast_split" && (
        <div className="space-y-4 pt-1">
          <div className="p-2.5 rounded-xl bg-ember/10 border border-ember/20 text-xs text-mist flex items-center gap-2">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="size-4 text-ember shrink-0">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 1 1-18 0 9 9 0 0 1 18 0Zm-9 3.75h.008v.008H12v-.008Z" />
            </svg>
            <span>Kamu bisa geser langsung frame video atas &amp; bawah di layar preview untuk sudut presisi.</span>
          </div>

          {/* Top Speaker (Host) Pan */}
          <div className="space-y-2 rounded-xl border border-white/10 bg-white/5 p-3">
            <div className="flex items-center justify-between text-xs">
              <span className="font-bold text-white flex items-center gap-1.5">
                <span className="size-2 rounded-full bg-blue-400" />
                <span>Kamera Atas (Host / Pembicara 1)</span>
              </span>
              <span className="font-mono text-ember font-bold">
                {Math.round((splitTopPanX ?? 0.25) * 100)}%
              </span>
            </div>
            <input
              type="range"
              min="0"
              max="1"
              step="0.01"
              value={splitTopPanX ?? 0.25}
              onChange={(e) => onSplitPanChange?.("top", parseFloat(e.target.value))}
              className="w-full accent-ember cursor-pointer"
            />
            <div className="flex justify-between text-[10px] text-mist">
              <span>Kiri (0%)</span>
              <span>Tengah (50%)</span>
              <span>Kanan (100%)</span>
            </div>
          </div>

          {/* Bottom Speaker (Guest) Pan */}
          <div className="space-y-2 rounded-xl border border-white/10 bg-white/5 p-3">
            <div className="flex items-center justify-between text-xs">
              <span className="font-bold text-white flex items-center gap-1.5">
                <span className="size-2 rounded-full bg-emerald-400" />
                <span>Kamera Bawah (Tamu / Pembicara 2)</span>
              </span>
              <span className="font-mono text-ember font-bold">
                {Math.round((splitBottomPanX ?? 0.75) * 100)}%
              </span>
            </div>
            <input
              type="range"
              min="0"
              max="1"
              step="0.01"
              value={splitBottomPanX ?? 0.75}
              onChange={(e) => onSplitPanChange?.("bottom", parseFloat(e.target.value))}
              className="w-full accent-ember cursor-pointer"
            />
            <div className="flex justify-between text-[10px] text-mist">
              <span>Kiri (0%)</span>
              <span>Tengah (50%)</span>
              <span>Kanan (100%)</span>
            </div>
          </div>
        </div>
      )}

      {/* Auto AI Tracking Active Status */}
      {framingMode === "auto_ai" && (
        <div className="flex items-center justify-between p-3 rounded-xl bg-ember/10 border border-ember/20 text-xs">
          <div className="flex items-center gap-2">
            <span className={`size-2 rounded-full bg-ember ${isAITracking ? "animate-ping" : ""}`} />
            <span className="text-white/90">
              {isAITracking ? "AI sedang menganalisis & mengunci wajah pembicara..." : "AI Auto Tracking Aktif (Wajah pembicara otomatis diikuti)"}
            </span>
          </div>
          <button
            type="button"
            onClick={onRunAITrack}
            disabled={isAITracking}
            className="py-1 px-2.5 rounded-lg bg-ember text-obsidian font-bold text-[11px] hover:bg-ember/90 transition-all disabled:opacity-50"
          >
            {isAITracking ? "Memindai..." : "Pindai Ulang"}
          </button>
        </div>
      )}
    </div>
  );
}
