import { createServiceRoleClient } from "@/lib/supabase/server";

/**
 * Spending and refunding credits.
 *
 * This exists because every route got the same thing wrong, in the same way.
 * They all wrote:
 *
 *     try {
 *       await serviceRole.rpc("spend_credits", {...});
 *     } catch (err) {
 *       if (err.message.includes("INSUFFICIENT_CREDITS")) return 402;
 *     }
 *
 * `supabase.rpc()` resolves with `{ data, error }`. It does **not** reject on a
 * Postgres error, so that `catch` never ran. A user at zero credits sailed
 * straight past the guard and generated for free: the ledger shows spends for
 * `ide_hari_ini` and nothing at all for the hook, script and vibe_kit rows
 * created in the same minutes, with the balance sitting at 0 the whole time.
 *
 * Routing every spend through here makes the failure impossible to ignore —
 * the result has to be inspected to get the ref back out.
 */

export type SpendResult =
  | { ok: true; ref: string }
  | { ok: false; reason: "insufficient" | "error"; message: string };

export async function spendCredits(
  userId: string,
  amount: number,
  reason: string,
): Promise<SpendResult> {
  const ref = crypto.randomUUID();
  const { error } = await createServiceRoleClient().rpc("spend_credits", {
    p_user: userId,
    p_amount: amount,
    p_reason: reason,
    p_ref: ref,
  });

  if (!error) return { ok: true, ref };

  // The RPC raises INSUFFICIENT_CREDITS; surface that as its own case so the
  // caller can answer 402 rather than a generic 500.
  const text = `${error.message ?? ""} ${error.details ?? ""} ${error.hint ?? ""}`;
  if (text.includes("INSUFFICIENT_CREDITS")) {
    return {
      ok: false,
      reason: "insufficient",
      message: "Kredit lo abis. Besok jam 00:00 direfill, atau top up biar gak nunggu.",
    };
  }

  console.error("spend_credits failed", reason, error);
  return {
    ok: false,
    reason: "error",
    message: "Gagal motong kredit. Coba lagi sebentar lagi ya.",
  };
}

/**
 * Reverse a spend exactly, bucket for bucket, using its ref. Best-effort: a
 * failed refund must be logged, never thrown into the user's response, because
 * by this point their generation has already failed and a second error tells
 * them nothing useful.
 */
export async function refundCredits(userId: string, ref: string, reason: string) {
  try {
    const { error } = await createServiceRoleClient().rpc("refund_credits", {
      p_user: userId,
      p_ref: ref,
      p_reason: reason,
    });
    if (error) console.error("refund_credits failed", reason, error);
  } catch (e) {
    console.error("refund_credits threw", reason, e);
  }
}
