import "server-only";

import { createServiceRoleClient } from "@/lib/supabase/server";

/**
 * Internal helper for processing referral bonuses upon a user's first generation.
 *
 * Placed in a pure server library (without "use server") so that it cannot be
 * invoked directly as a public client Server Action endpoint.
 */
export async function processReferral(refereeId: string) {
  if (!refereeId || typeof refereeId !== "string") return;
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
      credited_at: new Date().toISOString(),
    });

    if (insertError) {
      // 23505 is Postgres unique_violation. If it hits this, another thread just inserted it.
      if (insertError.code === "23505") return;
      throw insertError;
    }

    // Both sides, and both results checked. `.rpc()` does not throw.
    const [a, b] = await Promise.all([
      serviceRole.rpc("grant_credits", {
        p_user: profile.referred_by,
        p_amount: 10,
        p_bucket: "paid",
        p_reason: `referral_bonus_from_${refereeId}`,
      }),
      serviceRole.rpc("grant_credits", {
        p_user: refereeId,
        p_amount: 10,
        p_bucket: "paid",
        p_reason: `referral_bonus_joined_via_${profile.referred_by}`,
      }),
    ]);

    if (a.error || b.error) {
      await serviceRole
        .from("referrals")
        .update({
          status: "voided",
          void_reason: `grant failed: ${a.error?.message ?? ""} ${b.error?.message ?? ""}`.trim(),
        })
        .eq("referee_id", refereeId);
    }
  }
}
