import assert from "node:assert/strict";
import { readFile, stat } from "node:fs/promises";
import path from "node:path";
const root = process.cwd();
const kb = (bytes) => Math.round(bytes / 1024);
const assetBudgets = [
  ["public/tutorial/tutorial-demo-v2.mp4", 5_600],
  ["public/tutorial/tutorial-poster.webp", 25],
  ["public/branding/logo-social.png", 750],
  ["public/branding/app-icon.png", 170],
  ["public/branding/logo-header.png", 125],
];
for (const [relativePath, maxKb] of assetBudgets) {
  const sizeKb = kb((await stat(path.join(root, relativePath))).size);
  assert.ok(sizeKb <= maxKb, `${relativePath}: ${sizeKb} KB exceeds ${maxKb} KB budget`);
}
const instrumentation = await readFile(path.join(root, "src/instrumentation-client.ts"), "utf8");
assert.match(instrumentation, /SAMPLE_RATE = 0\.1/);
assert.match(instrumentation, /location\.pathname/);
assert.doesNotMatch(instrumentation, /location\.href|location\.search|document\.cookie|localStorage/);
const endpoint = await readFile(path.join(root, "src/app/api/performance/route.ts"), "utf8");
assert.match(endpoint, /MAX_BODY_BYTES = 2_048/);
assert.match(endpoint, /sameOrigin\(request\)/);
assert.match(endpoint, /RATE_LIMIT = 60/);
assert.doesNotMatch(endpoint, /SUPABASE_SERVICE_ROLE_KEY|createClient/);
console.log("Performance budgets and privacy invariants verified.");
