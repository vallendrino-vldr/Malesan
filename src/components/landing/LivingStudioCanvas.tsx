"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { Mascot } from "@/components/Mascot";

export type StudioStateId = "standby" | "thinking" | "ideas" | "script" | "ready";

export type TopicPreset = {
  id: string;
  label: string;
  topicName: string;
  sampleHook: string;
  angles: string[];
  scriptHook: string;
};

export const TOPIC_PRESETS: TopicPreset[] = [
  {
    id: "bengkel",
    label: "Modus Bengkel",
    topicName: "Trik Bengkel Nakal Pas Servis CVT",
    sampleHook: "Modus Bengkel Nakal Pas Lo Servis CVT",
    angles: [
      "Trik oknum mekanik maksa ganti part padahal cuma kotor",
      "Perbedaan gredek kampas ganda vs v-belt aus",
      "Cara cek fisik part lama sebelum bayar tagihan bengkel",
    ],
    scriptHook: "Stop iyain pas mekanik bilang: 'Ini harus ganti satu set, Mas...'",
  },
  {
    id: "freelance",
    label: "Klien Remote",
    topicName: "Trik Dapet Klien Luar Negeri Tanpa Portofolio",
    sampleHook: "Trik Dapet Klien Luar Negeri Tanpa Portofolio",
    angles: [
      "Kirim audit gratis 2 menit via video loom ke target klien",
      "Framework cold outreach yang dibalas 8 dari 10 CEO",
      "Cara nego rate USD meski akun Upwork masih nol review",
    ],
    scriptHook: "Klien luar negeri gak peduli lo kuliah di mana, mereka cuma peduli...",
  },
  {
    id: "kopi",
    label: "Kopi Senja",
    topicName: "Kenapa Coffee Shop Aesthetic Banyak yang Tutup",
    sampleHook: "Kenapa Coffee Shop Aesthetic Banyak yang Tutup",
    angles: [
      "Kesalahan fatal hitung COGS biji kopi vs sewa tempat",
      "Pelanggan cuma beli 1 cup tapi nongkrong 6 jam numpang WiFi",
      "Strategi food pairing yang bikin margin profit naik 40%",
    ],
    scriptHook: "Punya modal 100 juta terus pengen buka coffee shop? Tahan dulu...",
  },
  {
    id: "thrift",
    label: "Fashion Thrift",
    topicName: "Rahasia Sortir Baju Thrift Jadi Omset Puluhan Juta",
    sampleHook: "Rahasia Sortir Baju Thrift Jadi Omset Puluhan Juta",
    angles: [
      "Trik bedain hoodie vintage ori vs repro pasar lokal",
      "Formula live streaming TikTok yang ludes 50 pcs dalam 30 menit",
      "Cara mencuci & setrika uap biar baju modal 15rb terlihat 200rb",
    ],
    scriptHook: "Modal 1 karung baju bekas di Pasar Senen bisa jadi motor baru kalau lo...",
  },
];

type HeroTimelineState = {
  id: StudioStateId;
  stepNum: string;
  badge: string;
  headline: string;
  subtext: string;
  mood: "sleepy" | "thinking" | "ideas" | "script" | "ready";
  glowIntensity: number;
  glowHue: string;
  borderColor: string;
};

const TIMELINE_STATES: HeroTimelineState[] = [
  {
    id: "standby",
    stepNum: "01",
    badge: "MENUNGGU TOPIK",
    headline: "Layar kosong lagi?",
    subtext: "Pilih atau sebut topik konten pertama lo.",
    mood: "sleepy",
    glowIntensity: 0.2,
    glowHue: "rgba(255, 138, 61, 0.15)",
    borderColor: "border-hairline/60",
  },
  {
    id: "thinking",
    stepNum: "02",
    badge: "MEMINDAI TREN LOKAL",
    headline: "Menyaring Pola Viral Indonesia",
    subtext: "Mencocokkan gaya bahasa santai audiens lo.",
    mood: "thinking",
    glowIntensity: 0.6,
    glowHue: "rgba(255, 138, 61, 0.5)",
    borderColor: "border-ember/40",
  },
  {
    id: "ideas",
    stepNum: "03",
    badge: "3 SUDUT PANDANG MATANG",
    headline: "3 Pilihan Sudut Pandang",
    subtext: "Pilih angle yang paling pas buat karakter lo.",
    mood: "ideas",
    glowIntensity: 0.75,
    glowHue: "rgba(255, 184, 108, 0.55)",
    borderColor: "border-amber-500/40",
  },
  {
    id: "script",
    stepNum: "04",
    badge: "NASKAH 45 DETIK SIAP",
    headline: "Alur Video Siap Rekam",
    subtext: "Lengkap dengan Hook, Masalah, Solusi & CTA.",
    mood: "script",
    glowIntensity: 0.85,
    glowHue: "rgba(255, 138, 61, 0.6)",
    borderColor: "border-ember/50",
  },
  {
    id: "ready",
    stepNum: "05",
    badge: "KONTEN SIAP TAYANG ✓",
    headline: "Tinggal Rekam & Upload!",
    subtext: "Subtitle sinkron otomatis per kata.",
    mood: "ready",
    glowIntensity: 0.7,
    glowHue: "rgba(111, 207, 151, 0.45)",
    borderColor: "border-emerald-500/40",
  },
];

export function LivingStudioCanvas({
  className = "",
  activePresetId = "bengkel",
  onSelectPreset,
}: {
  className?: string;
  activePresetId?: string;
  onSelectPreset?: (id: string) => void;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [activeStep, setActiveStep] = useState(2); // Start at "03 Ideas Found" for high perceived value
  const [isPaused, setIsPaused] = useState(false);
  const [mouseGaze, setMouseGaze] = useState({ x: 0, y: 0, angleX: 0, angleY: 0 });
  const [isTransitioning, setIsTransitioning] = useState(false);

  const activeTopic = TOPIC_PRESETS.find((p) => p.id === activePresetId) || TOPIC_PRESETS[0];

  // Manual step selection with smooth transition
  const handleSelectStep = useCallback((idx: number) => {
    setIsTransitioning(true);
    setTimeout(() => {
      setActiveStep(idx);
      setIsTransitioning(false);
    }, 180);
  }, []);

  // 16-Second State Machine Loop (Auto Progress when not hovered)
  useEffect(() => {
    if (isPaused) return;

    const durations = [3200, 3600, 4200, 4200, 3600];
    const duration = durations[activeStep] || 3800;

    const timer = setTimeout(() => {
      setIsTransitioning(true);
      setTimeout(() => {
        setActiveStep((prev) => (prev + 1) % TIMELINE_STATES.length);
        setIsTransitioning(false);
      }, 200);
    }, duration);

    return () => clearTimeout(timer);
  }, [activeStep, isPaused]);

  // Desktop Mouse Gaze & Parallax Tracking
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const onMove = (e: MouseEvent) => {
      const rect = el.getBoundingClientRect();
      const normX = (e.clientX - rect.left) / rect.width - 0.5;
      const normY = (e.clientY - rect.top) / rect.height - 0.5;

      setMouseGaze({
        x: normX * 18,
        y: normY * 14,
        angleX: -normY * 8,
        angleY: normX * 10,
      });
    };

    const onLeave = () => {
      setMouseGaze({ x: 0, y: 0, angleX: 0, angleY: 0 });
    };

    el.addEventListener("mousemove", onMove, { passive: true });
    el.addEventListener("mouseleave", onLeave, { passive: true });

    return () => {
      el.removeEventListener("mousemove", onMove);
      el.removeEventListener("mouseleave", onLeave);
    };
  }, []);

  const current = TIMELINE_STATES[activeStep];
  const isWorking = current.mood === "thinking" || current.mood === "script" || current.mood === "ideas";

  return (
    <div
      ref={containerRef}
      onMouseEnter={() => setIsPaused(true)}
      onMouseLeave={() => setIsPaused(false)}
      className={`relative flex w-full max-w-[480px] min-h-[350px] sm:min-h-[480px] flex-col items-center justify-between rounded-3xl border border-hairline/80 bg-surface/40 p-4 sm:p-7 shadow-2xl backdrop-blur-xl transition-all duration-300 overflow-hidden select-none ${className}`}
      style={{
        transform: `perspective(1200px) rotateY(${mouseGaze.angleY * 0.35}deg) rotateX(${mouseGaze.angleX * 0.35}deg)`,
      }}
    >
      {/* 3D Volumetric Stage Lighting Backdrop */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -bottom-20 left-1/2 -translate-x-1/2 w-[380px] h-[400px] blur-3xl rounded-full transition-all duration-700"
        style={{
          backgroundColor: current.glowHue,
          opacity: current.glowIntensity,
          transform: `scale(${0.85 + current.glowIntensity * 0.35})`,
        }}
      />

      {/* Top Celebration Glow for Ready State */}
      {current.id === "ready" && (
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -top-10 left-1/2 -translate-x-1/2 w-64 h-64 blur-3xl rounded-full bg-emerald-500/25 transition-opacity duration-700"
        />
      )}

      {/* Orbit Rings with Subtle Rotation */}
      <div
        className="pointer-events-none absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 size-52 sm:size-64 rounded-full border transition-all duration-500"
        style={{
          borderColor: isWorking ? "rgba(255,138,61,0.3)" : "rgba(255,138,61,0.12)",
          transform: `translate(-50%, -50%) scale(${isWorking ? 1.04 : 1})`,
        }}
      />
      <div
        className="pointer-events-none absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 size-64 sm:size-80 rounded-full border border-dashed transition-all duration-500"
        style={{
          borderColor: isWorking ? "rgba(255,138,61,0.2)" : "rgba(255,138,61,0.06)",
          animation: isWorking ? "spin 24s linear infinite" : "spin 45s linear infinite",
        }}
      />

      {/* Top Control Bar: Status Indicator & 5 Interactive Steps */}
      <div className="relative z-20 flex w-full items-center justify-between border-b border-hairline/60 pb-2 sm:pb-3">
        <div className="flex items-center gap-2">
          <span
            className="size-2 rounded-full transition-colors duration-300"
            style={{
              backgroundColor: current.id === "ready" ? "#6fcf97" : "#ff8a3d",
              boxShadow: isWorking
                ? "0 0 10px rgba(255,138,61,0.9)"
                : current.id === "ready"
                  ? "0 0 10px rgba(111,207,151,0.85)"
                  : "0 0 5px rgba(255,138,61,0.4)",
              animation: isWorking ? "pulse 1.2s ease-in-out infinite" : "none",
            }}
          />
          <span className="font-mono text-[9px] sm:text-[10px] font-bold text-ember uppercase tracking-wider transition-all duration-300">
            {current.badge}
          </span>
        </div>

        {/* 5 Step Progress Clickable Pills */}
        <div className="flex items-center gap-1.5">
          {TIMELINE_STATES.map((_, idx) => (
            <button
              key={idx}
              type="button"
              onClick={() => handleSelectStep(idx)}
              aria-label={`Pindah ke tahap ${idx + 1}`}
              className={`h-1.5 rounded-full transition-all duration-300 cursor-pointer ${
                activeStep === idx
                  ? "w-4 sm:w-5 bg-ember shadow-[0_0_10px_rgba(255,138,61,0.8)]"
                  : activeStep > idx
                    ? "w-2 sm:w-2.5 bg-ember/50"
                    : "w-1.5 bg-muted/30 hover:bg-ember/40"
              }`}
            />
          ))}
        </div>
      </div>

      {/* Central Living Mascot with Gaze & Dynamic Expression */}
      <div className="relative z-10 my-2 sm:my-auto flex flex-col items-center">
        <div
          className={`relative size-28 sm:size-40 transition-transform duration-200 ${
            current.mood === "ready"
              ? "animate-[bounce-gentle_2.2s_ease-in-out_infinite]"
              : "animate-[bounce-gentle_3.5s_ease-in-out_infinite]"
          }`}
          style={{
            transform: `translate(${mouseGaze.x * 0.4}px, ${mouseGaze.y * 0.3}px) ${
              current.mood === "thinking"
                ? "rotate(2deg)"
                : current.mood === "ideas"
                  ? "rotate(-2deg) scale(1.02)"
                  : "rotate(0deg)"
            }`,
          }}
        >
          <Mascot
            mood={current.mood}
            className="size-full filter drop-shadow-[0_14px_30px_rgba(0,0,0,0.7)]"
          />
        </div>

        {/* Workspace Hologram Pedestal */}
        <div className="mt-2 flex flex-col items-center">
          <div
            className="w-40 h-3 rounded-full bg-gradient-to-r from-transparent via-ember/40 to-transparent blur-[1px] transition-all duration-500"
            style={{
              opacity: 0.5 + current.glowIntensity * 0.5,
              width: `${9 + current.glowIntensity * 2.5}rem`,
            }}
          />
          <div
            className="w-28 h-1.5 rounded-full transition-all duration-500"
            style={{
              backgroundColor: current.id === "ready" ? "rgba(111,207,151,0.6)" : "rgba(255,138,61,0.6)",
              boxShadow: current.id === "ready"
                ? "0 0 20px rgba(111,207,151,0.8)"
                : `0 0 ${12 + current.glowIntensity * 12}px rgba(255,138,61,${0.5 + current.glowIntensity * 0.4})`,
            }}
          />
        </div>
      </div>

      {/* Holographic Workspace Window with Active Topic Content */}
      <div
        className={`relative z-20 w-full rounded-2xl border p-4 shadow-lg backdrop-blur-md transition-all duration-300 ${current.borderColor} ${
          current.id === "ready" ? "bg-emerald-500/10" : current.id === "standby" ? "bg-surface/50" : "bg-ember/10"
        }`}
        style={{
          transform: `translate(${-mouseGaze.x * 0.25}px, ${-mouseGaze.y * 0.25}px)`,
          opacity: isTransitioning ? 0.3 : 1,
        }}
      >
        <div className="flex items-center justify-between border-b border-hairline/60 pb-1.5">
          <span className="font-mono text-[9px] font-bold text-ember uppercase tracking-wider">
            Tahap {current.stepNum} · Ruang Kerja Malesan
          </span>
          <span className="font-mono text-[9px] text-muted">TERSINKRON</span>
        </div>

        <p className="mt-2 font-display text-sm font-bold text-ink">
          {current.headline}
        </p>
        <p className="mt-0.5 text-micro text-muted">
          {current.subtext}
        </p>

        {/* Dynamic Hologram Body per State */}
        <div
          className="mt-2.5 transition-all duration-200"
          style={{
            opacity: isTransitioning ? 0 : 1,
            transform: isTransitioning ? "translateY(5px)" : "translateY(0)",
          }}
        >
          {/* 01: Standby */}
          {current.id === "standby" && (
            <div className="rounded-lg border border-hairline/60 bg-obsidian/70 px-3 py-2 font-mono text-[11px] text-muted flex items-center gap-2">
              <span className="size-1.5 rounded-full bg-muted/40 animate-pulse" />
              <span className="truncate">Topik aktif: &ldquo;{activeTopic.topicName}&rdquo;</span>
            </div>
          )}

          {/* 02: Thinking */}
          {current.id === "thinking" && (
            <div className="space-y-1.5 rounded-lg border border-ember/30 bg-ember/10 p-2.5 font-mono text-[10px] text-ember">
              <div className="flex items-center justify-between">
                <span>› Menganalisis angle viral: {activeTopic.label}</span>
                <span className="size-2 rounded-full bg-ember animate-ping shrink-0" />
              </div>
              <p className="text-muted text-[9px]">
                › Mengunci hook 3 detik & format video vertikal 9:16
              </p>
            </div>
          )}

          {/* 03: Ideas Found */}
          {current.id === "ideas" && (
            <div className="space-y-1 rounded-lg border border-amber-500/30 bg-obsidian/85 p-2 font-mono text-[10px]">
              {activeTopic.angles.map((angle, idx) => (
                <div key={idx} className={`flex items-center gap-1.5 ${idx === 0 ? "text-ember-lo font-semibold" : "text-muted"}`}>
                  <span className={idx === 0 ? "text-ember font-bold" : "text-muted/70"}>{idx + 1}.</span>
                  <span className="truncate">{angle}</span>
                </div>
              ))}
            </div>
          )}

          {/* 04: Script Breakdown */}
          {current.id === "script" && (
            <div className="rounded-lg border border-ember/40 bg-obsidian/90 p-2 font-mono text-[10px] space-y-1">
              <div className="flex items-center justify-between text-ember font-bold text-[9px] border-b border-hairline/40 pb-1">
                <span>ALUR VIDEO 45 DETIK</span>
                <span>SIAP SYUTING</span>
              </div>
              <div className="space-y-0.5 text-[9px] leading-tight pt-0.5">
                <p className="text-ink/95 truncate">
                  <strong className="text-ember">00:00 HOOK:</strong> &ldquo;{activeTopic.scriptHook}&rdquo;
                </p>
                <p className="text-muted truncate">
                  <strong className="text-muted/80">00:05 MASALAH:</strong> Langsung to-the-point bongkar kendala utama
                </p>
                <p className="text-muted truncate">
                  <strong className="text-muted/80">00:20 SOLUSI:</strong> 3 langkah taktis praktis tanpa teori bertele-tele
                </p>
                <p className="text-ember-lo truncate">
                  <strong className="text-ember">00:40 CTA:</strong> &ldquo;Simpan video ini biar ga lupa pas butuh!&rdquo;
                </p>
              </div>
            </div>
          )}

          {/* 05: Ready / Siap Tayang */}
          {current.id === "ready" && (
            <div className="rounded-lg border border-emerald-500/30 bg-obsidian/90 p-2.5 font-mono text-[10px] space-y-1">
              <div className="flex items-center justify-between text-emerald-400 font-bold text-[9px]">
                <span>✓ KONTEN SELESAI DISIAPKAN</span>
                <span>LANGSUNG TAYANG</span>
              </div>
              <div className="space-y-1 pt-0.5 text-[9px]">
                <p className="text-ink/90 truncate">
                  <strong className="text-emerald-400">TikTok & Reels:</strong> Video 9:16 + Subtitle Sinkron Kata
                </p>
                <p className="text-ember-lo truncate">
                  <strong className="text-ember">Threads & X:</strong> Utas 5 Postingan Ringkas Siap Share
                </p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
