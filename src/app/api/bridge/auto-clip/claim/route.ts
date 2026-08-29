import { createHash, randomBytes } from "node:crypto";
import { NextRequest } from "next/server";
import { createServiceRoleClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

const ID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const TOKEN = /^[A-Za-z0-9_-]{40,128}$/;
const ALLOWED_ORIGINS = new Set([
  "https://malesan.my.id",
  "https://www.malesan.my.id",
  ...(process.env.NODE_ENV === "development" ? ["http://localhost:3000"] : []),
]);
const digest = (token: string) => createHash("sha256").update(token).digest("hex");
const json = (body: unknown, status = 200) =>
  Response.json(body, { status, headers: { "Cache-Control": "no-store" } });

export async function POST(request: NextRequest) {
  const origin = request.headers.get("origin");
  if (!origin || !ALLOWED_ORIGINS.has(origin)) return json({ error: "Origin Bridge ditolak." }, 403);
  const body = await request.json().catch(() => null) as { jobId?: unknown; claimToken?: unknown } | null;
  const jobId = typeof body?.jobId === "string" ? body.jobId : "";
  const claimToken = typeof body?.claimToken === "string" ? body.claimToken : "";
  if (!ID.test(jobId) || !TOKEN.test(claimToken)) return json({ error: "Klaim Bridge gak valid." }, 400);

  const workerToken = randomBytes(32).toString("base64url");
  const { data, error } = await createServiceRoleClient().rpc("claim_auto_clip_job", {
    p_job: jobId,
    p_token_hash: digest(claimToken),
    p_credit_ref: `auto-clip:${jobId}`,
    p_worker_token_hash: digest(workerToken),
  });
  const job = data?.[0];
  if (error) {
    console.error("auto clip bridge claim failed", error);
    return json({ error: "Bridge gagal mengambil job." }, 500);
  }
  if (!job) return json({ error: "Token kedaluwarsa, sudah dipakai, atau job dibatalkan." }, 409);
  return json({
    workerToken,
    job: {
      id: job.id,
      videoId: job.video_id,
      sourceUrl: job.source_url,
      title: job.title,
      clipTitle: job.clip_title,
      startTime: job.start_time,
      endTime: job.end_time,
      ratio: job.ratio,
      focus: job.focus,
      captionPreset: job.caption_preset,
      language: job.language,
      status: job.status,
      progress: job.progress,
      stage: job.stage,
    },
  });
}
