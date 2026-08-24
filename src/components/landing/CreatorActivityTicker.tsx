"use client";

type StreamItem = {
  handle: string;
  name: string;
  avatarColor: string;
  activity: string;
  timeAgo: string;
  tag: string;
};

const STREAM_ITEMS: StreamItem[] = [
  {
    handle: "@dimasdaily",
    name: "Dimas",
    avatarColor: "from-amber-500 to-orange-600",
    activity: 'lagi nyusun script: "3 kesalahan fatal servis motor"',
    timeAgo: "baru saja",
    tag: "Script Studio",
  },
  {
    handle: "@ayufashion",
    name: "Ayu",
    avatarColor: "from-rose-500 to-pink-600",
    activity: 'nemu angle viral: "Trend fashion vintage lokal"',
    timeAgo: "2 mnt lalu",
    tag: "Idea Engine",
  },
  {
    handle: "@kopisenja",
    name: "Seno",
    avatarColor: "from-blue-500 to-indigo-600",
    activity: "subtitle video 9:16 sinkron otomatis",
    timeAgo: "4 mnt lalu",
    tag: "Video Auto-CC",
  },
  {
    handle: "@riancreative",
    name: "Rian",
    avatarColor: "from-purple-500 to-violet-600",
    activity: 'riset hook 3 detik: "Trik dapet klien remote USD"',
    timeAgo: "6 mnt lalu",
    tag: "Hook Lab",
  },
  {
    handle: "@dindastyle",
    name: "Dinda",
    avatarColor: "from-orange-500 to-amber-600",
    activity: "rancang kalender tayang 7 hari",
    timeAgo: "8 mnt lalu",
    tag: "Kalender 7 Hari",
  },
  {
    handle: "@bayustudio",
    name: "Bayu",
    avatarColor: "from-emerald-500 to-teal-600",
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
        <div className="inline-flex items-center gap-2 rounded-full border border-hairline/60 bg-surface/50 px-3.5 py-1 backdrop-blur-md shadow-xs">
          <span className="size-2 rounded-full bg-emerald-500 animate-pulse shadow-[0_0_8px_rgba(16,185,129,0.8)]" />
          <span className="font-mono text-micro font-bold tracking-wider text-ink uppercase text-center">
            Aktivitas Live Kreator di Malesan
          </span>
        </div>
      </div>

      {/* Infinite Horizontal Marquee Stream */}
      <div className="relative w-full overflow-hidden [mask-image:linear-gradient(to_right,transparent,black_10%,black_90%,transparent)]">
        <div
          className="animate-ticker-marquee flex w-max gap-3"
          style={{ animation: "marquee 28s linear infinite" }}
        >
          {[...STREAM_ITEMS, ...STREAM_ITEMS].map((item, idx) => (
            <div
              key={idx}
              className="flex items-center gap-2.5 rounded-2xl border border-hairline/80 bg-surface/75 px-3.5 py-2 shadow-xs backdrop-blur-md shrink-0 transition-colors duration-200 hover:border-ember/40"
            >
              {/* Avatar circle with initial */}
              <div
                className={`size-6 rounded-full bg-gradient-to-br ${item.avatarColor} flex items-center justify-center font-display text-[10px] font-bold text-white shadow-xs shrink-0`}
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
                <span className="font-mono text-[9px] text-muted/70">
                  {item.timeAgo}
                </span>
                <span className="rounded-md border border-hairline bg-surface-raised px-1.5 py-0.5 font-mono text-[9px] text-ember font-semibold">
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
