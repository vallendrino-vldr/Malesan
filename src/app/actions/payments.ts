"use server";

import { createClient, createServiceRoleClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";

export async function submitTopup(amountIdr: number, credits: number, method: "bank_transfer" | "qris" | "voucher" | "manual_admin", proofUrl: string) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Unauthorized");

  const { error } = await supabase.from("topups").insert({
    user_id: user.id,
    amount_idr: amountIdr,
    credits,
    method,
    proof_url: proofUrl,
    status: "pending",
  });

  if (error) throw new Error("Failed to submit topup");
  revalidatePath("/app/topup");
}

export async function redeemVoucher(code: string) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Unauthorized");

  const serviceRole = createServiceRoleClient();
  
  // Need a transaction-like approach: mark voucher as redeemed, then grant credits
  // We can't do true transaction easily from edge functions without RPC, but we can try an optimistic update
  const { data: voucher, error: fetchError } = await serviceRole
    .from("vouchers")
    .update({ is_redeemed: true, redeemed_by: user.id, redeemed_at: new Date().toISOString() })
    .eq("code", code)
    .eq("is_redeemed", false)
    .select()
    .single();

  if (fetchError || !voucher) {
    throw new Error("Voucher invalid or already redeemed");
  }

  // Grant credits
  try {
    await serviceRole.rpc("grant_credits", {
      p_user: user.id,
      p_amount: voucher.credits,
      p_bucket: "paid",
      p_reason: `voucher_redemption_${code}`
    });
  } catch (err) {
    // If credit grant fails, rollback voucher
    await serviceRole
      .from("vouchers")
      .update({ is_redeemed: false, redeemed_by: null, redeemed_at: null })
      .eq("code", code);
    throw new Error("Failed to grant credits");
  }

  revalidatePath("/app");
  return voucher.credits;
}

export async function processReferral(refereeId: string) {
  const serviceRole = createServiceRoleClient();

  // Check if referee was referred by someone and hasn't been credited yet
  const { data: profile } = await serviceRole
    .from("profiles")
    .select("referred_by")
    .eq("id", refereeId)
    .single();

  if (!profile || !profile.referred_by) return;

  // Insert referral row if it doesn't exist
  const { data: existingRef } = await serviceRole
    .from("referrals")
    .select("*")
    .eq("referee_id", refereeId)
    .single();

  if (!existingRef) {
    const { error: insertError } = await serviceRole.from("referrals").insert({
      referrer_id: profile.referred_by,
      referee_id: refereeId,
      status: "credited", // we credit immediately upon first gen
      credited_at: new Date().toISOString()
    });

    if (insertError) {
      // 23505 is Postgres unique_violation. If it hits this, another thread just inserted it.
      if (insertError.code === "23505") return;
      throw insertError;
    }

    // Grant credits to both
    await serviceRole.rpc("grant_credits", {
      p_user: profile.referred_by,
      p_amount: 10,
      p_bucket: "paid",
      p_reason: `referral_bonus_from_${refereeId}`
    });

    await serviceRole.rpc("grant_credits", {
      p_user: refereeId,
      p_amount: 10,
      p_bucket: "paid",
      p_reason: `referral_bonus_joined_via_${profile.referred_by}`
    });
  }
}
