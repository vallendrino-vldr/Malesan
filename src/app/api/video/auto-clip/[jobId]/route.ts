import { NextRequest } from "next/server";
import { createClient, createServiceRoleClient } from "@/lib/supabase/server";

const ID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const json = (body: unknown, status = 200) =>
  Response.json(body, { status, headers: { "Cache-Control": "no-store" } });

type Context = { params: Promise<{ jobId: string }> };

export async function GET(_request: NextRequest, { params }: Context) {
  const { jobId } = await params;
  if (!ID.test(jobId)) return json({ error: "Job gak valid." }, 400);
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return json({ error: "Sesi lo udah habis. Masuk lagi ya." }, 401);
  const { data, error } = await supabase
    .from("auto_clip_jobs")
    .select("id, video_id, title, clip_title, start_time, end_time, ratio, focus, status, progress, stage, error_code, error_message, output_name, output_bytes, created_at, updated_at")
    .eq("id", jobId)
    .single();
  if (error || !data) return json({ error: "Job gak ketemu." }, 404);
  return json({ job: data });
}

export async function DELETE(_request: NextRequest, { params }: Context) {
  const { jobId } = await params;
  if (!ID.test(jobId)) return json({ error: "Job gak valid." }, 400);
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return json({ error: "Sesi lo udah habis. Masuk lagi ya." }, 401);
  const { data: owned } = await supabase
    .from("auto_clip_jobs")
    .select("id, status")
    .eq("id", jobId)
    .single();
  if (!owned) return json({ error: "Job gak ketemu." }, 404);
  if (owned.status === "cancelled") return json({ status: "cancelled" });
  if (!["queued", "acquiring", "trimming", "tracking", "transcribing", "ready", "exporting", "failed"].includes(owned.status)) {
    return json({ error: "Job ini gak bisa dibatalkan." }, 409);
  }
  const { data, error } = await createServiceRoleClient()
    .from("auto_clip_jobs")
    .update({ status: "cancelled", stage: "Dibatalkan", updated_at: new Date().toISOString() })
    .eq("id", jobId)
    .eq("user_id", user.id)
    .select("status")
    .single();
  if (error || !data) return json({ error: "Gagal membatalkan job." }, 409);
  return json(data);
}
