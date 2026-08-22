import "server-only";
import { createClient, createServiceRoleClient } from "@/lib/supabase/server";

/**
 * The admin gate and the admin trail, in one place.
 *
 * These two are copied verbatim from src/app/actions/admin.ts, which cannot
 * export them: that file carries `"use server"`, so every export becomes a
 * callable HTTP endpoint. Turning an authorisation check into a public action is
 * not a thing to do for the sake of tidiness.
 *
 * Living here means the AI-fleet actions reuse the exact check that guards
 * credit injection and bans, rather than growing a second, subtly different
 * one — an auth guard that exists twice is an auth guard that will eventually
 * disagree with itself.
 */

/** Throws unless the caller is a signed-in admin. Returns their user id. */
export async function verifyAdmin(): Promise<string> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Unauthorized");

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();

  if (profile?.role !== "admin") throw new Error("Forbidden");
  return user.id;
}

/**
 * Record what an admin did. Best-effort by design — a failed audit write must
 * not roll back a completed action, or the operator is left unsure whether it
 * applied.
 */
export async function audit(
  actorId: string,
  action: string,
  targetId: string,
  targetType = "ai",
  metadata: Record<string, string | number | boolean | null> = {},
): Promise<void> {
  try {
    await createServiceRoleClient().from("audit_log").insert({
      actor_id: actorId,
      action,
      target_type: targetType,
      target_id: targetId,
      metadata,
    });
  } catch (e) {
    console.error("audit write failed", action, targetId, e);
  }
}
