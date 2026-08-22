"use server";

import { revalidatePath } from "next/cache";
import { createServiceRoleClient } from "@/lib/supabase/server";
import { verifyAdmin, audit } from "@/lib/admin/guard";
import { encryptSecret, maskKey, decryptSecret } from "@/lib/gemini/crypto";
import { invalidateAiCache, getFleet, resolveProviderKey } from "@/lib/ai/registry";
import { scanModels, testProvider } from "@/lib/ai/discovery";
import { checkBalance, balanceTrend } from "@/lib/ai/balance";
import { runOnModel } from "@/lib/ai/engine";
import { resolveRoute } from "@/lib/ai/router";
import { costIdr } from "@/lib/ai/cost";
import { getUsdToIdr } from "@/lib/config";
import type { Database } from "@/lib/supabase/database.types";
import type {
  Capability,
  ModelRow,
  ProviderRow,
  ProviderView,
  Protocol,
  RouteMode,
  RoutePrefer,
  RouteRow,
} from "@/lib/ai/types";

/**
 * Admin actions for the AI Provider Management Layer.
 *
 * Every export here is a public HTTP endpoint — that is what `"use server"`
 * means — so every one of them starts with verifyAdmin() and no exception is
 * made for the read-only ones. A provider list is not secret, but it names the
 * owner's vendors and spending, and there is no reason to hand that to an
 * anonymous caller.
 *
 * ── THE KEY RULE ─────────────────────────────────────────────────────────────
 * A provider API key crosses this boundary in exactly one direction: inward.
 * Nothing here ever returns a key, encrypted or otherwise. `ProviderView` has no
 * field for one; the UI gets `has_key` and a four-character mask, which is
 * enough to answer "is it set" and "is it the right one" and nothing else.
 */

type ProviderUpdate = Database["public"]["Tables"]["ai_providers"]["Update"];
type ModelUpdate = Database["public"]["Tables"]["ai_models"]["Update"];

const REVALIDATE = [
  "/admin/ai",
  "/admin/ai/models",
  "/admin/ai/playground",
  "/admin/ai/biaya",
  "/admin",
];
const revalidateAll = () => REVALIDATE.forEach((p) => revalidatePath(p));

/** Rows -> the browser-safe view. The one place the key is stripped. */
function toView(p: ProviderRow, models: ModelRow[]): ProviderView {
  const mine = models.filter((m) => m.provider_id === p.id);
  let mask: string | null = null;
  if (p.api_key_encrypted) {
    try {
      mask = maskKey(decryptSecret(p.api_key_encrypted));
    } catch {
      // A key encrypted under a rotated ENCRYPTION_KEY cannot be read back.
      // Say so in the mask rather than pretending there is no key at all —
      // "set but unreadable" is a different problem from "not set".
      mask = "gak kebaca";
    }
  }
  return {
    id: p.id,
    slug: p.slug,
    label: p.label,
    protocol: p.protocol,
    base_url: p.base_url,
    key_source: p.key_source,
    balance_url: p.balance_url,
    balance_path: p.balance_path,
    balance_currency: p.balance_currency,
    low_balance_threshold: p.low_balance_threshold,
    is_active: p.is_active,
    priority: p.priority,
    last_checked_at: p.last_checked_at,
    last_ok_at: p.last_ok_at,
    last_error: p.last_error,
    last_latency_ms: p.last_latency_ms,
    consecutive_failures: p.consecutive_failures,
    notes: p.notes,
    has_key: Boolean(p.api_key_encrypted) || p.key_source === "env_gemini_pool",
    key_mask: mask,
    model_count: mine.length,
    active_model_count: mine.filter((m) => m.is_active).length,
  };
}

// ============================================================
// PROVIDERS
// ============================================================

export async function listProviders(): Promise<ProviderView[]> {
  await verifyAdmin();
  const { providers, models } = await getFleet();
  return providers.map((p) => toView(p, models));
}

export type ProviderInput = {
  /** Omit to create. */
  id?: string;
  slug: string;
  label: string;
  protocol: Protocol;
  baseUrl?: string;
  /** Plaintext, encrypted here. Empty string means "leave the existing key". */
  apiKey?: string;
  balanceUrl?: string;
  balancePath?: string;
  balanceCurrency?: string;
  lowBalanceThreshold?: number | null;
  priority?: number;
  isActive?: boolean;
  notes?: string;
};

export async function saveProvider(input: ProviderInput): Promise<{ id: string }> {
  const adminId = await verifyAdmin();

  const slug = input.slug.trim().toLowerCase().replace(/[^a-z0-9-]/g, "-");
  if (slug.length < 2) throw new Error("Slug-nya minimal 2 huruf, cuma huruf kecil dan strip.");
  if (!input.label.trim()) throw new Error("Kasih nama providernya.");

  // A non-Gemini provider with no base URL and no key is not a provider, it is
  // a row that will fail on first use with a confusing error. Catch it here.
  if (input.protocol !== "gemini" && !input.baseUrl?.trim() && !input.apiKey?.trim() && !input.id) {
    throw new Error("Provider ini butuh Base URL dan API key.");
  }

  const db = createServiceRoleClient();
  const now = new Date().toISOString();

  const patch: ProviderUpdate = {
    slug,
    label: input.label.trim(),
    protocol: input.protocol,
    base_url: input.baseUrl?.trim() || null,
    balance_url: input.balanceUrl?.trim() || null,
    balance_path: input.balancePath?.trim() || null,
    balance_currency: input.balanceCurrency?.trim() || "USD",
    low_balance_threshold: input.lowBalanceThreshold ?? null,
    priority: input.priority ?? 100,
    is_active: input.isActive ?? false,
    notes: input.notes?.trim() || null,
    updated_at: now,
  };

  // Empty means "keep what is there". Without this, opening the edit form and
  // pressing save would silently wipe the key, because the form never had it to
  // send back — it is never sent to the browser in the first place.
  if (input.apiKey?.trim()) {
    patch.api_key_encrypted = encryptSecret(input.apiKey.trim());
    patch.key_source = "db";
  }

  let id: string;
  if (input.id) {
    const { data, error } = await db
      .from("ai_providers")
      .update(patch)
      .eq("id", input.id)
      .select("id")
      .single();
    if (error) throw new Error(`Gagal nyimpen: ${error.message}`);
    id = data.id;
  } else {
    const { data, error } = await db
      .from("ai_providers")
      .insert({ ...patch, slug, label: input.label.trim(), key_source: "db" })
      .select("id")
      .single();
    if (error) {
      throw new Error(
        error.code === "23505"
          ? `Slug "${slug}" udah kepakai. Pilih yang lain.`
          : `Gagal bikin provider: ${error.message}`,
      );
    }
    id = data.id;
  }

  await audit(adminId, input.id ? "ai.provider.update" : "ai.provider.create", id, "ai_provider", {
    slug,
    protocol: input.protocol,
    key_changed: Boolean(input.apiKey?.trim()),
  });
  invalidateAiCache();
  revalidateAll();
  return { id };
}

export async function setProviderActive(id: string, isActive: boolean): Promise<void> {
  const adminId = await verifyAdmin();
  const { error } = await createServiceRoleClient()
    .from("ai_providers")
    .update({ is_active: isActive, updated_at: new Date().toISOString() })
    .eq("id", id);
  if (error) throw new Error(error.message);

  await audit(adminId, isActive ? "ai.provider.activate" : "ai.provider.deactivate", id, "ai_provider");
  invalidateAiCache();
  revalidateAll();
}

/**
 * Delete a provider and everything under it.
 *
 * `ai_models` cascades, and any route pointing at one of those models has its
 * `primary_model_id` set to null — which the router reads as "no usable model"
 * and answers by falling back to the legacy path. So deleting a provider
 * degrades routing rather than breaking generation, which is the behaviour you
 * want at 2am.
 *
 * Refuses the env pool: that row represents the keys the product runs on, and
 * deleting it would make the fallback path invisible in the dashboard while it
 * carried on serving every request.
 */
export async function deleteProvider(id: string): Promise<void> {
  const adminId = await verifyAdmin();
  const db = createServiceRoleClient();

  const { data: provider } = await db
    .from("ai_providers")
    .select("slug, key_source")
    .eq("id", id)
    .maybeSingle();

  if (!provider) throw new Error("Providernya udah gak ada.");
  if (provider.key_source === "env_gemini_pool") {
    throw new Error("Pool Gemini bawaan gak bisa dihapus — matiin aja kalau gak dipakai.");
  }

  const { error } = await db.from("ai_providers").delete().eq("id", id);
  if (error) throw new Error(error.message);

  await audit(adminId, "ai.provider.delete", id, "ai_provider", { slug: provider.slug });
  invalidateAiCache();
  revalidateAll();
}

export async function testProviderConnection(
  id: string,
): Promise<{ ok: boolean; message: string; latencyMs?: number; modelCount?: number }> {
  const adminId = await verifyAdmin();
  const { providers } = await getFleet();
  const provider = providers.find((p) => p.id === id);
  if (!provider) throw new Error("Providernya gak ketemu.");

  const result = await testProvider(provider);
  const now = new Date().toISOString();
  const db = createServiceRoleClient();

  if (result.ok) {
    await db
      .from("ai_providers")
      .update({
        last_checked_at: now,
        last_ok_at: now,
        last_error: null,
        last_latency_ms: result.latencyMs,
        consecutive_failures: 0,
        updated_at: now,
      })
      .eq("id", id);
  } else {
    await db
      .from("ai_providers")
      .update({ last_checked_at: now, last_error: result.error.slice(0, 500), updated_at: now })
      .eq("id", id);
  }

  await audit(adminId, "ai.provider.test", id, "ai_provider", { ok: result.ok });
  invalidateAiCache();
  revalidateAll();

  return result.ok
    ? {
        ok: true,
        message: `Nyambung. ${result.modelCount} model kebaca, ${result.latencyMs}ms.`,
        latencyMs: result.latencyMs,
        modelCount: result.modelCount,
      }
    : { ok: false, message: result.error };
}

// ============================================================
// MODELS
// ============================================================

/**
 * SCAN MODELS.
 *
 * Upserts what the provider reports. Discovered models arrive INACTIVE, and an
 * existing row keeps its `is_active`, its prices and its capabilities — the
 * owner's corrections are the point, and a rescan that overwrote them would
 * make the button hostile. Only the vendor facts (label, context window) are
 * refreshed, and pricing only when the row has none and the scan supplied one.
 */
export async function scanProviderModels(
  id: string,
): Promise<{ found: number; added: number; updated: number }> {
  const adminId = await verifyAdmin();
  const { providers, models } = await getFleet();
  const provider = providers.find((p) => p.id === id);
  if (!provider) throw new Error("Providernya gak ketemu.");

  const discovered = await scanModels(provider);
  const existing = new Map(
    models.filter((m) => m.provider_id === id).map((m) => [m.model_id, m]),
  );

  const db = createServiceRoleClient();
  const now = new Date().toISOString();
  let added = 0;
  let updated = 0;

  for (const d of discovered) {
    const prev = existing.get(d.model_id);
    if (prev) {
      await db
        .from("ai_models")
        .update({
          label: d.label ?? prev.label,
          context_length: d.context_length ?? prev.context_length,
          input_price_usd_per_mtok:
            prev.input_price_usd_per_mtok > 0
              ? prev.input_price_usd_per_mtok
              : d.input_price_usd_per_mtok,
          output_price_usd_per_mtok:
            prev.output_price_usd_per_mtok > 0
              ? prev.output_price_usd_per_mtok
              : d.output_price_usd_per_mtok,
          discovered_at: now,
          updated_at: now,
        })
        .eq("id", prev.id);
      updated++;
    } else {
      await db.from("ai_models").insert({
        provider_id: id,
        model_id: d.model_id,
        label: d.label,
        context_length: d.context_length,
        input_price_usd_per_mtok: d.input_price_usd_per_mtok,
        output_price_usd_per_mtok: d.output_price_usd_per_mtok,
        capabilities: d.capabilities,
        is_active: false,
        source: "scan",
        discovered_at: now,
      });
      added++;
    }
  }

  await audit(adminId, "ai.models.scan", id, "ai_provider", {
    found: discovered.length,
    added,
    updated,
  });
  invalidateAiCache();
  revalidateAll();
  return { found: discovered.length, added, updated };
}

export async function listModels(): Promise<ModelRow[]> {
  await verifyAdmin();
  const { models } = await getFleet();
  return [...models].sort((a, b) => (a.label ?? a.model_id).localeCompare(b.label ?? b.model_id));
}

export type ModelPatch = {
  id: string;
  label?: string;
  contextLength?: number | null;
  inputPriceUsdPerMtok?: number;
  outputPriceUsdPerMtok?: number;
  capabilities?: Capability[];
  isActive?: boolean;
  supportsStreaming?: boolean;
  supportsSchema?: boolean;
};

export async function saveModel(patch: ModelPatch): Promise<void> {
  const adminId = await verifyAdmin();

  const update: ModelUpdate = { updated_at: new Date().toISOString() };
  if (patch.label !== undefined) update.label = patch.label.trim() || null;
  if (patch.contextLength !== undefined) update.context_length = patch.contextLength;
  if (patch.inputPriceUsdPerMtok !== undefined) {
    if (patch.inputPriceUsdPerMtok < 0) throw new Error("Harga gak boleh minus.");
    update.input_price_usd_per_mtok = patch.inputPriceUsdPerMtok;
  }
  if (patch.outputPriceUsdPerMtok !== undefined) {
    if (patch.outputPriceUsdPerMtok < 0) throw new Error("Harga gak boleh minus.");
    update.output_price_usd_per_mtok = patch.outputPriceUsdPerMtok;
  }
  if (patch.capabilities !== undefined) update.capabilities = patch.capabilities;
  if (patch.isActive !== undefined) update.is_active = patch.isActive;
  if (patch.supportsStreaming !== undefined) update.supports_streaming = patch.supportsStreaming;
  if (patch.supportsSchema !== undefined) update.supports_schema = patch.supportsSchema;

  const { error } = await createServiceRoleClient()
    .from("ai_models")
    .update(update)
    .eq("id", patch.id);
  if (error) throw new Error(error.message);

  await audit(adminId, "ai.model.update", patch.id, "ai_model", {
    active: patch.isActive ?? null,
  });
  invalidateAiCache();
  revalidateAll();
}

export async function deleteModel(id: string): Promise<void> {
  const adminId = await verifyAdmin();
  const { error } = await createServiceRoleClient().from("ai_models").delete().eq("id", id);
  if (error) throw new Error(error.message);
  await audit(adminId, "ai.model.delete", id, "ai_model");
  invalidateAiCache();
  revalidateAll();
}

// ============================================================
// ROUTES
// ============================================================

export async function listRoutes(): Promise<RouteRow[]> {
  await verifyAdmin();
  const { routes } = await getFleet();
  return routes;
}

export type RouteInput = {
  feature: string;
  mode: RouteMode;
  primaryModelId: string | null;
  fallbackModelIds: string[];
  requiredCapabilities: Capability[];
  prefer: RoutePrefer;
  isActive: boolean;
};

export async function saveRoute(input: RouteInput): Promise<void> {
  const adminId = await verifyAdmin();

  if (input.mode === "manual" && !input.primaryModelId) {
    throw new Error("Mode manual butuh model utama. Pilih dulu modelnya.");
  }

  const { error } = await createServiceRoleClient()
    .from("ai_routes")
    .upsert({
      feature: input.feature,
      mode: input.mode,
      primary_model_id: input.primaryModelId,
      fallback_model_ids: input.fallbackModelIds,
      required_capabilities: input.requiredCapabilities,
      prefer: input.prefer,
      is_active: input.isActive,
      updated_at: new Date().toISOString(),
      updated_by: adminId,
    });
  if (error) throw new Error(error.message);

  await audit(adminId, "ai.route.save", input.feature, "ai_route", {
    mode: input.mode,
    active: input.isActive,
  });
  invalidateAiCache();
  revalidateAll();
}

/**
 * Remove a route, which puts the feature back on the legacy Gemini path.
 * The safest possible undo, and the reason routes are deletable at all.
 */
export async function clearRoute(feature: string): Promise<void> {
  const adminId = await verifyAdmin();
  const { error } = await createServiceRoleClient()
    .from("ai_routes")
    .delete()
    .eq("feature", feature);
  if (error) throw new Error(error.message);
  await audit(adminId, "ai.route.clear", feature, "ai_route");
  invalidateAiCache();
  revalidateAll();
}

/** What the router would pick right now, without spending anything. */
export async function previewRoute(
  feature: string,
): Promise<{ reason: string; mode: string; chain: string[] }> {
  await verifyAdmin();
  const decision = await resolveRoute(feature);
  return {
    reason: decision.reason,
    mode: decision.mode,
    chain: decision.candidates.map(
      (c) => `${c.provider.label} · ${c.model.label ?? c.model.model_id}`,
    ),
  };
}

// ============================================================
// PLAYGROUND
// ============================================================

export type PlaygroundResult = {
  text: string;
  providerSlug: string;
  modelId: string;
  inputTokens: number;
  outputTokens: number;
  costIdr: number;
  latencyMs: number;
};

/**
 * Try one model before trusting it with real users.
 *
 * Calls a specific model directly rather than going through the router, because
 * the question here is "what does THIS model do", not "what would the system
 * pick". Charges no credits — it is the owner's own money either way, and the
 * real cost is reported back so the answer to "can I afford this" is a number
 * rather than a feeling.
 */
export async function runPlayground(
  modelId: string,
  prompt: string,
): Promise<PlaygroundResult> {
  const adminId = await verifyAdmin();
  if (!prompt.trim()) throw new Error("Isi dulu promptnya.");

  const { providers, models } = await getFleet();
  const model = models.find((m) => m.id === modelId);
  if (!model) throw new Error("Modelnya gak ketemu.");
  const provider = providers.find((p) => p.id === model.provider_id);
  if (!provider) throw new Error("Providernya gak ketemu.");

  // resolveProviderKey throws a readable message when the key is missing or
  // undecryptable, which is exactly what the tester needs to see.
  resolveProviderKey(provider);

  // runOnModel, not runAI: the router would score candidates and could hand back
  // a different model than the one being tested, which would make this button
  // lie about what it just ran.
  const result = await runOnModel(
    { provider, model },
    {
      feature: "playground",
      prompt: prompt.slice(0, 8000),
      userId: adminId,
      // The playground never touches credits.
      creditsCharged: 0,
      signal: AbortSignal.timeout(45_000),
    },
  );

  await audit(adminId, "ai.playground.run", model.model_id, "ai_model", {
    provider: provider.slug,
    cost_idr: Math.round(result.costIdr),
  });

  return {
    text: result.text,
    providerSlug: result.providerSlug,
    modelId: result.modelId,
    inputTokens: result.inputTokens,
    outputTokens: result.outputTokens,
    costIdr: result.costIdr,
    latencyMs: result.latencyMs,
  };
}

/** Price a hypothetical call against a model, with no request made. */
export async function estimateCost(
  modelId: string,
  inputTokens: number,
  outputTokens: number,
): Promise<number> {
  await verifyAdmin();
  const { models } = await getFleet();
  const model = models.find((m) => m.id === modelId);
  if (!model) throw new Error("Modelnya gak ketemu.");
  return costIdr(model, { input: inputTokens, output: outputTokens }, await getUsdToIdr());
}

// ============================================================
// BALANCE
// ============================================================

export async function refreshBalance(id: string): Promise<{
  amount: number | null;
  currency: string;
  low: boolean;
  burnPerDay: number | null;
  daysLeft: number | null;
}> {
  const adminId = await verifyAdmin();
  const { providers } = await getFleet();
  const provider = providers.find((p) => p.id === id);
  if (!provider) throw new Error("Providernya gak ketemu.");
  if (!provider.balance_url?.trim()) throw new Error("Provider ini gak punya endpoint saldo.");

  const reading = await checkBalance(provider);
  const trend = await balanceTrend(id);

  await audit(adminId, "ai.balance.check", id, "ai_provider", {
    amount: reading?.amount ?? null,
  });
  revalidateAll();

  return {
    amount: reading?.amount ?? null,
    currency: reading?.currency ?? provider.balance_currency,
    low: reading?.low ?? false,
    burnPerDay: trend.burnPerDay,
    daysLeft: trend.daysLeft,
  };
}
