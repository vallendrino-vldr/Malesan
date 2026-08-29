import { createHash, timingSafeEqual } from "node:crypto";
import { NextRequest } from "next/server";
import { createServiceRoleClient } from "@/lib/supabase/server";
import { canTransitionAutoClip, parseAutoClipProgress, type AutoClipStatus } from "@/lib/video/auto-clip";

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
const sameDigest = (left: string, right: string) => {
  const a = Buffer.from(left, "hex");
  const b = Buffer.from(right, "hex");
  return a.length === b.length && timingSafeEqual(a, b);
};

export async function POST(request: NextRequest) {
  const origin = request.headers.get("origin");
  if (!origin || !ALLOWED_ORIGINS.has(origin)) return json({ error: "Origin Bridge ditolak." }, 403);
  const body = await request.json().catch(() => null) as Record<string, unknown> | null;
  const jobId = typeof body?.jobId === "string" ? body.jobId : "";
  const workerToken = typeof body?.workerToken === "string" ? body.workerToken : "";
  const progress = parseAutoClipProgress(body);
  if (!ID.test(jobId) || !TOKEN.test(workerToken) || !progress) {
    return json({ error: "Progress Bridge gak valid." }, 400);
  }

  const service = createServiceRoleClient();
  const { data: job } = await service
    .from("auto_clip_jobs")
    .select("status, progress, worker_token_hash, worker_token_expires_at")
    .eq("id", jobId)
    .single();
  if (
    !job?.worker_token_hash ||
    !job.worker_token_expires_at ||
    new Date(job.worker_token_expires_at).getTime() <= Date.now() ||
    !sameDigest(job.worker_token_hash, digest(workerToken))
  ) return json({ error: "Sesi Bridge habis. Mulai ulang dari Malesan." }, 401);
  if (!canTransitionAutoClip(job.status as AutoClipStatus, progress.status)) {
    return json({ error: `Transisi ${job.status} ke ${progress.status} ditolak.` }, 409);
  }
  if (progress.status !== "failed" && progress.progress < job.progress) {
    return json({ error: "Progress gak boleh mundur." }, 409);
  }

  const terminal = ["ready", "failed", "cancelled"].includes(progress.status);
  const { data, error } = await service
    .from("auto_clip_jobs")
    .update({
      status: progress.status,
      progress: progress.progress,
      stage: progress.stage,
      error_code: progress.errorCode,
      error_message: progress.errorMessage,
      output_name: progress.outputName,
      output_bytes: progress.outputBytes,
      worker_token_hash: terminal ? null : job.worker_token_hash,
      worker_token_expires_at: terminal ? null : job.worker_token_expires_at,
      updated_at: new Date().toISOString(),
    })
    .eq("id", jobId)
    .eq("status", job.status)
    .select("status, progress, stage, output_name, output_bytes")
    .single();
  if (error || !data) return json({ error: "Progress bentrok. Baca status terbaru lalu lanjutkan." }, 409);
  return json({ job: data });
}
