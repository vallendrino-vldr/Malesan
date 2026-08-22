import { createClient } from "@/lib/supabase/server";
import { spendCredits } from "@/lib/credits";
import { getVideoNoWatermarkCost } from "@/lib/config";

/**
 * Charge for removing the export watermark.
 *
 * The burn-in is client-side, so there is no export request to gate — this is
 * the one server touch that makes dropping the mark cost something. The client
 * calls it before exporting without the watermark; only on a successful spend
 * does it export clean. Credits move through spend_credits like everything else.
 */
export const runtime = "nodejs";

export async function POST() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return json({ error: "Unauthorized" }, 401);

  const { data: profile } = await supabase
    .from("profiles")
    .select("is_banned")
    .eq("id", user.id)
    .single();
  if (!profile) return json({ error: "Profil gak ketemu." }, 404);
  if (profile.is_banned) return json({ error: "Akun lo lagi dibekuin." }, 403);

  const cost = await getVideoNoWatermarkCost();
  if (cost <= 0) return json({ ok: true, cost: 0 }, 200);

  const spend = await spendCredits(user.id, cost, "video_no_watermark");
  if (!spend.ok) {
    return json({ error: spend.message }, spend.reason === "insufficient" ? 402 : 500);
  }
  return json({ ok: true, cost }, 200);
}

function json(body: unknown, status: number) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}
