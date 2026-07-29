/**
 * Apply migration via Supabase service-role client.
 * Run: node scripts/apply-migration.mjs
 */
import { readFileSync } from "fs";
import { createClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!url || !key) {
  console.error("Set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY");
  process.exit(1);
}

const file = process.argv[2];
if (!file) {
  console.error("Usage: node scripts/apply-migration.mjs <path-to-sql>");
  process.exit(1);
}

const sql = readFileSync(file, "utf8");
const supabase = createClient(url, key);

// Split on semicolons, execute each statement
const statements = sql
  .split(/;\s*$/m)
  .map((s) => s.trim())
  .filter((s) => s.length > 0 && !s.startsWith("--"));

console.log(`Executing ${statements.length} statements from ${file}...`);

for (let i = 0; i < statements.length; i++) {
  const stmt = statements[i];
  const preview = stmt.slice(0, 80).replace(/\n/g, " ");
  try {
    const { error } = await supabase.rpc("exec_sql", { sql_string: stmt });
    if (error) {
      // Try a different approach - direct fetch to the postgrest endpoint
      throw error;
    }
    console.log(`  [${i + 1}] OK: ${preview}...`);
  } catch (e) {
    console.log(`  [${i + 1}] SKIP (rpc not available): ${preview}...`);
    console.log(`    Error: ${e.message || e}`);
  }
}

console.log("\nDone. If statements failed, apply manually via Supabase Dashboard > SQL Editor.");
