const BASE_URL = process.env.TEST_BASE_URL || "https://www.malesan.my.id";
const CONCURRENCY = 25; // 25 simultaneous users per wave
const WAVES = 3; // 3 continuous waves = 75 user sessions

console.log("=================================================================");
console.log(`🚀 MALESAN MULTI-WAVE HIGH CONCURRENCY STRESS BENCHMARK`);
console.log(`🎯 Target: ${BASE_URL}`);
console.log(`👥 Concurrent Users Per Wave: ${CONCURRENCY} | Total Waves: ${WAVES}`);
console.log("=================================================================\n");

const endpoints = [
  { name: "1. Landing Page (Root /)", url: `${BASE_URL}/`, method: "GET" },
  { name: "2. Sign-in Page (/masuk)", url: `${BASE_URL}/masuk`, method: "GET" },
  { name: "3. App Studio Shell (/app)", url: `${BASE_URL}/app`, method: "GET" },
  { name: "4. Web Manifest (/manifest.webmanifest)", url: `${BASE_URL}/manifest.webmanifest`, method: "GET" },
  { name: "5. Autocomplete API (/api/autocomplete)", url: `${BASE_URL}/api/autocomplete?q=trik`, method: "GET" },
  { name: "6. Vibe Questions API (/api/vibe/questions)", url: `${BASE_URL}/api/vibe/questions`, method: "GET" },
];

async function measureRequest(endpoint, userId, wave) {
  const start = performance.now();
  try {
    const res = await fetch(endpoint.url, {
      method: endpoint.method,
      headers: {
        "User-Agent": `MalesanStressTest/2.0 (Wave-${wave}-User-${userId})`,
        "Accept": "text/html,application/json,*/*",
      },
    });

    const duration = performance.now() - start;
    const body = await res.text();

    return {
      wave,
      userId,
      endpoint: endpoint.name,
      status: res.status,
      ok: res.status < 500, // 200, 307, 401 are expected/valid HTTP responses
      duration,
      bytes: body.length,
    };
  } catch (err) {
    const duration = performance.now() - start;
    return {
      wave,
      userId,
      endpoint: endpoint.name,
      status: 0,
      ok: false,
      duration,
      error: err.message,
    };
  }
}

async function runBenchmark() {
  const allResults = [];

  for (let wave = 1; wave <= WAVES; wave++) {
    console.log(`🌊 --- WAVE ${wave} / ${WAVES} (${CONCURRENCY} SIMULTANEOUS USERS) ---`);

    for (const endpoint of endpoints) {
      process.stdout.write(`  ⚡ Firing ${CONCURRENCY} requests at [${endpoint.name}]... `);
      const startBatch = performance.now();

      const promises = Array.from({ length: CONCURRENCY }, (_, i) =>
        measureRequest(endpoint, i + 1, wave)
      );

      const batchResults = await Promise.all(promises);
      const batchDuration = performance.now() - startBatch;

      allResults.push(...batchResults);

      const failed = batchResults.filter((r) => !r.ok);
      const durations = batchResults.map((r) => r.duration).sort((a, b) => a - b);
      const p50 = durations[Math.floor(durations.length * 0.5)].toFixed(1);
      const p95 = durations[Math.floor(durations.length * 0.95)].toFixed(1);
      const max = durations[durations.length - 1].toFixed(1);

      if (failed.length === 0) {
        console.log(`✅ [100% OK] P50: ${p50}ms | P95: ${p95}ms | Max: ${max}ms (${(CONCURRENCY / (batchDuration / 1000)).toFixed(1)} req/s)`);
      } else {
        console.log(`❌ [${failed.length} FAILED] P50: ${p50}ms | P95: ${p95}ms`);
      }
    }
    console.log("");
  }

  console.log("=================================================================");
  console.log("📊 MULTI-WAVE SUSTAINED CONCURRENCY BENCHMARK REPORT:");
  console.log("=================================================================");

  const totalRequests = allResults.length;
  const successfulRequests = allResults.filter((r) => r.ok).length;
  const failedRequests = totalRequests - successfulRequests;
  const allDurations = allResults.map((r) => r.duration).sort((a, b) => a - b);

  const avgLatency = (allDurations.reduce((a, b) => a + b, 0) / totalRequests).toFixed(1);
  const p50 = allDurations[Math.floor(allDurations.length * 0.5)].toFixed(1);
  const p95 = allDurations[Math.floor(allDurations.length * 0.95)].toFixed(1);
  const p99 = allDurations[Math.floor(allDurations.length * 0.99)].toFixed(1);
  const max = allDurations[allDurations.length - 1].toFixed(1);

  console.log(`Total Requests Fired Across All Waves: ${totalRequests}`);
  console.log(`Successful Responses (0 Server Crashes / 0 500s): ${successfulRequests} / ${totalRequests} (${((successfulRequests / totalRequests) * 100).toFixed(1)}%)`);
  console.log(`Server Crashes / Unhandled Errors: ${failedRequests}`);
  console.log(`Average Latency: ${avgLatency} ms`);
  console.log(`P50 (Median) Latency: ${p50} ms`);
  console.log(`P95 Latency: ${p95} ms`);
  console.log(`P99 Latency: ${p99} ms`);
  console.log(`Max Latency: ${max} ms`);
  console.log("=================================================================");

  if (failedRequests === 0) {
    console.log("🛡️ ARCHITECTURAL VERDICT: ROCK-SOLID & PRODUCTION-READY (0 CRASHES)");
    console.log("=================================================================\n");
  } else {
    console.error("❌ ARCHITECTURAL VERDICT: FAILED — Server errors detected.");
    process.exit(1);
  }
}

runBenchmark().catch((err) => {
  console.error("Fatal benchmark error:", err);
  process.exit(1);
});
