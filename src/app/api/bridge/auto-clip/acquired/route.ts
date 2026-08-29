import { createHash } from "node:crypto";
import { NextRequest } from "next/server";
import { createServiceRoleClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

const ID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const TOKEN = /^[A-Za-z0-9_-]{40,128}$/;
const ALLOWED_ORIGINS = new Set([
  "https://malesan.my.id", "https://www.malesan.my.id",
  ...(process.env.NODE_ENV === "development" ? ["http://localhost:3000"] : []),
]);
const digest = (token: string) => createHash("sha256").update(token).digest("hex");
const json = (body: unknown, status = 200) =>
  Response.json(body, { status, headers: { "Cache-Control": "no-store" } });

export async function POST(request: NextRequest) {
  const origin = request.headers.get("origin");
  if (!origin || !ALLOWED_ORIGINS.has(origin)) return json({ error: "Origin Bridge ditolak." }, 403);
  const body = await request.json().catch(() => null) as { jobId?: unknown; workerToken?: unknown; outputBytes?: unknown } | null;
  const jobId = typeof body?.jobId === "string" ? body.jobId : "";
  const workerToken = typeof body?.workerToken === "string" ? body.workerToken : "";
  const outputBytes = typeof body?.outputBytes === "number" && Number.isSafeInteger(body.outputBytes) ? body.outputBytes : 0;
  if (!ID.test(jobId) || !TOKEN.test(workerToken) || outputBytes < 1024 || outputBytes > 2_147_483_648) {
    return json({ error: "Bukti hasil Bridge gak valid." }, 400);
  }
  const { data, error } = await createServiceRoleClient().rpc("charge_auto_clip_job", {
    p_job: jobId,
    p_worker_token_hash: digest(workerToken),
    p_credit_ref: `auto-clip:${jobId}`,
  });
  const job = data?.[0];
  if (error) {
    const insufficient = error.message.includes("Insufficient credits");
    return json({ error: insufficient ? "Kredit berubah dan sekarang gak cukup." : "Gagal mengunci biaya Auto Clip." }, insufficient ? 402 : 409);
  }
  if (!job) return json({ error: "Sesi Bridge habis atau job sudah dibatalkan." }, 409);
  return json({ job: { id: job.id, status: job.status, progress: job.progress, stage: job.stage } });
}
