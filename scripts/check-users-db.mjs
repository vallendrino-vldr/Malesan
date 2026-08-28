import fs from "fs";
import path from "path";
import { createClient } from "@supabase/supabase-js";

const envContent = fs.readFileSync(path.resolve(".env.local"), "utf8");
const env = {};
envContent.split("\n").forEach((line) => {
  const trimmed = line.trim();
  if (!trimmed || trimmed.startsWith("#")) return;
  const idx = trimmed.indexOf("=");
  if (idx !== -1) {
    const key = trimmed.slice(0, idx).trim();
    let val = trimmed.slice(idx + 1).trim();
    if (val.startsWith('"') && val.endsWith('"')) val = val.slice(1, -1);
    if (val.startsWith("'") && val.endsWith("'")) val = val.slice(1, -1);
    env[key] = val;
  }
});

const supabase = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);

async function check() {
  const { data: profiles, error: pErr } = await supabase
    .from("profiles")
    .select("*");

  console.log("Profiles in DB:", profiles);
  if (pErr) console.log("Profiles Error:", pErr);

  const { data: authUsers } = await supabase.auth.admin.listUsers();
  console.log("Auth Users:", authUsers?.users?.map((u) => ({ id: u.id, email: u.email, providers: u.app_metadata?.providers })));
}

check();
