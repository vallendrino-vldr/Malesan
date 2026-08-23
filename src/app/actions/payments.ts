"use server";

import { getPaymentConfig, type PaymentConfig } from "@/lib/config";
import { createClient, createServiceRoleClient } from "@/lib/supabase/server";
import type { Json } from "@/lib/supabase/database.types";
import { checkProof } from "@/lib/payments/proof-check";
import { revalidatePath } from "next/cache";

export type CreditPackOption = {
  id: string;
  credits: number;
  price_idr: number;
};

/**
 * Payment details for the top-up page.
 *
 * Not secret — it is a destination account the user is meant to read — but it
 * lives in `app_config` behind admin-only RLS, so the browser cannot query it
 * directly. This is the read path.
 */
export async function paymentSettings(): Promise<PaymentConfig> {
  return getPaymentConfig();
}

/**
 * Active packs for the signed-in top-up screen.
 *
 * The old client query discarded its `{ error }`, so a permission or network
 * failure looked exactly like loading and left three skeleton cards forever.
 * Keep the price source in the database, but make the read explicit after a
 * server-side auth check. The service role never reaches the browser; only the
 * three public fields below do.
 */
export async function activeCreditPacks(): Promise<CreditPackOption[]> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Sesi lo abis. Masuk lagi ya.");

  const { data, error } = await createServiceRoleClient()
    .from("credit_packs")
    .select("id, credits, price_idr")
    .eq("is_active", true)
    .order("sort_order");

  if (error) {
    console.error("active credit packs read failed", error.message);
    throw new Error("Daftar paketnya belum kebaca. Coba muat ulang.");
  }

  return (data ?? []) as CreditPackOption[];
}

/**
 * Submit a bank-transfer top-up for review.
 *
 * The previous signature was `submitTopup(amountIdr, credits, method, proofUrl)`
 * — every one of those came from the browser and was inserted as given. A
 * server action is a public HTTP endpoint, so anyone could call it directly
 * with `credits: 1_000_000, amountIdr: 1` and land a plausible-looking row in
 * the approval queue. The admin's own UI would then show it as a real request.
 *
 * So the client now sends only two things it is allowed to know: which pack it
 * picked, and where it just uploaded its own file. Price and credit count are
 * read from `credit_packs` server-side, and the storage path is required to sit
 * under the caller's own user id so one account cannot claim another's upload.
 *
 * The proof is then read by `checkProof` and the verdict stored on the row. It
 * decides nothing — no credits move without an admin — but the queue is no
 * longer a wall of undifferentiated screenshots.
 */
export async function submitTopup(
  packId: string,
  storagePath: string,
  proofHash: string,
): Promise<{ flagged: boolean }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Sesi lo abis. Masuk lagi ya.");

  // The upload went to `${user.id}/...` under RLS; require the claim to match
  // so a path belonging to someone else cannot be attached to this row.
  if (!storagePath.startsWith(`${user.id}/`)) {
    throw new Error("Bukti transfernya gak valid. Coba upload ulang.");
  }
  if (!/^[a-f0-9]{64}$/.test(proofHash)) {
    throw new Error("Bukti transfernya gak valid. Coba upload ulang.");
  }

  const serviceRole = createServiceRoleClient();

  /**
   * Drop the object the client uploaded a moment ago.
   *
   * The upload happens before this action runs, so every rejection below would
   * otherwise strand a private bank screenshot in storage that no row
   * references and nothing will ever clean up. Users deliberately cannot delete
   * from this bucket — that would let someone pull the evidence out from under
   * a pending review — so the tidying has to happen here.
   */
  const discardUpload = async () => {
    const { error } = await serviceRole.storage.from("topup_proofs").remove([storagePath]);
    if (error) console.error("orphan proof cleanup failed", storagePath, error.message);
  };

  const { data: pack } = await serviceRole
    .from("credit_packs")
    .select("credits, price_idr")
    .eq("id", packId)
    .eq("is_active", true)
    .single();

  if (!pack) {
    await discardUpload();
    throw new Error("Paketnya udah gak tersedia. Muat ulang halamannya.");
  }

  // One open request at a time. Without this, a queue can be filled with
  // hundreds of pending rows faster than anyone can reject them.
  const { count: openCount } = await serviceRole
    .from("topups")
    .select("*", { count: "exact", head: true })
    .eq("user_id", user.id)
    .eq("status", "pending");

  if ((openCount ?? 0) > 0) {
    await discardUpload();
    throw new Error("Masih ada topup lo yang belum di-review. Tunggu yang itu kelar dulu ya.");
  }

  // The same image bytes submitted twice — by this account or any other — is
  // the cheapest possible fraud, and it is invisible to a human reviewer who
  // cannot remember last month's receipts.
  const { data: seen } = await serviceRole
    .from("topups")
    .select("id, user_id")
    .eq("proof_hash", proofHash)
    .limit(1)
    .maybeSingle();

  if (seen) {
    await discardUpload();
    throw new Error("Bukti transfer ini udah pernah dipakai sebelumnya. Kirim struk yang asli ya.");
  }

  const check = await checkProof({
    storagePath,
    expectedAmountIdr: pack.price_idr,
  });

  const { error } = await serviceRole.from("topups").insert({
    user_id: user.id,
    amount_idr: pack.price_idr,
    credits: pack.credits,
    method: "bank_transfer",
    proof_url: storagePath,
    proof_path: storagePath,
    proof_hash: proofHash,
    check_verdict: check.verdict,
    check_detail: check as unknown as Json,
    status: "pending",
  });

  if (error) {
    await discardUpload();
    throw new Error("Gagal nyimpen topupnya. Coba lagi bentar lagi.");
  }

  revalidatePath("/app/topup");
  revalidatePath("/admin/topups");
  return { flagged: check.verdict !== "pass" };
}

export async function redeemVoucher(code: string) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Unauthorized");

  const serviceRole = createServiceRoleClient();
  const clean = code.trim().toUpperCase();

  // Claim the voucher first, conditionally. `is_redeemed = false` in the WHERE
  // clause is what makes two simultaneous redemptions of one code impossible:
  // the second update matches no row.
  //
  // The expiry test is new. `expires_at` was written at creation and then never
  // read, so every voucher was effectively permanent — a campaign code from
  // three months ago still paid out.
  const { data: voucher, error: claimError } = await serviceRole
    .from("vouchers")
    .update({
      is_redeemed: true,
      redeemed_by: user.id,
      redeemed_at: new Date().toISOString(),
    })
    .eq("code", clean)
    .eq("is_redeemed", false)
    .or(`expires_at.is.null,expires_at.gt.${new Date().toISOString()}`)
    .select()
    .single();

  if (claimError || !voucher) {
    throw new Error("Kodenya gak valid, udah kepakai, atau udah lewat masa berlakunya.");
  }

  const { error: grantErr } = await serviceRole.rpc("grant_credits", {
    p_user: user.id,
    p_amount: voucher.credits,
    p_bucket: "paid",
    p_reason: `voucher_redemption_${clean}`,
  });

  // This rollback used to live in a `catch`, which never ran: `.rpc()` resolves
  // with {data, error} instead of throwing. So a failed grant burned the
  // voucher and handed over nothing.
  if (grantErr) {
    await serviceRole
      .from("vouchers")
      .update({ is_redeemed: false, redeemed_by: null, redeemed_at: null })
      .eq("code", clean);
    throw new Error("Kreditnya gagal masuk. Vouchernya masih bisa dipakai, coba lagi.");
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

    // Both sides, and both results checked. `.rpc()` does not throw, so an
    // unchecked call here meant a `referrals` row marked "credited" next to two
    // people who never received anything — and because the row exists, the
    // `if (!existingRef)` guard above ensures it is never retried.
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
      // Mark it for a human rather than leaving a silent "credited" lie. The
      // referral itself stays recorded so the pair is not double-credited by a
      // later retry.
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
