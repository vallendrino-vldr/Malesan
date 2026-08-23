import "server-only";

import { createServiceRoleClient } from "@/lib/supabase/server";

type LimitRow = {
  allowed: boolean;
  retry_after_seconds: number;
  request_count: number;
};

/**
 * One atomic, database-backed guard for every authenticated AI surface.
 *
 * Serverless instances cannot share an in-memory counter, so a Map-based limit
 * would reset whenever Vercel moved a request to another function. The RPC
 * increments one row under a primary-key conflict, which makes concurrent
 * requests count correctly across every instance.
 *
 * This deliberately fails closed. If the guard cannot verify capacity, making
 * a paid provider call anyway turns a database incident into an unbounded bill.
 */
export async function aiRateLimit(
  userId: string,
  scope: string,
  limit: number,
  windowSeconds = 60,
): Promise<Response | null> {
  const { data, error } = await createServiceRoleClient().rpc("consume_rate_limit", {
    p_user: userId,
    p_scope: scope,
    p_limit: limit,
    p_window_seconds: windowSeconds,
  });

  if (error) {
    console.error("AI rate-limit check failed", { scope, code: error.code });
    return Response.json(
      { error: "Malesan lagi ngatur antrean. Coba lagi sebentar ya." },
      { status: 503, headers: { "Retry-After": "5" } },
    );
  }

  const row = (data as LimitRow[] | null)?.[0];
  if (!row?.allowed) {
    const retry = Math.max(1, Number(row?.retry_after_seconds ?? windowSeconds));
    return Response.json(
      { error: `Kebanyakan permintaan sekaligus. Coba lagi dalam ${retry} detik.` },
      { status: 429, headers: { "Retry-After": String(retry) } },
    );
  }

  return null;
}
