import { createServiceRoleClient } from "@/lib/supabase/server";

/**
 * Runtime configuration.
 *
 * Model choice lived in env vars and credit costs were literals inside
 * /api/generate, so changing either meant a redeploy — and a module that
 * started failing could not be pulled out of service at all.
 *
 * Values come from `app_config` with env/literal fallbacks, so a missing or
 * unreachable row degrades to the previous behaviour rather than taking the
 * product down. Cached briefly because these are read on every generation and
 * change a few times a month at most.
 */

export type ModuleKey =
  | "ide_hari_ini"
  | "idea"
  | "hook"
  | "script"
  | "repurpose"
  | "vibe"
  // Niche engines. Separate module keys rather than a flag on `script`, because
  // they carry their own price, their own on/off switch and their own schema.
  | "clip"
  | "thread";

const FALLBACK_COST: Record<ModuleKey, number> = {
  ide_hari_ini: 1,
  idea: 1,
  hook: 2,
  script: 4,
  repurpose: 1,
  vibe: 6,
  clip: 4,
  thread: 3,
};

const TTL_MS = 30_000;
let cache: { at: number; rows: Record<string, unknown> } | null = null;

async function load(): Promise<Record<string, unknown>> {
  if (cache && Date.now() - cache.at < TTL_MS) return cache.rows;
  try {
    const { data } = await createServiceRoleClient().from("app_config").select("key, value");
    const rows: Record<string, unknown> = {};
    for (const r of data ?? []) rows[(r as { key: string }).key] = (r as { value: unknown }).value;
    cache = { at: Date.now(), rows };
    return rows;
  } catch (e) {
    console.error("app_config read failed, using fallbacks", e);
    return cache?.rows ?? {};
  }
}

/** Call after a write so the next read does not serve the old value. */
export function invalidateConfigCache() {
  cache = null;
}

export async function getModel(tier: "free" | "pro"): Promise<string> {
  const rows = await load();
  const v = rows[tier === "pro" ? "model_pro" : "model_free"];
  if (typeof v === "string" && v.trim()) return v;
  return (
    (tier === "pro" ? process.env.GEMINI_MODEL_PRO : process.env.GEMINI_MODEL_FREE) ??
    "gemini-2.5-flash"
  );
}

export async function getCost(module: ModuleKey): Promise<number> {
  const rows = await load();
  const v = rows[`cost_${module}`];
  return typeof v === "number" && v > 0 ? Math.round(v) : FALLBACK_COST[module];
}

/** Unknown modules default to enabled — a missing row must not silently break one. */
export async function isModuleEnabled(module: ModuleKey): Promise<boolean> {
  const rows = await load();
  const map = rows["enabled_modules"];
  if (map && typeof map === "object" && module in (map as Record<string, unknown>)) {
    return (map as Record<string, boolean>)[module] !== false;
  }
  return true;
}

export async function getAllConfig() {
  cache = null;
  return load();
}

/**
 * The owner's live dashboard announcement. Empty means nothing is shown.
 * Read on the dashboard's server pass, so editing it in the admin panel takes
 * effect within the config cache TTL, no redeploy.
 */
export async function getDashboardNotice(): Promise<string> {
  const rows = await load();
  const v = rows["dashboard_notice"];
  return typeof v === "string" ? v.trim() : "";
}

/**
 * The owner's global instruction, injected into every user generation.
 *
 * Deliberately invisible to the user — it is a house style rule ("never open
 * with 'di era digital ini'"), not a setting they own. Read on the server only:
 * it must never be echoed back in a response, or it stops being a house rule
 * and becomes a prompt anyone can work around.
 */
export async function getShadowPrompt(): Promise<string> {
  const rows = await load();
  const v = rows["shadow_prompt"];
  return typeof v === "string" ? v.trim() : "";
}

/**
 * Credits charged per minute of video for the Auto-CC transcription.
 *
 * Priced per minute rather than per call because the cost driver is audio
 * length, not request count — a 10-second clip and a 5-minute one are not the
 * same job. Read from app_config so the owner can retune it without a deploy;
 * falls back to 2 so a missing row never makes the module free by accident.
 */
export async function getVideoCostPerMin(): Promise<number> {
  const rows = await load();
  const v = rows["cost_video_per_min"];
  return typeof v === "number" && v > 0 ? Math.round(v) : 2;
}

/**
 * Extra credits to remove the malesan.my.id watermark from an export.
 *
 * The watermark is free advertising the product gives up when someone pays to
 * drop it, so it is priced as its own small charge rather than folded into the
 * per-minute rate. Retunable in app_config; 5 is the safe default.
 */
export async function isVideoEnabled(): Promise<boolean> {
  const rows = await load();
  const map = rows["enabled_modules"];
  if (map && typeof map === "object" && "video" in (map as Record<string, unknown>)) {
    return (map as Record<string, boolean>)["video"] !== false;
  }
  return true;
}

export async function getVideoNoWatermarkCost(): Promise<number> {
  const rows = await load();
  const v = rows["cost_no_watermark"];
  return typeof v === "number" && v >= 0 ? Math.round(v) : 5;
}

/**
 * Credits for the instant Groq reactions on a draft — the netizen-comment
 * simulator and the script roast. Cheap on purpose (a Groq call is fast and
 * costs the owner little), and `>= 0` so the owner can set either to 0 to make it
 * free from app_config without a deploy. Defaults to 1.
 */
export async function getReactionCost(kind: "netizen" | "roast"): Promise<number> {
  const rows = await load();
  const v = rows[`cost_${kind}`];
  return typeof v === "number" && v >= 0 ? Math.round(v) : 1;
}

/**
 * Credits to recycle an old posted piece into fresh angles via Gemini. A real
 * reasoning generation, so priced a little above the instant reactions. Retunable
 * in app_config; defaults to 2.
 */
export async function getRecycleCost(): Promise<number> {
  const rows = await load();
  const v = rows["cost_recycle"];
  return typeof v === "number" && v >= 0 ? Math.round(v) : 2;
}

export type Pricing = { inPerMTok: number; outPerMTok: number };

/**
 * What the owner actually pays per million tokens, in IDR, set in the admin
 * panel. Zero means "not configured", and the dashboard says so rather than
 * drawing a confident Rp0 line — a cost chart that silently reads zero is worse
 * than no chart, because it looks like profit.
 */
export async function getPricing(): Promise<Pricing> {
  const rows = await load();
  const num = (k: string) => {
    const v = rows[k];
    return typeof v === "number" && v >= 0 ? v : 0;
  };
  return { inPerMTok: num("price_in_per_mtok"), outPerMTok: num("price_out_per_mtok") };
}

export type PaymentConfig = {
  methods: { bank: boolean; qris: boolean };
  bankName: string;
  accountNumber: string;
  accountHolder: string;
  qrisImageUrl: string;
  note: string;
};

/**
 * Payment details were hardcoded into the top-up page — one bank, one number,
 * no QRIS. Changing a destination account meant a code change and a deploy.
 */
export async function getPaymentConfig(): Promise<PaymentConfig> {
  const rows = await load();
  const str = (k: string, d = "") => (typeof rows[k] === "string" ? (rows[k] as string) : d);
  const m = rows["payment_methods"] as { bank?: boolean; qris?: boolean } | undefined;
  return {
    methods: { bank: m?.bank !== false, qris: m?.qris === true },
    bankName: str("bank_name", "BCA"),
    accountNumber: str("bank_account_number"),
    accountHolder: str("bank_account_holder"),
    qrisImageUrl: str("qris_image_url"),
    note: str("payment_note"),
  };
}

export type ProviderConfig = {
  provider: "gemini" | "openai" | "anthropic" | "custom";
  baseUrl: string;
  apiKey: string;
};

/**
 * Lets the owner point the product at a different model vendor without touching
 * code. An empty `apiKey` means "keep using the env-based Gemini key rotation",
 * so a half-filled form cannot take generation down.
 */
export async function getProviderConfig(): Promise<ProviderConfig> {
  const rows = await load();
  const p = rows["ai_provider"];
  const provider =
    p === "openai" || p === "anthropic" || p === "custom" ? p : "gemini";
  return {
    provider,
    baseUrl: typeof rows["ai_base_url"] === "string" ? (rows["ai_base_url"] as string) : "",
    apiKey: typeof rows["ai_api_key"] === "string" ? (rows["ai_api_key"] as string) : "",
  };
}

/**
 * USD → IDR, for turning a vendor's published per-token price into money the
 * owner recognises.
 *
 * Applied once, at the moment a request is logged, and the resulting rupiah
 * figure is frozen onto that row. A rate change must not silently rewrite what
 * last month cost — that is the difference between a cost record and a guess.
 *
 * Falls back to 16500 rather than 0: a zero rate would report every AI call as
 * free, which is a worse lie than a slightly stale rate.
 */
export async function getUsdToIdr(): Promise<number> {
  const rows = await load();
  const v = rows["usd_to_idr"];
  return typeof v === "number" && v > 0 ? v : 16_500;
}

/**
 * The Global AI Brain: the model the whole product runs on.
 *
 * Ids point at `ai_models.id`. Null primary means "not configured", which the
 * router reads as the legacy Gemini path — so an owner who never opens this
 * screen keeps exactly the behaviour they have today.
 */
export type BrainConfig = {
  primary: string | null;
  fallbacks: string[];
};

export async function getAiBrain(): Promise<BrainConfig> {
  const rows = await load();
  const v = rows["ai_brain"];
  if (!v || typeof v !== "object") return { primary: null, fallbacks: [] };
  const o = v as { primary?: unknown; fallbacks?: unknown };
  return {
    primary: typeof o.primary === "string" && o.primary ? o.primary : null,
    fallbacks: Array.isArray(o.fallbacks)
      ? o.fallbacks.filter((x): x is string => typeof x === "string" && Boolean(x))
      : [],
  };
}

export type AdminMode = "simple" | "advanced";

/**
 * Which face the AI panel shows. Simple is the default because the person using
 * it owns a business rather than a codebase: the questions that matter are what
 * the AI is, what it costs, and whether it is making money. Gateways, model
 * registries and routing tables are the answer to a different question, and
 * putting them first is what made the old panel unusable to its only user.
 */
export async function getAdminMode(): Promise<AdminMode> {
  const rows = await load();
  return rows["ai_admin_mode"] === "advanced" ? "advanced" : "simple";
}

export type RouterFlags = {
  /** Master switch. Off = every feature uses the legacy env Gemini path. */
  routerEnabled: boolean;
  /** Off = try the primary model only, never a backup. */
  fallbackEnabled: boolean;
};

/**
 * The two emergency switches for the provider layer.
 *
 * Both default to ON when unreadable, because both describe the intended
 * behaviour of the system. The point of `routerEnabled` is that an owner who
 * has just misconfigured a provider at 2am can put the product back on the
 * known-good path from one toggle, without a deploy and without understanding
 * routing.
 */
export async function getRouterFlags(): Promise<RouterFlags> {
  const rows = await load();
  const bool = (k: string) => (typeof rows[k] === "boolean" ? (rows[k] as boolean) : true);
  return {
    routerEnabled: bool("ai_router_enabled"),
    fallbackEnabled: bool("ai_fallback_enabled"),
  };
}
