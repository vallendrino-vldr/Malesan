export interface NgodingProgress {
  completedLevelIds: string[];
  currentLevelId: string;
  xp: number;
  streak: number;
  lastActiveDate: string;
  unlockedTracks: string[];
}

const STORAGE_KEY = "malesan_ngoding_progress_v1";

const DEFAULT_PROGRESS: NgodingProgress = {
  completedLevelIds: [],
  currentLevelId: "track1_lvl1_q1",
  xp: 0,
  streak: 1,
  lastActiveDate: new Date().toISOString().slice(0, 10),
  unlockedTracks: ["dasar"],
};

export function getNgodingProgress(): NgodingProgress {
  if (typeof window === "undefined") return DEFAULT_PROGRESS;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_PROGRESS;
    const parsed = JSON.parse(raw) as Partial<NgodingProgress>;
    return {
      completedLevelIds: parsed.completedLevelIds || [],
      currentLevelId: parsed.currentLevelId || "track1_lvl1_q1",
      xp: parsed.xp || 0,
      streak: parsed.streak || 1,
      lastActiveDate: parsed.lastActiveDate || new Date().toISOString().slice(0, 10),
      unlockedTracks: parsed.unlockedTracks || ["dasar"],
    };
  } catch {
    return DEFAULT_PROGRESS;
  }
}

export function saveNgodingProgress(progress: NgodingProgress): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(progress));
  } catch {}
}

export function markLevelCompleted(
  levelId: string,
  xpEarned: number,
  nextLevelId?: string
): NgodingProgress {
  const current = getNgodingProgress();
  const today = new Date().toISOString().slice(0, 10);

  const alreadyCompleted = current.completedLevelIds.includes(levelId);
  const updatedCompleted = alreadyCompleted
    ? current.completedLevelIds
    : [...current.completedLevelIds, levelId];

  // Streak logic
  let newStreak = current.streak;
  if (current.lastActiveDate !== today) {
    const lastDate = new Date(current.lastActiveDate);
    const currentDate = new Date(today);
    const diffDays = Math.round(
      (currentDate.getTime() - lastDate.getTime()) / (1000 * 3600 * 24)
    );

    if (diffDays === 1) {
      newStreak += 1;
    } else if (diffDays > 1) {
      newStreak = 1;
    }
  }

  const updatedProgress: NgodingProgress = {
    ...current,
    completedLevelIds: updatedCompleted,
    currentLevelId: nextLevelId || current.currentLevelId,
    xp: alreadyCompleted ? current.xp : current.xp + xpEarned,
    streak: newStreak,
    lastActiveDate: today,
  };

  saveNgodingProgress(updatedProgress);
  return updatedProgress;
}
