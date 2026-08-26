"use server";

import { createClient, createServiceRoleClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";

export type TutorialRewardStatus = {
  isLoggedIn: boolean;
  hasClaimed: boolean;
  userId?: string;
  creditsFree?: number;
};

export type ClaimRewardResult =
  | { success: true; creditsAdded: number; newBalance: number; message: string }
  | { success: false; alreadyClaimed?: boolean; error: string };

const TUTORIAL_REASON = "tutorial_watch_bonus";
const TUTORIAL_BONUS_AMOUNT = 10;

/**
 * Checks whether the current user has already claimed the 10 credit tutorial bonus.
 */
export async function getTutorialRewardStatus(): Promise<TutorialRewardStatus> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { isLoggedIn: false, hasClaimed: false };
  }

  const serviceRole = createServiceRoleClient();

  // Check in credit_ledger if user already received tutorial_watch_bonus
  const { data: existingLedger } = await serviceRole
    .from("credit_ledger")
    .select("id")
    .eq("user_id", user.id)
    .eq("reason", TUTORIAL_REASON)
    .limit(1);

  const hasClaimed = Boolean(existingLedger && existingLedger.length > 0);

  const { data: profile } = await serviceRole
    .from("profiles")
    .select("credits_free")
    .eq("id", user.id)
    .single();

  return {
    isLoggedIn: true,
    hasClaimed,
    userId: user.id,
    creditsFree: profile?.credits_free ?? 0,
  };
}

/**
 * Atomically claims the 10 credit tutorial bonus for the logged-in user.
 * 100% idempotent: will not grant twice if already present in ledger.
 */
export async function claimTutorialBonusAction(
  watchTimeSeconds: number,
  videoDurationSeconds: number,
): Promise<ClaimRewardResult> {
  // Anti-cheat verification on the server
  if (videoDurationSeconds <= 0 || watchTimeSeconds < videoDurationSeconds * 0.85) {
    return {
      success: false,
      error: "Waktu tonton belum mencukupi untuk klaim bonus. Tonton minimal 90% video ya!",
    };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return {
      success: false,
      error: "Sesi login lo belum terdeteksi. Silakan masuk dulu untuk klaim bonus kredit.",
    };
  }

  const serviceRole = createServiceRoleClient();

  // 1. Idempotency Check: Verify user hasn't already claimed
  const { data: existingLedger } = await serviceRole
    .from("credit_ledger")
    .select("id")
    .eq("user_id", user.id)
    .eq("reason", TUTORIAL_REASON)
    .limit(1);

  if (existingLedger && existingLedger.length > 0) {
    return {
      success: false,
      alreadyClaimed: true,
      error: "Lo udah pernah klaim bonus 10 kredit tutorial ini sebelumnya!",
    };
  }

  // 2. Grant credits atomically via SQL RPC
  const { data: newBalance, error: grantError } = await serviceRole.rpc(
    "grant_credits",
    {
      p_user: user.id,
      p_amount: TUTORIAL_BONUS_AMOUNT,
      p_bucket: "free",
      p_reason: TUTORIAL_REASON,
      p_ref: `tutorial_bonus_${user.id.slice(0, 8)}`,
    },
  );

  if (grantError) {
    console.error("grant_credits failed for tutorial reward:", grantError);
    return {
      success: false,
      error: "Gagal menambahkan bonus kredit ke akun. Coba beberapa saat lagi ya.",
    };
  }

  revalidatePath("/app");
  revalidatePath("/app/profile");

  return {
    success: true,
    creditsAdded: TUTORIAL_BONUS_AMOUNT,
    newBalance: Number(newBalance ?? 0),
    message: "🎉 Selamat! 10 Kredit Gratis berhasil ditambahkan ke akun lo!",
  };
}
