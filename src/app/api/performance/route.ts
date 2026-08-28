import { NextRequest, NextResponse } from "next/server";
export const dynamic = "force-dynamic";
const METRIC_NAMES = new Set(["LCP", "CLS", "INP", "TTFB"]);
const MAX_BODY_BYTES = 2_048;
const RATE_LIMIT = 60;
const WINDOW_MS = 60_000;
const buckets = new Map<string, { count: number; resetAt: number }>();
type Metric = { name: string; value: number };
function sameOrigin(request: NextRequest) {
  const origin = request.headers.get("origin");
  return !origin || origin === request.nextUrl.origin;
}
function rateLimited(request: NextRequest) {
  const now = Date.now();
  const key = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
  const current = buckets.get(key);
  if (!current || current.resetAt <= now) {
    if (buckets.size >= 1_000) {
      for (const [bucketKey, bucket] of buckets) if (bucket.resetAt <= now) buckets.delete(bucketKey);
      if (buckets.size >= 1_000) buckets.delete(buckets.keys().next().value as string);
    }
    buckets.set(key, { count: 1, resetAt: now + WINDOW_MS });
    return false;
  }
  current.count += 1;
  return current.count > RATE_LIMIT;
}
function validMetric(metric: unknown): metric is Metric {
  if (!metric || typeof metric !== "object") return false;
  const value = metric as Partial<Metric>;
  return typeof value.name === "string" && METRIC_NAMES.has(value.name) && typeof value.value === "number" && Number.isFinite(value.value) && value.value >= 0 && value.value <= (value.name === "CLS" ? 10 : 120_000);
}
export async function POST(request: NextRequest) {
  if (!sameOrigin(request)) return new NextResponse(null, { status: 403 });
  if (rateLimited(request)) return new NextResponse(null, { status: 429 });
  if (!request.headers.get("content-type")?.startsWith("application/json")) return new NextResponse(null, { status: 415 });
  const declaredLength = Number(request.headers.get("content-length") || 0);
  if (declaredLength > MAX_BODY_BYTES) return new NextResponse(null, { status: 413 });
  try {
    const raw = await request.text();
    if (new TextEncoder().encode(raw).byteLength > MAX_BODY_BYTES) return new NextResponse(null, { status: 413 });
    const body = JSON.parse(raw) as Record<string, unknown>;
    if (typeof body.path !== "string" || !body.path.startsWith("/") || body.path.length > 160 || body.path.includes("?") || !Array.isArray(body.metrics) || body.metrics.length < 1 || body.metrics.length > 4 || !body.metrics.every(validMetric)) return new NextResponse(null, { status: 400 });
    const viewport = typeof body.viewport === "string" && /^\d{2,5}x\d{2,5}$/.test(body.viewport) ? body.viewport : "unknown";
    const connection = typeof body.connection === "string" && /^(slow-2g|2g|3g|4g|unknown)$/.test(body.connection) ? body.connection : "unknown";
    const buildId = typeof body.buildId === "string" ? body.buildId.slice(0, 16) : "unknown";
    console.info(JSON.stringify({ event: "web_vitals", path: body.path, metrics: body.metrics, viewport, connection, buildId }));
    return new NextResponse(null, { status: 204, headers: { "Cache-Control": "no-store" } });
  } catch {
    return new NextResponse(null, { status: 400 });
  }
}
