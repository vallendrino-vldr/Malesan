/* eslint-disable @typescript-eslint/no-explicit-any */
import { createServiceRoleClient } from "@/lib/supabase/server";

export async function createPairingSession(): Promise<string> {
  const code = "msk_" + Math.random().toString(36).substring(2, 10) + Math.random().toString(36).substring(2, 10);
  const supabase = createServiceRoleClient() as any;

  try {
    await supabase
      .from("desktop_pairing_sessions")
      .delete()
      .lt("created_at", new Date(Date.now() - 300_000).toISOString());
  } catch {}

  await supabase
    .from("desktop_pairing_sessions")
    .insert({ code, status: "pending" });

  return code;
}

export async function approvePairingSession(
  code: string,
  cookies: { name: string; value: string }[]
): Promise<boolean> {
  if (!code) return false;
  const supabase = createServiceRoleClient() as any;

  const { error } = await supabase
    .from("desktop_pairing_sessions")
    .update({ status: "approved", cookies })
    .eq("code", code);

  return !error;
}

export async function pollPairingSession(code: string): Promise<{
  status: "pending" | "approved" | "expired";
  cookies?: { name: string; value: string }[];
}> {
  if (!code) return { status: "expired" };
  const supabase = createServiceRoleClient() as any;

  const { data, error } = await supabase
    .from("desktop_pairing_sessions")
    .select("*")
    .eq("code", code)
    .maybeSingle();

  if (error || !data) return { status: "expired" };

  if (data.status === "approved" && Array.isArray(data.cookies)) {
    try {
      await supabase.from("desktop_pairing_sessions").delete().eq("code", code);
    } catch {}
    return { status: "approved", cookies: data.cookies };
  }

  return { status: "pending" };
}
