"use client";

type ActivityItem = {
  handle: string;
  action: string;
  tag: string;
  accent: string;
};

const ACTIVITIES: ActivityItem[] = [
  {
    handle: "@dimasdaily",
    action: "baru selesai bikin script 45 detik",
    tag: "Script Studio",
    accent: "bg-ember/15 text-ember border-ember/30",
  },
  {
    handle: "@ayufashion",
    action: "menemukan 3 angle konten baru",
    tag: "Ide Harian",
    accent: "bg-amber-500/15 text-amber-400 border-amber-500/30",
  },
  {
    handle: "@kopisenja",
    action: "mulai konten pertama hari ini",
    tag: "Creator DNA",
    accent: "bg-emerald-500/15 text-emerald-400 border-emerald-500/30",
  },
  {
    handle: "@riancreative",
    action: "bakar subtitle auto-cc TikTok",
    tag: "Auto-CC",
    accent: "bg-ember/15 text-ember border-ember/30",
  },
  {
    handle: "@bintang.tech",
    action: "dapet hook skor 9.4/10",
    tag: "Hook Lab",
    accent: "bg-amber-500/15 text-amber-400 border-amber-500/30",
  },
  {
    handle: "@claracooks",
    action: "naskah reels 30s siap syuting",
    tag: "Script Studio",
    accent: "bg-emerald-500/15 text-emerald-400 border-emerald-500/30",
  },
];

export function CreatorActivityTicker() {
  return (
    <section className="relative border-t border-hairline/60 bg-surface/10 py-8 sm:py-10 overflow-hidden select-none">
      <div className="mx-auto w-full max-w-5xl px-5 sm:px-8 mb-4 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="size-2 rounded-full bg-emerald-500 animate-pulse" />
          <span className="font-mono text-micro font-bold tracking-wider text-muted uppercase">
            Creator yang lagi ditemenin Malesan
          </span>
        </div>
        <span className="hidden sm:inline font-mono text-[10px] text-muted/60">
          Live Creator Activity
        </span>
      </div>

      {/* Infinite Horizontal Marquee Ticker */}
      <div className="relative w-full overflow-hidden [mask-image:linear-gradient(to_right,transparent,black_10%,black_90%,transparent)]">
        <div className="flex w-max gap-3.5 animate-[marquee_30s_linear_infinite] hover:[animation-play-state:paused]">
          {/* Double items array for seamless infinite loop */}
          {[...ACTIVITIES, ...ACTIVITIES].map((item, idx) => (
            <div
              key={idx}
              className="flex items-center gap-2.5 rounded-full border border-hairline/70 bg-surface/60 px-4 py-2 shadow-xs backdrop-blur-md shrink-0"
            >
              <span className="font-display text-xs font-bold text-ink">
                {item.handle}
              </span>
              <span className="text-xs text-muted">
                {item.action}
              </span>
              <span className={`rounded-full border px-2 py-0.5 font-mono text-[9px] font-semibold ${item.accent}`}>
                {item.tag}
              </span>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
