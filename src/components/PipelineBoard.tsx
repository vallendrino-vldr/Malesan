"use client";

import { useState, useRef, useEffect, useMemo } from "react";
import { motion, useDragControls, type PanInfo } from "framer-motion";
import type { PipelineCard } from "@/lib/supabase/database.types";
import {
  ratePerformance,
  updateCardContentAndStatus,
  deletePipelineCard,
  restorePipelineCard,
} from "@/app/actions/pipeline";
import { createClient } from "@/lib/supabase/client";
import { LiveRefresh } from "./LiveRefresh";
import { IdeaData } from "./IdeaCard";
import { useRouter } from "next/navigation";
import { readErrorBody, readSSE } from "@/lib/sse";
import { ScriptView, type ScriptOutput } from "./ScriptView";
import { GenerationProgress } from "./GenerationProgress";
import {
  startStudioProcessing,
  updateStudioChars,
  completeStudioProcessing,
} from "./studio/AIProcessingOverlay";
import { normalizeTodayPlatform, todayPlatformLabel } from "@/lib/content-options";
import { PipelineCalendarView } from "./PipelineCalendarView";
import { PipelineCardModal } from "./PipelineCardModal";
import { PipelineClearModal } from "./PipelineClearModal";

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
 *
 * Arrangement now persists. `sort_order` is the user's own ordering inside a
 * column; a drop renumbers that column and writes back only the rows that
 * actually moved. Every move — drag or button — goes through `place()`, so
 * there is one path to get right instead of three.
 */

type Column = "ide" | "draft" | "siap" | "posted";

/** Long enough to notice and react to; short enough to still feel like "just now". */
const UNDO_WINDOW_MS = 8000;

/** Module-level so the realtime subscription's dependency stays stable. */
const LIVE_TABLES = ["pipeline_cards"];

/**
 * The user's own arrangement first, newest-first only to break ties.
 *
 * Every existing row was written before `sort_order` existed and sits at 0, so
 * a board nobody has rearranged still reads exactly as it did before.
 */
const byOrder = (list: PipelineCard[]) =>
  [...list].sort(
    (a, b) => a.sort_order - b.sort_order || (a.created_at < b.created_at ? 1 : -1),
  );

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
      "Belum ada ide di sini. Bikin ide di tab Studio, terus tap “Simpan ke Alur” di kartu hasilnya.",
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
    label: "Tayang",
    blurb: "Udah tayang. Kasih rating biar ide berikutnya makin nyambung.",
    empty: "Belum ada yang tayang. Geser kartu dari Siap kalau udah lo posting.",
  },
];

const ORDER: Column[] = ["ide", "draft", "siap", "posted"];
const labelOf = (c: Column) => COLUMNS.find((x) => x.id === c)?.label ?? c;

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
      return "Langkah 3 dari 3 — syuting, posting, terus geser ke Tayang.";
    case "posted":
      return "Kasih rating performanya.";
    default:
      return "";
  }
}

/**
 * Where the pointer actually was when the card was dropped.
 *
 * `PanInfo.point` is `pageX/pageY` — it includes the window scroll. Comparing
 * it against `getBoundingClientRect()`, which is viewport-relative, silently
 * misses every column the moment the page is scrolled down: the card snaps back
 * and the drag looks like it did nothing. The native event carries viewport
 * coordinates directly, so use those and keep `info.point` only as a fallback.
 */
function dropPoint(
  event: MouseEvent | TouchEvent | PointerEvent,
  info: PanInfo,
): { x: number; y: number } {
  const p = event as PointerEvent;
  if (typeof p.clientX === "number") return { x: p.clientX, y: p.clientY };
  const t = (event as TouchEvent).changedTouches?.[0];
  if (t) return { x: t.clientX, y: t.clientY };
  return { x: info.point.x - window.scrollX, y: info.point.y - window.scrollY };
}

export function PipelineBoard({ initialCards }: { initialCards: PipelineCard[] }) {
  const [prevInitialCards, setPrevInitialCards] = useState<PipelineCard[]>(initialCards);
  const [cards, setCards] = useState<PipelineCard[]>(initialCards);
  const [mobileStage, setMobileStage] = useState<Column>("ide");
  const [undoCard, setUndoCard] = useState<PipelineCard | null>(null);
  const [boardError, setBoardError] = useState("");
  const [dragging, setDragging] = useState(false);
  const [scheduling, setScheduling] = useState<string[]>([]);
  const [viewMode, setViewMode] = useState<"kanban" | "calendar">("kanban");
  const [isGeneratingStrategy, setIsGeneratingStrategy] = useState(false);
  const [strategyStatus, setStrategyStatus] = useState<string>("");
  const [strategySuccess, setStrategySuccess] = useState<string>("");
  const [selectedCard, setSelectedCard] = useState<PipelineCard | null>(null);
  const [isClearModalOpen, setIsClearModalOpen] = useState(false);
  const router = useRouter();

  const currentWeekInfo = useMemo(() => {
    const d = new Date();
    const day = d.getDay();
    const diff = d.getDate() - day + (day === 0 ? -6 : 1);
    const monday = new Date(d.setDate(diff));
    const sunday = new Date(monday);
    sunday.setDate(monday.getDate() + 6);
    const format = (dt: Date) => {
      const year = dt.getFullYear();
      const month = String(dt.getMonth() + 1).padStart(2, "0");
      const day = String(dt.getDate()).padStart(2, "0");
      return `${year}-${month}-${day}`;
    };
    const startStr = format(monday);
    const endStr = format(sunday);
    const weekCards = cards.filter(
      (c) => c.scheduled_date && c.scheduled_date >= startStr && c.scheduled_date <= endStr,
    );
    return {
      startDate: startStr,
      endDate: endStr,
      weekCardsCount: weekCards.length,
    };
  }, [cards]);

  const handleCardUpdated = (updated: PipelineCard) => {
    setCards((prev) => prev.map((c) => (c.id === updated.id ? updated : c)));
    setSelectedCard(updated);
  };

  const handleCardDeleted = (cardId: string) => {
    setCards((prev) => prev.filter((c) => c.id !== cardId));
    setSelectedCard(null);
  };

  const handleGenerate7DayStrategy = async () => {
    setIsGeneratingStrategy(true);
    setBoardError("");
    setStrategySuccess("");
    setStrategyStatus("Menganalisis Creator DNA dan 3 kemungkinan angle...");

    const timer1 = setTimeout(() => {
      setStrategyStatus("Mengecek relevansi dengan target audiens lo...");
    }, 1800);

    const timer2 = setTimeout(() => {
      setStrategyStatus("Menyusun kalender strategi 7 hari...");
    }, 3800);

    try {
      const res = await fetch("/api/pipeline/strategy", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });

      if (!res.ok) {
        throw new Error(await readErrorBody(res, "Gagal merancang strategi 7 hari."));
      }

      const json = (await res.json()) as {
        cards?: PipelineCard[];
        overview?: string;
      };

      if (json.cards && Array.isArray(json.cards)) {
        setCards((prev) => [...json.cards!, ...prev]);
        setStrategySuccess(
          json.overview || "Strategi 7 hari berhasil dirancang dan masuk ke kalender!",
        );
        setViewMode("calendar");
        router.refresh();
      }
    } catch (e) {
      setBoardError(e instanceof Error ? e.message : "Gagal membuat strategi 7 hari.");
    } finally {
      clearTimeout(timer1);
      clearTimeout(timer2);
      setIsGeneratingStrategy(false);
      setStrategyStatus("");
    }
  };

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

  const listOf = (c: Column) => byOrder(cards.filter((x) => x.status === c));

  /**
   * Ask the model for a posting slot once a card reaches Siap.
   *
   * Deliberately fire-and-forget from the caller's point of view: a failed tag
   * is a missing chip, never a move that gets rolled back. The card is where the
   * user put it either way.
   */
  const tagSchedule = async (cardId: string) => {
    setScheduling((p) => (p.includes(cardId) ? p : [...p, cardId]));
    try {
      const res = await fetch("/api/pipeline/schedule", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ card_id: cardId }),
      });
      if (!res.ok) throw new Error(await readErrorBody(res, "Gagal nyariin jam tayangnya."));
      const json = (await res.json()) as {
        card?: { schedule_label: string | null; schedule_reason: string | null };
      };
      if (!json.card) throw new Error("Gagal nyariin jam tayangnya. Coba geser ulang kartunya.");
      setCards((prev) =>
        prev.map((c) =>
          c.id === cardId
            ? {
                ...c,
                schedule_label: json.card!.schedule_label,
                schedule_reason: json.card!.schedule_reason,
              }
            : c,
        ),
      );
    } catch (err) {
      setBoardError(
        err instanceof Error ? err.message : "Gagal nyariin jam tayangnya.",
      );
    } finally {
      setScheduling((p) => p.filter((id) => id !== cardId));
    }
  };

  /**
   * Put a card at `index` of column `to` and persist the whole column's order.
   *
   * The write goes straight from the browser: `pipeline_cards` is RLS'd to the
   * owner for update, and the query still filters on `user_id` so the policy is
   * a second lock rather than the only one. `.select()` is not optional — an
   * update that matched no rows is indistinguishable from a successful one
   * without it, and the board would keep showing a move the database refused.
   *
   * ponytail: renumbers 0..n-1 and issues one update per row that actually
   * moved — O(column length) writes per drop. A fractional rank column would cut
   * it to one write, worth doing only if someone ever keeps hundreds of cards in
   * one stage.
   */
  const place = async (cardId: string, to: Column, index: number) => {
    const snapshot = cards;
    const moving = snapshot.find((c) => c.id === cardId);
    if (!moving) return;

    const target = byOrder(snapshot.filter((c) => c.status === to && c.id !== cardId));
    target.splice(Math.max(0, Math.min(index, target.length)), 0, { ...moving, status: to });

    const renumbered = target.map((c, i) => ({ ...c, status: to, sort_order: i }));
    const changed = renumbered.filter((c) => {
      const before = snapshot.find((s) => s.id === c.id);
      return !before || before.status !== c.status || before.sort_order !== c.sort_order;
    });
    if (changed.length === 0) return;

    const patch = new Map(renumbered.map((c) => [c.id, c]));
    setCards((prev) => prev.map((c) => patch.get(c.id) ?? c));
    setBoardError("");

    const supabase = createClient();
    const results = await Promise.all(
      changed.map((c) =>
        supabase
          .from("pipeline_cards")
          .update({ status: c.status, sort_order: c.sort_order })
          .eq("id", c.id)
          .eq("user_id", c.user_id)
          .select("id")
          .single(),
      ),
    );

    if (results.some((r) => r.error)) {
      setCards(snapshot);
      setBoardError("Kartunya gagal dipindah. Coba lagi bentar lagi.");
      return;
    }

    // A card only earns a posting slot when it first becomes shootable, and only
    // if it has not been tagged already — re-entering Siap should not re-spend.
    if (to === "siap" && moving.status !== "siap" && !moving.schedule_label) {
      void tagSchedule(cardId);
    }
  };

  const move = (cardId: string, to: Column) => place(cardId, to, 0);

  const reorder = (cardId: string, delta: number) => {
    const card = cards.find((c) => c.id === cardId);
    if (!card) return;
    const list = listOf(card.status as Column);
    const i = list.findIndex((c) => c.id === cardId);
    if (i < 0) return;
    const to = i + delta;
    if (to < 0 || to >= list.length) return;
    return place(cardId, card.status as Column, to);
  };

  /**
   * Delete goes through on the first tap, with an undo window afterwards,
   * rather than putting a confirmation in front of it. Confirming every delete
   * trains people to tap "yes" without reading, and it does not help the case
   * that actually matters — the tap you did not mean to make. An undo does.
   */
  const remove = async (card: PipelineCard) => {
    setBoardError("");
    setCards((prev) => prev.filter((c) => c.id !== card.id));
    try {
      await deletePipelineCard(card.id);
      setUndoCard(card);
    } catch {
      // Put it straight back: the board must never show a card as gone when
      // the database still has it.
      setCards((prev) => [...prev, card]);
      setBoardError("Kartunya gagal dihapus. Coba lagi bentar lagi.");
    }
  };

  const undoDelete = async () => {
    const card = undoCard;
    if (!card) return;
    setUndoCard(null);
    setCards((prev) => [...prev, card]);
    try {
      await restorePipelineCard({
        id: card.id,
        title: card.title,
        content: card.content,
        status: card.status as Column,
        generation_id: card.generation_id ?? null,
        created_at: card.created_at,
      });
      // The restore action's signature predates `sort_order` and the schedule
      // tag, so a straight re-insert would put the card back at the top of its
      // column with its posting slot wiped. Patch those two back on the way in.
      // Best effort: the card is already restored, and a failed patch costs the
      // user its position, not the card.
      if (card.sort_order !== 0 || card.schedule_label) {
        const { error } = await createClient()
          .from("pipeline_cards")
          .update({
            sort_order: card.sort_order,
            schedule_label: card.schedule_label,
            schedule_reason: card.schedule_reason,
          })
          .eq("id", card.id)
          .eq("user_id", card.user_id)
          .select("id")
          .single();
        if (error) console.error("restore: sort_order/schedule patch failed", error);
      }
    } catch {
      setCards((prev) => prev.filter((c) => c.id !== card.id));
      setBoardError("Gagal balikin kartunya. Kartu itu udah kehapus permanen.");
    }
  };

  const handleDragEnd = (
    cardId: string,
    event: MouseEvent | TouchEvent | PointerEvent,
    info: PanInfo,
  ) => {
    setDragging(false);
    const p = dropPoint(event, info);

    const col = COLUMNS.find((c) => {
      const r = colRefs.current[c.id]?.getBoundingClientRect();
      return !!r && p.x >= r.left && p.x <= r.right && p.y >= r.top && p.y <= r.bottom;
    });
    if (!col) return;

    // Where in that column the card was dropped: the first card whose midpoint
    // the pointer is above. Measured from the DOM rather than from state so it
    // matches what the user is actually looking at, dragged card excluded
    // because `place()` reinserts it.
    const siblings = Array.from(
      colRefs.current[col.id]?.querySelectorAll<HTMLElement>("[data-card-id]") ?? [],
    ).filter((el) => el.dataset.cardId !== cardId);

    let index = siblings.length;
    for (let i = 0; i < siblings.length; i++) {
      const r = siblings[i].getBoundingClientRect();
      if (p.y < r.top + r.height / 2) {
        index = i;
        break;
      }
    }

    void place(cardId, col.id, index);
  };

  const total = cards.length;

  return (
    <div className="space-y-4">
      {/* The board is live: `pipeline_cards` is in the realtime publication and
          RLS scopes events to this user's own rows. Silent, because most events
          on this table are the user's own drag landing — a toast for your own
          drop is noise. */}
      <LiveRefresh tables={LIVE_TABLES} silent />

      {/* ---------- Creator Workflow & AI Companion Header Strip ---------- */}
      <div className="surface-card rounded-2xl border border-hairline/80 p-4 sm:p-5 shadow-xs">
        <div className="flex flex-col gap-4">
          {/* Top row: Title, Total badge, and View Switcher */}
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex items-center gap-2.5">
              <div className="inline-flex items-center gap-1.5 rounded-full bg-ember/15 px-2.5 py-0.5 text-micro font-bold tracking-wider text-ember border border-ember/30 uppercase">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="size-3.5 text-ember">
                  <path d="M18 6H5a2 2 0 0 0-2 2v3a2 2 0 0 0 2 2h13l4-3.5L18 6Z" />
                  <path d="M12 13v8" />
                  <path d="M12 3v3" />
                </svg>
                <span>Alur Kerja Kreator</span>
              </div>
              <span className="rounded-full bg-surface-raised px-2.5 py-0.5 font-mono text-micro text-muted border border-hairline">
                {total} konten aktif
              </span>
            </div>

            {/* View Mode Toggle & Rancang 7 Hari Action */}
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
              {/* Segmented View Switcher */}
              <div className="flex h-9 items-center rounded-xl border border-hairline bg-surface/70 p-0.5 shrink-0">
                <button
                  type="button"
                  onClick={() => setViewMode("kanban")}
                  className={`flex h-8 flex-1 sm:flex-initial items-center justify-center gap-1.5 rounded-lg px-3 text-xs font-semibold transition-all ${
                    viewMode === "kanban"
                      ? "bg-surface-raised text-ink shadow-xs"
                      : "text-muted hover:text-ink"
                  }`}
                >
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="size-3.5">
                    <rect width="18" height="18" x="3" y="3" rx="2" />
                    <path d="M9 3v18" />
                    <path d="M15 3v18" />
                  </svg>
                  <span>Papan Kanban</span>
                </button>
                <button
                  type="button"
                  onClick={() => setViewMode("calendar")}
                  className={`flex h-8 flex-1 sm:flex-initial items-center justify-center gap-1.5 rounded-lg px-3 text-xs font-semibold transition-all ${
                    viewMode === "calendar"
                      ? "bg-surface-raised text-ink shadow-xs"
                      : "text-muted hover:text-ink"
                  }`}
                >
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="size-3.5">
                    <rect width="18" height="18" x="3" y="4" rx="2" />
                    <path d="M16 2v4" />
                    <path d="M8 2v4" />
                    <path d="M3 10h18" />
                  </svg>
                  <span>Kalender</span>
                </button>
              </div>

              <div className="flex items-center gap-2">
                {cards.length > 0 && (
                  <button
                    type="button"
                    onClick={() => setIsClearModalOpen(true)}
                    className="flex h-9 flex-1 sm:flex-initial items-center justify-center gap-1.5 rounded-xl border border-hairline bg-surface-raised/60 px-3 text-xs font-semibold text-muted transition-colors hover:border-danger/40 hover:bg-danger/10 hover:text-danger whitespace-nowrap shrink-0"
                    title="Kosongkan jadwal atau hapus kartu dari alur"
                  >
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="size-3.5">
                      <path d="M3 6h18" />
                      <path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6" />
                      <path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2" />
                    </svg>
                    <span>Bersihkan</span>
                  </button>
                )}

                <button
                  type="button"
                  onClick={handleGenerate7DayStrategy}
                  disabled={isGeneratingStrategy}
                  className="flex h-9 flex-2 sm:flex-initial items-center justify-center gap-1.5 rounded-xl border border-ember/40 bg-ember/10 px-3.5 font-display text-xs font-bold text-ember transition-colors hover:bg-ember/20 disabled:opacity-50 whitespace-nowrap shrink-0"
                >
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="size-3.5">
                    <path d="m12 3-1.9 5.8a2 2 0 0 1-1.3 1.3L3 12l5.8 1.9a2 2 0 0 1 1.3 1.3L12 21l1.9-5.8a2 2 0 0 1 1.3-1.3L21 12l-5.8-1.9a2 2 0 0 1-1.3-1.3L12 3z" />
                  </svg>
                  <span>{isGeneratingStrategy ? "Menyusun..." : "Rancang 7 Hari · 5 kredit"}</span>
                </button>
              </div>
            </div>
          </div>

          {/* AI Dynamic Greeting & Status Banner */}
          <div className="rounded-xl border border-hairline/60 bg-surface-raised/40 px-3.5 py-2.5">
            <div className="flex items-start gap-2.5">
              <span className="mt-0.5 flex size-2 rounded-full bg-ember animate-pulse shrink-0" />
              <div className="flex-1 text-xs leading-relaxed text-muted">
                {isGeneratingStrategy ? (
                  <span className="font-semibold text-ember">{strategyStatus}</span>
                ) : (
                  <>
                    <strong className="text-ink font-medium">AI Content Brain:</strong>{" "}
                    {listOf("siap").length > 0 ? (
                      <>Lo punya <span className="font-semibold text-ink">{listOf("siap").length} konten siap produksi</span>. {cards.filter((c) => c.scheduled_date).length} konten sudah terjadwal di kalender mingguan.</>
                    ) : listOf("ide").length > 0 ? (
                      <>Ada <span className="font-semibold text-ink">{listOf("ide").length} ide aktif</span>. Bikin hook atau rancang kalender 7 hari untuk eksekusi terstruktur.</>
                    ) : (
                      <>Alur kerja lo masih kosong. Klik tombol <span className="font-semibold text-ember">Rancang 7 Hari</span> di atas biar AI siapkan strategi seimbang buat lo!</>
                    )}
                  </>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Success Notification */}
      {strategySuccess && (
        <div className="flex items-center justify-between rounded-xl border border-success/30 bg-success/10 px-4 py-3 text-xs text-success">
          <p className="font-medium">{strategySuccess}</p>
          <button
            type="button"
            onClick={() => setStrategySuccess("")}
            className="text-xs font-bold hover:underline"
          >
            Tutup
          </button>
        </div>
      )}

      {/* View Conditional: Calendar vs Kanban */}
      {viewMode === "calendar" ? (
        <PipelineCalendarView
          cards={cards}
          onOpenCard={(card) => setSelectedCard(card)}
          onGenerateStrategy={handleGenerate7DayStrategy}
          onClearSchedule={() => setIsClearModalOpen(true)}
          isGeneratingStrategy={isGeneratingStrategy}
        />
      ) : (
        <>
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
                      className={`grid size-5 place-items-center rounded-full text-micro leading-none ${
                        on ? "bg-ember/25 text-ink" : "bg-surface-raised text-ink"
                      }`}
                    >
                      {listOf(col.id).length}
                    </span>
                  </button>
                );
              })}
            </div>

            {COLUMNS.filter((c) => c.id === mobileStage).map((col) => {
              const list = listOf(col.id);
              return (
                <div key={col.id} className="mt-3 space-y-3">
                  <p className="text-xs leading-relaxed text-muted">{col.blurb}</p>
                  {list.length === 0 ? (
                    <EmptyStage text={col.empty} />
                  ) : (
                    list.map((card, i) => (
                      <PipelineCardItem
                        key={card.id}
                        card={card}
                        index={i}
                        count={list.length}
                        onMove={move}
                        onReorder={reorder}
                        onDelete={remove}
                        onSchedule={tagSchedule}
                        isScheduling={scheduling.includes(card.id)}
                        draggable={false}
                      />
                    ))
                  )}
                </div>
              );
            })}
          </div>

          {/* ---------- md and up: the full board ---------- */}
          <div className="hidden gap-3 overflow-x-auto pb-2 md:flex">
            {COLUMNS.map((col) => {
              const list = listOf(col.id);
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

                  <div
                    className={`flex min-h-0 flex-1 flex-col gap-3 ${
                      dragging ? "overflow-visible" : "overflow-y-auto"
                    }`}
                  >
                    {list.length === 0 ? (
                      <EmptyStage text={col.empty} />
                    ) : (
                      list.map((card, i) => (
                        <PipelineCardItem
                          key={card.id}
                          card={card}
                          index={i}
                          count={list.length}
                          onMove={move}
                          onReorder={reorder}
                          onDelete={remove}
                          onSchedule={tagSchedule}
                          isScheduling={scheduling.includes(card.id)}
                          draggable
                          onDragStart={() => setDragging(true)}
                          onDragEnd={(event, info) => handleDragEnd(card.id, event, info)}
                        />
                      ))
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </>
      )}

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

      {boardError && (
        <p
          role="alert"
          className="rounded-lg border border-danger/25 bg-danger/10 px-3 py-2 text-xs leading-relaxed text-danger"
        >
          {boardError}
        </p>
      )}

      {/* Universal Card Detail Modal */}
      <PipelineCardModal
        card={selectedCard}
        isOpen={Boolean(selectedCard)}
        onClose={() => setSelectedCard(null)}
        onCardUpdated={handleCardUpdated}
        onCardDeleted={handleCardDeleted}
      />

      {/* Batch Clear Modal */}
      <PipelineClearModal
        isOpen={isClearModalOpen}
        onClose={() => setIsClearModalOpen(false)}
        totalCards={cards.length}
        weekCardsCount={currentWeekInfo.weekCardsCount}
        startDate={currentWeekInfo.startDate}
        endDate={currentWeekInfo.endDate}
        onCleared={() => {
          setCards([]);
          router.refresh();
        }}
      />
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
  index,
  count,
  onMove,
  onReorder,
  onDelete,
  onSchedule,
  isScheduling,
  draggable,
  onDragStart,
  onDragEnd,
}: {
  card: PipelineCard;
  index: number;
  count: number;
  onMove: (cardId: string, to: Column) => void | Promise<void>;
  onReorder: (cardId: string, delta: number) => void | Promise<void>;
  onDelete: (card: PipelineCard) => void | Promise<void>;
  onSchedule: (cardId: string) => void | Promise<void>;
  isScheduling: boolean;
  draggable: boolean;
  onDragStart?: () => void;
  onDragEnd?: (event: MouseEvent | TouchEvent | PointerEvent, info: PanInfo) => void;
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
  const [generationModule, setGenerationModule] = useState<"hook" | "script">("hook");
  const [generationChars, setGenerationChars] = useState(0);
  const [generationStatus, setGenerationStatus] = useState("");
  const [error, setError] = useState("");
  const router = useRouter();
  const dragControls = useDragControls();

  const status = card.status as Column;
  const [showAnalysis, setShowAnalysis] = useState(false);
  const aiScore =
    card.ai_score ??
    ((content as unknown as Record<string, unknown>)?.ai_score as number | undefined);
  const breakdown = (content as unknown as Record<string, unknown>)?.score_breakdown as
    | {
        pattern?: number;
        curiosity?: number;
        pain?: number;
        specificity?: number;
        emotion?: number;
      }
    | undefined;
  const scoreReason = (content as unknown as Record<string, unknown>)?.score_reason as
    | string
    | undefined;

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
      setError("Kartu ini gak punya judul, jadi gak ada yang bisa digarap. Hapus aja terus bikin ulang dari Studio.");
      return;
    }
    if (module === "script" && !hook) {
      setError("Hook-nya belum kepilih. Bikin hook dulu, nanti tombol ini kebuka sendiri.");
      return;
    }

    setIsGenerating(true);
    setGenerationModule(module);
    setGenerationChars(0);
    setGenerationStatus(module === "hook" ? "Lagi meracik hook..." : "Lagi menyusun naskah...");
    setError("");

    startStudioProcessing({
      moduleKey: module,
      label: module === "hook" ? "Lagi meracik hook..." : "Lagi menyusun naskah...",
    });

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
          // Ide Hari Ini now stores the creator's actual destination. Falling
          // back to TikTok preserves old cards that predate that field.
          platform: content.platform || "tiktok",
        }),
      });

      if (!res.ok) throw new Error(await readErrorBody(res, "Kontennya belum berhasil dibikin."));

      let finalResult: unknown = null;
      let streamError: string | null = null;

      await readSSE(res, (msg) => {
        if (typeof msg.error === "string") {
          streamError = msg.error;
          return true;
        }
        if (typeof msg.status === "string") setGenerationStatus(msg.status);
        if (typeof msg.chunk === "string") {
          const chunk = msg.chunk;
          setGenerationChars((count) => count + chunk.length);
          updateStudioChars(chunk.length);
        }
        if (msg.done) {
          finalResult = (msg.generation as { output?: unknown } | undefined)?.output ?? null;
          completeStudioProcessing();
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
        // Finishing a script is the main way a card reaches Siap — it earns a
        // posting slot exactly like a card dragged there does.
        if (module === "script" && !card.schedule_label) void onSchedule(card.id);
        router.refresh();
      } else {
        // A stream that ends without a terminal frame used to leave the card
        // sitting there with no explanation. Say so instead.
        throw new Error("Prosesnya kepotong di tengah jalan. Coba lagi ya.");
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Ada yang error.");
    } finally {
      setIsGenerating(false);
      completeStudioProcessing();
    }
  };

  const handleUpdateScript = async (updatedScript: ScriptOutput) => {
    const newContent = {
      ...content,
      generated_script: updatedScript,
    };
    await updateCardContentAndStatus(card.id, newContent, status);
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
        {/* The grip is the only part of a desktop card that starts a drag.
            Grabbing the whole card meant selecting text in a script, or
            scrolling the hook list, threw the card across the board instead. */}
        {draggable && (
          <span
            role="presentation"
            title="Geser buat pindahin"
            onPointerDown={(e) => {
              e.preventDefault();
              dragControls.start(e);
            }}
            className="-ml-1 mt-0.5 shrink-0 cursor-grab touch-none px-1 text-muted active:cursor-grabbing"
          >
            <svg viewBox="0 0 24 24" aria-hidden="true" className="size-4 fill-current">
              <path d="M9 5h2v2H9V5Zm4 0h2v2h-2V5ZM9 11h2v2H9v-2Zm4 0h2v2h-2v-2Zm-4 6h2v2H9v-2Zm4 0h2v2h-2v-2Z" />
            </svg>
          </span>
        )}
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

      <div className="mt-2 flex flex-wrap items-center gap-1.5">
        {content?.format && (
          <span className="eyebrow inline-block rounded bg-obsidian px-2 py-1 text-muted">
            {content.format}
          </span>
        )}
        {content?.platform && (
          <span className="eyebrow inline-block rounded bg-obsidian px-2 py-1 text-muted">
            {todayPlatformLabel(normalizeTodayPlatform(content.platform))}
          </span>
        )}
        {aiScore && (
          <span
            className="inline-flex items-center gap-1 rounded-full border border-ember/30 bg-ember/10 px-2 py-0.5 font-mono text-[10px] font-bold text-ember"
            title="Skor Potensi Konten AI"
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="size-2.5 text-ember">
              <path d="M8.5 14.5A2.5 2.5 0 0 0 11 12c0-1.38-.5-2-1-3-1.072-2.143-.224-4.054 2-6 .5 2.5 2 4.9 4 6.5 2 1.6 3 3.5 3 5.5a7 7 0 1 1-14 0c0-1.153.433-2.294 1-3a2.5 2.5 0 0 0 2.5 3.5z" />
            </svg>
            Potensi {aiScore}
          </span>
        )}
        {card.scheduled_date && (
          <span className="inline-flex items-center gap-1 rounded-full border border-hairline bg-surface-raised px-2 py-0.5 text-[10px] text-muted">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="size-2.5">
              <rect width="18" height="18" x="3" y="4" rx="2" />
              <path d="M16 2v4" />
              <path d="M8 2v4" />
              <path d="M3 10h18" />
            </svg>
            {card.scheduled_date}
          </span>
        )}
        {/* The posting slot the model picked. Neutral on purpose — ember is for
            action and heat, and this is information. */}
        {card.schedule_label && (
          <span
            className="inline-flex items-center gap-1 rounded-full border border-hairline bg-obsidian px-2 py-1 text-micro text-ink"
            title={card.schedule_reason ?? undefined}
          >
            <svg viewBox="0 0 24 24" aria-hidden="true" className="size-3 fill-current">
              <path d="M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20Zm1 10.6V6h-2v7.4l4.7 2.8 1-1.7-3.7-2.2Z" />
            </svg>
            {card.schedule_label}
          </span>
        )}
        {isScheduling && !card.schedule_label && (
          <span className="text-micro text-muted">Lagi nyariin jam tayang...</span>
        )}
      </div>

      {breakdown && (
        <div className="mt-2.5 rounded-lg border border-hairline bg-surface/70 p-2.5">
          <button
            type="button"
            onClick={() => setShowAnalysis((v) => !v)}
            className="flex w-full items-center justify-between text-micro font-semibold text-ink/80 transition-colors hover:text-ember"
          >
            <span className="flex items-center gap-1.5">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="size-3 text-ember">
                <path d="m12 3-1.9 5.8a2 2 0 0 1-1.3 1.3L3 12l5.8 1.9a2 2 0 0 1 1.3 1.3L12 21l1.9-5.8a2 2 0 0 1 1.3-1.3L21 12l-5.8-1.9a2 2 0 0 1-1.3-1.3L12 3z" />
              </svg>
              Analisis Potensi AI
            </span>
            <span className="text-[10px] text-muted">{showAnalysis ? "Tutup" : "Lihat Rincian"}</span>
          </button>

          {showAnalysis && (
            <div className="mt-2 space-y-1.5 border-t border-hairline/60 pt-2 text-[11px]">
              {scoreReason && (
                <p className="mb-2 text-micro leading-relaxed text-muted italic">"{scoreReason}"</p>
              )}
              <div className="grid grid-cols-2 gap-1.5 text-[10px] text-muted">
                <div className="flex items-center justify-between rounded bg-surface px-1.5 py-1">
                  <span>Daya Henti:</span>
                  <span className="font-mono font-bold text-ink">{breakdown.pattern ?? "-"}/25</span>
                </div>
                <div className="flex items-center justify-between rounded bg-surface px-1.5 py-1">
                  <span>Penasaran:</span>
                  <span className="font-mono font-bold text-ink">{breakdown.curiosity ?? "-"}/20</span>
                </div>
                <div className="flex items-center justify-between rounded bg-surface px-1.5 py-1">
                  <span>Masalah Audiens:</span>
                  <span className="font-mono font-bold text-ink">{breakdown.pain ?? "-"}/20</span>
                </div>
                <div className="flex items-center justify-between rounded bg-surface px-1.5 py-1">
                  <span>Spesifik:</span>
                  <span className="font-mono font-bold text-ink">{breakdown.specificity ?? "-"}/20</span>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {card.schedule_label && card.schedule_reason && (
        <p className="mt-1.5 text-micro leading-relaxed text-muted">{card.schedule_reason}</p>
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

      {isGenerating && (
        <div className="mt-3">
          <GenerationProgress
            moduleKey={generationModule}
            chars={generationChars}
            label={generationModule === "hook" ? "Lagi meracik hook..." : "Lagi menyusun naskah..."}
            status={generationStatus}
          />
        </div>
      )}

      {(status === "ide" || (status === "draft" && !hasHook)) && (
        <div className="mt-3 border-t border-hairline pt-3">
          <button
            onClick={() => handleGenerate("hook")}
            disabled={isGenerating}
            className={`w-full cursor-pointer rounded-xl px-4 py-2.5 text-xs font-bold transition-all duration-[var(--duration-standard)] ease-heat active:scale-[0.98] disabled:opacity-60 ${
              isGenerating
                ? "glow-ember bg-surface text-ember"
                : "bg-ember text-obsidian shadow-[0_0_20px_rgba(255,138,61,0.25)] hover:bg-ember-lo"
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
            className={`mt-1 w-full cursor-pointer rounded-xl px-4 py-2.5 text-xs font-bold transition-all duration-[var(--duration-standard)] ease-heat active:scale-[0.98] disabled:opacity-60 ${
              isGenerating
                ? "glow-ember bg-surface text-ember"
                : "bg-ember text-obsidian shadow-[0_0_20px_rgba(255,138,61,0.25)] hover:bg-ember-lo"
            }`}
          >
            {isGenerating ? "Lagi nulis script..." : "Bikin script dari hook ini · 4 kredit"}
          </button>
        </div>
      )}

      {/* The script existed in the row the whole time and was never shown. */}
      {(status === "siap" || status === "posted") && content.generated_script && (
        <ScriptView
          script={content.generated_script}
          title={card.title}
          platform={content.platform}
          onSaveScript={handleUpdateScript}
        />
      )}

      {status === "siap" && (
        <div className="mt-3 border-t border-hairline pt-3">
          <button
            onClick={() => onMove(card.id, "posted")}
            className="w-full cursor-pointer rounded-xl border border-white/[0.08] bg-white/[0.04] px-4 py-2.5 text-xs font-bold text-ink transition-all duration-[var(--duration-standard)] ease-heat hover:border-ember/40 hover:bg-ember/10 hover:text-ember active:scale-[0.98]"
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

      <StageMover
        status={status}
        index={index}
        count={count}
        onMove={(to) => onMove(card.id, to)}
        onReorder={(delta) => onReorder(card.id, delta)}
      />
    </>
  );

  // Phones get buttons, not drag: `drag` inside a scroll container is a fight
  // the scroll container wins, and the gesture is hard to land one-handed.
  if (!draggable) {
    return (
      <div data-card-id={card.id} className="surface-card rounded-xl p-4">
        {body}
      </div>
    );
  }

  return (
    <motion.div
      layoutId={card.id}
      data-card-id={card.id}
      drag
      dragListener={false}
      dragControls={dragControls}
      dragSnapToOrigin
      onDragStart={() => onDragStart?.()}
      onDragEnd={(event, info) => onDragEnd?.(event, info)}
      whileDrag={{ scale: 1.04, zIndex: 10 }}
      className="rounded-xl border border-hairline bg-surface-raised p-4 transition-colors hover:border-ember/30"
    >
      {body}
    </motion.div>
  );
}

/**
 * Every move a drag can do, as buttons.
 *
 * Not a fallback — it is the only way to move a card on a phone (where the board
 * shows one stage at a time), and the only keyboard-reachable way anywhere. A
 * card must never be stuck because a gesture did not land.
 */
function StageMover({
  status,
  index,
  count,
  onMove,
  onReorder,
}: {
  status: Column;
  index: number;
  count: number;
  onMove: (to: Column) => void;
  onReorder: (delta: number) => void;
}) {
  const i = ORDER.indexOf(status);
  const back = i > 0 ? ORDER[i - 1] : null;
  const next = i < ORDER.length - 1 ? ORDER[i + 1] : null;

  const arrow =
    "flex min-h-10 min-w-10 cursor-pointer items-center justify-center rounded-lg text-muted/80 transition-all duration-[var(--duration-standard)] ease-heat hover:bg-white/[0.08] hover:text-ink disabled:cursor-default disabled:opacity-20";
  const stage =
    "min-h-9 cursor-pointer rounded-lg border border-white/[0.08] bg-white/[0.04] px-3 text-micro font-bold text-ink transition-all duration-[var(--duration-standard)] ease-heat hover:border-ember/40 hover:bg-ember/15 hover:text-ember active:scale-95";

  return (
    <div className="-mb-1 mt-3 flex items-center justify-between gap-1 border-t border-hairline pt-1">
      <div className="flex items-center">
        <button
          type="button"
          onClick={() => onReorder(-1)}
          disabled={index === 0}
          aria-label="Naikin urutan kartu"
          title="Naikin urutan"
          className={arrow}
        >
          <svg viewBox="0 0 24 24" aria-hidden="true" className="size-4 fill-current">
            <path d="M12 6l6 7h-4v5h-4v-5H6l6-7Z" />
          </svg>
        </button>
        <button
          type="button"
          onClick={() => onReorder(1)}
          disabled={index >= count - 1}
          aria-label="Turunin urutan kartu"
          title="Turunin urutan"
          className={arrow}
        >
          <svg viewBox="0 0 24 24" aria-hidden="true" className="size-4 fill-current">
            <path d="M12 18l-6-7h4V6h4v5h4l-6 7Z" />
          </svg>
        </button>
      </div>

      <div className="flex items-center gap-1">
        {back && (
          <button type="button" onClick={() => onMove(back)} className={stage}>
            ← {labelOf(back)}
          </button>
        )}
        {next && (
          <button type="button" onClick={() => onMove(next)} className={stage}>
            {labelOf(next)} →
          </button>
        )}
      </div>
    </div>
  );
}
