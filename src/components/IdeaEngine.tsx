"use client";

import { useState } from "react";
import { IdeaCard, type IdeaData } from "./IdeaCard";
import { useRouter } from "next/navigation";

export function IdeaEngine() {
  const [input, setInput] = useState("");
  const [ideas, setIdeas] = useState<IdeaData[]>([]);
  const [generationId, setGenerationId] = useState<string | undefined>();
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState("");
  const router = useRouter();

  async function generate(e: React.FormEvent) {
    e.preventDefault();
    if (!input.trim()) return;

    setIsGenerating(true);
    setError("");
    setIdeas([]);
    setGenerationId(undefined);

    try {
      const res = await fetch("/api/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ module: "idea", input }),
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
              const cleaned = data.chunk.replace(/^```json\\n?/, "").replace(/\\n?```$/, "");
              try {
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
