import "server-only";
import type { Capability, ProviderRow, Protocol } from "./types";
import { resolveProviderKey } from "./registry";

/**
 * Model discovery — the SCAN MODELS button.
 *
 * Every provider publishes a list endpoint and every one shapes it differently,
 * so this is a switch on protocol rather than a method on the generation
 * adapter. Keeping it out of providers.ts is deliberate: that module's job is
 * to make one call correctly, and forcing a discovery method onto its interface
 * would mean every future adapter has to implement one before it can generate.
 *
 * What a scan returns is a PROPOSAL, never a commitment. Discovered models land
 * inactive with guessed capabilities; the owner enables and corrects them. A
 * scan that silently switched on a hundred models would be a way to spend money
 * by accident.
 */

export type DiscoveredModel = {
  model_id: string;
  label: string | null;
  context_length: number | null;
  input_price_usd_per_mtok: number;
  output_price_usd_per_mtok: number;
  capabilities: Capability[];
};

const GEMINI_ROOT = "https://generativelanguage.googleapis.com/v1beta";

/** Auth header per protocol. Shared with the balance probe. */
export function authHeaders(protocol: Protocol, apiKey: string): Record<string, string> {
  switch (protocol) {
    case "gemini":
      return { "x-goog-api-key": apiKey };
    case "anthropic":
      return { "x-api-key": apiKey, "anthropic-version": "2023-06-01" };
    case "openai":
    default:
      return { Authorization: `Bearer ${apiKey}` };
  }
}

function rootFor(provider: ProviderRow): string {
  const base = provider.base_url?.trim();
  if (base) return base.replace(/\/$/, "");
  switch (provider.protocol) {
    case "gemini":
      return GEMINI_ROOT;
    case "anthropic":
      return "https://api.anthropic.com/v1";
    case "openai":
    default:
      return "https://api.openai.com/v1";
  }
}

/**
 * Guess what a model can do from its id.
 *
 * Openly a heuristic. It exists because a scan returning a hundred models with
 * empty capability lists is unusable — the router filters on capabilities, so
 * every one of them would be ineligible for every feature and the owner would
 * have to tag them by hand before anything worked. A wrong guess is one click to
 * fix; a hundred blanks is an afternoon.
 *
 * Only `text` is asserted with confidence. Everything else is a hint.
 */
function guessCapabilities(id: string, contextLength: number | null): Capability[] {
  const s = id.toLowerCase();
  const caps = new Set<Capability>(["text"]);

  if (/vision|4o|omni|gemini|claude-3|claude-4|sonnet|opus|pixtral|llava/.test(s)) {
    caps.add("vision");
  }
  if (/flash|mini|lite|turbo|haiku|instant|8b|small/.test(s)) {
    caps.add("fast");
    caps.add("cheap");
  }
  if (/opus|pro|gpt-5|o1|o3|r1|reason|think|sonnet-4|ultra/.test(s)) {
    caps.add("reasoning");
    caps.add("premium");
  }
  if (/cod(er|e)|deepseek|qwen.*coder|devstral/.test(s)) {
    caps.add("coding");
  }
  if ((contextLength ?? 0) >= 200_000) {
    caps.add("long_context");
  }
  return [...caps];
}

async function fetchJson(url: string, headers: Record<string, string>): Promise<unknown> {
  const res = await fetch(url, { headers, method: "GET" });
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`${res.status} ${body.slice(0, 200)}`);
  }
  return res.json();
}

/**
 * List the models a provider offers.
 *
 * Throws with the upstream status and body on failure, because "scan found
 * nothing" and "your key is wrong" must not look the same to the person
 * pressing the button.
 */
export async function scanModels(provider: ProviderRow): Promise<DiscoveredModel[]> {
  const key = resolveProviderKey(provider);
  if (!key && provider.key_source === "db") {
    throw new Error("Provider ini belum ada API key-nya.");
  }

  // The env pool has no single key to introspect with; borrow slot 1, which is
  // the same project the pool's quota is measured against anyway.
  const effectiveKey = key ?? process.env.GEMINI_API_KEY_1;
  if (!effectiveKey) throw new Error("Gak ada API key yang bisa dipakai buat scan.");

  const root = rootFor(provider);
  const headers = authHeaders(provider.protocol, effectiveKey);

  if (provider.protocol === "gemini") {
    const json = (await fetchJson(`${root}/models`, headers)) as {
      models?: {
        name?: string;
        displayName?: string;
        inputTokenLimit?: number;
        supportedGenerationMethods?: string[];
      }[];
    };
    return (json.models ?? [])
      // Embedding and tuning endpoints appear in the same list and cannot serve
      // a generation, so listing them would be offering the owner a broken choice.
      .filter((m) => m.supportedGenerationMethods?.includes("generateContent"))
      .map((m) => {
        const id = (m.name ?? "").replace(/^models\//, "");
        const ctx = m.inputTokenLimit ?? null;
        return {
          model_id: id,
          label: m.displayName ?? null,
          context_length: ctx,
          input_price_usd_per_mtok: 0,
          output_price_usd_per_mtok: 0,
          capabilities: guessCapabilities(id, ctx),
        };
      })
      .filter((m) => m.model_id);
  }

  if (provider.protocol === "anthropic") {
    const json = (await fetchJson(`${root}/models`, headers)) as {
      data?: { id?: string; display_name?: string }[];
    };
    return (json.data ?? [])
      .filter((m) => m.id)
      .map((m) => ({
        model_id: m.id as string,
        label: m.display_name ?? null,
        context_length: 200_000,
        input_price_usd_per_mtok: 0,
        output_price_usd_per_mtok: 0,
        capabilities: guessCapabilities(m.id as string, 200_000),
      }));
  }

  // OpenAI-compatible: OpenAI itself, SumoPod, OpenRouter, Groq, Together, and
  // most self-hosted gateways. OpenRouter is the useful case — it returns
  // context length and per-token pricing inline, so a scan there fills in the
  // cost dashboard with no typing at all.
  const json = (await fetchJson(`${root}/models`, headers)) as {
    data?: {
      id?: string;
      name?: string;
      context_length?: number;
      top_provider?: { context_length?: number };
      pricing?: { prompt?: string | number; completion?: string | number };
    }[];
  };

  // Pricing, when present, is per single token. Per million is the unit every
  // human and every vendor page uses.
  const perMtok = (v: string | number | undefined): number => {
    const n = typeof v === "string" ? Number(v) : v;
    return Number.isFinite(n) && (n as number) > 0 ? (n as number) * 1_000_000 : 0;
  };

  return (json.data ?? [])
    .filter((m) => m.id)
    .map((m) => {
      const ctx = m.context_length ?? m.top_provider?.context_length ?? null;
      return {
        model_id: m.id as string,
        label: m.name ?? null,
        context_length: ctx,
        input_price_usd_per_mtok: perMtok(m.pricing?.prompt),
        output_price_usd_per_mtok: perMtok(m.pricing?.completion),
        capabilities: guessCapabilities(m.id as string, ctx),
      };
    });
}

/**
 * One cheap round trip that proves a provider is reachable and the key works.
 *
 * Uses the model list rather than a generation: it costs nothing, needs no
 * model id to be chosen yet, and still exercises the exact URL and credential a
 * real call would use. Returns latency because "it works" and "it works but
 * takes nine seconds" are different answers.
 */
export async function testProvider(
  provider: ProviderRow,
): Promise<{ ok: true; latencyMs: number; modelCount: number } | { ok: false; error: string }> {
  const started = Date.now();
  try {
    const models = await scanModels(provider);
    return { ok: true, latencyMs: Date.now() - started, modelCount: models.length };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "gagal nyambung" };
  }
}
