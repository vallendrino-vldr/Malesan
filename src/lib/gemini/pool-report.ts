import "server-only";
import { createServiceRoleClient } from "@/lib/supabase/server";
import { getPool, isCooling } from "./keys";
import { adapterFor } from "./providers";

/**
 * Per-key health for the admin panel.
 *
 * The panel used to render straight from `gemini_pool_used_today()`, which
 * means it could only ever show keys that had already served a request. A key
 * that was configured but never reached — wrong project, revoked, typo'd into
 * the wrong env var — looked exactly like a key that simply had not been used
 * yet: absent. That is the one question an operator actually has about a key
 * pool, and the panel could not answer it.
 *
 * So the roster comes from the environment (`getPool()`), and usage is joined
 * onto it. A configured key with no usage now renders as "belum kepakai"
 * instead of vanishing.
 */

/** Requests a key is assumed to be allowed per day. Same source as the guard. */
export function capPerKey(): number {
  return Number(process.env.GEMINI_DAILY_CAP_PER_KEY ?? 1000);
}

export type KeyHealth =
  /** Configured, no traffic today. Cannot be called healthy — only untested. */
  | "idle"
  /** Serving requests, error rate under a fifth. */
  | "healthy"
  /** Serving, but a fifth or more of today's calls failed. */
  | "degraded"
  /** Rate limited recently; rotation is currently stepping around it. */
  | "cooling"
  /** At or past the assumed daily cap. */
  | "exhausted";

export type KeyReport = {
  slot: number;
  requests: number;
  errors: number;
  tokens: number;
  cap: number;
  /** 0–1. Clamped, because the cap is an assumption and can be overshot. */
  usedRatio: number;
  lastUsedAt: string | null;
  health: KeyHealth;
};

export type PoolReport = {
  keys: KeyReport[];
  capPerKey: number;
  capacity: number;
  used: number;
  remainingRatio: number;
  /** True when free users are being turned away. Mirrors quota.ts. */
  guardEngaged: boolean;
  /** Set when usage could not be read; the roster is still valid. */
  usageError: string | null;
};

type Row = {
  key_index: number;
  requests: number;
  errors: number;
  tokens: number;
  last_used_at: string | null;
};

const GUARD_THRESHOLD = 0.2;

export async function getPoolReport(): Promise<PoolReport> {
  const cap = capPerKey();

  // The roster is the environment, not the database. This is the whole point:
  // an unused key must still appear.
  let slots: number[] = [];
  try {
    slots = getPool().map((k) => k.index);
  } catch {
    // No keys configured at all. getPool throws by design; the panel should
    // render that state rather than crash the admin overview.
    slots = [];
  }

  let rows: Row[] = [];
  let usageError: string | null = null;
  try {
    const { data, error } = await createServiceRoleClient().rpc("gemini_pool_report_today");
    // Reading the error is not optional here. A discarded `error` is what made
    // the top-up queue render "empty" with money sitting in it (HANDOFF §4);
    // the same shape of bug would render a busy pool as an idle one.
    if (error) throw error;
    rows = (data ?? []) as Row[];
  } catch (e) {
    usageError = e instanceof Error ? e.message : "Gagal baca pemakaian";
  }

  const byIndex = new Map(rows.map((r) => [r.key_index, r]));

  const keys: KeyReport[] = slots.map((slot) => {
    const r = byIndex.get(slot);
    const requests = Number(r?.requests ?? 0);
    const errors = Number(r?.errors ?? 0);
    const tokens = Number(r?.tokens ?? 0);
    const usedRatio = cap > 0 ? Math.min(1, requests / cap) : 0;

    let health: KeyHealth;
    if (isCooling(slot)) health = "cooling";
    else if (requests === 0) health = "idle";
    else if (requests >= cap) health = "exhausted";
    else if (errors / requests >= 0.2) health = "degraded";
    else health = "healthy";

    return {
      slot,
      requests,
      errors,
      tokens,
      cap,
      usedRatio,
      lastUsedAt: r?.last_used_at ?? null,
      health,
    };
  });

  // Usage from keys no longer configured still counts against nothing, so it is
  // deliberately excluded from `used`: capacity and usage must describe the same
  // set of keys or the ratio is meaningless.
  const used = keys.reduce((s, k) => s + k.requests, 0);
  const capacity = keys.length * cap;
  const remainingRatio = capacity > 0 ? Math.max(0, (capacity - used) / capacity) : 0;

  return {
    keys,
    capPerKey: cap,
    capacity,
    used,
    remainingRatio,
    guardEngaged: capacity > 0 && remainingRatio < GUARD_THRESHOLD,
    usageError,
  };
}

export type ProbeResult = {
  slot: number;
  ok: boolean;
  status: number | null;
  ms: number;
  /** Provider's own message on failure. Never contains the key. */
  message: string | null;
};

/**
 * Calls each configured key once, for real.
 *
 * Usage counters answer "has this key worked recently". They cannot answer "is
 * this key valid right now", which is the question after adding one. Nothing
 * short of a live call distinguishes a brand-new working key from a revoked
 * one — both have zero rows.
 *
 * Deliberately NOT recorded through `recordUsage`: a diagnostic that pollutes
 * the counter it is diagnosing makes the next reading harder to trust. The
 * request does still consume real upstream quota, and the panel says so.
 */
export async function probePool(): Promise<ProbeResult[]> {
  const model = process.env.GEMINI_MODEL_FREE;
  if (!model) {
    return [{ slot: 0, ok: false, status: null, ms: 0, message: "GEMINI_MODEL_FREE belum diset" }];
  }

  let pool: { index: number; value: string }[];
  try {
    pool = getPool();
  } catch (e) {
    return [
      { slot: 0, ok: false, status: null, ms: 0, message: e instanceof Error ? e.message : "No keys" },
    ];
  }

  const adapter = adapterFor("gemini");

  return Promise.all(
    pool.map(async ({ index, value }): Promise<ProbeResult> => {
      const started = Date.now();
      try {
        // Built through the adapter so the probe exercises the same URL, auth
        // header and body shape the product uses. A probe that talks to the
        // provider its own way can pass while the product fails.
        const req = adapter.buildRequest({
          apiKey: value,
          model,
          prompt: "Balas satu kata: oke",
          stream: false,
        });
        const res = await fetch(req.url, {
          method: "POST",
          headers: req.headers,
          body: req.body,
          signal: AbortSignal.timeout(15_000),
        });
        const ms = Date.now() - started;

        if (res.ok) return { slot: index, ok: true, status: res.status, ms, message: null };

        const raw = await res.text().catch(() => "");
        let message = raw.slice(0, 200);
        try {
          message = (JSON.parse(raw) as { error?: { message?: string } })?.error?.message ?? message;
        } catch {
          // Not JSON. The truncated body is still the most useful thing we have.
        }
        return { slot: index, ok: false, status: res.status, ms, message: message.slice(0, 200) };
      } catch (e) {
        return {
          slot: index,
          ok: false,
          status: null,
          ms: Date.now() - started,
          message: e instanceof Error ? e.message : "Gagal konek",
        };
      }
    }),
  );
}
