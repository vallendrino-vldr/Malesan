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
  const { data } = await createServiceRoleClient()
    .from("app_config")
    .select("key, value, description, updated_at")
    .order("key");

  return (
    <div className="space-y-5">
      <header>
        <h1 className="font-display text-xl font-bold text-ink">Otak AI</h1>
        <p className="mt-1 text-sm leading-relaxed text-muted">
          Model, harga kredit, dan saklar tiap modul. Berubah langsung — gak
          perlu deploy ulang.
        </p>
      </header>

      <ConfigEditor rows={(data as ConfigRow[]) ?? []} />
    </div>
  );
}
