"use client";

import React, { useState } from "react";
import rawCurriculum from "@/data/lancar-ngoding-curriculum.json";
import { getNgodingProgress, markLevelCompleted, NgodingProgress } from "@/lib/ngoding-progress";
import NgodingHUD, { TRACKS } from "./NgodingHUD";
import StepLearnView, { LessonItem } from "./StepLearnView";
import StepSandboxView from "./StepSandboxView";
import StepChallengeView from "./StepChallengeView";
import GlossaryModal from "./GlossaryModal";

const CURRICULUM = rawCurriculum as LessonItem[];

export default function LancarNgodingRoot() {
  const [progress, setProgress] = useState<NgodingProgress>(() => getNgodingProgress());
  const [activeTrackId, setActiveTrackId] = useState<string>("dasar");
  const [activeLevelNum, setActiveLevelNum] = useState<number>(1);
  const [activeStep, setActiveStep] = useState<1 | 2 | 3>(1);
  const [isGlossaryOpen, setIsGlossaryOpen] = useState(false);

  // Find current active lesson
  const activeLesson =
    CURRICULUM.find((l) => l.level === activeLevelNum) ||
    CURRICULUM.find((l) => l.track === activeTrackId) ||
    CURRICULUM[0];

  // When level changes, reset step to 1
  const handleSelectLevel = (lvlNum: number) => {
    setActiveLevelNum(lvlNum);
    setActiveStep(1);

    // Auto-switch track if level belongs to another track
    const matchedTrack = TRACKS.find(
      (t) => lvlNum >= t.levelRange[0] && lvlNum <= t.levelRange[1]
    );
    if (matchedTrack && matchedTrack.id !== activeTrackId) {
      setActiveTrackId(matchedTrack.id);
    }
  };

  const handleLessonSuccess = (xpEarned: number) => {
    const nextLesson = CURRICULUM.find((l) => l.level === activeLevelNum + 1);
    const updated = markLevelCompleted(
      activeLesson.id,
      xpEarned,
      nextLesson ? nextLesson.id : undefined
    );
    setProgress(updated);
  };

  const handleNextLevel = () => {
    const nextLesson = CURRICULUM.find((l) => l.level === activeLevelNum + 1);
    if (nextLesson) {
      handleSelectLevel(nextLesson.level);
    } else {
      // Reached the end of curriculum
      setActiveStep(1);
    }
  };

  const isLevelCompleted = progress.completedLevelIds.includes(activeLesson.id);

  return (
    <div className="space-y-4 max-w-3xl mx-auto pb-12">
      {/* HUD Header */}
      <NgodingHUD
        progress={progress}
        activeTrackId={activeTrackId}
        onSelectTrack={(tId) => setActiveTrackId(tId)}
        activeLevelNum={activeLevelNum}
        onSelectLevel={handleSelectLevel}
        totalLevels={CURRICULUM.length}
        onOpenGlossary={() => setIsGlossaryOpen(true)}
      />

      {/* 3-Step Navigation Tabs */}
      <div className="surface-card rounded-xl border border-hairline/70 p-1 flex items-center justify-between gap-1 shadow-xs">
        <button
          type="button"
          onClick={() => setActiveStep(1)}
          className={`flex-1 h-8 flex items-center justify-center gap-1.5 rounded-lg text-xs font-semibold transition-all ${
            activeStep === 1
              ? "bg-ember text-obsidian font-bold shadow-xs"
              : "text-muted hover:text-ink"
          }`}
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="size-3.5">
            <path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z" />
            <path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z" />
          </svg>
          <span className="truncate">1. Pelajari</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveStep(2)}
          className={`flex-1 h-8 flex items-center justify-center gap-1.5 rounded-lg text-xs font-semibold transition-all ${
            activeStep === 2
              ? "bg-ember text-obsidian font-bold shadow-xs"
              : "text-muted hover:text-ink"
          }`}
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="size-3.5">
            <polyline points="16 18 22 12 16 6" />
            <polyline points="8 6 2 12 8 18" />
          </svg>
          <span className="truncate">2. Sandbox</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveStep(3)}
          className={`flex-1 h-8 flex items-center justify-center gap-1.5 rounded-lg text-xs font-semibold transition-all ${
            activeStep === 3
              ? "bg-ember text-obsidian font-bold shadow-xs"
              : "text-muted hover:text-ink"
          }`}
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="size-3.5">
            <path d="M6 9H4.5a2.5 2.5 0 0 1 0-5H6" />
            <path d="M18 9h1.5a2.5 2.5 0 0 0 0-5H18" />
            <path d="M4 22h16" />
            <path d="M10 14.66V17c0 .55-.45 1-1 1H7c-.55 0-1-.45-1-1v-2.34" />
            <path d="M18 14.66V17c0 .55-.45 1-1 1h-2c-.55 0-1-.45-1-1v-2.34" />
            <path d="M6 2h12v7a6 6 0 0 1-12 0V2z" />
          </svg>
          <span className="truncate">3. Tantangan</span>
        </button>
      </div>

      {/* Active Step Content */}
      <div className="animate-fadeIn">
        {activeStep === 1 && (
          <StepLearnView
            key={activeLesson.id}
            lesson={activeLesson}
            onNextStep={() => setActiveStep(2)}
          />
        )}

        {activeStep === 2 && (
          <StepSandboxView
            key={activeLesson.id}
            lesson={activeLesson}
            onNextStep={() => setActiveStep(3)}
            onPrevStep={() => setActiveStep(1)}
          />
        )}

        {activeStep === 3 && (
          <StepChallengeView
            key={activeLesson.id}
            lesson={activeLesson}
            isCompleted={isLevelCompleted}
            onSuccess={handleLessonSuccess}
            onNextLevel={handleNextLevel}
            onPrevStep={() => setActiveStep(2)}
          />
        )}
      </div>

      {/* Glossary Modal */}
      <GlossaryModal
        isOpen={isGlossaryOpen}
        onClose={() => setIsGlossaryOpen(false)}
      />
    </div>
  );
}
