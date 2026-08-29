import { randomBytes, createHash } from "node:crypto";
import { NextRequest } from "next/server";
import { getVideoCostPerMin, isVideoEnabled } from "@/lib/config";
import { aiRateLimit } from "@/lib/rate-limit";
import { createClient, createServiceRoleClient } from "@/lib/supabase/server";
import { parseAutoClipDraft } from "@/lib/video/auto-clip";

export const runtime = "nodejs";

const json = (body: unknown, status = 200) =>
  Response.json(body, { status, headers: { "Cache-Control": "no-store" } });
const digest = (token: string) => createHash("sha256").update(token).digest("hex");

export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return json({ error: "Sesi lo udah habis. Masuk lagi ya." }, 401);
  const { data, error } = await supabase
    .from("auto_clip_jobs")
    .select("id, video_id, title, clip_title, start_time, end_time, ratio, focus, status, progress, stage, error_code, error_message, output_name, output_bytes, created_at, updated_at")
    .order("created_at", { ascending: false })
    .limit(20);
  if (error) return json({ error: "Gagal baca antrean Auto Clip." }, 500);
  return json({ jobs: data });
}

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return json({ error: "Sesi lo udah habis. Masuk lagi ya." }, 401);
  const { data: profile } = await supabase
    .from("profiles")
    .select("is_banned, credits_free, credits_paid")
    .eq("id", user.id)
    .single();
  if (!profile) return json({ error: "Profil gak ketemu." }, 404);
  if (profile.is_banned) return json({ error: "Akun lo lagi dibekuin." }, 403);
  const limited = await aiRateLimit(user.id, "video_auto_clip_job", 10);
  if (limited) return limited;
  if (!(await isVideoEnabled())) {
    return json({ error: "Auto Clip lagi dimatiin sementara. Preview dan file sendiri tetap bisa dipakai." }, 503);
  }

  const draft = parseAutoClipDraft(await request.json().catch(() => null));
  if (!draft) {
    return json({ error: "Data clip gak valid. Pilih potongan 20–180 detik dan konfirmasi hak pakainya." }, 400);
  }
  const creditAmount = Math.ceil((draft.endTime - draft.startTime) / 60) * await getVideoCostPerMin();
  if (profile.credits_free + profile.credits_paid < creditAmount) {
    return json({ error: `Perlu ${creditAmount} kredit saat Bridge mulai mengambil clip.`, needed: creditAmount }, 402);
  }

  const claimToken = randomBytes(32).toString("base64url");
  const service = createServiceRoleClient();
  const { data, error } = await service.from("auto_clip_jobs").insert({
    user_id: user.id,
    video_id: draft.videoId,
    source_url: draft.sourceUrl,
    title: draft.title,
    clip_title: draft.clipTitle,
    start_time: draft.startTime,
    end_time: draft.endTime,
    ratio: draft.ratio,
    focus: draft.focus,
    caption_preset: draft.captionPreset,
    language: draft.language,
    credit_amount: creditAmount,
    bridge_token_hash: digest(claimToken),
    bridge_token_expires_at: new Date(Date.now() + 10 * 60_000).toISOString(),
  }).select("id, status, progress, stage, credit_amount, created_at").single();
  if (error || !data) {
    console.error("auto clip job create failed", error);
    return json({ error: "Gagal bikin job Auto Clip. Coba lagi." }, 500);
  }
  return json({ job: data, claimToken, claimExpiresIn: 600 }, 201);
}
