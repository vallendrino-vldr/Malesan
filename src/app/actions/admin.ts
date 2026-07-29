"use server";

import { createServiceRoleClient, createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import { invalidateConfigCache } from "@/lib/config";

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

export async function approveTopup(topupId: string) {
  const adminId = await verifyAdmin();
  const serviceRole = createServiceRoleClient();

  const { data: topup, error: fetchErr } = await serviceRole
    .from("topups")
    .select("*")
    .eq("id", topupId)
    .single();

  if (fetchErr || !topup || topup.status !== "pending") {
    throw new Error("Topup not found or already processed");
  }

  // Update topup status
  await serviceRole
    .from("topups")
    .update({
      status: "approved",
      reviewed_by: adminId,
      reviewed_at: new Date().toISOString()
    })
    .eq("id", topupId);

  // Grant credits
  await serviceRole.rpc("grant_credits", {
    p_user: topup.user_id,
    p_amount: topup.credits,
    p_bucket: "paid",
    p_reason: `topup_${topupId}`
  });

  // Permanently delete proof image
  if (topup.proof_url) {
    try {
      // url format: https://.../storage/v1/object/public/topup_proofs/userId/timestamp.jpg
      const urlParts = topup.proof_url.split("/topup_proofs/");
      if (urlParts.length === 2) {
        const path = urlParts[1];
        if (path.startsWith(`${topup.user_id}/`)) {
          await serviceRole.storage.from("topup_proofs").remove([path]);
        }
      }
    } catch (e) {
      console.error("Failed to delete proof image", e);
    }
  }

  revalidatePath("/admin/topups");
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
    throw new Error("Topup not found or already processed");
  }

  await serviceRole
    .from("topups")
    .update({
      status: "rejected",
      note,
      reviewed_by: adminId,
      reviewed_at: new Date().toISOString()
    })
    .eq("id", topupId);

  // Permanently delete proof image
  if (topup.proof_url) {
    try {
      const urlParts = topup.proof_url.split("/topup_proofs/");
      if (urlParts.length === 2) {
        const path = urlParts[1];
        if (path.startsWith(`${topup.user_id}/`)) {
          await serviceRole.storage.from("topup_proofs").remove([path]);
        }
      }
    } catch (e) {
      console.error("Failed to delete proof image", e);
    }
  }

  revalidatePath("/admin/topups");
}

export async function banUser(userId: string, reason: string) {
  const adminId = await verifyAdmin();
  const serviceRole = createServiceRoleClient();

  await serviceRole
    .from("profiles")
    .update({ is_banned: true, ban_reason: reason })
    .eq("id", userId);

  await audit(adminId, "user.ban", userId, { reason });
  revalidatePath("/admin/users");
}

export async function unbanUser(userId: string) {
  const adminId = await verifyAdmin();
  const serviceRole = createServiceRoleClient();

  await serviceRole
    .from("profiles")
    .update({ is_banned: false, ban_reason: null })
    .eq("id", userId);

  await audit(adminId, "user.unban", userId, {});
  revalidatePath("/admin/users");
}

export async function createVoucher(code: string, credits: number, daysValid: number) {
  const adminId = await verifyAdmin();
  const serviceRole = createServiceRoleClient();

  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + daysValid);

  await serviceRole
    .from("vouchers")
    .insert({
      code: code.toUpperCase(),
      credits,
      created_by: adminId,
      expires_at: expiresAt.toISOString(),
      is_redeemed: false
    });

  revalidatePath("/admin/vouchers");
}

export async function injectCredits(userId: string, amount: number, bucket: "free" | "paid", reason: string) {
  const adminId = await verifyAdmin();
  const serviceRole = createServiceRoleClient();

  // Validate user exists
  const { data: userProfile, error: profileErr } = await serviceRole
    .from("profiles")
    .select("id")
    .eq("id", userId)
    .single();

  if (profileErr || !userProfile) throw new Error("User not found");

  // grant_credits validates p_amount > 0 — that check was restored after a
  // previous agent dropped it. So a deduction cannot go through this path.
  if (!Number.isInteger(amount) || amount <= 0) {
    throw new Error("Jumlah kredit harus bilangan bulat di atas 0.");
  }

  await serviceRole.rpc("grant_credits", {
    p_user: userId,
    p_amount: amount,
    p_bucket: bucket,
    p_reason: `admin_injection_by_${adminId}_reason_${reason}`
  });

  await audit(adminId, "credits.grant", userId, { amount, bucket, reason });
  revalidatePath("/admin/users");
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
