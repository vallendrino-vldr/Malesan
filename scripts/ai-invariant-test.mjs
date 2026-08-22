import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const root = process.cwd();
const read = (path) => readFileSync(resolve(root, path), "utf8");

const aiEntrypoints = [
  "src/app/api/generate/route.ts",
  "src/app/api/vibe/route.ts",
  "src/app/api/vibe/questions/route.ts",
  "src/app/api/autocomplete/route.ts",
  "src/app/api/onboarding/route.ts",
  "src/app/api/pipeline/schedule/route.ts",
  "src/app/api/react/route.ts",
  "src/app/api/recycle/route.ts",
  "src/app/api/admin/assistant/route.ts",
  "src/app/api/cron/trends/route.ts",
  "src/lib/payments/proof-check.ts",
];

for (const file of aiEntrypoints) {
  const source = read(file);
  assert.match(source, /\brunAI(?:Stream)?\b/, `${file} must use the shared AI engine`);
  assert.doesNotMatch(
    source,
    /from\s+["'][^"']*(?:gemini\/client|gemini\/providers|groq\/llm)["']/,
    `${file} imports a provider client directly`,
  );
  assert.doesNotMatch(source, /\bmodel\s*:\s*["'][^"']+["']/, `${file} hardcodes a model id`);
}

const chargedTextRoutes = [
  "src/app/api/generate/route.ts",
  "src/app/api/vibe/route.ts",
  "src/app/api/autocomplete/route.ts",
  "src/app/api/onboarding/route.ts",
  "src/app/api/pipeline/schedule/route.ts",
  "src/app/api/react/route.ts",
  "src/app/api/recycle/route.ts",
];
for (const file of chargedTextRoutes) {
  const source = read(file);
  assert.match(source, /spendCredits\(/, `${file} must charge through spendCredits`);
  assert.match(source, /refundCredits\(/, `${file} must refund a failed AI request by ref`);
}

const limitedRoutes = [
  ...chargedTextRoutes,
  "src/app/api/vibe/questions/route.ts",
  "src/app/api/video/transcribe/route.ts",
  "src/app/api/admin/assistant/route.ts",
];
for (const file of limitedRoutes) {
  assert.match(read(file), /aiRateLimit\(/, `${file} must enforce the database rate limit`);
}

for (const file of [
  "src/app/api/generate/route.ts",
  "src/app/api/vibe/route.ts",
  "src/app/api/autocomplete/route.ts",
]) {
  const source = read(file);
  assert.match(source, /checkPoolAdmission\(\{[\s\S]*?feature:/, `${file} quota check must be Brain-aware`);
  assert.match(
    source,
    /allowSharedGemini:\s*admission\.allowSharedGemini/,
    `${file} must carry the Gemini reservation into the engine`,
  );
}

assert.match(
  read("src/lib/gemini/quota.ts"),
  /resolveRoute\(caller\.feature\)/,
  "the shared-pool guard must inspect the resolved Brain route",
);
assert.match(
  read("src/lib/ai/engine.ts"),
  /route\.candidates\.filter\(\(c\) => c\.provider\.key_source !== "env_gemini_pool"\)/,
  "the engine must remove a reserved Gemini pool without bypassing the Brain",
);

assert.doesNotMatch(
  read("src/lib/ai/engine.ts"),
  /\b(?:spendCredits|refundCredits)\b/,
  "provider fallback must remain below the credit layer",
);

for (const file of [
  "src/lib/ai/discovery.ts",
  "src/lib/ai/balance.ts",
  "src/lib/gemini/client.ts",
]) {
  assert.match(read(file), /assertSafeOutboundUrl/, `${file} must validate custom outbound URLs`);
}

const nextConfig = read("next.config.ts");
const worker = read("public/sw.js");
const manifest = read("src/app/manifest.ts");
assert.match(nextConfig, /Cache-Control["',:\s]+value:\s*"no-cache, no-store, must-revalidate"/);
assert.match(worker, /SKIP_WAITING/);
assert.match(worker, /url\.pathname\.startsWith\("\/api\/"\)/);
assert.match(worker, /keys\.filter\(\(k\) => k !== CACHE\)/);
assert.match(manifest, /display:\s*"standalone"/);

console.log(`AI/PWA invariants: ${aiEntrypoints.length} engine paths verified`);
