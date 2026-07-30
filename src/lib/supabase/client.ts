import { createBrowserClient } from "@supabase/ssr";
import type { Database } from "./database.types";

/**
 * Supabase client for browser/client components.
 *
 * This uses the anon key, which is public by design — it ships in the bundle and
 * is safe there **only because RLS is enabled on every table** (see the schema
 * 4). If a table ever ships without RLS, this key becomes a full data leak.
 *
 * Never import the service role key into anything reachable from here.
 */
export function createClient() {
  return createBrowserClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  );
}
