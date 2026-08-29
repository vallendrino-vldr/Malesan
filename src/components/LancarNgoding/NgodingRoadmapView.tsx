"use client";

import React, { useState } from "react";
import { LessonItem } from "./StepLearnView";
import { NgodingProgress } from "@/lib/ngoding-progress";
import { TRACKS } from "./NgodingHUD";

interface Props {
  curriculum: LessonItem[];
  progress: NgodingProgress;
  onSelectLevel: (levelNum: number) => void;
  onOpenGlossary: () => void;
}

export default function NgodingRoadmapView({
  curriculum,
  progress,
  onSelectLevel,
  onOpenGlossary,
}: Props) {
  const [activeTrackId, setActiveTrackId] = useState<string>("dasar");

  const currentTrack = TRACKS.find((t) => t.id === activeTrackId) || TRACKS[0];
  const completedCount = progress.completedLevelIds.length;
  const totalLevels = curriculum.length;
  const progressPercent = Math.round((completedCount / totalLevels) * 100);

  // Filter lessons ONLY for the active track
  const trackLessons = curriculum.filter((l) => l.track === activeTrackId);

  // Check if level is unlocked (Level 1 is always unlocked; next is unlocked if previous is done)
  const isLevelUnlocked = (levelNum: number) => {
    if (levelNum === 1) return true;
    const prevLesson = curriculum.find((l) => l.level === levelNum - 1);
    if (!prevLesson) return true;
    return progress.completedLevelIds.includes(prevLesson.id);
  };

  const isLevelDone = (lessonId: string) => progress.completedLevelIds.includes(lessonId);

  // Find the primary active quest in this track (first unlocked but not done, or first if none done, or last if all done)
  const activeTrackQuest =
    trackLessons.find((l) => isLevelUnlocked(l.level) && !isLevelDone(l.id)) ||
    trackLessons[0];

  const isActiveQuestUnlocked = activeTrackQuest ? isLevelUnlocked(activeTrackQuest.level) : false;
  const isActiveQuestDone = activeTrackQuest ? isLevelDone(activeTrackQuest.id) : false;

  return (
    <div className="space-y-3.5 max-w-2xl mx-auto pb-12 animate-fadeIn">
      {/* Gamification HUD Summary */}
      <div className="surface-card rounded-2xl border border-hairline/80 p-3.5 sm:p-4 space-y-3 shadow-xs">
        <div className="flex items-center justify-between gap-2 flex-wrap sm:flex-nowrap">
          {/* Streak & XP Badges */}
          <div className="flex items-center gap-2">
            <div className="inline-flex h-7.5 items-center gap-1.5 rounded-xl bg-orange-500/15 border border-orange-500/30 px-2.5 text-xs font-bold text-orange-400">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" className="size-3.5 text-orange-400">
                <path d="M8.5 14.5A2.5 2.5 0 0 0 11 12c0-1.38-.5-2-1-3-1.072-2.143-.224-4.054 2-6 .5 2.5 2 4.9 4 6.5 2 1.6 3 3.5 3 5.5a7 7 0 1 1-14 0c0-1.153.433-2.294 1-3a2.5 2.5 0 0 0 2.5 3z" />
              </svg>
              <span>{progress.streak} Hari Streak</span>
            </div>

            <div className="inline-flex h-7.5 items-center gap-1.5 rounded-xl bg-ember/15 border border-ember/30 px-2.5 text-xs font-bold text-ember">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" className="size-3.5 text-ember">
                <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
              </svg>
              <span>{progress.xp} Total XP</span>
            </div>
          </div>

          {/* Glossary Button */}
          <button
            type="button"
            onClick={onOpenGlossary}
            className="flex h-7.5 items-center gap-1.5 rounded-xl border border-hairline bg-surface-raised/70 px-2.5 text-xs font-semibold text-muted hover:text-ink hover:border-ember/40 transition-colors"
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="size-3.5 text-ember">
              <path d="M4 19.5v-15A2.5 2.5 0 0 1 6.5 2H20v20H6.5a2.5 2.5 0 0 1-2.5-2.5Z" />
              <path d="M6 6h10" />
            </svg>
            <span>Kamus Istilah</span>
          </button>
        </div>

        {/* Progress Bar */}
        <div className="space-y-1 pt-0.5">
          <div className="flex items-center justify-between text-micro font-mono text-muted">
            <span>Petualangan Belajar</span>
            <span>{completedCount}/{totalLevels} Selesai ({progressPercent}%)</span>
          </div>
          <div className="w-full h-2 rounded-full bg-surface-raised border border-hairline/60 overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-ember-lo to-ember transition-all duration-500 rounded-full"
              style={{ width: `${progressPercent}%` }}
            />
          </div>
        </div>
      </div>

      {/* Track Selector Tabs */}
      <div className="grid grid-cols-3 h-9 items-center rounded-xl border border-hairline bg-surface/70 p-1 w-full gap-1 shadow-xs">
        {TRACKS.map((t) => {
          const isActive = t.id === activeTrackId;
          return (
            <button
              key={t.id}
              type="button"
              onClick={() => setActiveTrackId(t.id)}
              className={`flex h-7 items-center justify-center gap-1.5 rounded-lg px-2 text-xs font-bold transition-all ${
                isActive
                  ? "bg-ember text-obsidian shadow-sm"
                  : "text-muted hover:text-ink hover:bg-surface-raised/40"
              }`}
            >
              <span className="truncate">{t.shortName}</span>
            </button>
          );
        })}
      </div>

      {/* Primary Highlight Hero Quest Card */}
      {activeTrackQuest && (
        <div className="surface-card rounded-2xl border-2 border-ember bg-gradient-to-br from-ember/15 via-ember/5 to-transparent p-4 sm:p-5 space-y-3 shadow-lg shadow-ember/10">
          <div className="flex items-center justify-between">
            <span className="inline-flex h-5.5 items-center rounded-md bg-ember/20 px-2 font-mono text-[10px] font-bold text-ember border border-ember/40">
              MISI UTAMA · LEVEL {activeTrackQuest.level}
            </span>
            <span className="text-micro font-mono text-muted bg-surface-raised/80 px-2 py-0.5 rounded border border-hairline/60">
              +{activeTrackQuest.xpReward} XP
            </span>
          </div>

          <div className="space-y-1">
            <div className="text-micro font-mono text-muted/90 uppercase tracking-wider">{activeTrackQuest.topic}</div>
            <h3 className="font-display text-base sm:text-lg font-bold text-ink">{activeTrackQuest.title}</h3>
            <p className="text-xs text-muted leading-relaxed line-clamp-2">{activeTrackQuest.analogy}</p>
          </div>

          <div className="pt-1">
            {isActiveQuestUnlocked ? (
              <button
                type="button"
                onClick={() => onSelectLevel(activeTrackQuest.level)}
                className="w-full flex h-10 items-center justify-center gap-2 rounded-xl bg-ember px-4 font-display text-xs sm:text-sm font-bold text-obsidian hover:bg-ember-lo active:scale-[0.99] transition-all shadow-md shadow-ember/25"
              >
                <span>{isActiveQuestDone ? "Ulangi Misi Ini 🔄" : "Mulai Misi Level " + activeTrackQuest.level + " 🚀"}</span>
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="size-4">
                  <path d="M5 12h14M12 5l7 7-7 7" />
                </svg>
              </button>
            ) : (
              <div className="flex h-9 items-center justify-center rounded-xl bg-surface-raised text-xs text-muted font-medium border border-hairline">
                🔒 Selesaikan level sebelumnya untuk membuka
              </div>
            )}
          </div>
        </div>
      )}

      {/* Compact Track Level List (Zero-Clutter) */}
      <div className="space-y-1.5">
        <div className="flex items-center justify-between px-1 text-micro font-mono text-muted uppercase">
          <span>Daftar Level ({currentTrack.name})</span>
          <span>{trackLessons.filter((l) => isLevelDone(l.id)).length}/{trackLessons.length} Selesai</span>
        </div>

        <div className="space-y-1.5">
          {trackLessons.map((lesson) => {
            const unlocked = isLevelUnlocked(lesson.level);
            const completed = isLevelDone(lesson.id);
            const isCurrentHero = activeTrackQuest?.id === lesson.id;

            return (
              <div
                key={lesson.id}
                className={`flex items-center justify-between gap-2.5 rounded-xl border px-3 py-2 transition-all ${
                  completed
                    ? "border-emerald-500/30 bg-emerald-500/[0.04] text-ink"
                    : isCurrentHero
                    ? "border-ember/60 bg-ember/[0.06] text-ink"
                    : unlocked
                    ? "border-hairline bg-surface/70 hover:border-ember/30 text-ink"
                    : "border-hairline/30 bg-surface/20 text-muted/60 opacity-60"
                }`}
              >
                {/* Left indicator & Title */}
                <div className="flex items-center gap-2.5 min-w-0 flex-1">
                  <span
                    className={`inline-flex size-6 shrink-0 items-center justify-center rounded-md font-mono text-[10px] font-bold border ${
                      completed
                        ? "bg-emerald-500/20 text-emerald-400 border-emerald-500/40"
                        : unlocked
                        ? "bg-ember/20 text-ember border-ember/40"
                        : "bg-surface-raised text-muted/60 border-hairline/40"
                    }`}
                  >
                    {completed ? "✓" : lesson.level}
                  </span>

                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5">
                      <span className="font-display text-xs font-bold truncate text-ink">
                        {lesson.title}
                      </span>
                      {completed && <span className="text-[10px] text-amber-400 shrink-0">⭐⭐⭐</span>}
                    </div>
                    <span className="text-[10px] font-mono text-muted truncate block">
                      {lesson.topic}
                    </span>
                  </div>
                </div>

                {/* Right Action */}
                <div className="shrink-0">
                  {unlocked ? (
                    <button
                      type="button"
                      onClick={() => onSelectLevel(lesson.level)}
                      className={`h-7 px-2.5 rounded-lg font-display text-[11px] font-bold transition-all active:scale-95 ${
                        completed
                          ? "bg-surface-raised border border-emerald-500/30 text-emerald-400 hover:bg-emerald-500/10"
                          : "bg-ember text-obsidian hover:bg-ember-lo"
                      }`}
                    >
                      {completed ? "Ulangi" : "Mulai"}
                    </button>
                  ) : (
                    <span className="text-micro font-mono text-muted/40 px-2 py-0.5">
                      🔒 Terkunci
                    </span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
