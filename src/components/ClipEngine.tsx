"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { readErrorBody, readSSE, stripFence } from "@/lib/sse";
import { GenerationProgress } from "./GenerationProgress";
import { RateResult } from "./RateResult";

/**
 * Clip Engine — a stream moment turned into a shootable short.
 *
 * Not a variant of Script Builder, even though the output rhymes with it. A
 * script is written before anything is filmed; a clip is cut out of footage
 * that already exists, so the useful artefact is not prose — it is a shot list
 * an editor can work down without asking questions.
 *
 * That is why `edit_note` gets its own treated block rather than a third grey
 * line. Everything else on a beat describes what happened; the edit note is the
 * only field that is an instruction, and burying it next to the footage
 * description is how it gets skipped.
 *
 * The run loop is deliberately the same shape as IdeaEngine and ModuleRunner —
 * fetch, `readSSE`, terminal frame wins — because the SSE bugs this app has
 * already paid for all live in that block, and a second dialect of it is a
 * second place for them to come back.
 */

export type ClipBeat = {
  timestamp?: string;
  spoken?: string;
  visual?: string;
  on_screen_text?: string;
  edit_note?: string;
};

export type ClipOutput = {
  title?: string;
  hook_line?: string;
  hook_visual?: string;
  beats?: ClipBeat[];
  caption?: string;
  hashtags?: string[];
  thumbnail_idea?: string;
};

const PLATFORMS = ["tiktok", "instagram", "youtube", "x", "threads"] as const;
const DURATIONS = ["15 detik", "30 detik", "45 detik", "60 detik"] as const;

/** Hashtags come back bare, but nobody pastes them bare. */
function hashtagLine(tags: string[]) {
  return tags
    .map((t) => (t.startsWith("#") ? t : `#${t.replace(/\s+/g, "")}`))
    .join(" ");
}

function buildPlainText(c: ClipOutput) {
  const out: string[] = [];
  if (c.title) out.push(c.title, "");
  if (c.hook_line) out.push(`HOOK: ${c.hook_line}`);
  if (c.hook_visual) out.push(`VISUAL: ${c.hook_visual}`);
  out.push("");
  (c.beats ?? []).forEach((b, i) => {
    out.push(`${i + 1}. ${b.timestamp ?? ""}`.trim());
    if (b.spoken) out.push(`   Diucapkan: ${b.spoken}`);
    if (b.on_screen_text) out.push(`   Teks layar: ${b.on_screen_text}`);
    if (b.visual) out.push(`   Gambar: ${b.visual}`);
    if (b.edit_note) out.push(`   Edit: ${b.edit_note}`);
    out.push("");
  });
  if (c.caption) out.push("CAPTION", c.caption, "");
  if (c.hashtags?.length) out.push(hashtagLine(c.hashtags), "");
  if (c.thumbnail_idea) out.push(`THUMBNAIL: ${c.thumbnail_idea}`);
  return out.join("\n").trim();
}

export function ClipEngine({ cost }: { cost: number }) {
  const router = useRouter();
  const [moment, setMoment] = useState("");
  const [platform, setPlatform] = useState<string>("tiktok");
  const [duration, setDuration] = useState<string>("30 detik");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [out, setOut] = useState<ClipOutput | null>(null);
  const [genId, setGenId] = useState<string | null>(null);
  const [chars, setChars] = useState(0);
  const [status, setStatus] = useState("");

  const run = async () => {
    if (!moment.trim()) {
      setError("Ceritain dulu momennya, baru gue bisa potongin.");
      return;
    }
    setBusy(true);
    setError("");
    setOut(null);
    setGenId(null);
    setChars(0);
    setStatus("Lagi siapin bahan lo...");

    try {
      const res = await fetch("/api/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          module: "clip",
          input: { moment, duration },
          platform,
        }),
      });

      if (!res.ok) throw new Error(await readErrorBody(res, "Gagal bikin klip."));

      let acc = "";
      let streamError: string | null = null;

      await readSSE(res, (msg) => {
        if (typeof msg.error === "string") {
          streamError = msg.error;
          return true;
        }
        if (typeof msg.status === "string") setStatus(msg.status);
        if (msg.done) {
          const g = msg.generation as { id?: string; output?: ClipOutput } | undefined;
          setOut(g?.output ?? null);
          setGenId(typeof g?.id === "string" ? g.id : null);
          router.refresh();
          return true;
        }
        if (typeof msg.chunk === "string") {
          acc += msg.chunk;
          setChars(acc.length);
          try {
            setOut(JSON.parse(stripFence(acc.trim())));
          } catch {
            /* JSON not closed yet */
          }
        }
      });

      if (streamError) throw new Error(streamError);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Ada yang error.");
    } finally {
      setBusy(false);
    }
  };

  const beats = out?.beats ?? [];

  return (
    <div className="space-y-4">
      <section className="surface-card rounded-2xl p-5">
        <h2 className="font-display text-xl font-bold tracking-display-sm text-ink">
          Potong Momen Live
        </h2>
        <p className="mt-2 text-sm leading-relaxed text-muted">
          Buat streamer. Ceritain momen yang kejadian pas live, balik jadi shot
          list siap potong — lengkap sama catatan editnya.
        </p>

        <div className="mt-4 space-y-3.5">
          <div>
            <label htmlFor="clip-moment" className="block text-sm font-semibold text-ink">
              Momennya gimana?
            </label>
            <p className="mt-0.5 text-micro text-muted">
              Tulis apa adanya. Gak usah rapi — gue yang cari beat-nya.
            </p>
            <textarea
              id="clip-moment"
              rows={4}
              value={moment}
              onChange={(e) => setMoment(e.target.value)}
              disabled={busy}
              placeholder="Lagi clutch 1v4, tinggal 20 HP, terus mati gara-gara kena granat sendiri. Chat langsung rusuh."
              className="skeu-inset mt-2 w-full resize-none rounded-xl border border-hairline bg-obsidian p-3.5 text-sm text-ink placeholder:text-muted focus:border-ember focus:outline-none focus:ring-1 focus:ring-ember disabled:opacity-50"
            />
          </div>

          <div>
            <span className="block text-sm font-semibold text-ink">Platform</span>
            <div className="mt-2 flex flex-wrap gap-2">
              {PLATFORMS.map((p) => (
                <Pill key={p} on={platform === p} onClick={() => setPlatform(p)} capitalize>
                  {p}
                </Pill>
              ))}
            </div>
          </div>

          <div>
            <span className="block text-sm font-semibold text-ink">Durasi</span>
            <div className="mt-2 flex flex-wrap gap-2">
              {DURATIONS.map((d) => (
                <Pill key={d} on={duration === d} onClick={() => setDuration(d)}>
                  {d}
                </Pill>
              ))}
            </div>
          </div>
        </div>

        {error && (
          <p className="mt-4 rounded-lg border border-danger/20 bg-danger/10 px-4 py-3 text-sm text-danger">
            {error}
          </p>
        )}

        <button
          onClick={run}
          disabled={busy}
          className={`mt-5 w-full cursor-pointer rounded-xl bg-ember px-5 py-3.5 font-display text-sm font-bold text-obsidian transition-all duration-[var(--duration-standard)] ease-heat hover:bg-ember-lo disabled:cursor-not-allowed disabled:opacity-50 ${
            busy ? "glow-ember" : ""
          }`}
        >
          {busy ? "Lagi motong klipnya..." : `Bikin klip · ${cost} kredit`}
        </button>
      </section>

      {busy && (
        <GenerationProgress moduleKey="clip" chars={chars} label="Lagi motong klipnya" status={status} />
      )}

      {out && (
        <div className="space-y-3">
          <section className="surface-card rounded-2xl p-4">
            <p className="eyebrow text-muted">Judul klip</p>
            <h3 className="mt-1 font-display text-lg font-bold leading-snug tracking-display-sm text-ink">
              {out.title || "—"}
            </h3>

            {(out.hook_line || out.hook_visual) && (
              <div className="mt-3 rounded-xl border border-hairline bg-obsidian p-3">
                <p className="eyebrow text-ember">Dua detik pertama</p>
                {out.hook_line && (
                  <p className="mt-1.5 text-sm leading-relaxed text-ink">{out.hook_line}</p>
                )}
                {out.hook_visual && (
                  <p className="mt-1.5 text-micro leading-relaxed text-muted">
                    Yang keliatan: {out.hook_visual}
                  </p>
                )}
              </div>
            )}
          </section>

          {beats.length > 0 && (
            <section className="rounded-2xl border border-hairline bg-obsidian">
              <div className="flex items-center justify-between border-b border-hairline px-4 py-2.5">
                <p className="eyebrow text-muted">Shot list · {beats.length} beat</p>
                <CopyBtn text={buildPlainText(out)} label="Salin semua" inline />
              </div>

              <ol className="space-y-2.5 p-3">
                {beats.map((b, i) => (
                  <li key={i} className="rounded-xl border border-hairline bg-surface p-3">
                    <p className="eyebrow text-ember">
                      {i + 1}. {b.timestamp || "—"}
                    </p>

                    {b.spoken && (
                      <p className="mt-1.5 text-mini leading-relaxed text-ink/90">{b.spoken}</p>
                    )}

                    {b.on_screen_text && (
                      <p className="mt-2 rounded bg-obsidian px-2 py-1 text-micro leading-relaxed text-ink/70">
                        Teks layar: {b.on_screen_text}
                      </p>
                    )}

                    {b.visual && (
                      <p className="mt-1.5 text-micro leading-relaxed text-muted">
                        Gambar: {b.visual}
                      </p>
                    )}

                    {/* The only line here that is an instruction rather than a
                        description — an editor works down these and ignores the
                        rest, so it gets the weight. */}
                    {b.edit_note && (
                      <p className="mt-2 rounded-lg border border-ember/30 bg-ember/10 px-2.5 py-1.5 text-micro leading-relaxed text-ember-lo">
                        <span className="font-bold">Edit:</span> {b.edit_note}
                      </p>
                    )}
                  </li>
                ))}
              </ol>
            </section>
          )}

          {out.caption && (
            <section className="surface-card rounded-2xl p-4">
              <p className="eyebrow text-muted">Caption</p>
              <p className="mt-1.5 whitespace-pre-wrap text-sm leading-relaxed text-ink/90">
                {out.caption}
              </p>
              <CopyBtn text={out.caption} />
            </section>
          )}

          {!!out.hashtags?.length && (
            <section className="surface-card rounded-2xl p-4">
              <p className="eyebrow text-muted">Hashtag</p>
              <div className="mt-2 flex flex-wrap gap-1.5">
                {out.hashtags.map((t, i) => (
                  <span
                    key={i}
                    className="rounded-full border border-hairline bg-obsidian px-2.5 py-1 text-micro text-ember-lo"
                  >
                    {t.startsWith("#") ? t : `#${t.replace(/\s+/g, "")}`}
                  </span>
                ))}
              </div>
              <CopyBtn text={hashtagLine(out.hashtags)} />
            </section>
          )}

          {out.thumbnail_idea && (
            <section className="surface-card rounded-2xl p-4">
              <p className="eyebrow text-muted">Ide cover</p>
              <p className="mt-1.5 text-sm leading-relaxed text-ink/90">{out.thumbnail_idea}</p>
            </section>
          )}

          {!busy && (
            <div className="surface-card rounded-xl p-4">
              <RateResult generationId={genId} />
            </div>
          )}
        </div>
      )}
    </div>
  );
}

/**
 * Exported so ThreadEngine uses the same two controls rather than growing its
 * own near-identical pair. They belong in a shared file the day a third engine
 * needs them; two callers is not yet a component library.
 */
export function Pill({
  on,
  onClick,
  capitalize = false,
  children,
}: {
  on: boolean;
  onClick: () => void;
  capitalize?: boolean;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={on}
      className={`cursor-pointer rounded-full border px-3.5 py-2 min-h-11 sm:min-h-8 inline-flex items-center justify-center text-xs font-semibold transition-colors duration-[var(--duration-standard)] ease-heat ${
        capitalize ? "capitalize" : ""
      } ${on ? "border-ember/45 bg-ember/10 text-ember" : "border-hairline text-muted hover:text-ink"}`}
    >
      {children}
    </button>
  );
}

export function CopyBtn({
  text,
  label = "Salin",
  inline = false,
}: {
  text: string;
  label?: string;
  inline?: boolean;
}) {
  const [done, setDone] = useState(false);
  return (
    <button
      type="button"
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(text);
          setDone(true);
          setTimeout(() => setDone(false), 1500);
        } catch {
          setDone(false);
        }
      }}
      className={`cursor-pointer text-micro font-semibold text-muted underline-offset-2 hover:text-ember hover:underline ${
        inline ? "min-h-11 sm:min-h-auto inline-flex items-center" : "mt-3 min-h-11 sm:min-h-auto inline-flex items-center"
      }`}
    >
      {done ? "Kesalin!" : label}
    </button>
  );
}
