export type TutorialRewardStatus = {
  isLoggedIn: boolean;
  hasClaimed: boolean;
  userId?: string;
  totalCredits?: number;
};

export type ClaimRewardResult =
  | { success: true; creditsAdded: number; newBalance: number; message: string }
  | { success: false; alreadyClaimed?: boolean; error: string };

export const TUTORIAL_REASON = "demo_watch_bonus";
export const TUTORIAL_BONUS_AMOUNT = 10;
export const PENDING_BONUS_COOKIE = "malesan_pending_demo_bonus";
