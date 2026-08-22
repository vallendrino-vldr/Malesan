/**
 * Authenticated end-to-end AI accounting smoke test.
 *
 * Creates one disposable ordinary user, calls the real local /api/generate
 * route against the linked Supabase project, verifies the selected Brain model,
 * token/cost logging, and one-time credit spend, then removes every test row.
 * Secrets are loaded locally and are never printed.
 *
 * Usage: npm run test:live-ai
 * Requires a local server at MALESAN_QA_BASE (default http://127.0.0.1:3100).
 */
import { randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";
import { createServerClient } from "@supabase/ssr";
import { createClient } from "@supabase/supabase-js";

function loadEnv() {
  const values = {};
  for (const raw of readFileSync(".env.local", "utf8").split(/\r?\n/)) {
    const line = raw.trim();
    if (!line || line.startsWith("#")) continue;
    const separator = line.indexOf("=");
    if (separator < 1) continue;
    const key = line.slice(0, separator).trim();
    let value = line.slice(separator + 1).trim();
    if (
      value.length >= 2 &&
      ((value.startsWith('"') && value.endsWith('"')) ||
        (value.startsWith("'") && value.endsWith("'")))
    ) {
      value = value.slice(1, -1);
    }
    values[key] = value;
  }
  return values;
}

function invariant(value, message) {
  if (!value) throw new Error(message);
}

function sseEvents(body) {
  return body
    .split(/\r?\n\r?\n/)
    .flatMap((frame) => frame.split(/\r?\n/))
    .filter((line) => line.startsWith("data: "))
    .map((line) => {
      try {
        return JSON.parse(line.slice(6));
      } catch {
        return null;
      }
    })
    .filter(Boolean);
}

const env = loadEnv();
const supabaseUrl = env.NEXT_PUBLIC_SUPABASE_URL;
const anonKey = env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const serviceKey = env.SUPABASE_SERVICE_ROLE_KEY;
const base = process.env.MALESAN_QA_BASE ?? "http://127.0.0.1:3100";

invariant(supabaseUrl && anonKey && serviceKey, "Supabase QA env belum lengkap.");

const service = createClient(supabaseUrl, serviceKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});
const adminAuthHeaders = {
  apikey: serviceKey,
  Authorization: `Bearer ${serviceKey}`,
  "Content-Type": "application/json",
};
const suffix = randomUUID();
// GoTrue rejects the reserved .invalid TLD on this production project.
// The admin API confirms the address directly, so no email is sent.
const email = `qa-ai-${suffix}@qa.malesan.my.id`;
// Keep below bcrypt's 72-byte boundary. GoTrue currently reports an overlong
// admin-created password as a generic HTTP 500 instead of a validation error.
const password = `${randomUUID()}-Qa9!`;
let userId;

try {
  // Direct GoTrue admin calls avoid an auth-js/Node 24 Windows handle bug seen
  // after an admin request fails; PostgREST continues through supabase-js.
  const createResponse = await fetch(`${supabaseUrl}/auth/v1/admin/users`, {
    method: "POST",
    headers: adminAuthHeaders,
    body: JSON.stringify({ email, password, email_confirm: true }),
  });
  if (!createResponse.ok) {
    throw new Error(`User QA gagal dibuat (HTTP ${createResponse.status}).`);
  }
  const created = await createResponse.json();
  userId = created.id;
  invariant(userId, "Auth tidak mengembalikan user id.");

  const { error: profileError } = await service
    .from("profiles")
    .update({ credits_free: 20, credits_paid: 0, is_pro: false, role: "user" })
    .eq("id", userId);
  if (profileError) throw profileError;

  const auth = createClient(supabaseUrl, anonKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const { data: signedIn, error: signInError } = await auth.auth.signInWithPassword({
    email,
    password,
  });
  if (signInError || !signedIn.session) {
    throw signInError ?? new Error("Session QA gagal dibuat.");
  }

  const cookieJar = new Map();
  const ssr = createServerClient(supabaseUrl, anonKey, {
    cookies: {
      getAll: () =>
        [...cookieJar.entries()].map(([name, value]) => ({ name, value })),
      setAll: (cookies) => {
        for (const cookie of cookies) cookieJar.set(cookie.name, cookie.value);
      },
    },
  });
  const { error: sessionError } = await ssr.auth.setSession({
    access_token: signedIn.session.access_token,
    refresh_token: signedIn.session.refresh_token,
  });
  if (sessionError) throw sessionError;

  const before = await service
    .from("profiles")
    .select("credits_free, credits_paid")
    .eq("id", userId)
    .single();
  if (before.error) throw before.error;
  const beforeCredits = before.data.credits_free + before.data.credits_paid;

  const response = await fetch(`${base}/api/generate`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Cookie: [...cookieJar.entries()].map(([name, value]) => `${name}=${value}`).join("; "),
    },
    body: JSON.stringify({
      module: "idea",
      platform: "tiktok",
      input: { text: "Tiga ide konten singkat soal disiplin kreator pemula." },
    }),
    signal: AbortSignal.timeout(58_000),
  });
  const body = await response.text();
  invariant(response.ok, `Generate QA gagal dengan HTTP ${response.status}.`);
  const events = sseEvents(body);
  const streamError = events.find((event) => typeof event.error === "string");
  invariant(!streamError, `Generate QA gagal: ${streamError?.error ?? "error stream"}`);
  invariant(events.some((event) => event.done === true), "Stream selesai tanpa event done.");

  const after = await service
    .from("profiles")
    .select("credits_free, credits_paid")
    .eq("id", userId)
    .single();
  if (after.error) throw after.error;
  const afterCredits = after.data.credits_free + after.data.credits_paid;

  const ledger = await service
    .from("credit_ledger")
    .select("delta, ref_id, reason")
    .eq("user_id", userId)
    .lt("delta", 0);
  if (ledger.error) throw ledger.error;
  invariant(ledger.data.length === 1, `Expected 1 credit spend, got ${ledger.data.length}.`);
  const charge = Math.abs(Number(ledger.data[0].delta));
  const requestRef = ledger.data[0].ref_id;
  invariant(requestRef, "Credit spend tidak punya request ref.");
  invariant(beforeCredits - afterCredits === charge, "Saldo dan ledger tidak sinkron.");

  const usage = await service
    .from("ai_usage_log")
    .select(
      "status, model_id, provider_slug, input_tokens, output_tokens, cost_idr, credits_charged, ref_id",
    )
    .eq("user_id", userId)
    .eq("ref_id", requestRef)
    .order("attempt", { ascending: true });
  if (usage.error) throw usage.error;
  const success = usage.data.find((row) => row.status === "ok");
  invariant(success, "Tidak ada usage log sukses.");
  invariant(/deepseek/i.test(success.model_id ?? ""), "Brain primary bukan DeepSeek.");
  invariant(
    Number(success.input_tokens) + Number(success.output_tokens) > 0,
    "Token usage tidak tercatat.",
  );
  invariant(Number(success.cost_idr) > 0, "Biaya AI masih nol.");
  invariant(
    usage.data.reduce((sum, row) => sum + Number(row.credits_charged), 0) === charge,
    "Revenue usage log tidak sama dengan satu credit charge.",
  );

  const generation = await service
    .from("generations")
    .select("model_used, credits_spent")
    .eq("user_id", userId)
    .single();
  if (generation.error) throw generation.error;
  invariant(/deepseek/i.test(generation.data.model_used ?? ""), "Generation menyimpan model yang salah.");
  invariant(Number(generation.data.credits_spent) === charge, "Generation menyimpan biaya kredit yang salah.");

  console.log(
    JSON.stringify({
      verdict: "PASS",
      route: "/api/generate",
      userRole: "ordinary",
      primaryModel: success.model_id,
      attempts: usage.data.length,
      creditCharges: ledger.data.length,
      creditsCharged: charge,
      tokensRecorded: Number(success.input_tokens) + Number(success.output_tokens),
      costRecorded: Number(success.cost_idr) > 0,
      generationPersisted: true,
    }),
  );
} finally {
  if (userId) {
    await service.from("ai_usage_log").delete().eq("user_id", userId);
    await service.from("rate_limits").delete().eq("user_id", userId);
    await fetch(`${supabaseUrl}/auth/v1/admin/users/${userId}`, {
      method: "DELETE",
      headers: adminAuthHeaders,
    });
  }
}
