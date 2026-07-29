"use server";

import { createServiceRoleClient, createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";

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
  await verifyAdmin();
  const serviceRole = createServiceRoleClient();

  await serviceRole
    .from("profiles")
    .update({ is_banned: true, ban_reason: reason })
    .eq("id", userId);

  revalidatePath("/admin/users");
}

export async function unbanUser(userId: string) {
  await verifyAdmin();
  const serviceRole = createServiceRoleClient();

  await serviceRole
    .from("profiles")
    .update({ is_banned: false, ban_reason: null })
    .eq("id", userId);

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

  await serviceRole.rpc("grant_credits", {
    p_user: userId,
    p_amount: amount,
    p_bucket: bucket,
    p_reason: `admin_injection_by_${adminId}_reason_${reason}`
  });

  revalidatePath("/admin/users");
}
