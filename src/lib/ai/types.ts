/**
 * Shared types for the AI Provider Management Layer.
 *
 * Kept free of `server-only` on purpose: the admin UI needs these shapes to
 * render, and nothing here carries a secret. Every field that could is either
 * absent (`ProviderView` has no key at all) or already masked.
 */

import type { ProviderName } from "@/lib/gemini/providers";

/** The wire format. Not the brand — SumoPod and OpenRouter are both `openai`. */
export type Protocol = Extract<ProviderName, "gemini" | "openai" | "anthropic">;

export type KeySource = "db" | "env_gemini_pool";

export type Capability =
  | "text"
  | "vision"
  | "image"
  | "audio"
  | "coding"
  | "reasoning"
  | "long_context"
  | "fast"
  | "cheap"
  | "premium";

export const CAPABILITIES: Capability[] = [
  "text",
  "vision",
  "image",
  "audio",
  "coding",
  "reasoning",
  "long_context",
  "fast",
  "cheap",
  "premium",
];

export type RouteMode = "manual" | "smart";
export type RoutePrefer = "cheap" | "fast" | "quality" | "balanced";

export type ProviderRow = {
  id: string;
  slug: string;
  label: string;
  protocol: Protocol;
  base_url: string | null;
  key_source: KeySource;
  api_key_encrypted: string | null;
  balance_url: string | null;
  balance_path: string | null;
  balance_currency: string;
  low_balance_threshold: number | null;
  is_active: boolean;
  priority: number;
  last_checked_at: string | null;
  last_ok_at: string | null;
  last_error: string | null;
  last_latency_ms: number | null;
  consecutive_failures: number;
  notes: string | null;
};

/**
 * What the browser is allowed to see. The ciphertext is dropped entirely and
 * replaced by a boolean plus a mask — an admin needs to know *whether* a key is
 * set and *which* one it is, never the value.
 */
export type ProviderView = Omit<ProviderRow, "api_key_encrypted"> & {
  has_key: boolean;
  key_mask: string | null;
  model_count: number;
  active_model_count: number;
};

/**
 * How a model's cost is known.
 *
 * `direct_usd` is what a scan returns — per-million-token rates from OpenAI,
 * OpenRouter and friends. `prepaid_package` is what an Indonesian owner actually
 * buys: "Rp2.238 for 1,000,000 tokens, expires in 30 days". Making them convert
 * that into USD-per-Mtok by hand is why every cost figure read Rp0 — nobody was
 * ever going to do that arithmetic.
 */
export type PricingMode = "direct_usd" | "prepaid_package";

export type ModelRow = {
  id: string;
  provider_id: string;
  model_id: string;
  label: string | null;
  context_length: number | null;
  input_price_usd_per_mtok: number;
  output_price_usd_per_mtok: number;
  capabilities: Capability[];
  is_active: boolean;
  supports_streaming: boolean;
  supports_schema: boolean;
  source: "manual" | "scan";
  pricing_mode: PricingMode;
  /** Prepaid only: what the package cost, in rupiah. */
  package_price_idr: number | null;
  /** Prepaid only: how many tokens it bought. */
  package_tokens: number | null;
  package_expires_at: string | null;
};

export type RouteRow = {
  feature: string;
  label: string | null;
  mode: RouteMode;
  primary_model_id: string | null;
  fallback_model_ids: string[];
  required_capabilities: Capability[];
  prefer: RoutePrefer;
  is_active: boolean;
  notes: string | null;
};

/** One provider+model pair the engine may try, in the order the router returned. */
export type Candidate = {
  provider: ProviderRow;
  model: ModelRow;
};

export type AttemptOutcome = {
  provider_id: string | null;
  provider_slug: string;
  model_id: string;
  input_tokens: number;
  output_tokens: number;
  cost_idr: number;
  latency_ms: number;
  status: "ok" | "error" | "fallback";
  attempt: number;
  error_message?: string;
};

/**
 * Every AI feature in the product, and what it needs.
 *
 * This list lives in code rather than as a database enum because it grows with
 * every module that ships, and a migration per feature is exactly the redeploy
 * this layer exists to remove. The database stores routes keyed by these
 * strings; an unknown key is simply a feature with no route, which falls back to
 * the legacy path.
 *
 * `suggested` drives the "smart" router when the owner has not pinned a model:
 * it is a hint about the *job*, not about any particular vendor.
 */
export type FeatureSpec = {
  key: string;
  label: string;
  /** Capabilities a model must have to serve this feature at all. */
  requires: Capability[];
  /** What matters most for this job when several models qualify. */
  suggested: RoutePrefer;
  note: string;
};

export const AI_FEATURES: FeatureSpec[] = [
  {
    key: "ide_hari_ini",
    label: "Ide Hari Ini",
    requires: ["text"],
    suggested: "fast",
    note: "Tiga ide harian. Sering dipanggil, output pendek — kecepatan lebih penting dari kepintaran.",
  },
  {
    key: "idea",
    label: "Idea Engine",
    requires: ["text"],
    suggested: "balanced",
    note: "Ngembangin ide kasar jadi lima ide matang.",
  },
  {
    key: "hook",
    label: "Hook Lab",
    requires: ["text"],
    suggested: "quality",
    note: "Sepuluh hook. Ini yang paling nentuin konten ditonton atau di-skip.",
  },
  {
    key: "script",
    label: "Script Builder",
    requires: ["text"],
    suggested: "quality",
    note: "Naskah lengkap. Output paling panjang dan paling mahal per panggilan.",
  },
  {
    key: "repurpose",
    label: "Repurpose",
    requires: ["text"],
    suggested: "balanced",
    note: "Satu konten ditulis ulang buat lima platform.",
  },
  {
    key: "clip",
    label: "Clip Engine",
    requires: ["text"],
    suggested: "balanced",
    note: "Engine niche buat potongan video.",
  },
  {
    key: "thread",
    label: "Thread Engine",
    requires: ["text"],
    suggested: "balanced",
    note: "Engine niche buat thread X/Threads.",
  },
  {
    key: "vibe",
    label: "Vibe Coding Kit",
    requires: ["text", "reasoning"],
    suggested: "quality",
    note: "Enam dokumen sekaligus. Paling mahal di produk — butuh model yang bisa nalar panjang.",
  },
  {
    key: "vibe_questions",
    label: "Vibe — pertanyaan",
    requires: ["text"],
    suggested: "fast",
    note: "Pertanyaan klarifikasi sebelum kit dibikin.",
  },
  {
    key: "autocomplete",
    label: "Autocomplete draft",
    requires: ["text", "fast"],
    suggested: "fast",
    note: "Ghost text pas ngetik. Kalau telat dua detik, udah keburu diketik sendiri — kecepatan mutlak.",
  },
  {
    key: "react_netizen",
    label: "Simulasi komentar netizen",
    requires: ["text", "fast"],
    suggested: "fast",
    note: "Lima komentar pendek. Dipakai sambil nulis, jadi harus balik cepet.",
  },
  {
    key: "react_roast",
    label: "Roast draft",
    requires: ["text", "fast"],
    suggested: "fast",
    note: "Kritik tajam ~180 kata. Pendek, tapi butuh model yang bisa nilai tulisan.",
  },
  {
    key: "recycle",
    label: "Smart Recycle",
    requires: ["text"],
    suggested: "balanced",
    note: "Konten lama jadi tiga angle baru.",
  },
  {
    key: "schedule_tag",
    label: "Tag jadwal tayang",
    requires: ["text"],
    suggested: "cheap",
    note: "Dua string pendek. Jangan pakai model mahal buat ini.",
  },
  {
    key: "onboarding_dna",
    label: "Analisa Creator DNA",
    requires: ["text"],
    suggested: "quality",
    note: "Sekali seumur akun, dan hasilnya dipakai di semua generate setelahnya.",
  },
  {
    key: "trends_cron",
    label: "Tren harian (cron)",
    requires: ["text"],
    suggested: "cheap",
    note: "Sekali sehari, tanpa user nunggu.",
  },
  {
    key: "proof_check",
    label: "Cek bukti transfer",
    requires: ["text", "vision"],
    suggested: "balanced",
    note: "Baca gambar struk. WAJIB model yang bisa lihat gambar.",
  },
  {
    key: "admin_assistant",
    label: "Asisten admin",
    requires: ["text", "reasoning"],
    suggested: "quality",
    note: "Baca kondisi platform dan kasih saran. Cuma dipakai owner.",
  },
];

export const FEATURE_MAP: Record<string, FeatureSpec> = Object.fromEntries(
  AI_FEATURES.map((f) => [f.key, f]),
);
