/**
 * The mandatory double-spend race test. ROADMAP.md step 3.
 *
 *   node scripts/race-test.mjs [--free N] [--paid N] [--amount N] [--requests N]
 *
 * Creates a throwaway user, fires genuinely parallel HTTP requests at
 * spend_credits, and asserts that exactly floor(total / amount) of them win.
 * These are real concurrent connections through PostgREST, not sequential SQL
 * dressed up as concurrency — a sequential test would pass even if the
 * SELECT ... FOR UPDATE were removed, which is the whole thing being tested.
 *
 * Re-run this after ANY change to spend_credits. If more requests succeed than
 * expected, the lock is gone and every credit downstream is unsafe.
 *
 * Requires SUPABASE_SERVICE_ROLE_KEY in .env.local. Never run it against a
 * database with real users — it writes and deletes an auth.users row.
 */
import { readFileSync } from "node:fs";

const args = Object.fromEntries(
  process.argv.slice(2).reduce((acc, cur, i, arr) => {
    if (cur.startsWith("--")) acc.push([cur.slice(2), arr[i + 1]]);
    return acc;
  }, []),
);

const FREE = Number(args.free ?? 1);
const PAID = Number(args.paid ?? 0);
const AMOUNT = Number(args.amount ?? 1);
const REQUESTS = Number(args.requests ?? 12);
const TEST_USER = "facefeed-0000-4000-8000-0000000000ff";
const TEST_EMAIL = "race-test@malesan.invalid";

const env = Object.fromEntries(
  readFileSync(".env.local", "utf8")
    .split("\n")
    .filter((l) => l.trim() && !l.trim().startsWith("#"))
    .map((l) => {
      const i = l.indexOf("=");
      return [l.slice(0, i).trim(), l.slice(i + 1).trim()];
    }),
);

const URL_ = env.NEXT_PUBLIC_SUPABASE_URL;
const KEY = env.SUPABASE_SERVICE_ROLE_KEY;
if (!URL_ || !KEY) {
  console.error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env.local");
  process.exit(1);
}

const headers = {
  apikey: KEY,
  Authorization: `Bearer ${KEY}`,
  "Content-Type": "application/json",
};

async function rpc(fn, body) {
  const res = await fetch(`${URL_}/rest/v1/rpc/${fn}`, {
    method: "POST",
    headers,
    body: JSON.stringify(body),
  });
  return { status: res.status, body: (await res.text()).slice(0, 160) };
}

/* ---- run ---- */

const total = FREE + PAID;
const expected = Math.floor(total / AMOUNT);

console.log(
  `Setup: free=${FREE} paid=${PAID} (total ${total}), spending ${AMOUNT} per request, ` +
    `${REQUESTS} in parallel. Expecting exactly ${expected} to succeed.\n`,
);
console.log(
  "NOTE: this script cannot create the test user by itself — do that with SQL first:\n" +
    `  insert into auth.users (instance_id, id, aud, role, email, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)\n` +
    `  values ('00000000-0000-0000-0000-000000000000','${TEST_USER}','authenticated','authenticated','${TEST_EMAIL}','{}','{}', now(), now());\n` +
    `  update public.profiles set credits_free=${FREE}, credits_paid=${PAID} where id='${TEST_USER}';\n`,
);

const results = await Promise.all(
  Array.from({ length: REQUESTS }, (_, i) =>
    rpc("spend_credits", {
      p_user: TEST_USER,
      p_amount: AMOUNT,
      p_reason: "race_test",
      p_ref: `req-${i}`,
    }).then((r) => ({ i, ...r })),
  ),
);

const ok = results.filter((r) => r.status === 200);
const insufficient = results.filter((r) => r.body.includes("INSUFFICIENT_CREDITS"));
const other = results.filter(
  (r) => r.status !== 200 && !r.body.includes("INSUFFICIENT_CREDITS"),
);

const pass = ok.length === expected && other.length === 0;

console.log(
  JSON.stringify(
    {
      requestsFired: REQUESTS,
      expectedSuccesses: expected,
      succeeded: ok.length,
      rejectedInsufficient: insufficient.length,
      unexpected: other.length,
      balancesReturned: ok.map((r) => r.body),
      unexpectedDetail: other,
      verdict: pass
        ? `PASS — exactly ${expected} spend(s) won the race`
        : `FAIL — ${ok.length} succeeded (expected ${expected}), ${other.length} unexpected`,
    },
    null,
    2,
  ),
);

console.log(
  "\nNow verify the ledger by hand: sum(delta) must equal the credits actually\n" +
    "removed, and the last balance_after must match the profile's real balance.\n" +
    `Clean up with: delete from auth.users where email = '${TEST_EMAIL}';`,
);

process.exit(pass ? 0 : 1);
