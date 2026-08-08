"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { readErrorBody, readSSE, stripFence } from "@/lib/sse";
import { GenerationProgress } from "./GenerationProgress";
import { RateResult } from "./RateResult";
import { CopyBtn, Pill } from "./ClipEngine";

/**
 * Thread Engine — raw notes in, a thread that survives the timeline out.
 *
 * A thread is not one piece of text with line breaks in it. It is posted post
 * by post, and a reader can meet post four first, so every post gets its own
 * card and its own copy button — that is literally the posting workflow, one
 * paste per box.
 *
 * `alt_hooks` is the part worth building UI for rather than printing. The first
 * post decides whether the rest is ever read, so the alternatives are offered
 * as a swap on the hook itself: pick one and it becomes the hook, including in
 * "salin semua". Showing them as a list at the bottom would have made them
 * trivia; showing them as a switch makes them a decision.
 */

export type ThreadPost = { order?: number; text?: string; role?: string };

export type ThreadOutput = {
  hook_post?: string;
  posts?: ThreadPost[];
  closing_post?: string;
  alt_hooks?: string[];
};

const PLATFORMS = ["x", "threads", "instagram", "tiktok", "youtube"] as const;

export function ThreadEngine({ cost }: { cost: number }) {
  const router = useRouter();
  const [bullets, setBullets] = useState("");
  const [platform, setPlatform] = useState<string>("x");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [out, setOut] = useState<ThreadOutput | null>(null);
  const [genId, setGenId] = useState<string | null>(null);
  const [chars, setChars] = useState(0);
  // -1 is the model's own hook; 0..n index into alt_hooks. Reset on every run so
  // a swap chosen for the last thread does not silently apply to the next one.
  const [altHook, setAltHook] = useState(-1);

  const run = async () => {
    if (!bullets.trim()) {
      setError("Tempel dulu poin-poinnya. Angka mentah juga gak apa-apa.");
      return;
    }
    setBusy(true);
    setError("");
    setOut(null);
    setGenId(null);
    setChars(0);
    setAltHook(-1);

    try {
      const res = await fetch("/api/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          module: "thread",
          input: { bullets },
          platform,
        }),
      });

      if (!res.ok) throw new Error(await readErrorBody(res, "Gagal bikin thread."));

      let acc = "";
      let streamError: string | null = null;

      await readSSE(res, (msg) => {
        if (typeof msg.error === "string") {
          streamError = msg.error;
          return true;
        }
        if (msg.done) {
          const g = msg.generation as { id?: string; output?: ThreadOutput } | undefined;
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

  const alts = out?.alt_hooks ?? [];
  const hook = (altHook >= 0 ? alts[altHook] : out?.hook_post) ?? out?.hook_post ?? "";
  // Body posts keep the model's order when it gave one — a thread read out of
  // sequence is a different thread.
  const posts = (out?.posts ?? [])
    .filter((p) => p?.text)
    .slice()
    .sort((a, b) => (a.order ?? 0) - (b.order ?? 0));

  const everything = [hook, ...posts.map((p) => p.text), out?.closing_post]
    .filter((t): t is string => !!t?.trim())
    .map((t, i) => `${i + 1}/ ${t}`)
    .join("\n\n");

  return (
    <div className="space-y-4">
      <section className="surface-card rounded-2xl p-5">
        <h2 className="font-display text-xl font-bold tracking-display-sm text-ink">
          Thread Engine
        </h2>
        <p className="mt-2 text-sm leading-relaxed text-muted">
          Buat yang bahas market atau tech. Lempar catatan mentah hari ini, balik
          jadi thread yang kebaca sampai post terakhir.
        </p>

        <div className="mt-4 space-y-3.5">
          <div>
            <label htmlFor="thread-bullets" className="block text-sm font-semibold text-ink">
              Poin-poinnya apa aja?
            </label>
            <p className="mt-0.5 text-micro text-muted">
              Satu baris satu poin. Angkanya jangan dibulatin — biar dipakai apa
              adanya.
            </p>
            <textarea
              id="thread-bullets"
              rows={6}
              value={bullets}
              onChange={(e) => setBullets(e.target.value)}
              disabled={busy}
              placeholder={"IHSG turun 1,2% ke 7.180\nAsing net sell Rp 840 M\nSektor bank paling dalem, BBRI -2,1%\nRupiah 16.240 per USD"}
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
          {busy ? "Lagi nyusun threadnya..." : `Bikin thread · ${cost} kredit`}
        </button>
      </section>

      {busy && (
        <GenerationProgress moduleKey="thread" chars={chars} label="Lagi nyusun threadnya" />
      )}

      {out && (
        <div className="space-y-3">
          {everything && (
            <div className="flex items-center justify-between rounded-xl border border-hairline bg-obsidian px-4 py-2.5">
              <p className="eyebrow text-muted">
                Thread · {posts.length + (out.closing_post ? 1 : 0) + (hook ? 1 : 0)} post
              </p>
              <CopyBtn text={everything} label="Salin semua" inline />
            </div>
          )}

          {hook && (
            <section className="surface-card rounded-2xl border border-ember/30 p-4">
              <div className="flex items-baseline justify-between gap-3">
                <p className="eyebrow text-ember">1 · Hook</p>
                <CopyBtn text={hook} inline />
              </div>
              <p className="mt-2 whitespace-pre-wrap text-sm leading-relaxed text-ink">{hook}</p>

              {alts.length > 0 && (
                <div className="mt-3 border-t border-hairline pt-3">
                  <p className="text-micro text-muted">
                    Kurang nendang? Tuker sama yang ini:
                  </p>
                  <div className="mt-2 space-y-1.5">
                    <AltHook
                      on={altHook === -1}
                      text={out.hook_post ?? ""}
                      label="Versi asli"
                      onClick={() => setAltHook(-1)}
                    />
                    {alts.map((a, i) => (
                      <AltHook
                        key={i}
                        on={altHook === i}
                        text={a}
                        label={`Alternatif ${i + 1}`}
                        onClick={() => setAltHook(i)}
                      />
                    ))}
                  </div>
                </div>
              )}
            </section>
          )}

          {posts.map((p, i) => (
            <section key={i} className="surface-card rounded-2xl p-4">
              <div className="flex items-baseline justify-between gap-3">
                <p className="eyebrow text-muted">
                  {i + 2}
                  {p.role ? ` · ${p.role}` : ""}
                </p>
                <CopyBtn text={p.text ?? ""} inline />
              </div>
              <p className="mt-2 whitespace-pre-wrap text-sm leading-relaxed text-ink/90">
                {p.text}
              </p>
            </section>
          ))}

          {out.closing_post && (
            <section className="surface-card rounded-2xl p-4">
              <div className="flex items-baseline justify-between gap-3">
                <p className="eyebrow text-muted">{posts.length + 2} · Penutup</p>
                <CopyBtn text={out.closing_post} inline />
              </div>
              <p className="mt-2 whitespace-pre-wrap text-sm leading-relaxed text-ink/90">
                {out.closing_post}
              </p>
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

function AltHook({
  on,
  text,
  label,
  onClick,
}: {
  on: boolean;
  text: string;
  label: string;
  onClick: () => void;
}) {
  if (!text.trim()) return null;
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={on}
      className={`block w-full cursor-pointer rounded-lg border px-3 py-2 text-left transition-colors duration-[var(--duration-standard)] ease-heat ${
        on
          ? "border-ember/45 bg-ember/10"
          : "border-hairline bg-obsidian hover:border-ember/30"
      }`}
    >
      <span className={`eyebrow ${on ? "text-ember" : "text-muted"}`}>{label}</span>
      <span className="mt-1 block text-micro leading-relaxed text-ink/80">{text}</span>
    </button>
  );
}
