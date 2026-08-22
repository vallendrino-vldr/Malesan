"use client";

import { useMemo, useState } from "react";
import { simulate, formatIdr, type SimulatorInput } from "@/lib/ai/cost";
import type { CostSummary } from "@/lib/ai/analytics";
import type { ModelRow } from "@/lib/ai/types";

/**
 * Cost intelligence and the planning simulator.
 *
 * The number this screen exists to protect is margin per generation. Everything
 * else — spend today, cost by feature, cost by model — is a way of finding out
 * which feature is quietly eating it.
 *
 * The simulator runs the same `simulate()` the rest of the system uses rather
 * than reimplementing the arithmetic in the component, because a planning tool
 * that disagrees with the ledger is worse than no planning tool.
 */

function Stat({ label, value, tone }: { label: string; value: string; tone?: "good" | "bad" }) {
  return (
    <div className="rounded-lg bg-surface px-3 py-2.5">
      <p className="text-micro text-muted">{label}</p>
      <p
        className={`mt-0.5 font-mono text-mini font-bold ${
          tone === "bad" ? "text-danger" : tone === "good" ? "text-ember-lo" : "text-ink"
        }`}
      >
        {value}
      </p>
    </div>
  );
}

export function CostPanel({
  summary,
  models,
  usdToIdr,
}: {
  summary: CostSummary;
  models: ModelRow[];
  usdToIdr: number;
}) {
  const priced = models.filter(
    (m) => m.input_price_usd_per_mtok > 0 || m.output_price_usd_per_mtok > 0,
  );

  const [sim, setSim] = useState<SimulatorInput>({
    users: 10_000,
    generationsPerUserPerDay: 5,
    inputTokensPerGeneration: 3_000,
    outputTokensPerGeneration: 1_200,
    inputUsdPerMtok: priced[0]?.input_price_usd_per_mtok ?? 0.1,
    outputUsdPerMtok: priced[0]?.output_price_usd_per_mtok ?? 0.4,
    creditsPerGeneration: 4,
    rupiahPerCredit: Math.round(summary.rupiahPerCredit),
    usdToIdr,
  });

  const out = useMemo(() => simulate(sim), [sim]);
  const num = (k: keyof SimulatorInput) => (v: string) =>
    setSim({ ...sim, [k]: Number(v) || 0 });

  return (
    <div className="space-y-6">
      <header>
        <h1 className="font-display text-xl font-bold text-ink">Biaya & untung</h1>
        <p className="mt-1 text-sm leading-relaxed text-muted">
          Berapa yang kekeluar buat AI, berapa yang masuk dari kredit, dan fitur
          mana yang paling boros. Satu kredit dihitung {formatIdr(summary.rupiahPerCredit)}{" "}
          (rata-rata dari paket yang aktif).
        </p>
      </header>

      {summary.pricingUnconfigured && (
        <p className="rounded-lg border border-danger/20 bg-danger/5 px-3 py-2.5 text-micro leading-relaxed text-danger">
          Semua panggilan tercatat Rp0 karena belum ada model yang diisi harganya.
          Itu bukan berarti gratis — isi harga model di menu Model biar angka di
          halaman ini beneran.
        </p>
      )}

      <section className="space-y-2">
        <p className="eyebrow text-ember-lo">Hari ini</p>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          <Stat label="Panggilan AI" value={String(summary.today.calls)} />
          <Stat label="Biaya" value={formatIdr(summary.today.costIdr)} />
          <Stat label="Pemasukan" value={formatIdr(summary.today.revenueIdr)} />
          <Stat
            label="Untung"
            value={formatIdr(summary.today.marginIdr)}
            tone={summary.today.marginIdr < 0 ? "bad" : "good"}
          />
        </div>
      </section>

      <section className="space-y-2">
        <p className="eyebrow text-ember-lo">{summary.days} hari terakhir</p>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          <Stat label="Panggilan" value={String(summary.window.calls)} />
          <Stat label="Biaya" value={formatIdr(summary.window.costIdr)} />
          <Stat
            label="Untung"
            value={formatIdr(summary.window.marginIdr)}
            tone={summary.window.marginIdr < 0 ? "bad" : "good"}
          />
          <Stat
            label="Gagal / pindah"
            value={`${summary.window.failures} / ${summary.window.fallbacks}`}
            tone={summary.window.failures > 0 ? "bad" : undefined}
          />
        </div>
      </section>

      {summary.troubled.length > 0 && (
        <section className="space-y-2">
          <p className="eyebrow text-danger">Provider bermasalah</p>
          {summary.troubled.map((t) => (
            <div key={t.providerSlug} className="surface-card rounded-xl px-4 py-3">
              <p className="font-mono text-mini text-ink">{t.providerSlug}</p>
              <p className="text-micro text-danger">{t.failures}× gagal / pindah provider</p>
            </div>
          ))}
        </section>
      )}

      <section className="space-y-2">
        <p className="eyebrow text-ember-lo">Per fitur</p>
        {summary.byFeature.length === 0 ? (
          <p className="rounded-xl border border-dashed border-hairline px-4 py-8 text-center text-sm text-muted">
            Belum ada panggilan AI tercatat di rentang ini.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[34rem] text-left">
              <thead>
                <tr className="text-micro text-muted">
                  <th className="py-1.5 pr-3 font-normal">Fitur</th>
                  <th className="py-1.5 pr-3 font-normal">Panggilan</th>
                  <th className="py-1.5 pr-3 font-normal">Biaya</th>
                  <th className="py-1.5 pr-3 font-normal">Untung</th>
                  <th className="py-1.5 font-normal">Rata-rata</th>
                </tr>
              </thead>
              <tbody>
                {summary.byFeature.map((f) => (
                  <tr key={f.feature} className="border-t border-hairline">
                    <td className="py-2 pr-3 font-mono text-micro text-ink">{f.feature}</td>
                    <td className="py-2 pr-3 text-micro text-muted">
                      {f.calls}
                      {f.failures > 0 && (
                        <span className="text-danger"> ({f.failures} gagal)</span>
                      )}
                    </td>
                    <td className="py-2 pr-3 text-micro text-muted">{formatIdr(f.costIdr)}</td>
                    <td
                      className={`py-2 pr-3 text-micro ${
                        f.marginIdr < 0 ? "text-danger" : "text-ember-lo"
                      }`}
                    >
                      {formatIdr(f.marginIdr)}
                    </td>
                    <td className="py-2 text-micro text-muted">
                      {(f.avgLatencyMs / 1000).toFixed(1)}s
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {summary.byModel.length > 0 && (
        <section className="space-y-2">
          <p className="eyebrow text-ember-lo">Per model</p>
          <div className="space-y-1.5">
            {summary.byModel.slice(0, 8).map((m) => (
              <div
                key={`${m.providerSlug}-${m.modelId}`}
                className="flex items-center justify-between gap-3 rounded-lg bg-surface px-3 py-2"
              >
                <span className="min-w-0 truncate font-mono text-micro text-ink">
                  {m.providerSlug} · {m.modelId}
                </span>
                <span className="shrink-0 text-micro text-muted">
                  {m.calls}× · {formatIdr(m.costIdr)}
                </span>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* ---------- simulator ---------- */}
      <section className="space-y-3">
        <div>
          <p className="eyebrow text-ember-lo">Simulasi</p>
          <p className="mt-1 text-micro leading-relaxed text-muted">
            Kalau segini usernya, untung apa buntung. Angkanya optimis — dianggap
            semua generate dibayar, padahal ada jatah gratis harian.
          </p>
        </div>

        <div className="surface-card space-y-3 rounded-xl p-4">
          {priced.length > 0 && (
            <label className="block">
              <span className="text-micro text-muted">Pakai harga model</span>
              <select
                onChange={(e) => {
                  const m = priced.find((x) => x.id === e.target.value);
                  if (m) {
                    setSim({
                      ...sim,
                      inputUsdPerMtok: m.input_price_usd_per_mtok,
                      outputUsdPerMtok: m.output_price_usd_per_mtok,
                    });
                  }
                }}
                className="mt-1 w-full rounded-lg border border-hairline bg-obsidian px-3 py-2 text-mini text-ink"
              >
                {priced.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.label ?? m.model_id}
                  </option>
                ))}
              </select>
            </label>
          )}

          <div className="grid gap-3 sm:grid-cols-2">
            {(
              [
                ["users", "Jumlah user", sim.users],
                ["generationsPerUserPerDay", "Generate / user / hari", sim.generationsPerUserPerDay],
                ["inputTokensPerGeneration", "Token masuk / generate", sim.inputTokensPerGeneration],
                ["outputTokensPerGeneration", "Token keluar / generate", sim.outputTokensPerGeneration],
                ["creditsPerGeneration", "Kredit / generate", sim.creditsPerGeneration],
                ["rupiahPerCredit", "Rupiah / kredit", sim.rupiahPerCredit],
                ["inputUsdPerMtok", "Harga input (USD/Mtok)", sim.inputUsdPerMtok],
                ["outputUsdPerMtok", "Harga output (USD/Mtok)", sim.outputUsdPerMtok],
              ] as [keyof SimulatorInput, string, number][]
            ).map(([key, label, value]) => (
              <label key={key} className="block">
                <span className="text-micro text-muted">{label}</span>
                <input
                  type="number"
                  step="any"
                  min="0"
                  value={value}
                  onChange={(e) => num(key)(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-hairline bg-obsidian px-3 py-2 font-mono text-mini text-ink"
                />
              </label>
            ))}
          </div>

          <div className="grid grid-cols-2 gap-2 border-t border-hairline pt-3 sm:grid-cols-4">
            <Stat label="Biaya / generate" value={formatIdr(out.costPerGenerationIdr)} />
            <Stat
              label="Untung / generate"
              value={formatIdr(out.marginPerGenerationIdr)}
              tone={out.losesMoneyPerCall ? "bad" : "good"}
            />
            <Stat label="Margin" value={`${out.marginPercent.toFixed(0)}%`} />
            <Stat label="Generate / hari" value={out.generationsPerDay.toLocaleString("id-ID")} />
            <Stat label="Biaya / bulan" value={formatIdr(out.monthlyCostIdr)} />
            <Stat label="Pemasukan / bulan" value={formatIdr(out.monthlyRevenueIdr)} />
            <Stat
              label="Untung / bulan"
              value={formatIdr(out.monthlyProfitIdr)}
              tone={out.monthlyProfitIdr < 0 ? "bad" : "good"}
            />
            <Stat label="Kurs dipakai" value={`Rp${sim.usdToIdr.toLocaleString("id-ID")}`} />
          </div>

          {out.losesMoneyPerCall && (
            <p className="rounded-lg border border-danger/20 bg-danger/5 px-3 py-2 text-micro leading-relaxed text-danger">
              Rugi di tiap panggilan. Naikin harga kredit, turunin jatah gratis,
              atau pindah ke model yang lebih murah buat fitur ini.
            </p>
          )}
        </div>
      </section>
    </div>
  );
}
