"use client";

import { useState } from "react";
import { IdeaCard, type IdeaData } from "./IdeaCard";
import { GenerationProgress } from "./GenerationProgress";
import { useRouter } from "next/navigation";
import { readErrorBody, readSSE, stripFence } from "@/lib/sse";
import { GenerationExtras, useGenerationExtras } from "./ModuleRunner";

export function IdeaEngine() {
  const [input, setInput] = useState("");
  // Reference material and the picked voice are shared with every other module,
  // so they are defined once next to ModuleRunner rather than copied per screen.
  const extras = useGenerationExtras();
  const [ideas, setIdeas] = useState<IdeaData[]>([]);
  const [generationId, setGenerationId] = useState<string | undefined>();
  const [isGenerating, setIsGenerating] = useState(false);
  // Real characters received, so the progress figure moves because the
  // model is producing text — not because a timer is running.
  const [chars, setChars] = useState(0);
  const [error, setError] = useState("");
  const router = useRouter();

  async function generate(e: React.FormEvent) {
    e.preventDefault();
    if (!input.trim()) return;

    setIsGenerating(true);
    setChars(0);
    setError("");
    setIdeas([]);
    setGenerationId(undefined);

    try {
      const res = await fetch("/api/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        // The route reads `input.text`. Sending a bare string made every call
        // fail validation with a 400 whose body was plain text, which is what
        // the double-read error handler then choked on.
        body: JSON.stringify({
          module: "idea",
          input: { text: input, ...extras.extraInput },
        }),
      });

      if (!res.ok) {
        throw new Error(await readErrorBody(res, "Gagal ngembangin ide."));
      }

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
            /* JSON not closed yet */
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
      <form onSubmit={generate} className="rounded-2xl border border-hairline bg-surface p-6 sm:p-8">
        <h2 className="font-display text-2xl font-bold tracking-display-md text-ink">
          Idea Engine
        </h2>
        <p className="mt-3 text-sm leading-relaxed text-muted">
          Punya ide kasar tapi bingung ngembanginnya? Tulis di sini, gue kembangin jadi 5 ide mateng.
        </p>

        <div className="mt-6">
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            disabled={isGenerating}
            placeholder="Contoh: review mic wireless murah tapi suaranya bagus..."
            className="w-full resize-none rounded-xl border border-hairline bg-obsidian p-4 text-sm text-ink placeholder:text-muted focus:border-ember focus:outline-none focus:ring-1 focus:ring-ember disabled:opacity-50"
            rows={4}
          />
        </div>

        <div className="mt-4">
          <GenerationExtras extras={extras} disabled={isGenerating} />
        </div>

        {error && (
          <p className="mt-4 rounded-lg bg-danger/10 px-4 py-3 text-sm text-danger border border-danger/20">
            {error}
          </p>
        )}

        <div className="mt-6 flex justify-end">
          <button
            type="submit"
            disabled={isGenerating || !input.trim()}
            className={`rounded-xl bg-ember px-6 py-2.5 font-display text-sm font-bold text-obsidian transition-all duration-[var(--duration-standard)] ease-heat hover:bg-ember-lo disabled:opacity-50 disabled:cursor-not-allowed ${
              isGenerating ? "glow-ember" : ""
            }`}
          >
            {isGenerating ? "Lagi ngulik..." : "Kembangin ide"}
          </button>
        </div>
      </form>

      {isGenerating && (

        <GenerationProgress moduleKey="idea" chars={chars} label="Lagi ngembangin idenya" />

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
