/* eslint-disable @typescript-eslint/no-explicit-any */
import { createServiceRoleClient } from "@/lib/supabase/server";

export async function createDesktopTicket(
  cookiesList: Array<{ name: string; value: string }>
): Promise<string> {
  const ticket = "tkt_" + crypto.randomUUID();
  const supabase = createServiceRoleClient() as any;

  // Purge expired rows older than 5 minutes
  try {
    await supabase
      .from("desktop_pairing_sessions")
      .delete()
      .lt("created_at", new Date(Date.now() - 300_000).toISOString());
  } catch {}

  // Store ticket with 90s TTL
  await supabase
    .from("desktop_pairing_sessions")
    .insert({
      code: ticket,
      status: "approved",
      cookies: cookiesList,
    });

  return ticket;
}

export async function claimDesktopTicket(
  ticket: string
): Promise<Array<{ name: string; value: string }> | null> {
  if (!ticket || typeof ticket !== "string") return null;
  const supabase = createServiceRoleClient() as any;

  const ninetySecondsAgo = new Date(Date.now() - 90_000).toISOString();

  // Strictly one-time use: delete and return cookies in one atomic operation if not expired
  const { data, error } = await supabase
    .from("desktop_pairing_sessions")
    .delete()
    .eq("code", ticket)
    .eq("status", "approved")
    .gt("created_at", ninetySecondsAgo)
    .select("cookies")
    .maybeSingle();

  if (error || !data || !Array.isArray(data.cookies)) {
    return null;
  }

  return data.cookies as Array<{ name: string; value: string }>;
}
