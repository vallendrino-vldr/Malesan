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

  // Filter lessons for active track
  const [startLvl, endLvl] = currentTrack.levelRange;
  const trackLessons = curriculum.filter(
    (l) => l.level >= startLvl && l.level <= endLvl
  );

  // Determine which levels are unlocked
  // Level 1 is always unlocked. Next level is unlocked if previous level is completed.
  const isLevelUnlocked = (levelNum: number) => {
    if (levelNum === 1) return true;
    const prevLesson = curriculum.find((l) => l.level === levelNum - 1);
    if (!prevLesson) return true;
    return progress.completedLevelIds.includes(prevLesson.id);
  };

  const isLevelDone = (lessonId: string) => progress.completedLevelIds.includes(lessonId);

  return (
    <div className="space-y-4 max-w-2xl mx-auto pb-12 animate-fadeIn">
      {/* Gamification HUD Summary */}
      <div className="surface-card rounded-2xl border border-hairline/80 p-4 space-y-3 shadow-xs">
        <div className="flex items-center justify-between gap-2 flex-wrap sm:flex-nowrap">
          {/* Streak & XP Badges */}
          <div className="flex items-center gap-2">
            <div className="inline-flex h-8 items-center gap-1.5 rounded-xl bg-orange-500/15 border border-orange-500/30 px-3 text-xs font-bold text-orange-400">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" className="size-4 text-orange-400">
                <path d="M8.5 14.5A2.5 2.5 0 0 0 11 12c0-1.38-.5-2-1-3-1.072-2.143-.224-4.054 2-6 .5 2.5 2 4.9 4 6.5 2 1.6 3 3.5 3 5.5a7 7 0 1 1-14 0c0-1.153.433-2.294 1-3a2.5 2.5 0 0 0 2.5 3z" />
              </svg>
              <span>{progress.streak} Hari Streak</span>
            </div>

            <div className="inline-flex h-8 items-center gap-1.5 rounded-xl bg-ember/15 border border-ember/30 px-3 text-xs font-bold text-ember">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" className="size-4 text-ember">
                <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
              </svg>
              <span>{progress.xp} Total XP</span>
            </div>
          </div>

          {/* Glossary Button */}
          <button
            type="button"
            onClick={onOpenGlossary}
            className="flex h-8 items-center gap-1.5 rounded-xl border border-hairline bg-surface-raised/70 px-3 text-xs font-semibold text-muted hover:text-ink hover:border-ember/40 transition-colors"
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="size-3.5 text-ember">
              <path d="M4 19.5v-15A2.5 2.5 0 0 1 6.5 2H20v20H6.5a2.5 2.5 0 0 1-2.5-2.5Z" />
              <path d="M6 6h10" />
            </svg>
            <span>Kamus Istilah</span>
          </button>
        </div>

        {/* Progress Bar */}
        <div className="space-y-1.5 pt-1">
          <div className="flex items-center justify-between text-micro font-mono text-muted">
            <span>Petualangan Belajar</span>
            <span>{completedCount}/{totalLevels} Selesai ({progressPercent}%)</span>
          </div>
          <div className="w-full h-2.5 rounded-full bg-surface-raised border border-hairline/60 overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-ember-lo to-ember transition-all duration-500 rounded-full"
              style={{ width: `${progressPercent}%` }}
            />
          </div>
        </div>
      </div>

      {/* Track Selector Tabs */}
      <div className="grid grid-cols-3 h-10 items-center rounded-2xl border border-hairline bg-surface/70 p-1 w-full gap-1 shadow-xs">
        {TRACKS.map((t) => {
          const isActive = t.id === activeTrackId;
          return (
            <button
              key={t.id}
              type="button"
              onClick={() => setActiveTrackId(t.id)}
              className={`flex h-8 items-center justify-center gap-1.5 rounded-xl px-2 text-xs font-bold transition-all ${
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

      {/* Track Overview Banner */}
      <div className="rounded-xl border border-hairline/60 bg-surface-raised/40 p-3 flex items-center justify-between gap-2">
        <div>
          <h3 className="font-display text-xs font-bold text-ember">{currentTrack.name}</h3>
          <p className="text-[11px] text-muted">{currentTrack.desc}</p>
        </div>
        <span className="text-[10px] font-mono text-muted/75 bg-surface px-2 py-0.5 rounded border border-hairline/40 shrink-0">
          Level {startLvl}–{endLvl}
        </span>
      </div>

      {/* Level Roadmap Skill Tree Cards */}
      <div className="space-y-2.5">
        {trackLessons.map((lesson) => {
          const unlocked = isLevelUnlocked(lesson.level);
          const completed = isLevelDone(lesson.id);

          return (
            <div
              key={lesson.id}
              className={`relative surface-card rounded-2xl border p-4 transition-all duration-200 ${
                completed
                  ? "border-emerald-500/40 bg-gradient-to-r from-emerald-500/[0.06] to-transparent shadow-xs"
                  : unlocked
                  ? "border-ember/50 bg-gradient-to-r from-ember/[0.08] to-transparent shadow-sm hover:border-ember"
                  : "border-hairline/40 bg-surface/30 opacity-60"
              }`}
            >
              <div className="flex items-start justify-between gap-3">
                {/* Left info */}
                <div className="space-y-1 flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span
                      className={`inline-flex h-5.5 items-center rounded-md px-2 font-mono text-[10px] font-bold border ${
                        completed
                          ? "bg-emerald-500/20 text-emerald-400 border-emerald-500/40"
                          : unlocked
                          ? "bg-ember/20 text-ember border-ember/40"
                          : "bg-surface-raised text-muted border-hairline"
                      }`}
                    >
                      LEVEL {lesson.level}
                    </span>

                    <span className="text-micro font-medium text-muted tracking-tight">
                      {lesson.topic}
                    </span>

                    {completed && (
                      <span className="inline-flex items-center gap-1 text-emerald-400 font-bold text-micro">
                        <span>✓ Selesai</span>
                        <span className="text-amber-400">⭐⭐⭐</span>
                      </span>
                    )}
                  </div>

                  <h4 className="font-display text-sm sm:text-base font-bold text-ink leading-snug">
                    {lesson.title}
                  </h4>

                  <p className="text-xs text-muted leading-relaxed line-clamp-2">
                    {lesson.analogy}
                  </p>
                </div>

                {/* Right Action Button */}
                <div className="shrink-0 pt-0.5">
                  {unlocked ? (
                    <button
                      type="button"
                      onClick={() => onSelectLevel(lesson.level)}
                      className={`flex h-8.5 items-center gap-1.5 rounded-xl px-3.5 font-display text-xs font-bold transition-all active:scale-95 shadow-sm ${
                        completed
                          ? "bg-surface-raised border border-emerald-500/40 text-emerald-400 hover:bg-emerald-500/15"
                          : "bg-ember text-obsidian hover:bg-ember-lo shadow-ember/20"
                      }`}
                    >
                      <span>{completed ? "Ulangi" : "Mulai Misi"}</span>
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="size-3.5">
                        <path d="M5 12h14M12 5l7 7-7 7" />
                      </svg>
                    </button>
                  ) : (
                    <div className="flex size-8.5 items-center justify-center rounded-xl border border-hairline/60 bg-surface text-muted/60" title="Selesaikan level sebelumnya untuk membuka">
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="size-4">
                        <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
                        <path d="M7 11V7a5 5 0 0 1 10 0v4" />
                      </svg>
                    </div>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
