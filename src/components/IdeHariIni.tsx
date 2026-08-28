"use client";

import { useEffect, useRef, useState } from "react";
import { IdeaCard, type IdeaData } from "./IdeaCard";
import { GenerationProgress } from "./GenerationProgress";
import { useRouter } from "next/navigation";
import { readErrorBody, readSSE, stripFence } from "@/lib/sse";
import { GenerationExtras, useGenerationExtras } from "./ModuleRunner";
import {
  TODAY_GOALS,
  TODAY_PLATFORMS,
  type TodayGoal,
  type TodayPlatform,
} from "@/lib/content-options";

export function IdeHariIni({ cost = 1 }: { cost?: number }) {
  const [ideas, setIdeas] = useState<IdeaData[]>([]);
  // Shared with every other module — same pasted material, same picked voice,
  // so switching from here to Hook Lab does not throw the context away.
  const extras = useGenerationExtras();
  const [generationId, setGenerationId] = useState<string | undefined>();
  const [isGenerating, setIsGenerating] = useState(false);
  // Real characters received, so the progress figure moves because the
  // model is producing text — not because a timer is running.
  const [chars, setChars] = useState(0);
  const [status, setStatus] = useState("");
  const [error, setError] = useState("");
  const [platform, setPlatform] = useState<TodayPlatform>("tiktok_reels");
  const [goal, setGoal] = useState<TodayGoal>("views");
  const router = useRouter();
  const resultsRef = useRef<HTMLDivElement>(null);
  const errorRef = useRef<HTMLParagraphElement>(null);

  useEffect(() => {
    if (isGenerating || ideas.length === 0) return;
    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    requestAnimationFrame(() => {
      resultsRef.current?.scrollIntoView({
        behavior: reduceMotion ? "auto" : "smooth",
        block: "start",
      });
    });
  }, [ideas.length, isGenerating]);

  useEffect(() => {
    if (!error || isGenerating) return;
    requestAnimationFrame(() => {
      errorRef.current?.scrollIntoView({ behavior: "auto", block: "center" });
      errorRef.current?.focus({ preventScroll: true });
    });
  }, [error, isGenerating]);

  async function generate() {
    setIsGenerating(true);
    setChars(0);
    setStatus("Lagi siapin profil dan pilihan lo...");
    setError("");
    setIdeas([]);
    setGenerationId(undefined);

    try {
      const res = await fetch("/api/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          module: "ide_hari_ini",
          platform,
          input: { platform, goal, ...(extras.extraInput ?? {}) },
        }),
      });

      if (!res.ok) {
        throw new Error(await readErrorBody(res, "Gagal bikin ide."));
      }

      // The model streams one big JSON object, so accumulate and re-parse as it
      // grows. Parsing each chunk in isolation can never succeed.
      let acc = "";
      let streamError: string | null = null;

      await readSSE(res, (msg) => {
        if (typeof msg.error === "string") {
          streamError = msg.error;
          return true;
        }
        if (typeof msg.status === "string") {
          setStatus(msg.status);
        }
        if (msg.done) {
          const gen = msg.generation as
            | { id?: string; output?: { ideas?: IdeaData[] } }
            | undefined;
          if (gen?.output?.ideas) setIdeas(gen.output.ideas);
          if (gen?.id) setGenerationId(gen.id);
          router.refresh();
          return true;
        }
        if (typeof msg.chunk === "string") {
          acc += msg.chunk;
          setChars(acc.length);
          try {
            const partial = JSON.parse(stripFence(acc.trim()));
            if (Array.isArray(partial.ideas)) setIdeas(partial.ideas);
          } catch {
            /* JSON not closed yet — expected on every chunk but the last */
          }
        }
      });

      if (streamError) throw new Error(streamError);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Idenya belum berhasil dibikin. Coba lagi ya.";
      setError(message);
    } finally {
      setIsGenerating(false);
    }
  }

  return (
    <div className="space-y-6">
      <div className="rounded-2xl border border-hairline bg-surface p-5 pb-24 sm:p-8">
        <h2 className="font-display text-2xl font-bold tracking-display-md text-ink">
          Ide Hari Ini
        </h2>
        <p className="mt-3 text-sm leading-relaxed text-muted">
          Pilih mau posting di mana dan lagi ngejar apa. Gak perlu nulis ide —
          bagian mikirnya biar Malesan yang pegang.
        </p>

        <fieldset className="mt-6">
          <legend className="text-sm font-semibold text-ink">Mau posting di mana?</legend>
          <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-3">
            {TODAY_PLATFORMS.map((option) => {
              const active = platform === option.id;
              return (
                <button
                  key={option.id}
                  type="button"
                  aria-pressed={active}
                  disabled={isGenerating}
                  onClick={() => setPlatform(option.id)}
                  className={`min-h-14 rounded-xl border px-3 py-2.5 text-left transition-colors disabled:opacity-50 ${
                    active
                      ? "border-ember/60 bg-ember/10"
                      : "border-hairline bg-obsidian/45 hover:border-ember/30"
                  }`}
                >
                  <span className={`block text-mini font-bold ${active ? "text-ember" : "text-ink"}`}>
                    {option.label}
                  </span>
                  <span className="mt-0.5 block text-micro text-muted">{option.hint}</span>
                </button>
              );
            })}
          </div>
        </fieldset>

        <fieldset className="mt-5">
          <legend className="text-sm font-semibold text-ink">Lagi ngejar apa?</legend>
          <div className="mt-2 flex flex-wrap gap-2">
            {TODAY_GOALS.map((option) => {
              const active = goal === option.id;
              return (
                <button
                  key={option.id}
                  type="button"
                  aria-pressed={active}
                  disabled={isGenerating}
                  onClick={() => setGoal(option.id)}
                  className={`h-8 sm:h-8.5 rounded-lg border px-3 text-xs font-semibold transition-all disabled:opacity-50 shadow-xs ${
                    active
                      ? "border-ember bg-ember/15 text-ember font-bold"
                      : "border-hairline bg-surface/60 text-muted hover:border-ember/30 hover:text-ink"
                  }`}
                >
                  {option.label}
                </button>
              );
            })}
          </div>
        </fieldset>

        <div className="mt-5 border-t border-hairline pt-5">
          <GenerationExtras extras={extras} disabled={isGenerating} />
        </div>

        {error && (
          <p
            ref={errorRef}
            role="alert"
            tabIndex={-1}
            className="mt-4 rounded-lg border border-danger/20 bg-danger/10 px-4 py-3 text-sm text-danger outline-none"
          >
            {error}
          </p>
        )}

        <div
          className={`z-30 ${
            ideas.length === 0
              ? "fixed inset-x-4 bottom-[calc(4.5rem+env(safe-area-inset-bottom))] mx-auto max-w-[46rem] rounded-2xl border border-hairline bg-obsidian p-2 shadow-[0_14px_48px_rgba(0,0,0,0.5)] sm:static sm:mt-6 sm:max-w-none sm:border-0 sm:bg-transparent sm:p-0 sm:shadow-none"
              : "mt-6"
          }`}
        >
          <button
            onClick={generate}
            disabled={isGenerating}
            className={`w-full rounded-xl bg-ember px-5 py-3.5 font-display text-sm font-bold text-obsidian transition-all duration-[var(--duration-standard)] ease-heat hover:bg-ember-lo disabled:cursor-not-allowed disabled:opacity-50 ${
              isGenerating ? "glow-ember" : ""
            }`}
          >
            {isGenerating ? "Lagi mikirin buat lo..." : `Kasih 3 ide · ${cost} kredit`}
          </button>
        </div>
      </div>

      {isGenerating && (
        <GenerationProgress
          moduleKey="ide_hari_ini"
          chars={chars}
          label="Lagi mikirin buat lo"
          status={status}
        />
      )}

      {(ideas.length > 0 || isGenerating) && (
        <div ref={resultsRef} className="scroll-mt-4 space-y-4">
          <h3 className="font-mono text-micro uppercase tracking-[0.14em] text-muted ml-1">
            3 ide buat {TODAY_PLATFORMS.find((option) => option.id === platform)?.label}
          </h3>
          <div className="grid gap-4">
            {ideas.length > 0
              ? ideas.map((idea, i) => (
                  <IdeaCard key={i} idea={idea} isStreaming={isGenerating && i === ideas.length - 1} generationId={generationId} />
                ))
              : isGenerating && (
                  <>
                    <IdeaCard idea={{}} isStreaming={true} />
                  </>
                )}
          </div>
        </div>
      )}
    </div>
  );
}
