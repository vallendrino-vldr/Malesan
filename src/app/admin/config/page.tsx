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
  const [{ data }, { data: models }] = await Promise.all([
    db.from("app_config").select("key, value, description, updated_at").order("key"),
    // Only the Gemini pool's ids: this section configures the legacy fallback,
    // which is a Gemini-only path. Offering a DeepSeek id here would be a
    // choice that cannot work.
    db
      .from("ai_models")
      .select("model_id, ai_providers!inner(protocol)")
      .eq("ai_providers.protocol", "gemini"),
  ]);

  const geminiModels = [
    ...new Set(((models ?? []) as { model_id: string }[]).map((m) => m.model_id)),
  ].sort();

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

      {/* The key never reaches the browser. The editor only needs to know
          whether one is set, so send a boolean-ish placeholder instead of the
          secret — a value rendered into the page is a value that leaks through
          a screenshot or a shared screen. */}
      <ConfigEditor
        rows={((data as ConfigRow[]) ?? []).map((r) =>
          r.key === "ai_api_key"
            ? { ...r, value: String(r.value ?? "").length > 0 ? "set" : "" }
            : r,
        )}
        geminiModels={geminiModels}
      />
    </div>
  );
}
