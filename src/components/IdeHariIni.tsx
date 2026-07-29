"use client";

import { useState } from "react";
import { IdeaCard, type IdeaData } from "./IdeaCard";
import { useRouter } from "next/navigation";

export function IdeHariIni() {
  const [ideas, setIdeas] = useState<IdeaData[]>([]);
  const [generationId, setGenerationId] = useState<string | undefined>();
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState("");
  const router = useRouter();

  async function generate() {
    setIsGenerating(true);
    setError("");
    setIdeas([]);
    setGenerationId(undefined);

    try {
      const res = await fetch("/api/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ module: "ide_hari_ini" }),
      });

      if (!res.ok) {
        let msg = "Generation failed";
        try {
          const errData = await res.json();
          msg = errData.error || msg;
        } catch {
          msg = await res.text();
        }
        throw new Error(msg);
      }

      const reader = res.body?.getReader();
      if (!reader) throw new Error("No stream");

      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        
        const chunks = buffer.split("\\n\\n");
        buffer = chunks.pop() || "";

        for (const chunk of chunks) {
          if (!chunk.startsWith("data: ")) continue;
          const dataStr = chunk.slice(6);
          try {
            const data = JSON.parse(dataStr);
            if (data.error) throw new Error(data.error);
            if (data.done) {
              // Generation complete, refresh to update credit balance
              if (data.generation?.output?.ideas) {
                setIdeas(data.generation.output.ideas);
              }
              if (data.generation?.id) {
                setGenerationId(data.generation.id);
              }
              router.refresh();
              break;
            }
            if (data.chunk) {
              // Append to full parsed JSON so far
              // But we rely on the final complete JSON for the ideas.
              // If we want token-by-token parsing, we'd need a dirty JSON parser.
              // For simplicity in Phase 1, we parse the accumulated string when complete,
              // or do basic regex extraction.
              
              // With Gemini structured JSON, doing real-time streaming parsing of arrays is tricky.
              // We'll update the raw JSON text if needed, but here we'll just wait for the complete
              // JSON to be valid, or use a partial json parser.
              
              // Let's implement a naive dirty parser just for the streaming effect.
              // To keep it robust, we'll try parsing the accumulated string.
              const cleaned = data.chunk.replace(/^```json\\n?/, "").replace(/\\n?```$/, "");
              try {
                // If it happens to be valid JSON mid-way, update ideas
                const partial = JSON.parse(cleaned);
                if (partial.ideas) {
                  setIdeas(partial.ideas);
                }
              } catch {
                // Ignore partial JSON errors
              }
            }
          } catch (err: unknown) {
            // Ignore parse errors on chunks
          }
        }
      }
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

      {(ideas.length > 0 || isGenerating) && (
        <div className="space-y-4">
          <h3 className="font-mono text-[11px] uppercase tracking-[0.14em] text-muted ml-1">
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
