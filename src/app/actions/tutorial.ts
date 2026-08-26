"use server";

import { createClient, createServiceRoleClient } from "@/lib/supabase/server";
import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import {
  type TutorialRewardStatus,
  type ClaimRewardResult,
  TUTORIAL_REASON,
  TUTORIAL_BONUS_AMOUNT,
  PENDING_BONUS_COOKIE,
} from "@/lib/tutorial";

/**
 * Checks whether the current user has already claimed the 10 credit demo bonus.
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

  // Check in credit_ledger if user already received demo_watch_bonus or tutorial_watch_bonus
  const { data: existingLedger } = await serviceRole
    .from("credit_ledger")
    .select("id")
    .eq("user_id", user.id)
    .in("reason", [TUTORIAL_REASON, "tutorial_watch_bonus"])
    .limit(1);

  const hasClaimed = Boolean(existingLedger && existingLedger.length > 0);

  const { data: profile } = await serviceRole
    .from("profiles")
    .select("credits_free, credits_paid")
    .eq("id", user.id)
    .single();

  const total = (profile?.credits_free ?? 0) + (profile?.credits_paid ?? 0);

  return {
    isLoggedIn: true,
    hasClaimed,
    userId: user.id,
    totalCredits: total,
  };
}

/**
 * Atomically grants 10 permanent bonus credits to the user.
 * Idempotent: checks credit_ledger before granting.
 */
export async function grantDemoBonusToUser(userId: string): Promise<ClaimRewardResult> {
  const serviceRole = createServiceRoleClient();

  // 1. Idempotency Check: Verify user hasn't already claimed
  const { data: existingLedger } = await serviceRole
    .from("credit_ledger")
    .select("id")
    .eq("user_id", userId)
    .in("reason", [TUTORIAL_REASON, "tutorial_watch_bonus"])
    .limit(1);

  if (existingLedger && existingLedger.length > 0) {
    return {
      success: false,
      alreadyClaimed: true,
      error: "Bonus 10 kredit demo sudah pernah diklaim sebelumnya.",
    };
  }

  // 2. Grant credits to 'paid' (permanent bonus bucket that never gets wiped by daily refill)
  const { data: newBalance, error: grantError } = await serviceRole.rpc(
    "grant_credits",
    {
      p_user: userId,
      p_amount: TUTORIAL_BONUS_AMOUNT,
      p_bucket: "paid",
      p_reason: TUTORIAL_REASON,
      p_ref: `demo_bonus_${userId.slice(0, 8)}`,
    },
  );

  if (grantError) {
    console.error("grant_credits failed for demo reward:", grantError);
    return {
      success: false,
      error: "Gagal menambahkan bonus kredit ke akun. Coba lagi sebentar lagi.",
    };
  }

  // Clear pending bonus cookie if present
  try {
    const cookieStore = await cookies();
    cookieStore.delete(PENDING_BONUS_COOKIE);
  } catch {}

  revalidatePath("/app");
  revalidatePath("/app/profile");

  return {
    success: true,
    creditsAdded: TUTORIAL_BONUS_AMOUNT,
    newBalance: Number(newBalance ?? 0),
    message: "🎉 Selamat! +10 Kredit Bonus berhasil masuk ke saldo akun lo!",
  };
}

/**
 * Server Action called by the Video Player.
 */
export async function claimTutorialBonusAction(
  watchTimeSeconds: number,
  videoDurationSeconds: number,
): Promise<ClaimRewardResult> {
  // Anti-cheat verification on the server (at least 85% of duration watched)
  if (videoDurationSeconds <= 0 || watchTimeSeconds < videoDurationSeconds * 0.85) {
    return {
      success: false,
      error: "Tonton minimal 90% video untuk klaim bonus kredit ya!",
    };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return {
      success: false,
      error: "Sesi login belum terdeteksi. Silakan masuk dulu untuk klaim bonus kredit.",
    };
  }

  return grantDemoBonusToUser(user.id);
}
