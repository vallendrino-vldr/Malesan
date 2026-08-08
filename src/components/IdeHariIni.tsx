"use client";

import { useState } from "react";
import { IdeaCard, type IdeaData } from "./IdeaCard";
import { GenerationProgress } from "./GenerationProgress";
import { useRouter } from "next/navigation";
import { readErrorBody, readSSE, stripFence } from "@/lib/sse";
import { GenerationExtras, useGenerationExtras } from "./ModuleRunner";

export function IdeHariIni() {
  const [ideas, setIdeas] = useState<IdeaData[]>([]);
  // Shared with every other module — same pasted material, same picked voice,
  // so switching from here to Hook Lab does not throw the context away.
  const extras = useGenerationExtras();
  const [generationId, setGenerationId] = useState<string | undefined>();
  const [isGenerating, setIsGenerating] = useState(false);
  // Real characters received, so the progress figure moves because the
  // model is producing text — not because a timer is running.
  const [chars, setChars] = useState(0);
  const [error, setError] = useState("");
  const router = useRouter();

  async function generate() {
    setIsGenerating(true);
    setChars(0);
    setError("");
    setIdeas([]);
    setGenerationId(undefined);

    try {
      const res = await fetch("/api/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        // No `input` key at all when both extras are empty: the route stores
        // whatever it is given on the generation row, and an empty object there
        // is noise where a null used to say "this module takes no input".
        body: JSON.stringify({
          module: "ide_hari_ini",
          ...(extras.extraInput ? { input: extras.extraInput } : {}),
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
      const message = err instanceof Error ? err.message : "An error occurred";
      setError(message);
    } finally {
      setIsGenerating(false);
    }
  }

  return (
    <div className="space-y-6">
      <div className="rounded-2xl border border-hairline bg-surface p-6 sm:p-8">
        <h2 className="font-display text-2xl font-bold tracking-display-md text-ink">
          Ide Hari Ini
        </h2>
        <p className="mt-3 text-sm leading-relaxed text-muted">
          Gak tau mau bikin apa? Klik aja. Malesan bakal ngasih ide yang pas buat hari ini.
        </p>

        <div className="mt-5">
          <GenerationExtras extras={extras} disabled={isGenerating} />
        </div>

        {error && (
          <p className="mt-4 rounded-lg bg-danger/10 px-4 py-3 text-sm text-danger border border-danger/20">
            {error}
          </p>
        )}

        <button
          onClick={generate}
          disabled={isGenerating}
          className={`mt-6 w-full rounded-xl bg-ember px-5 py-3.5 font-display text-sm font-bold text-obsidian transition-all duration-[var(--duration-standard)] ease-heat hover:bg-ember-lo disabled:opacity-50 disabled:cursor-not-allowed ${
            isGenerating ? "glow-ember" : ""
          }`}
        >
          {isGenerating ? "Lagi mikirin buat lo..." : "Males mikir. Kasih ide."}
        </button>
      </div>

      {isGenerating && (
        <GenerationProgress
          moduleKey="ide_hari_ini"
          chars={chars}
          label="Lagi mikirin buat lo"
        />
      )}

      {(ideas.length > 0 || isGenerating) && (
        <div className="space-y-4">
          <h3 className="font-mono text-micro uppercase tracking-[0.14em] text-muted ml-1">
            Hasil
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
