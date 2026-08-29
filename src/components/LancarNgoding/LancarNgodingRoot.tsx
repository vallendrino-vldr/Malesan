"use client";

import React, { useState } from "react";
import rawCurriculum from "@/data/lancar-ngoding-curriculum.json";
import { getNgodingProgress, markLevelCompleted, NgodingProgress } from "@/lib/ngoding-progress";
import { LessonItem } from "./StepLearnView";
import NgodingRoadmapView from "./NgodingRoadmapView";
import NgodingQuestPlayer from "./NgodingQuestPlayer";
import GlossaryModal from "./GlossaryModal";

const CURRICULUM = rawCurriculum as LessonItem[];

export default function LancarNgodingRoot() {
  const [progress, setProgress] = useState<NgodingProgress>(() => getNgodingProgress());
  const [selectedLevelNum, setSelectedLevelNum] = useState<number | null>(null);
  const [isGlossaryOpen, setIsGlossaryOpen] = useState(false);

  // Find active lesson object if in Quest mode
  const activeLesson = selectedLevelNum
    ? CURRICULUM.find((l) => l.level === selectedLevelNum) || CURRICULUM[0]
    : null;

  const handleLevelSuccess = (xpEarned: number) => {
    if (!activeLesson) return;
    const nextLesson = CURRICULUM.find((l) => l.level === activeLesson.level + 1);
    const updated = markLevelCompleted(
      activeLesson.id,
      xpEarned,
      nextLesson ? nextLesson.id : undefined
    );
    setProgress(updated);
  };

  const handleNextLevel = () => {
    if (!activeLesson) return;
    const nextLesson = CURRICULUM.find((l) => l.level === activeLesson.level + 1);
    if (nextLesson) {
      setSelectedLevelNum(nextLesson.level);
    } else {
      setSelectedLevelNum(null); // Back to roadmap if finished all
    }
  };

  return (
    <div className="w-full">
      {selectedLevelNum === null || !activeLesson ? (
        <NgodingRoadmapView
          curriculum={CURRICULUM}
          progress={progress}
          onSelectLevel={(lvl) => setSelectedLevelNum(lvl)}
          onOpenGlossary={() => setIsGlossaryOpen(true)}
        />
      ) : (
        <NgodingQuestPlayer
          key={activeLesson.id}
          lesson={activeLesson}
          isCompleted={progress.completedLevelIds.includes(activeLesson.id)}
          onSuccess={handleLevelSuccess}
          onNextLevel={handleNextLevel}
          onBackToRoadmap={() => setSelectedLevelNum(null)}
        />
      )}

      {/* Glossary Modal */}
      <GlossaryModal
        isOpen={isGlossaryOpen}
        onClose={() => setIsGlossaryOpen(false)}
      />
    </div>
  );
}
