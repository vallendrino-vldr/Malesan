type MetricName = "LCP" | "CLS" | "INP" | "TTFB";
const SAMPLE_RATE = 0.1;
const endpoint = "/api/performance";
const metrics = new Map<MetricName, number>();
const sampled = Math.random() < SAMPLE_RATE;
let sent = false;
function record(name: MetricName, value: number) {
  if (!Number.isFinite(value) || value < 0) return;
  metrics.set(name, Math.round(value * 100) / 100);
}
function flush() {
  if (!sampled || sent || metrics.size === 0) return;
  sent = true;
  const body = JSON.stringify({
    path: location.pathname,
    metrics: Array.from(metrics, ([name, value]) => ({ name, value })),
    viewport: `${window.innerWidth}x${window.innerHeight}`,
    connection: (navigator as Navigator & { connection?: { effectiveType?: string } }).connection?.effectiveType ?? "unknown",
    buildId: process.env.NEXT_PUBLIC_BUILD_ID ?? "dev",
  });
  try {
    if (navigator.sendBeacon?.(endpoint, new Blob([body], { type: "application/json" }))) return;
    void fetch(endpoint, { method: "POST", body, headers: { "Content-Type": "application/json" }, keepalive: true, credentials: "omit" }).catch(() => undefined);
  } catch {
    // Telemetry must never affect product behavior.
  }
}
if (sampled && typeof PerformanceObserver !== "undefined") {
  try {
    const navigation = performance.getEntriesByType("navigation")[0] as PerformanceNavigationTiming | undefined;
    if (navigation) record("TTFB", navigation.responseStart);
    new PerformanceObserver((list) => {
      const latest = list.getEntries().at(-1);
      if (latest) record("LCP", latest.startTime);
    }).observe({ type: "largest-contentful-paint", buffered: true });
    let cls = 0;
    new PerformanceObserver((list) => {
      for (const entry of list.getEntries() as Array<PerformanceEntry & { hadRecentInput?: boolean; value?: number }>) {
        if (!entry.hadRecentInput) cls += entry.value ?? 0;
      }
      record("CLS", cls);
    }).observe({ type: "layout-shift", buffered: true });
    new PerformanceObserver((list) => {
      for (const entry of list.getEntries()) record("INP", Math.max(metrics.get("INP") ?? 0, entry.duration));
    }).observe({ type: "event", buffered: true, durationThreshold: 40 } as PerformanceObserverInit);
    addEventListener("pagehide", flush, { once: true });
    addEventListener("visibilitychange", () => { if (document.visibilityState === "hidden") flush(); });
    setTimeout(flush, 15_000);
  } catch {
    // Unsupported observer types degrade silently on older browsers.
  }
}
