import Link from "next/link";
import { listProviders, listModels, brainStatus, getQuotaTrackerDataAction } from "@/app/actions/ai-admin";
import { costSummary, savingsSuggestions, quotaFor } from "@/lib/ai/analytics";
import { getGeminiPoolQuota } from "@/lib/gemini/pool-report";
import { fetchQuotaTrackerData } from "@/lib/gemini/account-quotas";
import { getAdminMode, getUsdToIdr } from "@/lib/config";
import { verifyAdmin } from "@/lib/admin/guard";
import { formatIdr } from "@/lib/ai/cost";
import { LiveRefresh } from "@/components/LiveRefresh";
import { BrainPanel } from "./BrainPanel";
import { ProviderManager } from "./ProviderManager";
import { AccountQuotaTracker } from "./AccountQuotaTracker";
import { AdminAiClientTabs } from "./AdminAiClientTabs";

/**
 * The AI Control Center & Quota Tracker.
 *
 * Built for the person who owns the business, not the person who wrote the code.
 * Two key views:
 * 1. Otak AI & Brain: Controls models, 1-click switcher, daily usage and routing.
 * 2. Quota Tracker & ATM Cuan (4 Akun): Amati, Tiru 9Router layout, with Malesan
 *    founder 100% margin profit calculator and real-time reset countdown.
 */
export default async function AdminAiPage(props: {
  searchParams?: Promise<{ tab?: string }>;
}) {
  await verifyAdmin();

  const searchParams = props.searchParams ? await props.searchParams : undefined;
  const defaultTab =
    searchParams?.tab === "quota" || searchParams?.tab === "tracker"
      ? "tracker"
      : "brain";

  const [mode, brain, providers, models, summary, usdToIdr, quotaTrackerData] =
    await Promise.all([
      getAdminMode(),
      brainStatus(),
      listProviders(),
      listModels(),
      costSummary(7),
      getUsdToIdr(),
      fetchQuotaTrackerData(),
    ]);

  const suggestions = await savingsSuggestions(summary.byFeature, models, usdToIdr);
  const providerName = (id: string) => providers.find((p) => p.id === id)?.label ?? "?";

  // Prepaid package or Gemini pool status for whatever the Brain is currently running on.
  const primaryModel = brain.primary
    ? models.find((m) => m.id === brain.primary!.modelId)
    : undefined;

  const isGeminiOrFree =
    !brain.primary ||
    primaryModel?.pricing_mode === "free_quota" ||
    brain.primary.provider.toLowerCase().includes("gemini");

  const [geminiQuota, quota] = await Promise.all([
    isGeminiOrFree ? getGeminiPoolQuota(usdToIdr) : Promise.resolve(null),
    primaryModel && primaryModel.pricing_mode === "prepaid_package"
      ? quotaFor(primaryModel)
      : Promise.resolve(null),
  ]);

  const margin =
    summary.today.revenueIdr > 0
      ? (summary.today.marginIdr / summary.today.revenueIdr) * 100
      : null;

  const brainView = (
    <div className="space-y-6">
      <BrainPanel
        brain={brain}
        models={models}
        providers={providers}
        mode={mode}
        quota={quota}
        geminiQuota={geminiQuota}
      />

      {/* ---------- today, in money ---------- */}
      <section className="space-y-2">
        <p className="eyebrow text-ember-lo">Hari ini</p>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-5">
          {[
            { k: "Permintaan", v: String(summary.today.calls) },
            { k: "Token", v: summary.today.tokens.toLocaleString("id-ID") },
            {
              k: "Modal AI",
              v: isGeminiOrFree
                ? "Rp 0 (Gratis)"
                : summary.pricingUnconfigured && summary.today.tokens > 0
                  ? "belum diset"
                  : formatIdr(summary.today.costIdr),
              sub: isGeminiOrFree && geminiQuota ? (
                <span className="text-[10px] text-emerald-400 font-medium block truncate mt-0.5">
                  Hemat ~{formatIdr(geminiQuota.commercialValueSavedTodayIdr)} · ~Rp10/gen
                </span>
              ) : undefined,
            },
            { k: "Pendapatan", v: formatIdr(summary.today.revenueIdr) },
            {
              k: "Margin",
              v:
                isGeminiOrFree && summary.today.costIdr === 0
                  ? "100%"
                  : summary.pricingUnconfigured && summary.today.tokens > 0
                    ? "—"
                    : margin === null
                      ? "—"
                      : `${margin.toFixed(0)}%`,
              sub: isGeminiOrFree ? (
                <span className="text-[10px] text-emerald-400 font-medium block truncate mt-0.5">
                  Bebas Modal AI
                </span>
              ) : undefined,
              bad: margin !== null && margin < 0 && !summary.pricingUnconfigured,
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
              {s.sub}
            </div>
          ))}
        </div>

        {summary.pricingUnconfigured && (
          <p className="rounded-lg border border-ember/20 bg-ember/5 px-3 py-2 text-micro leading-relaxed text-ember-lo">
            <span className="font-bold">Harga belum dikonfigurasi.</span> Token
            udah kecatat, tapi modalnya belum bisa dihitung. Buka Model, terus isi
            paket token yang lo beli (contoh: Rp2.238 buat 1 juta token).
          </p>
        )}
        {summary.truncated && (
          <p className="rounded-lg border border-ember/20 bg-ember/5 px-3 py-2 text-micro leading-relaxed text-ember-lo">
            Trafik 30 hari melewati batas tampilan. Angka di sini adalah batas bawah; buka
            Biaya lengkap buat lihat peringatannya.
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

  const quotaTrackerView = (
    <AccountQuotaTracker
      initialData={quotaTrackerData}
      onRefreshAction={getQuotaTrackerDataAction}
    />
  );

  return (
    <div className="space-y-6">
      <LiveRefresh
        tables={["ai_providers", "ai_models", "app_config", "ai_provider_balance", "gemini_usage"]}
        label="Setelan AI berubah"
        pollMs={15_000}
      />

      <AdminAiClientTabs
        defaultTab={defaultTab}
        brainView={brainView}
        quotaTrackerView={quotaTrackerView}
        totalQuotaRemaining={quotaTrackerData.totalRemainingToday}
        totalCapacity={quotaTrackerData.totalCapacity}
      />
    </div>
  );
}
