"use client";

type StreamItem = {
  handle: string;
  activity: string;
  tag: string;
  isQuote?: boolean;
};

const STREAM_ITEMS: StreamItem[] = [
  {
    handle: "@dimasdaily",
    activity: "baru selesai bikin script 45 detik",
    tag: "Script Studio",
  },
  {
    handle: "@ayufashion",
    activity: "nemu 3 angle konten baru",
    tag: "Idea Lab",
  },
  {
    handle: "@rakabikin",
    activity: "“Gue biasanya habis 2 jam cuma mikirin ide. Sekarang tinggal pilih angle.”",
    tag: "Creator Note",
    isQuote: true,
  },
  {
    handle: "@kopisenja",
    activity: "mulai konten pertama hari ini",
    tag: "Creator DNA",
  },
  {
    handle: "@riancreative",
    activity: "auto-CC selesai sinkron kata",
    tag: "Auto CC",
  },
  {
    handle: "@dindastyle",
    activity: "“Opening 3 detik kelar tanpa overthinking.”",
    tag: "Creator Note",
    isQuote: true,
  },
];

export function CreatorActivityTicker() {
  return (
    <section className="relative border-t border-hairline/60 bg-surface/10 py-8 sm:py-10 overflow-hidden select-none">
      <div className="mx-auto w-full max-w-5xl px-5 sm:px-8 mb-4 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="size-2 rounded-full bg-emerald-500 animate-pulse" />
          <span className="font-mono text-micro font-bold tracking-wider text-muted uppercase">
            CREATOR YANG LAGI DITEMENIN MALESAN
          </span>
        </div>
        <span className="hidden sm:inline font-mono text-[10px] text-muted/60">
          Live Activity Stream
        </span>
      </div>

      {/* Infinite Horizontal Marquee Stream */}
      <div className="relative w-full overflow-hidden [mask-image:linear-gradient(to_right,transparent,black_10%,black_90%,transparent)]">
        <div className="flex w-max gap-3.5 animate-[marquee_32s_linear_infinite] hover:[animation-play-state:paused]">
          {[...STREAM_ITEMS, ...STREAM_ITEMS].map((item, idx) => (
            <div
              key={idx}
              className={`flex items-center gap-2.5 rounded-full border px-4 py-2 shadow-xs backdrop-blur-md shrink-0 ${
                item.isQuote
                  ? "border-ember/30 bg-ember/10"
                  : "border-hairline/70 bg-surface/60"
              }`}
            >
              <span className="font-display text-xs font-bold text-ink">
                {item.handle}
              </span>
              <span className={`text-xs ${item.isQuote ? "text-ink/90 font-medium" : "text-muted"}`}>
                {item.activity}
              </span>
              <span className="rounded-full border border-hairline/80 bg-surface-raised px-2 py-0.5 font-mono text-[9px] text-muted font-semibold">
                {item.tag}
              </span>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
