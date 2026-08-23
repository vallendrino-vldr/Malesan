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

// Creator-facing generation must preserve the choice from UI -> prompt ->
// saved Pipeline content. These are source-level contracts on purpose: they
// catch the exact regressions that previously made every follow-up silently
// revert to TikTok even after the creator picked another platform.
const contentOptions = read("src/lib/content-options.ts");
for (const platform of [
  "tiktok_reels",
  "youtube_shorts",
  "x",
  "threads",
  "facebook",
  "linkedin",
]) {
  assert.match(contentOptions, new RegExp(`id: ["']${platform}["']`), `missing ${platform} option`);
}
for (const goal of ["views", "sales", "branding", "education", "engagement"]) {
  assert.match(contentOptions, new RegExp(`id: ["']${goal}["']`), `missing ${goal} option`);
}

const todayUi = read("src/components/IdeHariIni.tsx");
assert.match(todayUi, /TODAY_PLATFORMS\.map/);
assert.match(todayUi, /TODAY_GOALS\.map/);
assert.match(todayUi, /input:\s*\{\s*platform,\s*goal,/);
assert.match(todayUi, /bottom-\[calc\(4\.5rem\+env\(safe-area-inset-bottom\)\)\]/);
assert.match(todayUi, /scrollIntoView/);
assert.match(todayUi, /ref=\{errorRef\}[\s\S]*?role="alert"/);

// A first successful result is the product's value moment. It must never be
// replaced by a count-based onboarding redirect during router.refresh().
const appPage = read("src/app/app/page.tsx");
assert.doesNotMatch(
  appPage,
  /from\(["']generations["']\)[\s\S]{0,300}redirect\(["']\/app\/onboarding["']\)/,
  "the first generation must stay visible instead of forcing onboarding",
);
assert.match(appPage, /Profil konten lo/);
assert.match(appPage, /profile\.onboarding_completed\s*\?\s*["']\/app\/profile["']\s*:\s*["']\/app\/onboarding["']/);

const ideaCard = read("src/components/IdeaCard.tsx");
assert.match(ideaCard, /navigator\.clipboard\.writeText/);
assert.match(ideaCard, /Salin konten/);
assert.match(ideaCard, /Simpan ke Alur/);

const tutorial = read("src/components/TutorialSheet.tsx");
assert.match(tutorial, /1 menit langsung ngerti/);
assert.match(tutorial, /NEXT_PUBLIC_TUTORIAL_VIDEO_URL/);
assert.match(tutorial, /NEXT_PUBLIC_TUTORIAL_CAPTIONS_URL/);

const videoEditor = read("src/components/VideoEditor.tsx");
assert.match(videoEditor, /<details[\s\S]*?>[\s\S]*?Atur sendiri/);
assert.match(videoEditor, /Subtitle Otomatis/);

for (const file of [
  "src/app/page.tsx",
  "src/components/TutorialSheet.tsx",
  "src/components/HistoryList.tsx",
]) {
  const source = read(file);
  for (const oldLabel of ["Idea Engine", "Hook Lab", "Script Builder", "Repurpose"]) {
    assert.doesNotMatch(source, new RegExp(oldLabel), `${file} still exposes ${oldLabel}`);
  }
}

const generateRoute = read("src/app/api/generate/route.ts");
assert.match(generateRoute, /buildIdeHariIniPrompt\([\s\S]*?idePlatform,[\s\S]*?ideGoal,/);
assert.match(generateRoute, /JSON\.stringify\(\{ status:/);
assert.match(generateRoute, /platform:\s*storedPlatform\(/);

const pipeline = read("src/components/PipelineBoard.tsx");
assert.match(pipeline, /platform:\s*content\.platform\s*\|\|\s*["']tiktok["']/);
assert.doesNotMatch(pipeline, /platform:\s*["']tiktok["']\s*,/);

const progress = read("src/components/GenerationProgress.tsx");
assert.match(progress, /role=["']status["']/);
assert.doesNotMatch(progress, /const\s+STAGES\b|\bpct\b|style=\{\{\s*width:/);

const topup = read("src/app/app/topup/page.tsx");
assert.match(topup, /activeCreditPacks\(\)/);
assert.match(topup, /packsError/);
assert.match(topup, /selected\s*\?\s*`Rp \$\{selected\.price_idr/);

assert.doesNotMatch(
  read("src/components/ScriptView.tsx"),
  /Makasih udah nonton sampai habis/,
  "the UI must not invent a closing the model did not generate",
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
