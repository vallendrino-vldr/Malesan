import Link from "next/link";
import { listProviders, listModels, brainStatus } from "@/app/actions/ai-admin";
import { costSummary, savingsSuggestions } from "@/lib/ai/analytics";
import { getAdminMode, getUsdToIdr } from "@/lib/config";
import { verifyAdmin } from "@/lib/admin/guard";
import { formatIdr } from "@/lib/ai/cost";
import { LiveRefresh } from "@/components/LiveRefresh";
import { BrainPanel } from "./BrainPanel";
import { ProviderManager } from "./ProviderManager";

/**
 * The AI Control Center.
 *
 * Built for the person who owns the business, not the person who wrote the code.
 * Simple mode answers the only three questions that matter day to day — what is
 * my AI, what is it costing me, is it making money — and hides everything else.
 *
 * Gateways, model registries, routing tables and logs are not removed, they are
 * demoted. They are the answer to "how do I change it", which is a question you
 * ask once a month, not every time you open the panel.
 */
export default async function AdminAiPage() {
  await verifyAdmin();

  const [mode, brain, providers, models, summary, usdToIdr] = await Promise.all([
    getAdminMode(),
    brainStatus(),
    listProviders(),
    listModels(),
    costSummary(7),
    getUsdToIdr(),
  ]);

  const suggestions = await savingsSuggestions(summary.byFeature, models, usdToIdr);
  const providerName = (id: string) => providers.find((p) => p.id === id)?.label ?? "?";

  const margin =
    summary.today.revenueIdr > 0
      ? (summary.today.marginIdr / summary.today.revenueIdr) * 100
      : null;

  return (
    <div className="space-y-6">
      <LiveRefresh tables={["ai_providers", "app_config"]} label="Setelan AI berubah" />

      <BrainPanel brain={brain} models={models} providers={providers} mode={mode} />

      {/* ---------- today, in money ---------- */}
      <section className="space-y-2">
        <p className="eyebrow text-ember-lo">Hari ini</p>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          {[
            { k: "Permintaan AI", v: String(summary.today.calls) },
            { k: "Biaya AI", v: formatIdr(summary.today.costIdr) },
            { k: "Pemasukan", v: formatIdr(summary.today.revenueIdr) },
            {
              k: "Margin",
              v: margin === null ? "—" : `${margin.toFixed(0)}%`,
              bad: margin !== null && margin < 0,
            },
          ].map((s) => (
            <div key={s.k} className="rounded-lg bg-surface px-3 py-2.5">
              <p className="text-micro text-muted">{s.k}</p>
              <p
                className={`mt-0.5 font-mono text-mini font-bold ${
                  s.bad ? "text-danger" : "text-ink"
                }`}
              >
                {s.v}
              </p>
            </div>
          ))}
        </div>

        {summary.pricingUnconfigured && (
          <p className="rounded-lg border border-ember/20 bg-ember/5 px-3 py-2 text-micro leading-relaxed text-ember-lo">
            Biayanya kebaca Rp0 karena harga model belum diisi. Itu bukan berarti
            gratis — isi harganya biar angka di halaman ini beneran.
          </p>
        )}
      </section>

      {/* ---------- what to do about it ---------- */}
      {suggestions.length > 0 && (
        <section className="space-y-2">
          <p className="eyebrow text-ember-lo">Saran hemat</p>
          {suggestions.map((s) => (
            <div key={s.feature} className="surface-card rounded-xl p-4">
              <p className="text-mini leading-relaxed text-ink">
                <span className="font-bold">{s.suggestedModel}</span> bisa hemat{" "}
                <span className="font-bold text-ember-lo">
                  {s.savingsPercent.toFixed(0)}%
                </span>{" "}
                buat fitur <span className="font-bold">{s.featureLabel}</span>.
              </p>
              <p className="mt-1 text-micro text-muted">
                Sekarang pakai {s.currentModel} · kira-kira hemat{" "}
                {formatIdr(s.monthlySavingIdr)} sebulan ·{" "}
                {providerName(s.suggestedProvider)}
              </p>
              <Link
                href="/admin/ai/routing"
                className="mt-2 inline-block text-micro text-ember-lo underline-offset-2 hover:underline"
              >
                Atur fitur ini &rarr;
              </Link>
            </div>
          ))}
        </section>
      )}

      {/* ---------- everything else, only when asked for ---------- */}
      {mode === "advanced" ? (
        <>
          <nav className="flex flex-wrap gap-2 border-t border-hairline pt-4">
            {[
              { href: "/admin/ai/models", label: "Model" },
              { href: "/admin/ai/routing", label: "Routing per fitur" },
              { href: "/admin/ai/playground", label: "Playground" },
              { href: "/admin/ai/biaya", label: "Biaya lengkap" },
              { href: "/admin/errors", label: "Log error" },
            ].map((l) => (
              <Link
                key={l.href}
                href={l.href}
                className="rounded-full border border-hairline px-4 py-2 text-mini text-muted hover:bg-surface hover:text-ink"
              >
                {l.label}
              </Link>
            ))}
          </nav>

          <ProviderManager providers={providers} />
        </>
      ) : (
        <p className="border-t border-hairline pt-4 text-micro leading-relaxed text-muted">
          Mau ngatur gateway, model, atau routing per fitur? Buka{" "}
          <span className="text-ink">Setelan lanjutan</span> di atas.
        </p>
      )}
    </div>
  );
}
