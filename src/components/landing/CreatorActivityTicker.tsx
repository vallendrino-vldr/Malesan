"use client";

import { useEffect, useState, useMemo, useSyncExternalStore } from "react";

const emptySubscribe = () => () => {};
const useMounted = () => useSyncExternalStore(emptySubscribe, () => true, () => false);

export type StreamItem = {
  id: string;
  handle: string;
  name: string;
  avatarBg: string;
  activity: string;
  baseMinutes: number;
  tag: string;
  tagBadgeClass: string;
};

const ACTIVITY_POOL: StreamItem[] = [
  {
    id: "ac-1",
    handle: "@kevinclip",
    name: "Kevin",
    avatarBg: "bg-red-500/20 text-red-400 border border-red-500/30",
    activity: 'potong YouTube 1080p: "Podcast Deddy Corbuzier 45 Mnt"',
    baseMinutes: 0,
    tag: "Auto Clip YouTube",
    tagBadgeClass: "text-red-400 border-red-500/30 bg-red-500/10",
  },
  {
    id: "sc-1",
    handle: "@dimasdaily",
    name: "Dimas",
    avatarBg: "bg-ember/25 text-ember border border-ember/35",
    activity: 'lagi nyusun script: "3 kesalahan fatal servis motor"',
    baseMinutes: 1,
    tag: "Script Studio",
    tagBadgeClass: "text-ember border-ember/30 bg-ember/10",
  },
  {
    id: "ac-2",
    handle: "@fajar_visual",
    name: "Fajar",
    avatarBg: "bg-red-600/20 text-red-300 border border-red-600/30",
    activity: 'ekstrak 3 momen viral YouTube: "Wawancara Najwa Shihab"',
    baseMinutes: 2,
    tag: "Auto Clip YouTube",
    tagBadgeClass: "text-red-400 border-red-500/30 bg-red-500/10",
  },
  {
    id: "hl-1",
    handle: "@riancreative",
    name: "Rian",
    avatarBg: "bg-amber-500/20 text-amber-300 border border-amber-500/30",
    activity: 'riset 5 variasi hook 3 detik: "Trik Remote Work USD"',
    baseMinutes: 4,
    tag: "Hook Lab",
    tagBadgeClass: "text-amber-400 border-amber-500/30 bg-amber-500/10",
  },
  {
    id: "cc-1",
    handle: "@kopisenja",
    name: "Seno",
    avatarBg: "bg-emerald-500/20 text-emerald-400 border border-emerald-500/30",
    activity: "subtitle video 9:16 sinkron per kata (Groq Whisper)",
    baseMinutes: 6,
    tag: "Video Auto-CC",
    tagBadgeClass: "text-emerald-400 border-emerald-500/30 bg-emerald-500/10",
  },
  {
    id: "af-1",
    handle: "@gadgetreview.id",
    name: "Gilang",
    avatarBg: "bg-orange-500/20 text-orange-400 border border-orange-500/30",
    activity: 'skrip keranjang kuning TikTok: "TWS 80 Ribuan Bass Nendang"',
    baseMinutes: 8,
    tag: "Affiliate Engine",
    tagBadgeClass: "text-orange-400 border-orange-500/30 bg-orange-500/10",
  },
  {
    id: "ac-3",
    handle: "@techindo.id",
    name: "Indra",
    avatarBg: "bg-red-500/20 text-red-400 border border-red-500/30",
    activity: 're-frame 9:16 Full HD: "Review iPhone 16 Pro Max"',
    baseMinutes: 11,
    tag: "Auto Clip YouTube",
    tagBadgeClass: "text-red-400 border-red-500/30 bg-red-500/10",
  },
  {
    id: "cr-1",
    handle: "@aripreneur",
    name: "Ari",
    avatarBg: "bg-cyan-500/20 text-cyan-400 border border-cyan-500/30",
    activity: 'generate 7 slide carousel IG: "Mentalitas Kaya vs Miskin"',
    baseMinutes: 14,
    tag: "Carousel AI",
    tagBadgeClass: "text-cyan-400 border-cyan-500/30 bg-cyan-500/10",
  },
  {
    id: "sc-2",
    handle: "@clarascript",
    name: "Clara",
    avatarBg: "bg-purple-500/20 text-purple-300 border border-purple-500/30",
    activity: 'alur storytelling 3 scene: "Kisah UMKM Bangkit dari Utang"',
    baseMinutes: 18,
    tag: "Script Studio",
    tagBadgeClass: "text-ember border-ember/30 bg-ember/10",
  },
  {
    id: "hl-2",
    handle: "@nadia.story",
    name: "Nadia",
    avatarBg: "bg-amber-600/20 text-amber-300 border border-amber-600/30",
    activity: 'hook curiosity gap: "Jangan beli skincare ini sebelum nonton"',
    baseMinutes: 22,
    tag: "Hook Lab",
    tagBadgeClass: "text-amber-400 border-amber-500/30 bg-amber-500/10",
  },
  {
    id: "ac-4",
    handle: "@creativestudio",
    name: "Chandra",
    avatarBg: "bg-red-600/20 text-red-400 border border-red-600/30",
    activity: 'potong YouTube ke Shorts 9:16: "Tips Bisnis Hermanto Tanoko"',
    baseMinutes: 27,
    tag: "Auto Clip YouTube",
    tagBadgeClass: "text-red-400 border-red-500/30 bg-red-500/10",
  },
  {
    id: "cc-2",
    handle: "@vlogkuliner",
    name: "Vina",
    avatarBg: "bg-teal-500/20 text-teal-300 border border-teal-500/30",
    activity: 'burn caption animasi word-by-word: "Street Food Malioboro"',
    baseMinutes: 33,
    tag: "Video Auto-CC",
    tagBadgeClass: "text-emerald-400 border-emerald-500/30 bg-emerald-500/10",
  },
  {
    id: "af-2",
    handle: "@ayufashion",
    name: "Ayu",
    avatarBg: "bg-orange-600/20 text-orange-300 border border-orange-600/30",
    activity: 'skrip racun Shopee: "Outfit Ngantor Cewek Kue Murah"',
    baseMinutes: 39,
    tag: "Affiliate Engine",
    tagBadgeClass: "text-orange-400 border-orange-500/30 bg-orange-500/10",
  },
  {
    id: "lb-1",
    handle: "@sarahspeaking",
    name: "Sarah",
    avatarBg: "bg-indigo-500/20 text-indigo-300 border border-indigo-500/30",
    activity: 'roleplay speaking AI native: "Job Interview Remote Tech"',
    baseMinutes: 46,
    tag: "Lancar Inggris",
    tagBadgeClass: "text-indigo-400 border-indigo-500/30 bg-indigo-500/10",
  },
  {
    id: "id-1",
    handle: "@tiara_daily",
    name: "Tiara",
    avatarBg: "bg-yellow-500/20 text-yellow-300 border border-yellow-500/30",
    activity: 'ambil 3 ide segar harian: "Kuliner & Street Food Viral"',
    baseMinutes: 54,
    tag: "Ide Hari Ini",
    tagBadgeClass: "text-yellow-400 border-yellow-500/30 bg-yellow-500/10",
  },
];

function formatTimeAgo(minutes: number): string {
  if (minutes <= 0) return "baru saja";
  if (minutes === 1) return "1 mnt lalu";
  if (minutes < 60) return `${minutes} mnt lalu`;
  const hours = Math.floor(minutes / 60);
  return `${hours} jam lalu`;
}

export function CreatorActivityTicker() {
  const mounted = useMounted();
  const [elapsedMinutes, setElapsedMinutes] = useState(0);

  useEffect(() => {
    const start = Date.now();
    const interval = setInterval(() => {
      setElapsedMinutes(Math.floor((Date.now() - start) / 60000));
    }, 30000);
    return () => clearInterval(interval);
  }, []);

  // Compute time-of-day dynamic shift so order rotates continuously across the day
  const items = useMemo(() => {
    if (!mounted) return ACTIVITY_POOL;
    const now = new Date();
    const shift = (now.getHours() * 3 + Math.floor(now.getMinutes() / 7)) % ACTIVITY_POOL.length;
    return [...ACTIVITY_POOL.slice(shift), ...ACTIVITY_POOL.slice(0, shift)];
  }, [mounted]);

  return (
    <section className="relative py-7 sm:py-10 overflow-hidden select-none">
      {/* Centered Heading Pill with Active Live Pulse */}
      <div className="mx-auto w-full max-w-5xl px-5 sm:px-8 mb-4 sm:mb-5 flex items-center justify-center">
        <div className="inline-flex items-center gap-2.5 rounded-full border border-white/[0.08] bg-surface/60 px-4 py-1.5 backdrop-blur-md shadow-xs">
          <span className="relative flex size-2 shrink-0">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
            <span className="relative inline-flex rounded-full size-2 bg-emerald-500" />
          </span>
          <span className="font-display text-xs font-semibold text-ink text-center">
            Aktivitas Kreator di Malesan
          </span>
          <span className="hidden sm:inline text-muted/40 font-mono">•</span>
          <span className="hidden sm:inline font-mono text-[11px] text-emerald-400/90 font-medium">
            Live Stream
          </span>
        </div>
      </div>

      {/* Infinite Horizontal Marquee Stream */}
      <div className="relative w-full overflow-hidden [mask-image:linear-gradient(to_right,transparent,black_10%,black_90%,transparent)]">
        <div
          className="animate-ticker-marquee flex w-max gap-3 hover:[animation-play-state:paused]"
          style={{ animation: "marquee 45s linear infinite" }}
        >
          {[...items, ...items].map((item, idx) => {
            const currentMins = item.baseMinutes + elapsedMinutes;
            const timeLabel = formatTimeAgo(currentMins);

            return (
              <div
                key={`${item.id}-${idx}`}
                className="flex items-center gap-2.5 rounded-2xl border border-white/[0.08] bg-surface/80 px-3.5 py-2 shadow-xs backdrop-blur-md shrink-0 transition-all duration-200 hover:border-ember/40 hover:bg-surface-raised/90"
              >
                {/* Avatar circle with cohesive distinct colors */}
                <div
                  className={`size-6 rounded-full ${item.avatarBg} flex items-center justify-center font-display text-xs font-bold shadow-xs shrink-0`}
                >
                  {item.name.charAt(0)}
                </div>

                <div className="flex items-center gap-2 text-xs">
                  <span className="font-display font-bold text-ink whitespace-nowrap">
                    {item.handle}
                  </span>
                  <span className="text-muted whitespace-nowrap">
                    {item.activity}
                  </span>
                </div>

                <div className="flex items-center gap-2 ml-1.5 shrink-0">
                  <span className="font-display text-[11px] text-muted/70 font-medium whitespace-nowrap">
                    {timeLabel}
                  </span>
                  <span className={`rounded-md border px-2 py-0.5 font-display text-[11px] font-semibold whitespace-nowrap ${item.tagBadgeClass}`}>
                    {item.tag}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
