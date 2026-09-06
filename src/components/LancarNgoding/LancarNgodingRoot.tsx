"use client";

import React, { useState } from "react";
import { getCurriculum } from "@/lib/curriculum";
import { useLanguage } from "@/lib/i18n/LanguageContext";
import { getNgodingProgress, markLevelCompleted, NgodingProgress } from "@/lib/ngoding-progress";
import NgodingRoadmapView from "./NgodingRoadmapView";
import NgodingQuestPlayer from "./NgodingQuestPlayer";
import GlossaryModal from "./GlossaryModal";

export default function LancarNgodingRoot() {
  const { language } = useLanguage();
  const curriculum = getCurriculum(language);
  const [progress, setProgress] = useState<NgodingProgress>(() => getNgodingProgress());
  const [selectedLevelNum, setSelectedLevelNum] = useState<number | null>(null);
  const [isGlossaryOpen, setIsGlossaryOpen] = useState(false);

  // Find active lesson object if in Quest mode
  const activeLesson = selectedLevelNum
    ? curriculum.find((l) => l.level === selectedLevelNum) || curriculum[0]
    : null;

  const handleLevelSuccess = (xpEarned: number) => {
    if (!activeLesson) return;
    const nextLesson = curriculum.find((l) => l.level === activeLesson.level + 1);
    const updated = markLevelCompleted(
      activeLesson.id,
      xpEarned,
      nextLesson ? nextLesson.id : undefined
    );
    setProgress(updated);
  };

  const handleNextLevel = () => {
    if (!activeLesson) return;
    const nextLesson = curriculum.find((l) => l.level === activeLesson.level + 1);
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
          curriculum={curriculum}
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
