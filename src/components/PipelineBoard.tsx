"use client";

import { useState, useRef, useEffect } from "react";
import { motion, PanInfo } from "framer-motion";
import type { PipelineCard } from "@/lib/supabase/database.types";
import { updateCardStatus, ratePerformance, updateCardContentAndStatus } from "@/app/actions/pipeline";
import { IdeaData } from "./IdeaCard";
import { useRouter } from "next/navigation";
import { readErrorBody, readSSE } from "@/lib/sse";

type Column = "ide" | "draft" | "siap" | "posted";
const COLUMNS: { id: Column; label: string }[] = [
  { id: "ide", label: "Ide" },
  { id: "draft", label: "Draft" },
  { id: "siap", label: "Siap" },
  { id: "posted", label: "Posted" },
];

export function PipelineBoard({ initialCards }: { initialCards: PipelineCard[] }) {
  const [prevInitialCards, setPrevInitialCards] = useState<PipelineCard[]>(initialCards);
  const [cards, setCards] = useState<PipelineCard[]>(initialCards);
  
  if (initialCards !== prevInitialCards) {
    setPrevInitialCards(initialCards);
    setCards(initialCards);
  }
  const colRefs = useRef<{ [key in Column]: HTMLDivElement | null }>({
    ide: null,
    draft: null,
    siap: null,
    posted: null,
  });


  const handleDragEnd = async (cardId: string, currentStatus: Column, info: PanInfo) => {
    const { point } = info;
    
    // Find which column we dropped into
    let targetColumn: Column | null = null;
    
    for (const col of COLUMNS) {
      const el = colRefs.current[col.id];
      if (el) {
        const rect = el.getBoundingClientRect();
        // Check if pointer is within column bounds
        if (
          point.x >= rect.left &&
          point.x <= rect.right &&
          point.y >= rect.top &&
          point.y <= rect.bottom
        ) {
          targetColumn = col.id;
          break;
        }
      }
    }

    if (targetColumn && targetColumn !== currentStatus) {
      // Optimistic update
      setCards((prev) =>
        prev.map((c) => (c.id === cardId ? { ...c, status: targetColumn as Column } : c))
      );

      try {
        await updateCardStatus(cardId, targetColumn);
      } catch (err) {
        // Revert on error
        setCards(initialCards);
      }
    }
  };

  return (
    <div className="flex w-full gap-4 overflow-x-auto pb-4">
      {COLUMNS.map((col) => (
        <div
          key={col.id}
          ref={(el) => {
            colRefs.current[col.id] = el;
          }}
          className="flex h-[70vh] min-w-[280px] flex-col rounded-xl border border-hairline bg-surface/50 p-4"
        >
          <div className="mb-4 flex items-center justify-between">
            <h3 className="font-display font-semibold text-ink">{col.label}</h3>
            <span className="flex h-5 w-5 items-center justify-center rounded-full bg-surface-raised text-[10px] text-muted">
              {cards.filter((c) => c.status === col.id).length}
            </span>
          </div>

          <div className="flex flex-col gap-3 flex-1 overflow-y-auto">
            {cards
              .filter((c) => c.status === col.id)
              .map((card) => (
                <PipelineCardItem
                  key={card.id}
                  card={card}
                  onDragEnd={(info) => handleDragEnd(card.id, col.id, info)}
                />
              ))}
          </div>
        </div>
      ))}
    </div>
  );
}

function PipelineCardItem({
  card,
  onDragEnd,
}: {
  card: PipelineCard;
  onDragEnd: (info: PanInfo) => void;
}) {
  const content = card.content as unknown as IdeaData & { generated_hook?: any, generated_script?: any };
  const [ratingHover, setRatingHover] = useState(0);
  const [isSubmittingRating, setIsSubmittingRating] = useState(false);
  const [rated, setRated] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState("");
  const router = useRouter();

  const handleGenerate = async (module: "hook" | "script") => {
    setIsGenerating(true);
    setError("");

    try {
      const payload = {
        module,
        input: {
          idea: content.title + "\n" + (content.angle || ""),
          ...(module === "script" ? { hook: content.hook_seed || "", duration: content.est_duration || "60s" } : {}),
        },
        platform: "tiktok",
      };

      const res = await fetch("/api/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        throw new Error(await readErrorBody(res, "Gagal generate."));
      }

      let finalResult: unknown = null;
      let streamError: string | null = null;

      await readSSE(res, (msg) => {
        if (typeof msg.error === "string") {
          streamError = msg.error;
          return true;
        }
        if (msg.done) {
          const gen = msg.generation as { output?: unknown } | undefined;
          finalResult = gen?.output ?? null;
          return true;
        }
      });

      if (streamError) throw new Error(streamError);

      if (finalResult) {
        const newContent = {
          ...content,
          ...(module === "hook" ? { generated_hook: finalResult } : { generated_script: finalResult }),
        };
        const newStatus = module === "hook" ? "draft" : "siap";
        await updateCardContentAndStatus(card.id, newContent, newStatus);
        router.refresh();
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Error");
    } finally {
      setIsGenerating(false);
    }
  };

  const handleRate = async (score: number) => {
    setIsSubmittingRating(true);
    try {
      await ratePerformance(card.id, score);
      setRated(true);
    } catch (err) {
      console.error(err);
    }
    setIsSubmittingRating(false);
  };

  return (
    <motion.div
      layoutId={card.id}
      drag
      dragSnapToOrigin
      onDragEnd={(_, info) => onDragEnd(info)}
      whileDrag={{ scale: 1.05, zIndex: 10, cursor: "grabbing" }}
      className="cursor-grab rounded-lg border border-hairline bg-surface-raised p-4 transition-colors hover:border-ember/30"
    >
      <h4 className="font-display text-sm font-bold text-ink">{card.title}</h4>
      {content?.format && (
        <span className="mt-2 inline-block rounded bg-obsidian px-2 py-1 font-mono text-[9px] uppercase tracking-wider text-muted">
          {content.format}
        </span>
      )}

      {/* Show generation errors */}
      {error && (
        <p className="mt-2 text-[10px] text-danger">{error}</p>
      )}

      {/* Show Hook/Script generator buttons */}
      {card.status === "ide" && (
        <div className="mt-4 border-t border-hairline pt-3">
          <button
            onClick={() => handleGenerate("hook")}
            disabled={isGenerating}
            className={`w-full rounded bg-surface px-3 py-2 text-xs font-bold transition-colors ${
              isGenerating ? "glow-ember text-ember" : "text-muted hover:text-ink hover:bg-surface-raised"
            }`}
          >
            {isGenerating ? "Lagi mikirin hook..." : "Bikin Hook (2 credits)"}
          </button>
        </div>
      )}

      {card.status === "draft" && (
        <div className="mt-4 border-t border-hairline pt-3">
          <button
            onClick={() => handleGenerate("script")}
            disabled={isGenerating}
            className={`w-full rounded bg-surface px-3 py-2 text-xs font-bold transition-colors ${
              isGenerating ? "glow-ember text-ember" : "text-muted hover:text-ink hover:bg-surface-raised"
            }`}
          >
            {isGenerating ? "Lagi nulis script..." : "Bikin Script (4 credits)"}
          </button>
        </div>
      )}

      {/* Show generated hook preview if available */}
      {content.generated_hook && card.status === "draft" && (
        <div className="mt-4 rounded-lg bg-obsidian p-3 border border-hairline max-h-24 overflow-y-auto">
          <p className="text-[10px] text-ember uppercase tracking-widest mb-1 font-mono">Hook 1</p>
          <p className="text-xs text-ink/80 leading-relaxed">
            {((content.generated_hook as { hooks?: { script_segment?: string }[] }).hooks?.[0]?.script_segment) || "Hook generated."}
          </p>
        </div>
      )}

      {/* Show rating UI only if posted and has a generation_id and hasn't just been rated */}
      {card.status === "posted" && card.generation_id && !rated && (
        <div className="mt-4 border-t border-hairline pt-3">
          <p className="text-[10px] text-muted mb-2">Rating performa konten ini:</p>
          <div className="flex gap-1" onMouseLeave={() => setRatingHover(0)}>
            {[1, 2, 3, 4, 5].map((star) => (
              <button
                key={star}
                disabled={isSubmittingRating}
                onMouseEnter={() => setRatingHover(star)}
                onClick={() => handleRate(star)}
                className={`text-lg transition-colors ${
                  star <= ratingHover ? "text-ember" : "text-muted/30"
                }`}
              >
                ★
              </button>
            ))}
          </div>
        </div>
      )}
    </motion.div>
  );
}
