"use server";

import { createServiceRoleClient, createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import { invalidateConfigCache } from "@/lib/config";
import { probePool } from "@/lib/gemini/pool-report";

async function verifyAdmin() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Unauthorized");

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();

  if (profile?.role !== "admin") {
    throw new Error("Forbidden");
  }
  return user.id;
}

/**
 * `audit_log` has existed since the schema repair and nothing has ever written
 * to it. Every mutation below now leaves a row: who did it, to whom, and what
 * changed. Admin powers that edit balances and roles without a trail are how a
 * ledger stops being trustworthy.
 *
 * Best-effort by design — a failed audit write must not roll back a completed
 * action, or the operator is left unsure whether it applied.
 */
async function audit(
  actorId: string,
  action: string,
  targetId: string,
  metadata: Record<string, string | number | boolean | null> = {},
) {
  try {
    await createServiceRoleClient().from("audit_log").insert({
      actor_id: actorId,
      action,
      target_type: "user",
      target_id: targetId,
      metadata,
    });
  } catch (e) {
    console.error("audit write failed", action, targetId, e);
  }
}

/** Free ↔ Pro. `is_pro` drives model tier and quota pool, so it is not cosmetic. */
export async function setProStatus(userId: string, isPro: boolean) {
  const adminId = await verifyAdmin();
  const { error } = await createServiceRoleClient()
    .from("profiles")
    .update({ is_pro: isPro })
    .eq("id", userId);

  if (error) throw new Error(error.message);
  await audit(adminId, isPro ? "user.promote_pro" : "user.demote_free", userId, { is_pro: isPro });
  revalidatePath("/admin/users");
}

/**
 * Grant or take away admin. Refuses to strip the last admin — locking every
 * operator out of the panel is unrecoverable from inside the product.
 */
export async function setAdminRole(userId: string, makeAdmin: boolean) {
  const adminId = await verifyAdmin();
  const serviceRole = createServiceRoleClient();

  if (!makeAdmin) {
    const { count } = await serviceRole
      .from("profiles")
      .select("id", { count: "exact", head: true })
      .eq("role", "admin");
    if ((count ?? 0) <= 1) {
      throw new Error("Ini admin terakhir. Angkat admin lain dulu sebelum nurunin yang ini.");
    }
  }

  const { error } = await serviceRole
    .from("profiles")
    .update({ role: makeAdmin ? "admin" : "user" })
    .eq("id", userId);

  if (error) throw new Error(error.message);
  await audit(adminId, makeAdmin ? "user.grant_admin" : "user.revoke_admin", userId, {});
  revalidatePath("/admin/users");
}

/**
 * Hard delete. Removes the auth user; `profiles` and everything keyed to it go
 * with it via cascade. Irreversible, so it refuses to delete an admin (demote
 * first — that path already refuses to strip the last one) and refuses to let
 * an operator delete themselves.
 */
export async function deleteUser(userId: string) {
  const adminId = await verifyAdmin();
  if (userId === adminId) throw new Error("Gak bisa hapus akun lo sendiri.");

  const serviceRole = createServiceRoleClient();
  const { data: target } = await serviceRole
    .from("profiles")
    .select("role, email")
    .eq("id", userId)
    .single();

  if (!target) throw new Error("User gak ketemu.");
  if (target.role === "admin") throw new Error("Turunin dari admin dulu sebelum dihapus.");

  await audit(adminId, "user.delete", userId, { email: target.email });

  const { error } = await serviceRole.auth.admin.deleteUser(userId);
  if (error) throw new Error(error.message);

  revalidatePath("/admin/users");
}

/**
 * Storage path for a proof, from either storage format.
 *
 * `proof_url` used to hold a full public URL and now holds a bare path. A
 * split that assumed the URL form silently found nothing for new rows, so the
 * cleanup below stopped running and private bank screenshots accumulated in the
 * bucket forever.
 */
function proofPathOf(topup: { proof_url: string | null; proof_path?: string | null; user_id: string }) {
  const raw = topup.proof_path || topup.proof_url;
  if (!raw) return null;
  const path = raw.includes("/topup_proofs/")
    ? raw.split("/topup_proofs/")[1]
    : raw.replace(/^\/+/, "");
  // Never delete outside the owner's folder, whatever the column contains.
  return path && path.startsWith(`${topup.user_id}/`) ? path : null;
}

/**
 * Approve a top-up and hand over the credits.
 *
 * The order here is deliberate and was wrong before. The row was marked
 * `approved` first and the credits granted second, with neither result checked
 * — and `supabase.rpc()` resolves with `{data, error}` rather than throwing, so
 * a failed grant was invisible. The outcome was a top-up shown as approved,
 * an admin told it had worked, and a paying user with no credits and no way to
 * prove it. Credits move first now, and nothing is marked approved until they
 * have actually landed.
 */
export async function approveTopup(topupId: string) {
  const adminId = await verifyAdmin();
  const serviceRole = createServiceRoleClient();

  const { data: topup, error: fetchErr } = await serviceRole
    .from("topups")
    .select("*")
    .eq("id", topupId)
    .single();

  if (fetchErr || !topup || topup.status !== "pending") {
    throw new Error("Topupnya udah gak pending — mungkin barusan keproses.");
  }

  const { error: grantErr } = await serviceRole.rpc("grant_credits", {
    p_user: topup.user_id,
    p_amount: topup.credits,
    p_bucket: "paid",
    p_reason: `topup_${topupId}`,
  });

  if (grantErr) {
    throw new Error(
      `Kreditnya gagal masuk, jadi topupnya gak jadi di-approve: ${grantErr.message}`,
    );
  }

  // Scoped to `pending` so two admins tapping Approve at the same moment
  // cannot both pass the check above and grant twice.
  const { data: marked, error: markErr } = await serviceRole
    .from("topups")
    .update({
      status: "approved",
      reviewed_by: adminId,
      reviewed_at: new Date().toISOString(),
    })
    .eq("id", topupId)
    .eq("status", "pending")
    .select("id");

  if (markErr || !marked?.length) {
    throw new Error(
      "Kreditnya udah masuk tapi statusnya gagal diupdate. Jangan approve lagi — cek dulu di daftar user.",
    );
  }

  // The proof is a bank screenshot with an account number on it, so it is
  // deleted once it has served its purpose. A failure here must not undo an
  // approval that already happened.
  const path = proofPathOf(topup);
  if (path) {
    const { error: rmErr } = await serviceRole.storage.from("topup_proofs").remove([path]);
    if (rmErr) console.error("proof cleanup failed", topupId, rmErr.message);
  }

  await audit(adminId, "topup.approve", topupId, {
    credits: topup.credits,
    amount_idr: topup.amount_idr,
    verdict: topup.check_verdict,
  });

  revalidatePath("/admin/topups");
  revalidatePath("/admin");
}

export async function rejectTopup(topupId: string, note?: string) {
  const adminId = await verifyAdmin();
  const serviceRole = createServiceRoleClient();

  const { data: topup, error: fetchErr } = await serviceRole
    .from("topups")
    .select("*")
    .eq("id", topupId)
    .single();

  if (fetchErr || !topup || topup.status !== "pending") {
    throw new Error("Topupnya udah gak pending — mungkin barusan keproses.");
  }

  const { data: marked, error: markErr } = await serviceRole
    .from("topups")
    .update({
      status: "rejected",
      note,
      reviewed_by: adminId,
      reviewed_at: new Date().toISOString(),
    })
    .eq("id", topupId)
    .eq("status", "pending")
    .select("id");

  if (markErr || !marked?.length) {
    throw new Error(`Gagal nge-reject topupnya: ${markErr?.message ?? "udah keproses"}`);
  }

  const path = proofPathOf(topup);
  if (path) {
    const { error: rmErr } = await serviceRole.storage.from("topup_proofs").remove([path]);
    if (rmErr) console.error("proof cleanup failed", topupId, rmErr.message);
  }

  await audit(adminId, "topup.reject", topupId, { note: note ?? "", amount_idr: topup.amount_idr });

  revalidatePath("/admin/topups");
  revalidatePath("/admin");
}

export async function banUser(userId: string, reason: string) {
  const adminId = await verifyAdmin();
  const serviceRole = createServiceRoleClient();

  // `.select()` so a write that matched no row is distinguishable from one that
  // worked. Without it a ban on a stale user id reported success and the person
  // carried on using the product.
  const { data, error } = await serviceRole
    .from("profiles")
    .update({ is_banned: true, ban_reason: reason })
    .eq("id", userId)
    .select("id");

  if (error) throw new Error(`Gagal nge-ban: ${error.message}`);
  if (!data?.length) throw new Error("Usernya gak ketemu — mungkin udah kehapus.");

  await audit(adminId, "user.ban", userId, { reason });
  revalidatePath("/admin/users");
}

export async function unbanUser(userId: string) {
  const adminId = await verifyAdmin();
  const serviceRole = createServiceRoleClient();

  const { data, error } = await serviceRole
    .from("profiles")
    .update({ is_banned: false, ban_reason: null })
    .eq("id", userId)
    .select("id");

  if (error) throw new Error(`Gagal buka ban: ${error.message}`);
  if (!data?.length) throw new Error("Usernya gak ketemu — mungkin udah kehapus.");

  await audit(adminId, "user.unban", userId, {});
  revalidatePath("/admin/users");
}

export async function createVoucher(code: string, credits: number, daysValid: number) {
  const adminId = await verifyAdmin();
  const serviceRole = createServiceRoleClient();

  const clean = code.trim().toUpperCase();
  if (clean.length < 4) throw new Error("Kodenya minimal 4 karakter.");
  if (!Number.isInteger(credits) || credits <= 0) {
    throw new Error("Kreditnya harus bilangan bulat di atas 0.");
  }
  if (!Number.isInteger(daysValid) || daysValid <= 0) {
    throw new Error("Masa berlakunya harus lebih dari 0 hari.");
  }

  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + daysValid);

  const { error } = await serviceRole.from("vouchers").insert({
    code: clean,
    credits,
    created_by: adminId,
    expires_at: expiresAt.toISOString(),
    is_redeemed: false,
  });

  // The insert error was discarded. `code` is the primary key, so re-using one
  // failed silently and the screen reported a voucher that did not exist —
  // which is what "voucher-nya gak jalan" looks like from the other side.
  if (error) {
    throw new Error(
      error.code === "23505"
        ? `Kode "${clean}" udah pernah dibikin. Pakai kode lain.`
        : `Gagal bikin voucher: ${error.message}`,
    );
  }

  await audit(adminId, "voucher.create", clean, { credits, daysValid });
  revalidatePath("/admin/vouchers");
}

/**
 * Delete a voucher.
 *
 * A redeemed voucher is a receipt — deleting it hides that credits were handed
 * out, so those are kept and only unredeemed codes (expired or still active)
 * can be removed. `.select()` is what turns "matched no row" into an error the
 * operator sees, rather than a button that reports success and changes nothing.
 */
export async function deleteVoucher(code: string) {
  const adminId = await verifyAdmin();
  const clean = code.trim().toUpperCase();

  const { data, error } = await createServiceRoleClient()
    .from("vouchers")
    .delete()
    .eq("code", clean)
    .eq("is_redeemed", false)
    .select("code");

  if (error) throw new Error(`Gagal hapus voucher: ${error.message}`);
  if (!data || data.length === 0) {
    throw new Error("Voucher gak ketemu, atau udah kepakai — yang udah kepakai gak bisa dihapus.");
  }

  await audit(adminId, "voucher.delete", clean, {});
  revalidatePath("/admin/vouchers");
}

export async function adjustCredits(
  userId: string,
  mode: "add" | "deduct",
  amount: number,
  bucket: "free" | "paid",
  reason: string,
) {
  const adminId = await verifyAdmin();
  const serviceRole = createServiceRoleClient();

  // Validate user exists & fetch current balance
  const { data: userProfile, error: profileErr } = await serviceRole
    .from("profiles")
    .select("id, credits_free, credits_paid")
    .eq("id", userId)
    .single();

  if (profileErr || !userProfile) throw new Error("User gak ketemu.");

  if (!Number.isInteger(amount) || amount <= 0) {
    throw new Error("Jumlah kredit harus bilangan bulat di atas 0.");
  }

  if (mode === "add") {
    const { error: grantErr } = await serviceRole.rpc("grant_credits", {
      p_user: userId,
      p_amount: amount,
      p_bucket: bucket,
      p_reason: `admin_add_by_${adminId}: ${reason}`,
    });

    if (grantErr) throw new Error(`Kredit gagal ditambah: ${grantErr.message}`);
    await audit(adminId, "credits.grant", userId, { amount, bucket, reason });
  } else {
    // Deduct credits
    const currentBalance = bucket === "paid" ? userProfile.credits_paid : userProfile.credits_free;
    if (currentBalance < amount) {
      throw new Error(`Saldo ${bucket} user saat ini cuma ${currentBalance}. Tidak bisa dikurangi ${amount}.`);
    }

    const newFree = bucket === "free" ? userProfile.credits_free - amount : userProfile.credits_free;
    const newPaid = bucket === "paid" ? userProfile.credits_paid - amount : userProfile.credits_paid;
    const newTotal = newFree + newPaid;

    const { error: updateErr } = await serviceRole
      .from("profiles")
      .update({
        credits_free: newFree,
        credits_paid: newPaid,
      })
      .eq("id", userId);

    if (updateErr) throw new Error(`Kredit gagal dikurangi: ${updateErr.message}`);

    // Insert negative entry to ledger for auditability
    await serviceRole.from("credit_ledger").insert({
      user_id: userId,
      delta: -amount,
      bucket,
      reason: `admin_deduct_by_${adminId}: ${reason || "Penyesuaian saldo admin"}`,
      balance_after: newTotal,
    });

    await audit(adminId, "credits.deduct", userId, {
      amount,
      bucket,
      reason,
      previous_balance: currentBalance,
      balance_after: newTotal,
    });
  }

  revalidatePath("/admin/users");
  revalidatePath("/app");
}

export async function injectCredits(userId: string, amount: number, bucket: "free" | "paid", reason: string) {
  return adjustCredits(userId, "add", amount, bucket, reason);
}

/**
 * Write one `app_config` row. Values are JSON, so the caller decides shape —
 * but the key must already exist. Creating keys from the UI would let a typo
 * silently produce a row nothing reads, which looks like a saved setting that
 * does nothing.
 */
export async function setConfig(key: string, value: unknown) {
  const adminId = await verifyAdmin();
  const serviceRole = createServiceRoleClient();

  const { data: existing } = await serviceRole
    .from("app_config")
    .select("key")
    .eq("key", key)
    .single();

  if (!existing) throw new Error(`Setting "${key}" gak dikenal.`);

  const { error } = await serviceRole
    .from("app_config")
    .update({
      value: value as never,
      updated_at: new Date().toISOString(),
      updated_by: adminId,
    })
    .eq("key", key);

  if (error) throw new Error(error.message);

  await audit(adminId, "config.update", key, { value: JSON.stringify(value) });
  invalidateConfigCache();
  revalidatePath("/admin/config");
}

/**
 * Short-lived signed URL for a transfer proof.
 *
 * The bucket was switched from public to private during the schema repair —
 * these are bank-transfer screenshots with account numbers on them — but the
 * approval screen kept rendering `proof_url` directly. That URL stopped
 * resolving the moment the bucket went private, so the admin has been
 * approving payments against a broken image.
 *
 * Five minutes is enough to look at it and not much else.
 */
export async function signedProofUrl(proofUrl: string): Promise<string | null> {
  await verifyAdmin();

  // Historically this column held a full public URL; it now holds the bare
  // storage path. Accept both — old rows still need to be reviewable, and
  // silently returning null for them would look like a broken proof.
  const path = proofUrl.includes("/topup_proofs/")
    ? proofUrl.split("/topup_proofs/")[1]
    : proofUrl.replace(/^\/+/, "");
  if (!path) return null;

  const { data, error } = await createServiceRoleClient()
    .storage.from("topup_proofs")
    .createSignedUrl(path, 300);

  if (error) {
    console.error("signed url failed", error);
    return null;
  }
  return data?.signedUrl ?? null;
}

/**
 * Upload the QRIS image and store its public URL in one step.
 *
 * The config screen only accepted a URL, which meant the owner had to go and
 * host the image somewhere else first — a dead end for someone who does not
 * code, and the reason the QRIS option never worked. Takes the file directly
 * now and writes `qris_image_url` itself.
 *
 * Goes to `public_assets`, not `topup_proofs`: proofs are private because they
 * are bank screenshots, and the QRIS has to be readable by every user.
 */
export async function uploadQrisImage(form: FormData) {
  const adminId = await verifyAdmin();
  const file = form.get("file");

  if (!(file instanceof File) || file.size === 0) {
    throw new Error("Gak ada file yang keunggah.");
  }
  if (!file.type.startsWith("image/")) {
    throw new Error("Filenya harus gambar (PNG atau JPG).");
  }
  if (file.size > 2 * 1024 * 1024) {
    throw new Error("Gambarnya kegedean. Maksimal 2MB.");
  }

  const serviceRole = createServiceRoleClient();
  const ext = file.name.split(".").pop()?.toLowerCase().replace(/[^a-z0-9]/g, "") || "png";
  // Timestamped name so a replacement is not masked by a cached old file.
  const path = `qris/${Date.now()}.${ext}`;

  const { error: upErr } = await serviceRole.storage
    .from("public_assets")
    .upload(path, file, { contentType: file.type, upsert: true });

  if (upErr) throw new Error(`Gagal upload: ${upErr.message}`);

  const {
    data: { publicUrl },
  } = serviceRole.storage.from("public_assets").getPublicUrl(path);

  const { error } = await serviceRole
    .from("app_config")
    .update({ value: publicUrl, updated_at: new Date().toISOString(), updated_by: adminId })
    .eq("key", "qris_image_url");

  if (error) throw new Error(error.message);

  await audit(adminId, "config.upload_qris", "qris_image_url", { path });
  invalidateConfigCache();
  revalidatePath("/admin/config");
  revalidatePath("/app/topup");
  return publicUrl;
}

/**
 * Calls every configured Gemini key once and reports which answered.
 *
 * The counters cannot tell a brand-new working key from a revoked one — both
 * have no rows. Only a live call can, and after adding a key that is the whole
 * question. Audited, because it spends real quota (one request per key) and an
 * operator hammering it should be visible in the trail.
 */
export async function probeGeminiKeys() {
  const adminId = await verifyAdmin();
  const results = await probePool();
  await audit(adminId, "gemini.probe_keys", "gemini_pool", {
    tested: results.length,
    ok: results.filter((r) => r.ok).length,
  });
  revalidatePath("/admin");
  return results;
}

export async function clearErrorLogs() {
  const adminId = await verifyAdmin();
  const serviceRole = createServiceRoleClient();
  const { error } = await serviceRole.from("error_log").delete().gte("id", 0);
  if (error) throw new Error(`Gagal membersihkan log error: ${error.message}`);
  await audit(adminId, "error_log.clear", "all", {});
  revalidatePath("/admin/errors");
  revalidatePath("/admin");
}

/** Recent admin activity, newest first. Powers the trail shown in the panel. */
export async function recentAuditLog(limit = 30) {
  await verifyAdmin();
  const { data } = await createServiceRoleClient()
    .from("audit_log")
    .select("id, actor_id, action, target_id, metadata, created_at")
    .order("created_at", { ascending: false })
    .limit(limit);
  return data ?? [];
}
