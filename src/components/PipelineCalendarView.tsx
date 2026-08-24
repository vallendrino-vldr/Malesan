"use client";

import { useState, useMemo } from "react";
import type { PipelineCard } from "@/lib/supabase/database.types";
import { updateCardScheduleDate } from "@/app/actions/pipeline";
import { todayPlatformLabel, normalizeTodayPlatform } from "@/lib/content-options";

interface PipelineCalendarViewProps {
  cards: PipelineCard[];
  onOpenCard?: (card: PipelineCard) => void;
}

const INDO_DAYS = ["Minggu", "Senin", "Selasa", "Rabu", "Kamis", "Jumat", "Sabtu"];
const INDO_MONTHS = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "Mei",
  "Jun",
  "Jul",
  "Ags",
  "Sep",
  "Okt",
  "Nov",
  "Des",
];

function toDateString(d: Date): string {
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function PipelineCalendarView({
  cards,
  onOpenCard,
}: PipelineCalendarViewProps) {
  // Current active reference date (starts at today)
  const [currentWeekStart, setCurrentWeekStart] = useState<Date>(() => {
    const d = new Date();
    // Start week from Monday
    const day = d.getDay();
    const diff = d.getDate() - day + (day === 0 ? -6 : 1);
    const monday = new Date(d.setDate(diff));
    monday.setHours(0, 0, 0, 0);
    return monday;
  });

  const [selectedUnscheduledCard, setSelectedUnscheduledCard] = useState<string | null>(null);
  const [isUpdatingDate, setIsUpdatingDate] = useState<string | null>(null);

  // Generate 7 days for the active week (Monday to Sunday)
  const weekDays = useMemo(() => {
    const days: Array<{
      date: Date;
      dateStr: string;
      isToday: boolean;
      dayOfWeek: number;
    }> = [];

    const now = new Date();
    const todayStr = toDateString(now);

    for (let i = 0; i < 7; i++) {
      const d = new Date(currentWeekStart);
      d.setDate(currentWeekStart.getDate() + i);
      const dateStr = toDateString(d);

      days.push({
        date: d,
        dateStr,
        isToday: dateStr === todayStr,
        dayOfWeek: d.getDay(),
      });
    }

    return days;
  }, [currentWeekStart]);

  // Group cards by scheduled_date
  const { scheduledMap, unscheduledCards } = useMemo(() => {
    const map = new Map<string, PipelineCard[]>();
    const unscheduled: PipelineCard[] = [];

    cards.forEach((card) => {
      if (card.scheduled_date) {
        const existing = map.get(card.scheduled_date) || [];
        existing.push(card);
        map.set(card.scheduled_date, existing);
      } else {
        unscheduled.push(card);
      }
    });

    return { scheduledMap: map, unscheduledCards: unscheduled };
  }, [cards]);

  const handlePrevWeek = () => {
    const prev = new Date(currentWeekStart);
    prev.setDate(currentWeekStart.getDate() - 7);
    setCurrentWeekStart(prev);
  };

  const handleNextWeek = () => {
    const next = new Date(currentWeekStart);
    next.setDate(currentWeekStart.getDate() + 7);
    setCurrentWeekStart(next);
  };

  const handleResetToday = () => {
    const d = new Date();
    const day = d.getDay();
    const diff = d.getDate() - day + (day === 0 ? -6 : 1);
    const monday = new Date(d.setDate(diff));
    monday.setHours(0, 0, 0, 0);
    setCurrentWeekStart(monday);
  };

  const handleAssignDate = async (cardId: string, targetDateStr: string | null) => {
    setIsUpdatingDate(cardId);
    try {
      await updateCardScheduleDate(cardId, targetDateStr);
      setSelectedUnscheduledCard(null);
    } catch (e) {
      console.error("Gagal mengupdate jadwal kartu:", e);
    } finally {
      setIsUpdatingDate(null);
    }
  };

  const weekRangeLabel = useMemo(() => {
    const first = weekDays[0].date;
    const last = weekDays[6].date;
    return `${first.getDate()} ${INDO_MONTHS[first.getMonth()]} — ${last.getDate()} ${INDO_MONTHS[last.getMonth()]} ${last.getFullYear()}`;
  }, [weekDays]);

  return (
    <div className="flex flex-col gap-4">
      {/* Calendar Top Navigation Bar: Pure & Uncluttered */}
      <div className="flex flex-col gap-3 rounded-2xl border border-hairline/80 bg-surface-raised/50 p-3.5 sm:p-4 shadow-xs">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-2.5">
            <div className="flex size-9 items-center justify-center rounded-xl border border-hairline bg-surface text-ink shrink-0">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="size-4 text-ember">
                <rect width="18" height="18" x="3" y="4" rx="2" />
                <path d="M16 2v4" />
                <path d="M8 2v4" />
                <path d="M3 10h18" />
              </svg>
            </div>
            <div>
              <h3 className="font-display text-sm font-bold text-ink">Jadwal Rencana Tayang</h3>
              <p className="text-micro text-muted">{weekRangeLabel}</p>
            </div>
          </div>

          {/* Week Navigation Segmented Control */}
          <div className="flex h-9 items-center rounded-xl border border-hairline bg-surface p-0.5 self-start sm:self-auto shrink-0">
            <button
              type="button"
              onClick={handlePrevWeek}
              aria-label="Minggu Sebelumnya"
              className="flex size-8 items-center justify-center rounded-lg text-muted transition-colors hover:bg-surface-raised hover:text-ink"
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="size-4">
                <path d="m15 18-6-6 6-6" />
              </svg>
            </button>
            <button
              type="button"
              onClick={handleResetToday}
              className="px-3 text-xs font-semibold text-ink transition-colors hover:text-ember whitespace-nowrap"
            >
              Minggu Ini
            </button>
            <button
              type="button"
              onClick={handleNextWeek}
              aria-label="Minggu Berikutnya"
              className="flex size-8 items-center justify-center rounded-lg text-muted transition-colors hover:bg-surface-raised hover:text-ink"
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="size-4">
                <path d="m9 18 6-6-6-6" />
              </svg>
            </button>
          </div>
        </div>
      </div>

      {/* ---------- DESKTOP VIEW: 7-DAY HORIZONTAL GRID (md and up) ---------- */}
      <div className="hidden grid-cols-7 gap-2.5 md:grid">
        {weekDays.map((day) => {
          const dayCards = scheduledMap.get(day.dateStr) || [];
          return (
            <div
              key={day.dateStr}
              className={`flex min-h-[380px] flex-col rounded-xl border p-2.5 transition-all ${
                day.isToday
                  ? "border-ember/40 bg-ember/[0.02] shadow-xs"
                  : "border-hairline bg-surface/50"
              }`}
            >
              {/* Day Header */}
              <div className="mb-2.5 flex items-center justify-between border-b border-hairline/60 pb-2">
                <div>
                  <p className="font-display text-xs font-semibold text-ink">
                    {INDO_DAYS[day.date.getDay()]}
                  </p>
                  <p className="text-micro text-muted">
                    {day.date.getDate()} {INDO_MONTHS[day.date.getMonth()]}
                  </p>
                </div>
                {day.isToday && (
                  <span className="rounded-md bg-ember/15 px-1.5 py-0.5 text-[10px] font-bold text-ember">
                    Hari Ini
                  </span>
                )}
              </div>

              {/* Day Content Cards */}
              <div className="flex flex-1 flex-col gap-2">
                {dayCards.length === 0 ? (
                  <div className="flex flex-1 flex-col items-center justify-center rounded-lg border border-dashed border-hairline/60 p-3 text-center">
                    <p className="text-micro text-muted/70">Belum ada konten</p>
                  </div>
                ) : (
                  dayCards.map((card) => (
                    <CalendarCardItem
                      key={card.id}
                      card={card}
                      onOpenCard={onOpenCard}
                      onUnschedule={() => handleAssignDate(card.id, null)}
                      isUpdating={isUpdatingDate === card.id}
                    />
                  ))
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* ---------- MOBILE VIEW: VERTICAL AGENDA LIST (under md) ---------- */}
      <div className="flex flex-col gap-3 md:hidden">
        {weekDays.map((day) => {
          const dayCards = scheduledMap.get(day.dateStr) || [];
          return (
            <div
              key={day.dateStr}
              className={`rounded-2xl border p-3.5 transition-colors ${
                day.isToday
                  ? "border-ember/40 bg-ember/[0.03]"
                  : "border-hairline bg-surface/60"
              }`}
            >
              {/* Mobile Day Header */}
              <div className="mb-3 flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <div
                    className={`flex size-8 items-center justify-center rounded-lg font-display text-xs font-bold ${
                      day.isToday
                        ? "bg-ember text-surface shadow-xs"
                        : "border border-hairline bg-surface-raised text-ink"
                    }`}
                  >
                    {day.date.getDate()}
                  </div>
                  <div>
                    <h4 className="font-display text-xs font-semibold text-ink">
                      {INDO_DAYS[day.date.getDay()]}
                    </h4>
                    <p className="text-micro text-muted">
                      {day.date.getDate()} {INDO_MONTHS[day.date.getMonth()]}{" "}
                      {day.date.getFullYear()}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-1.5">
                  {day.isToday && (
                    <span className="rounded-md bg-ember/15 px-2 py-0.5 text-micro font-bold text-ember">
                      Hari Ini
                    </span>
                  )}
                  <span className="rounded-full bg-surface-raised px-2 py-0.5 text-micro text-muted border border-hairline">
                    {dayCards.length} konten
                  </span>
                </div>
              </div>

              {/* Mobile Day Cards */}
              <div className="flex flex-col gap-2.5">
                {dayCards.length === 0 ? (
                  <div className="rounded-xl border border-dashed border-hairline/60 py-3 text-center">
                    <p className="text-micro text-muted/70">Jadwal kosong untuk hari ini</p>
                  </div>
                ) : (
                  dayCards.map((card) => (
                    <CalendarCardItem
                      key={card.id}
                      card={card}
                      onOpenCard={onOpenCard}
                      onUnschedule={() => handleAssignDate(card.id, null)}
                      isUpdating={isUpdatingDate === card.id}
                    />
                  ))
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* ---------- UNSCHEDULED CARDS SECTION: Clean & Responsive ---------- */}
      {unscheduledCards.length > 0 && (
        <div className="mt-2 rounded-2xl border border-hairline bg-surface/40 p-4">
          {/* Header Stacked Vertically on Mobile */}
          <div className="mb-3.5 flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-2">
              <div className="flex size-7 items-center justify-center rounded-lg border border-hairline bg-surface text-muted">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="size-3.5">
                  <path d="m12.83 2.18a2 2 0 0 0-1.66 0L2.6 6.08a1 1 0 0 0 0 1.83l8.58 3.9a2 2 0 0 0 1.66 0l8.58-3.9a1 1 0 0 0 0-1.83Z" />
                  <path d="m22 17.65-9.17 4.16a2 2 0 0 1-1.66 0L2 17.65" />
                  <path d="m22 12.65-9.17 4.16a2 2 0 0 1-1.66 0L2 12.65" />
                </svg>
              </div>
              <h4 className="font-display text-xs font-bold text-ink">
                Ide Belum Terjadwal
              </h4>
              <span className="rounded-full bg-surface-raised px-2 py-0.5 font-mono text-micro font-semibold text-muted border border-hairline">
                {unscheduledCards.length}
              </span>
            </div>
            <p className="text-micro text-muted">
              Pilih tanggal tayang agar rapi di kalender mingguan
            </p>
          </div>

          <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2 lg:grid-cols-3">
            {unscheduledCards.map((card) => {
              const cardContent = card.content as Record<string, unknown> | null;
              return (
                <div
                  key={card.id}
                  className="flex flex-col justify-between gap-3 rounded-xl border border-hairline bg-surface-raised p-3.5 transition-all hover:border-ink/20 shadow-xs"
                >
                  <div>
                    <div className="mb-2 flex items-center justify-between gap-1.5">
                      <div className="flex items-center gap-1.5 min-w-0">
                        <span className="rounded bg-surface px-1.5 py-0.5 text-[9px] font-bold text-muted border border-hairline uppercase tracking-wider">
                          {card.status}
                        </span>
                        {cardContent?.platform ? (
                          <span className="truncate rounded border border-hairline bg-surface px-1.5 py-0.5 text-[9px] text-muted">
                            {todayPlatformLabel(normalizeTodayPlatform(String(cardContent.platform)))}
                          </span>
                        ) : null}
                      </div>

                      {card.ai_score && (
                        <span className="shrink-0 flex items-center gap-0.5 font-mono text-[10px] font-bold text-ember">
                          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="size-2.5 text-ember">
                            <path d="M8.5 14.5A2.5 2.5 0 0 0 11 12c0-1.38-.5-2-1-3-1.072-2.143-.224-4.054 2-6 .5 2.5 2 4.9 4 6.5 2 1.6 3 3.5 3 5.5a7 7 0 1 1-14 0c0-1.153.433-2.294 1-3a2.5 2.5 0 0 0 2.5 3.5z" />
                          </svg>
                          {card.ai_score}
                        </span>
                      )}
                    </div>

                    <h5 className="font-display text-xs font-semibold text-ink leading-snug line-clamp-2">
                      {card.title}
                    </h5>
                  </div>

                  <div className="flex items-center justify-between border-t border-hairline/60 pt-2.5">
                    <button
                      type="button"
                      onClick={() =>
                        setSelectedUnscheduledCard(
                          selectedUnscheduledCard === card.id ? null : card.id,
                        )
                      }
                      className="flex items-center gap-1.5 rounded-lg border border-ember/30 bg-ember/10 px-2.5 py-1 text-micro font-bold text-ember transition-colors hover:bg-ember/20"
                    >
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="size-3">
                        <rect width="18" height="18" x="3" y="4" rx="2" />
                        <path d="M16 2v4" />
                        <path d="M8 2v4" />
                        <path d="M3 10h18" />
                      </svg>
                      <span>Atur Jadwal</span>
                    </button>

                    {onOpenCard && (
                      <button
                        type="button"
                        onClick={() => onOpenCard(card)}
                        className="text-micro font-medium text-muted transition-colors hover:text-ink"
                      >
                        Buka Detail →
                      </button>
                    )}
                  </div>

                  {/* Quick Date Picker Popover Grid */}
                  {selectedUnscheduledCard === card.id && (
                    <div className="mt-1 flex flex-col gap-2 rounded-xl border border-hairline bg-surface p-2.5 shadow-md">
                      <p className="text-[10px] font-semibold text-ink">
                        Pilih Hari Minggu Ini:
                      </p>
                      <div className="grid grid-cols-4 gap-1 sm:grid-cols-7">
                        {weekDays.map((d) => (
                          <button
                            key={d.dateStr}
                            type="button"
                            onClick={() => handleAssignDate(card.id, d.dateStr)}
                            disabled={isUpdatingDate === card.id}
                            className={`rounded-lg border px-1.5 py-1.5 text-center transition-colors disabled:opacity-50 ${
                              d.isToday
                                ? "border-ember/60 bg-ember/15 text-ember font-bold"
                                : "border-hairline bg-surface-raised text-ink hover:border-ember/40 hover:text-ember"
                            }`}
                          >
                            <p className="text-[9px] uppercase text-muted leading-none">
                              {INDO_DAYS[d.date.getDay()].slice(0, 3)}
                            </p>
                            <p className="font-mono text-xs font-bold mt-0.5 leading-none">
                              {d.date.getDate()}
                            </p>
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

function CalendarCardItem({
  card,
  onOpenCard,
  onUnschedule,
  isUpdating,
}: {
  card: PipelineCard;
  onOpenCard?: (card: PipelineCard) => void;
  onUnschedule?: () => void;
  isUpdating?: boolean;
}) {
  const content = card.content as Record<string, unknown> | null;
  const pillar = typeof content?.content_pillar === "string" ? content.content_pillar : undefined;

  const pillarLabel =
    pillar === "edukasi"
      ? "Edukasi"
      : pillar === "storytelling"
        ? "Cerita"
        : pillar === "engagement"
          ? "Diskusi"
          : pillar === "soft_selling"
            ? "Konversi"
            : null;

  return (
    <div
      onClick={() => onOpenCard?.(card)}
      className="group relative flex flex-col justify-between cursor-pointer rounded-xl border border-hairline/80 bg-surface-raised p-2.5 transition-all duration-150 hover:border-ember/40 hover:bg-surface-raised/90 hover:shadow-xs active:scale-[0.99]"
    >
      <div>
        <div className="mb-1.5 flex items-center justify-between gap-1">
          <div className="flex items-center gap-1 min-w-0">
            <span
              className={`rounded px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider ${
                card.status === "siap"
                  ? "bg-success/15 text-success border border-success/30"
                  : card.status === "draft"
                    ? "bg-blue-500/15 text-blue-400 border border-blue-500/30"
                    : card.status === "posted"
                      ? "bg-purple-500/15 text-purple-400 border border-purple-500/30"
                      : "bg-surface text-muted border border-hairline"
              }`}
            >
              {card.status}
            </span>
            {pillarLabel && (
              <span className="truncate rounded border border-hairline bg-surface px-1.5 py-0.5 text-[9px] font-medium text-ink/80">
                {pillarLabel}
              </span>
            )}
          </div>

          {card.ai_score && (
            <span className="shrink-0 flex items-center gap-0.5 font-mono text-[10px] font-bold text-ember">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="size-2.5 text-ember">
                <path d="M8.5 14.5A2.5 2.5 0 0 0 11 12c0-1.38-.5-2-1-3-1.072-2.143-.224-4.054 2-6 .5 2.5 2 4.9 4 6.5 2 1.6 3 3.5 3 5.5a7 7 0 1 1-14 0c0-1.153.433-2.294 1-3a2.5 2.5 0 0 0 2.5 3.5z" />
              </svg>
              {card.ai_score}
            </span>
          )}
        </div>

        <h5 className="font-display text-xs font-semibold leading-snug text-ink line-clamp-2 group-hover:text-ember transition-colors">
          {card.title}
        </h5>
      </div>

      {/* Card Footer: Clean, zero text collision */}
      <div className="mt-2.5 flex items-center justify-between border-t border-hairline/60 pt-1.5 text-[10px] text-muted">
        <span className="inline-flex items-center gap-1 font-mono font-semibold text-ember text-[10px]">
          {card.scheduled_time ? (
            <>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="size-2.5 text-ember">
                <circle cx="12" cy="12" r="10" />
                <polyline points="12 6 12 12 16 14" />
              </svg>
              <span>{card.scheduled_time}</span>
            </>
          ) : (
            <span className="truncate text-micro text-muted/70">
              {content?.est_duration ? String(content.est_duration) : card.schedule_label || "Rencana"}
            </span>
          )}
        </span>

        {onUnschedule && (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onUnschedule();
            }}
            disabled={isUpdating}
            className="text-[10px] text-muted/60 transition-colors hover:text-danger disabled:opacity-50"
            title="Hapus dari jadwal tanggal ini"
          >
            Lepas
          </button>
        )}
      </div>
    </div>
  );
}
