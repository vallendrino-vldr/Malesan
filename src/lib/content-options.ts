/**
 * Human-facing choices for Ide Hari Ini.
 *
 * Kept provider-neutral and importable by both the client form and the server
 * prompt so a label can never drift between what the creator picked and what
 * the model receives.
 */
export const TODAY_PLATFORMS = [
  { id: "tiktok_reels", label: "TikTok / Reels", hint: "Video pendek" },
  { id: "youtube_shorts", label: "YouTube Shorts", hint: "Video pencarian" },
  { id: "x", label: "X", hint: "Post atau thread" },
  { id: "threads", label: "Threads", hint: "Obrolan berseri" },
  { id: "facebook", label: "Facebook", hint: "Cerita yang relate" },
  { id: "linkedin", label: "LinkedIn", hint: "Insight profesional" },
] as const;

export type TodayPlatform = (typeof TODAY_PLATFORMS)[number]["id"];

export const TODAY_GOALS = [
  { id: "views", label: "Cari views" },
  { id: "sales", label: "Jualan" },
  { id: "branding", label: "Bangun nama" },
  { id: "education", label: "Edukasi" },
  { id: "engagement", label: "Ajak ngobrol" },
] as const;

export type TodayGoal = (typeof TODAY_GOALS)[number]["id"];

export function normalizeTodayPlatform(value: unknown): TodayPlatform {
  // Old clients and saved requests used these three values. Preserve them
  // while the UI moves to the clearer grouped labels.
  if (value === "tiktok" || value === "instagram") return "tiktok_reels";
  if (value === "youtube") return "youtube_shorts";
  return TODAY_PLATFORMS.some((option) => option.id === value)
    ? (value as TodayPlatform)
    : "tiktok_reels";
}

export function normalizeTodayGoal(value: unknown): TodayGoal {
  return TODAY_GOALS.some((option) => option.id === value)
    ? (value as TodayGoal)
    : "views";
}

export function todayPlatformLabel(value: TodayPlatform): string {
  return TODAY_PLATFORMS.find((option) => option.id === value)?.label ?? "TikTok / Reels";
}

export function todayGoalLabel(value: TodayGoal): string {
  return TODAY_GOALS.find((option) => option.id === value)?.label ?? "Cari views";
}
