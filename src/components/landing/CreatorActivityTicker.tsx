"use client";

type StreamItem = {
  handle: string;
  name: string;
  avatarBg: string;
  activity: string;
  timeAgo: string;
  tag: string;
};

const STREAM_ITEMS: StreamItem[] = [
  {
    handle: "@dimasdaily",
    name: "Dimas",
    avatarBg: "bg-ember text-obsidian",
    activity: 'lagi nyusun script: "3 kesalahan fatal servis motor"',
    timeAgo: "baru saja",
    tag: "Script Studio",
  },
  {
    handle: "@ayufashion",
    name: "Ayu",
    avatarBg: "bg-amber-600 text-white",
    activity: 'nemu angle viral: "Trend fashion vintage lokal"',
    timeAgo: "2 mnt lalu",
    tag: "Idea Engine",
  },
  {
    handle: "@kopisenja",
    name: "Seno",
    avatarBg: "bg-surface-raised text-ember border border-ember/30",
    activity: "subtitle video 9:16 sinkron otomatis",
    timeAgo: "4 mnt lalu",
    tag: "Video Auto-CC",
  },
  {
    handle: "@riancreative",
    name: "Rian",
    avatarBg: "bg-ember-lo text-ink",
    activity: 'riset hook 3 detik: "Trik dapet klien remote USD"',
    timeAgo: "6 mnt lalu",
    tag: "Hook Lab",
  },
  {
    handle: "@dindastyle",
    name: "Dinda",
    avatarBg: "bg-amber-500 text-obsidian",
    activity: "rancang kalender tayang 7 hari",
    timeAgo: "8 mnt lalu",
    tag: "Kalender 7 Hari",
  },
  {
    handle: "@bayustudio",
    name: "Bayu",
    avatarBg: "bg-surface text-ink border border-white/10",
    activity: "ekspor naskah teleprompter 45 detik",
    timeAgo: "11 mnt lalu",
    tag: "Script Studio",
  },
];

export function CreatorActivityTicker() {
  return (
    <section className="relative py-7 sm:py-10 overflow-hidden select-none">
      {/* Centered Heading */}
      <div className="mx-auto w-full max-w-5xl px-5 sm:px-8 mb-4 flex items-center justify-center">
        <div className="inline-flex items-center gap-2 rounded-full border border-white/[0.08] bg-surface/50 px-4 py-1.5 backdrop-blur-md shadow-xs">
          <span className="size-2 rounded-full bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.7)]" />
          <span className="font-display text-xs font-semibold text-ink text-center">
            Aktivitas Kreator di Malesan
          </span>
        </div>
      </div>

      {/* Infinite Horizontal Marquee Stream */}
      <div className="relative w-full overflow-hidden [mask-image:linear-gradient(to_right,transparent,black_10%,black_90%,transparent)]">
        <div
          className="animate-ticker-marquee flex w-max gap-3"
          style={{ animation: "marquee 30s linear infinite" }}
        >
          {[...STREAM_ITEMS, ...STREAM_ITEMS].map((item, idx) => (
            <div
              key={idx}
              className="flex items-center gap-2.5 rounded-2xl border border-white/[0.08] bg-surface/75 px-3.5 py-2 shadow-xs backdrop-blur-md shrink-0 transition-colors duration-200 hover:border-ember/40"
            >
              {/* Avatar circle with cohesive brand tone */}
              <div
                className={`size-6 rounded-full ${item.avatarBg} flex items-center justify-center font-display text-[10px] font-bold shadow-xs shrink-0`}
              >
                {item.name.charAt(0)}
              </div>

              <div className="flex items-center gap-2 text-xs">
                <span className="font-display font-bold text-ink">
                  {item.handle}
                </span>
                <span className="text-muted">
                  {item.activity}
                </span>
              </div>

              <div className="flex items-center gap-1.5 ml-1">
                <span className="font-display text-[10px] text-muted/70 font-medium">
                  {item.timeAgo}
                </span>
                <span className="rounded-md border border-white/[0.08] bg-surface-raised px-2 py-0.5 font-display text-[10px] text-ember font-semibold">
                  {item.tag}
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
