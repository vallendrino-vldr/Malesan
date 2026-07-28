import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import type { Database } from "./database.types";

/**
 * Supabase client for server components, route handlers and server actions.
 * Still the anon key — it acts as the signed-in user, so RLS applies.
 */
export async function createClient() {
  const cookieStore = await cookies();

  return createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options),
            );
          } catch {
            // Called from a Server Component, where cookies are read-only.
            // Harmless: middleware refreshes the session on every request.
          }
        },
      },
    },
  );
}

/**
 * Service-role client. Bypasses **every** RLS policy — it is effectively
 * superuser on the database.
 *
 * Rules for using it:
 *  - server-side only, never in a file that a client component can import
 *  - only when acting as the platform itself (cron, admin grants, webhooks),
 *    never to "make a query easier"
 *  - never to read or write on behalf of a signed-in user; use createClient()
 *    for that so RLS still applies
 *
 * It throws rather than falling back if the key is missing, because a silent
 * fallback to the anon key would look like a permissions bug at 3am.
 */
export function createServiceRoleClient() {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!key) {
    throw new Error(
      "SUPABASE_SERVICE_ROLE_KEY is not set. This client must never fall back to the anon key.",
    );
  }

  return createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    key,
    {
      cookies: {
        getAll: () => [],
        setAll: () => {},
      },
    },
  );
}
