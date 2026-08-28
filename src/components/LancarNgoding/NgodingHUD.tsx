"use client";

import React from "react";
import { NgodingProgress } from "@/lib/ngoding-progress";

export interface TrackMeta {
  id: string;
  name: string;
  shortName: string;
  icon: string;
  desc: string;
  levelRange: [number, number];
}

export const TRACKS: TrackMeta[] = [
  {
    id: "dasar",
    name: "Track 1: Fondasi Logika",
    shortName: "1. Logika Dasar",
    icon: "🚀",
    desc: "Variabel, If/Else, Array, Loop & Cara Komputer Berpikir",
    levelRange: [1, 10],
  },
  {
    id: "menengah",
    name: "Track 2: Interaktif & Modern Web",
    shortName: "2. Interaktif Web",
    icon: "⚡",
    desc: "Event, DOM, State, Fetch API & Tarik Data Internet",
    levelRange: [11, 18],
  },
  {
    id: "mahir",
    name: "Track 3: Fullstack & AI Builder",
    shortName: "3. Fullstack AI",
    icon: "👑",
    desc: "Database Supabase, Server Logic & Bikin AI App Sendiri",
    levelRange: [19, 24],
  },
];

interface Props {
  progress: NgodingProgress;
  activeTrackId: string;
  onSelectTrack: (trackId: string) => void;
  activeLevelNum: number;
  onSelectLevel: (levelNum: number) => void;
  totalLevels: number;
  onOpenGlossary: () => void;
}

export default function NgodingHUD({
  progress,
  activeTrackId,
  onSelectTrack,
  activeLevelNum,
  onSelectLevel,
  totalLevels,
  onOpenGlossary,
}: Props) {
  const currentTrack = TRACKS.find((t) => t.id === activeTrackId) || TRACKS[0];
  const completedCount = progress.completedLevelIds.length;
  const progressPercent = Math.round((completedCount / totalLevels) * 100);

  // Generate levels for active track
  const [startLvl, endLvl] = currentTrack.levelRange;
  const trackLevels: number[] = [];
  for (let i = startLvl; i <= endLvl; i++) {
    trackLevels.push(i);
  }

  return (
    <div className="surface-card rounded-2xl border border-hairline/80 p-3.5 sm:p-4.5 space-y-3.5 shadow-xs">
      {/* Top HUD: Streak, XP, Glossary Action */}
      <div className="flex items-center justify-between gap-2 flex-wrap sm:flex-nowrap">
        {/* Streak & XP Badges */}
        <div className="flex items-center gap-2">
          {/* Streak Counter */}
          <div className="inline-flex h-7.5 items-center gap-1.5 rounded-lg bg-orange-500/15 border border-orange-500/30 px-2.5 text-xs font-bold text-orange-400">
            <span className="text-sm">🔥</span>
            <span>{progress.streak} Hari Streak</span>
          </div>

          {/* XP Counter */}
          <div className="inline-flex h-7.5 items-center gap-1.5 rounded-lg bg-ember/15 border border-ember/30 px-2.5 text-xs font-bold text-ember">
            <span className="text-sm">⚡</span>
            <span>{progress.xp} XP</span>
          </div>
        </div>

        {/* Right side: Progress Bar & Kamus */}
        <div className="flex items-center gap-2 w-full sm:w-auto justify-between sm:justify-end">
          {/* Progress Indicator */}
          <div className="flex items-center gap-2">
            <span className="text-micro font-mono text-muted">
              {completedCount}/{totalLevels} Selesai ({progressPercent}%)
            </span>
            <div className="w-16 sm:w-24 h-2 rounded-full bg-surface-raised border border-hairline/60 overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-ember-lo to-ember transition-all duration-500"
                style={{ width: `${progressPercent}%` }}
              />
            </div>
          </div>

          {/* Kamus Button */}
          <button
            type="button"
            onClick={onOpenGlossary}
            className="flex h-7.5 items-center gap-1.5 rounded-lg border border-hairline bg-surface-raised/70 px-2.5 text-xs font-semibold text-muted hover:text-ink hover:border-ember/40 transition-colors shrink-0"
            title="Kamus istilah coding"
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="size-3.5 text-ember">
              <path d="M4 19.5v-15A2.5 2.5 0 0 1 6.5 2H20v20H6.5a2.5 2.5 0 0 1-2.5-2.5Z" />
              <path d="M6 6h10" />
            </svg>
            <span>Kamus</span>
          </button>
        </div>
      </div>

      {/* Track Tabs Switcher */}
      <div className="grid grid-cols-3 h-8.5 items-center rounded-xl border border-hairline bg-surface/70 p-0.5 w-full">
        {TRACKS.map((t) => {
          const isActive = t.id === activeTrackId;
          return (
            <button
              key={t.id}
              type="button"
              onClick={() => {
                onSelectTrack(t.id);
                onSelectLevel(t.levelRange[0]);
              }}
              className={`flex h-7.5 items-center justify-center gap-1 rounded-lg px-1.5 text-xs font-semibold transition-all ${
                isActive
                  ? "bg-surface-raised text-ink shadow-xs border border-ember/30 text-ember"
                  : "text-muted hover:text-ink"
              }`}
            >
              <span className="text-xs">{t.icon}</span>
              <span className="truncate">{t.shortName}</span>
            </button>
          );
        })}
      </div>

      {/* Level Numbers Strip */}
      <div className="flex items-center gap-1.5 overflow-x-auto pb-1 custom-scrollbar">
        {trackLevels.map((lvl) => {
          const isSelected = lvl === activeLevelNum;
          // Check if this level index in curriculum is completed
          const isCompleted = progress.completedLevelIds.some(
            (id) => id.includes(`lvl${lvl}_`) || id.includes(`_lvl${lvl}_`) || id.includes(`lvl${lvl}`)
          );

          return (
            <button
              key={lvl}
              type="button"
              onClick={() => onSelectLevel(lvl)}
              className={`flex size-8 shrink-0 items-center justify-center rounded-lg text-xs font-bold font-mono transition-all ${
                isSelected
                  ? "bg-ember text-obsidian shadow-[0_0_10px_rgba(255,138,61,0.5)] scale-105"
                  : isCompleted
                  ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/40"
                  : "bg-surface-raised/70 text-muted border border-hairline/60 hover:text-ink hover:border-hairline"
              }`}
              title={`Level ${lvl} ${isCompleted ? "(Selesai)" : ""}`}
            >
              {isCompleted ? "✓" : lvl}
            </button>
          );
        })}
      </div>
    </div>
  );
}
