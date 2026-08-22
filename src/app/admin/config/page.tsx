import Link from "next/link";
import { createServiceRoleClient } from "@/lib/supabase/server";
import { ConfigEditor, type ConfigRow } from "./ConfigEditor";

/**
 * AI control.
 *
 * Model ids lived in env vars and credit costs were literals inside
 * /api/generate, so pricing changes and model swaps both needed a redeploy —
 * and a module that started failing could not be taken out of service at all.
 * These rows are read on every generation via `lib/config`, with the old
 * hardcoded values as fallbacks if the table is unreachable.
 */
export default async function AdminConfigPage() {
  const db = createServiceRoleClient();
  const { data } = await db
    .from("app_config")
    .select("key, value, description, updated_at")
    .order("key");

  // Compatibility-only AI fields remain in app_config for emergency fallback,
  // but are no longer a second control panel and never need to reach the
  // browser. The Brain, gateway registry, and model pricing are managed from
  // /admin/ai.
  const hiddenLegacyAiKeys = new Set([
    "ai_provider",
    "ai_base_url",
    "ai_api_key",
    "model_free",
    "model_pro",
    "price_in_per_mtok",
    "price_out_per_mtok",
  ]);

  return (
    <div className="space-y-5">
      <header>
        <h1 className="font-display text-xl font-bold text-ink">Setelan lanjutan</h1>
        <p className="mt-1 text-sm leading-relaxed text-muted">
          Perintah bayangan, harga kredit, saklar modul dan pembayaran. Buat
          milih AI-nya, buka{" "}
          <Link href="/admin/ai" className="text-ember-lo underline-offset-2 hover:underline">
            Otak AI
          </Link>
          .
        </p>
      </header>

      <ConfigEditor
        rows={((data as ConfigRow[]) ?? []).filter((r) => !hiddenLegacyAiKeys.has(r.key))}
      />
    </div>
  );
}
