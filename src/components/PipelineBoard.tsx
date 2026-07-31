"use client";

import { useState, useRef, useEffect } from "react";
import { motion, PanInfo } from "framer-motion";
import type { PipelineCard } from "@/lib/supabase/database.types";
import {
  updateCardStatus,
  ratePerformance,
  updateCardContentAndStatus,
  deletePipelineCard,
  restorePipelineCard,
} from "@/app/actions/pipeline";
import { IdeaData } from "./IdeaCard";
import { useRouter } from "next/navigation";
import { readErrorBody, readSSE } from "@/lib/sse";
import { ScriptView, type ScriptOutput } from "./ScriptView";

/**
 * Pipeline.
 *
 * The previous version was one layout for every screen: four 280px columns at
 * 70vh inside a horizontally scrolling strip, moved only by dragging. On a
 * phone that is three problems at once — the board scrolls sideways, each
 * column eats the viewport, and `drag` inside `overflow-x-auto` fights the
 * scroll container so the gesture barely lands.
 *
 * It also never said what the board was *for*. A card dragged straight from
 * Ide to Draft skipped hook generation, then offered "Bikin Script" — the next
 * stage's action on a card that never completed this one. That is the reported
 * dead end: the card moved, and nothing explained what had just happened or
 * what to do next.
 *
 * So: one stage at a time on phones with an explicit stage switcher and button
 * moves, the full kanban with drag from `md` up, and every stage — empty or
 * not — states plainly what it holds and what the next action is.
 */

type Column = "ide" | "draft" | "siap" | "posted";

/** Long enough to notice and react to; short enough to still feel like "just now". */
const UNDO_WINDOW_MS = 8000;

/** The server hands cards back newest-first; a restored card has to land back in that order. */
const byNewest = (list: PipelineCard[]) =>
  [...list].sort((a, b) => (a.created_at < b.created_at ? 1 : -1));

const COLUMNS: {
  id: Column;
  label: string;
  blurb: string;
  empty: string;
}[] = [
  {
    id: "ide",
    label: "Ide",
    blurb: "Ide mentah yang belum digarap.",
    empty:
      "Belum ada ide di sini. Generate di tab Studio, terus tap “Simpan ke pipeline” di kartu hasilnya.",
  },
  {
    id: "draft",
    label: "Draft",
    blurb: "Udah punya hook, tinggal dibikinin script.",
    empty: "Kosong. Kartu masuk sini otomatis begitu hook-nya jadi.",
  },
  {
    id: "siap",
    label: "Siap",
    blurb: "Script kelar. Tinggal syuting dan posting.",
    empty: "Kosong. Kartu masuk sini otomatis begitu script-nya jadi.",
  },
  {
    id: "posted",
    label: "Posted",
    blurb: "Udah tayang. Kasih rating biar ide berikutnya makin nyambung.",
    empty: "Belum ada yang tayang. Geser kartu dari Siap kalau udah lo posting.",
  },
];

/**
 * One hook as HOOK_LAB_SCHEMA actually returns it: `text`, not `script_segment`.
 * Reading the wrong field sent an empty hook to Script Builder, which rejected
 * the request with "Idea, hook, and duration inputs are required" — an error
 * about the user's input for a value the user never supplied. The optional
 * aliases are tolerance for older rows written before this was pinned down.
 */
type HookOption = {
  text?: string;
  script_segment?: string;
  hook?: string;
  pattern?: string;
  score?: number;
  why?: string;
};

export function hookText(h: HookOption | undefined): string {
  return (h?.text ?? h?.script_segment ?? h?.hook ?? "").trim();
}

/** What this card is waiting on, in one line. Drives the guidance strip. */
function nextStep(card: PipelineCard, hasHook: boolean): string {
  switch (card.status as Column) {
    case "ide":
      return "Langkah 1 dari 3 — bikin hook dulu.";
    case "draft":
      return hasHook
        ? "Langkah 2 dari 3 — hook udah ada, lanjut bikin script."
        : "Kartu ini lompat tahap, hook-nya belum ada. Bikin hook dulu biar script-nya nyambung.";
    case "siap":
      return "Langkah 3 dari 3 — syuting, posting, terus geser ke Posted.";
    case "posted":
      return "Kasih rating performanya.";
    default:
      return "";
  }
}

export function PipelineBoard({ initialCards }: { initialCards: PipelineCard[] }) {
  const [prevInitialCards, setPrevInitialCards] = useState<PipelineCard[]>(initialCards);
  const [cards, setCards] = useState<PipelineCard[]>(initialCards);
  const [mobileStage, setMobileStage] = useState<Column>("ide");
  const [undoCard, setUndoCard] = useState<PipelineCard | null>(null);
  const [deleteError, setDeleteError] = useState("");

  if (initialCards !== prevInitialCards) {
    setPrevInitialCards(initialCards);
    setCards(initialCards);
  }

  // The undo offer expires on its own. Left up indefinitely it stops reading as
  // "act now" and starts reading as furniture.
  useEffect(() => {
    if (!undoCard) return;
    const t = setTimeout(() => setUndoCard(null), UNDO_WINDOW_MS);
    return () => clearTimeout(t);
  }, [undoCard]);

  const colRefs = useRef<{ [key in Column]: HTMLDivElement | null }>({
    ide: null,
    draft: null,
    siap: null,
    posted: null,
  });

  const countOf = (c: Column) => cards.filter((x) => x.status === c).length;

  const move = async (cardId: string, to: Column) => {
    const snapshot = cards;
    setCards((prev) => prev.map((c) => (c.id === cardId ? { ...c, status: to } : c)));
    try {
      await updateCardStatus(cardId, to);
    } catch {
      setCards(snapshot);
    }
  };

  /**
   * Delete goes through on the first tap, with an undo window afterwards,
   * rather than putting a confirmation in front of it. Confirming every delete
   * trains people to tap "yes" without reading, and it does not help the case
   * that actually matters — the tap you did not mean to make. An undo does.
   */
  const remove = async (card: PipelineCard) => {
    setDeleteError("");
    setCards((prev) => prev.filter((c) => c.id !== card.id));
    try {
      await deletePipelineCard(card.id);
      setUndoCard(card);
    } catch {
      // Put it straight back: the board must never show a card as gone when
      // the database still has it.
      setCards((prev) => byNewest([...prev, card]));
      setDeleteError("Kartunya gagal dihapus. Coba lagi bentar lagi.");
    }
  };

  const undoDelete = async () => {
    const card = undoCard;
    if (!card) return;
    setUndoCard(null);
    setCards((prev) => byNewest([...prev, card]));
    try {
      await restorePipelineCard({
        id: card.id,
        title: card.title,
        content: card.content,
        status: card.status as Column,
        generation_id: card.generation_id ?? null,
        created_at: card.created_at,
      });
    } catch {
      setCards((prev) => prev.filter((c) => c.id !== card.id));
      setDeleteError("Gagal balikin kartunya. Kartu itu udah kehapus permanen.");
    }
  };

  const handleDragEnd = async (cardId: string, currentStatus: Column, info: PanInfo) => {
    const { point } = info;
    let target: Column | null = null;

    for (const col of COLUMNS) {
      const el = colRefs.current[col.id];
      if (!el) continue;
      const r = el.getBoundingClientRect();
      if (point.x >= r.left && point.x <= r.right && point.y >= r.top && point.y <= r.bottom) {
        target = col.id;
        break;
      }
    }

    if (target && target !== currentStatus) await move(cardId, target);
  };

  const total = cards.length;

  return (
    <div className="space-y-4">
      {/* ---------- what this board is (shown once, only while empty) ---------- */}
      {total === 0 && (
        <div className="surface-card rounded-2xl p-5">
          <h2 className="font-display text-lg font-bold text-ink">Pipeline</h2>
          <p className="mt-2 text-sm leading-relaxed text-muted">
            Tempat ide lo jalan dari mentah sampai tayang. Tiap kartu lewat tiga
            langkah: <span className="text-ink">hook</span> →{" "}
            <span className="text-ink">script</span> →{" "}
            <span className="text-ink">posting</span>. Gak usah mikirin urutannya,
            tiap kartu bakal ngomong sendiri langkah berikutnya apa.
          </p>
        </div>
      )}

      {/* ---------- phones: stage switcher, one stage at a time ---------- */}
      <div className="md:hidden">
        <div
          role="tablist"
          aria-label="Tahap pipeline"
          className="flex gap-1 rounded-xl border border-hairline bg-surface/60 p-1"
        >
          {COLUMNS.map((col) => {
            const on = col.id === mobileStage;
            return (
              <button
                key={col.id}
                role="tab"
                aria-selected={on}
                onClick={() => setMobileStage(col.id)}
                className={`flex flex-1 items-center justify-center gap-1.5 rounded-lg py-2 text-xs font-semibold transition-colors duration-[var(--duration-standard)] ease-heat ${
                  on ? "bg-ember/15 text-ember" : "text-muted hover:text-ink"
                }`}
              >
                {col.label}
                <span
                  // `text-muted` measured 3.7:1 here: the badge sits on
                  // surface-raised which itself sits on a surface/60 strip, and
                  // the stack came out lighter than either layer alone.
                  className={`grid size-5 place-items-center rounded-full text-micro leading-none ${
                    on ? "bg-ember/25 text-ink" : "bg-surface-raised text-ink"
                  }`}
                >
                  {countOf(col.id)}
                </span>
              </button>
            );
          })}
        </div>

        {COLUMNS.filter((c) => c.id === mobileStage).map((col) => {
          const list = cards.filter((c) => c.status === col.id);
          return (
            <div key={col.id} className="mt-3 space-y-3">
              <p className="text-xs leading-relaxed text-muted">{col.blurb}</p>
              {list.length === 0 ? (
                <EmptyStage text={col.empty} />
              ) : (
                list.map((card) => (
                  <PipelineCardItem
                    key={card.id}
                    card={card}
                    onMove={move}
                    onDelete={remove}
                    draggable={false}
                  />
                ))
              )}
            </div>
          );
        })}
      </div>

      {/* ---------- md and up: the full board ----------
          `flex-1` with a `min-w` floor, not a fixed width. Fixed 272px columns
          inside a 1152px container meant a 1920px screen showed cramped cards
          *and* empty gutters at the same time — the board could not use the
          room it had. Columns now grow to fill the width (~380px each on a
          desktop) and only fall back to horizontal scrolling when the viewport
          genuinely cannot fit four at the 290px floor. */}
      <div className="hidden gap-3 overflow-x-auto pb-2 md:flex">
        {COLUMNS.map((col) => {
          const list = cards.filter((c) => c.status === col.id);
          return (
            <div
              key={col.id}
              ref={(el) => {
                colRefs.current[col.id] = el;
              }}
              className="flex max-h-[76vh] min-w-[290px] flex-1 flex-col rounded-xl border border-hairline bg-surface/50 p-3.5"
            >
              <div className="mb-1 flex items-center justify-between">
                <h3 className="font-display font-semibold text-ink">{col.label}</h3>
                <span className="grid size-5 place-items-center rounded-full bg-surface-raised text-micro text-ink">
                  {list.length}
                </span>
              </div>
              <p className="mb-3 text-micro leading-snug text-muted">{col.blurb}</p>

              <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto">
                {list.length === 0 ? (
                  <EmptyStage text={col.empty} />
                ) : (
                  list.map((card) => (
                    <PipelineCardItem
                      key={card.id}
                      card={card}
                      onMove={move}
                      onDelete={remove}
                      draggable
                      onDragEnd={(info) => handleDragEnd(card.id, col.id, info)}
                    />
                  ))
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* ---------- undo ----------
          z-40 is the ambient tier in globals.css: above the chrome, below any
          dialog. Sits clear of the bottom tab bar and the home indicator. */}
      {undoCard && (
        <div
          role="status"
          aria-live="polite"
          className="pointer-events-none fixed inset-x-0 bottom-[calc(env(safe-area-inset-bottom)+74px)] z-40 flex justify-center px-4"
        >
          <div className="pointer-events-auto w-full max-w-sm overflow-hidden rounded-xl border border-hairline bg-surface-raised shadow-lg">
            <div className="flex items-center gap-3 px-3.5 py-2.5">
              <p className="min-w-0 flex-1 text-xs leading-snug text-ink">
                <span className="font-semibold">Kartu dihapus.</span>{" "}
                <span className="text-muted">{undoCard.title}</span>
              </p>
              <button
                onClick={undoDelete}
                className="min-h-11 shrink-0 cursor-pointer rounded-lg border border-ember/40 bg-ember/10 px-3.5 font-display text-xs font-bold text-ember"
              >
                Balikin
              </button>
            </div>
            <div className="h-0.5 bg-hairline">
              <div
                className="undo-drain h-full bg-ember"
                style={{ ["--undo-window" as string]: `${UNDO_WINDOW_MS}ms` }}
              />
            </div>
          </div>
        </div>
      )}

      {deleteError && (
        <p
          role="alert"
          className="rounded-lg border border-danger/25 bg-danger/10 px-3 py-2 text-xs leading-relaxed text-danger"
        >
          {deleteError}
        </p>
      )}
    </div>
  );
}

function EmptyStage({ text }: { text: string }) {
  return (
    <div className="rounded-xl border border-dashed border-hairline px-4 py-6 text-center">
      <p className="text-xs leading-relaxed text-muted">{text}</p>
    </div>
  );
}

function PipelineCardItem({
  card,
  onMove,
  onDelete,
  draggable,
  onDragEnd,
}: {
  card: PipelineCard;
  onMove: (cardId: string, to: Column) => void | Promise<void>;
  onDelete: (card: PipelineCard) => void | Promise<void>;
  draggable: boolean;
  onDragEnd?: (info: PanInfo) => void;
}) {
  const content = card.content as unknown as IdeaData & {
    generated_hook?: { hooks?: HookOption[] };
    generated_script?: ScriptOutput;
    chosen_hook?: number;
  };
  const [ratingHover, setRatingHover] = useState(0);
  const [isSubmittingRating, setIsSubmittingRating] = useState(false);
  const [rated, setRated] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState("");
  const router = useRouter();

  const status = card.status as Column;
  // Hook Lab returns ten. Unranked and unbounded that is a wall of buttons on a
  // phone, so lead with the model's own scoring and let the rest scroll.
  const hookList = (content?.generated_hook?.hooks ?? [])
    .filter((h) => hookText(h))
    .slice()
    .sort((a, b) => (b.score ?? 0) - (a.score ?? 0));
  const [picked, setPicked] = useState(content?.chosen_hook ?? 0);
  const hasHook = hookList.length > 0;
  const chosenHook = hookText(hookList[picked]);

  const handleGenerate = async (module: "hook" | "script") => {
    const idea = [card.title, content.angle].filter(Boolean).join("\n").trim();
    const hook = chosenHook || content.hook_seed?.trim() || "";
    const duration = content.est_duration?.trim() || "60s";

    // Check locally what the route is about to check anyway. A 400 phrased as
    // "Idea, hook, and duration inputs are required" is the server's contract
    // leaking into the UI — it names fields the user never typed and offers no
    // way out. Catch it here and say what to actually do.
    if (!idea) {
      setError("Kartu ini gak punya judul, jadi gak ada yang bisa digarap. Hapus aja terus generate ulang dari Studio.");
      return;
    }
    if (module === "script" && !hook) {
      setError("Hook-nya belum kepilih. Bikin hook dulu, nanti tombol ini kebuka sendiri.");
      return;
    }

    setIsGenerating(true);
    setError("");

    try {
      const res = await fetch("/api/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          module,
          input: {
            idea,
            ...(module === "script" ? { hook, duration } : {}),
          },
          platform: "tiktok",
        }),
      });

      if (!res.ok) throw new Error(await readErrorBody(res, "Gagal generate."));

      let finalResult: unknown = null;
      let streamError: string | null = null;

      await readSSE(res, (msg) => {
        if (typeof msg.error === "string") {
          streamError = msg.error;
          return true;
        }
        if (msg.done) {
          finalResult = (msg.generation as { output?: unknown } | undefined)?.output ?? null;
          return true;
        }
      });

      if (streamError) throw new Error(streamError);

      if (finalResult) {
        const newContent = {
          ...content,
          ...(module === "hook"
            ? { generated_hook: finalResult, chosen_hook: 0 }
            : { generated_script: finalResult, chosen_hook: picked }),
        };
        await updateCardContentAndStatus(
          card.id,
          newContent,
          module === "hook" ? "draft" : "siap",
        );
        router.refresh();
      } else {
        // A stream that ends without a terminal frame used to leave the card
        // sitting there with no explanation. Say so instead.
        throw new Error("Generate-nya kepotong di tengah jalan. Coba lagi ya.");
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Ada yang error.");
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

  const body = (
    <>
      <div className="flex items-start gap-1">
        <h4 className="min-w-0 flex-1 font-display text-sm font-bold leading-snug text-ink">
          {card.title}
        </h4>
        {/* Quiet by default — a card you own should be removable in one tap,
            but the control must not compete with the card's actual content.
            Negative margins keep the 44px hit area from padding the card out.
            `stopPropagation` on pointerdown so grabbing the bin on desktop does
            not start a drag instead of a click. */}
        <button
          type="button"
          onPointerDownCapture={(e) => e.stopPropagation()}
          onClick={() => onDelete(card)}
          aria-label={`Hapus kartu ${card.title}`}
          title="Hapus kartu"
          className="-mr-2 -mt-2 flex min-h-11 min-w-11 shrink-0 cursor-pointer items-center justify-center rounded-lg text-muted transition-colors duration-[var(--duration-standard)] ease-heat hover:bg-danger/10 hover:text-danger"
        >
          <svg viewBox="0 0 24 24" aria-hidden="true" className="size-4 fill-current">
            <path d="M9 3h6l1 2h4v2H4V5h4l1-2ZM6 9h12l-1 11a2 2 0 0 1-2 2H9a2 2 0 0 1-2-2L6 9Zm4 2v8h1.5v-8H10Zm3.5 0v8H15v-8h-1.5Z" />
          </svg>
        </button>
      </div>
      {content?.format && (
        <span className="eyebrow mt-2 inline-block rounded bg-obsidian px-2 py-1 text-muted">
          {content.format}
        </span>
      )}

      {/* The card always says what it is waiting on. */}
      <p className="mt-3 text-micro leading-relaxed text-ember-lo">
        {nextStep(card, hasHook)}
      </p>

      {error && (
        <p className="mt-2 rounded-lg border border-danger/20 bg-danger/10 px-3 py-2 text-micro leading-relaxed text-danger">
          {error}
        </p>
      )}

      {(status === "ide" || (status === "draft" && !hasHook)) && (
        <div className="mt-3 border-t border-hairline pt-3">
          <button
            onClick={() => handleGenerate("hook")}
            disabled={isGenerating}
            className={`w-full rounded-lg px-3 py-2.5 text-xs font-bold transition-colors duration-[var(--duration-standard)] ease-heat disabled:opacity-60 ${
              isGenerating
                ? "glow-ember bg-surface text-ember"
                : "bg-surface text-muted hover:bg-surface-raised hover:text-ink"
            }`}
          >
            {isGenerating ? "Lagi mikirin hook..." : "Bikin hook · 2 kredit"}
          </button>
        </div>
      )}

      {/* The hooks were generated and then never shown — the card said "Hook
          udah jadi" and moved on. They are the whole point of the step, so
          show them and let the pick drive what the script is written against. */}
      {hasHook && status === "draft" && (
        <div className="mt-3 space-y-1.5">
          <p className="eyebrow text-ember">
            {hookList.length > 1 ? `Pilih hook · ${hookList.length} opsi` : "Hook"}
          </p>
          <div className="max-h-56 space-y-1.5 overflow-y-auto overscroll-contain pr-0.5">
          {hookList.map((h, i) => {
            const on = i === picked;
            return (
              <button
                key={i}
                onClick={() => setPicked(i)}
                aria-pressed={on}
                className={`block w-full cursor-pointer rounded-lg border p-3 text-left transition-colors duration-[var(--duration-standard)] ease-heat ${
                  on
                    ? "border-ember/45 bg-ember/10"
                    : "border-hairline bg-obsidian hover:border-ember/25"
                }`}
              >
                <p className={`text-xs leading-relaxed ${on ? "text-ink" : "text-ink/70"}`}>
                  {hookText(h)}
                </p>
                {h.why && on && (
                  <p className="mt-1.5 text-micro leading-relaxed text-muted">{h.why}</p>
                )}
              </button>
            );
          })}
          </div>

          <button
            onClick={() => handleGenerate("script")}
            disabled={isGenerating}
            className={`mt-1 w-full cursor-pointer rounded-lg px-3 py-2.5 text-xs font-bold transition-colors duration-[var(--duration-standard)] ease-heat disabled:opacity-60 ${
              isGenerating
                ? "glow-ember bg-surface text-ember"
                : "bg-ember text-obsidian hover:bg-ember-lo"
            }`}
          >
            {isGenerating ? "Lagi nulis script..." : "Bikin script dari hook ini · 4 kredit"}
          </button>
        </div>
      )}

      {/* The script existed in the row the whole time and was never shown. */}
      {(status === "siap" || status === "posted") && content.generated_script && (
        <ScriptView script={content.generated_script} title={card.title} />
      )}

      {status === "siap" && (
        <div className="mt-3 border-t border-hairline pt-3">
          <button
            onClick={() => onMove(card.id, "posted")}
            className="w-full rounded-lg bg-surface px-3 py-2.5 text-xs font-bold text-muted transition-colors duration-[var(--duration-standard)] ease-heat hover:bg-surface-raised hover:text-ink"
          >
            Udah gue posting
          </button>
        </div>
      )}

      {status === "posted" && card.generation_id && !rated && (
        <div className="mt-3 border-t border-hairline pt-3">
          <p className="mb-2 text-micro text-muted">Performanya gimana?</p>
          <div className="flex gap-1" onMouseLeave={() => setRatingHover(0)}>
            {[1, 2, 3, 4, 5].map((star) => (
              <button
                key={star}
                disabled={isSubmittingRating}
                aria-label={`Kasih ${star} bintang`}
                onMouseEnter={() => setRatingHover(star)}
                onClick={() => handleRate(star)}
                className={`text-lg transition-colors ${
                  star <= ratingHover ? "text-ember" : "text-muted"
                }`}
              >
                ★
              </button>
            ))}
          </div>
        </div>
      )}

      {status === "posted" && rated && (
        <p className="mt-3 border-t border-hairline pt-3 text-micro text-success">
          Makasih — ini kepake buat ide lo berikutnya.
        </p>
      )}
    </>
  );

  // Phones get buttons, not drag: `drag` inside a scroll container is a fight
  // the scroll container wins, and the gesture is hard to land one-handed.
  if (!draggable) {
    return (
      <div className="surface-card rounded-xl p-4">
        {body}
        <StageMover status={status} onMove={(to) => onMove(card.id, to)} />
      </div>
    );
  }

  return (
    <motion.div
      layoutId={card.id}
      drag
      dragSnapToOrigin
      onDragEnd={(_, info) => onDragEnd?.(info)}
      whileDrag={{ scale: 1.04, zIndex: 10, cursor: "grabbing" }}
      className="cursor-grab rounded-xl border border-hairline bg-surface-raised p-4 transition-colors hover:border-ember/30"
    >
      {body}
    </motion.div>
  );
}

/** Explicit stage movement for touch — the escape hatch when a card is in the wrong place. */
function StageMover({
  status,
  onMove,
}: {
  status: Column;
  onMove: (to: Column) => void;
}) {
  const order: Column[] = ["ide", "draft", "siap", "posted"];
  const i = order.indexOf(status);
  const back = i > 0 ? order[i - 1] : null;

  if (!back) return null;

  return (
    <div className="mt-3 flex justify-end">
      <button
        onClick={() => onMove(back)}
        className="text-micro text-muted underline-offset-2 transition-colors hover:text-ink hover:underline"
      >
        Balikin ke {COLUMNS.find((c) => c.id === back)?.label}
      </button>
    </div>
  );
}
