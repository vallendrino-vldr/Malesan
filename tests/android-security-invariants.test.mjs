import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const read = (path) => fs.readFileSync(path, "utf8");

test("auth and Android shell never hand Supabase sessions through URLs", () => {
  const callback = read("src/app/auth/callback/route.ts");
  const activity = read("android/app/src/main/java/id/my/malesan/app/MainActivity.java");
  const manifest = read("android/app/src/main/AndroidManifest.xml");
  for (const source of [callback, activity, manifest]) {
    assert.doesNotMatch(source, /access_token|refresh_token|session-sync|auth-session/i);
  }
  assert.doesNotMatch(activity, /addJavascriptInterface|@JavascriptInterface|setUserAgentString|request\.grant\(/);
  assert.match(activity, /addWebMessageListener/);
  assert.match(activity, /isMainFrame/);
});
