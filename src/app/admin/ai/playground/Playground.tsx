"use client";

import { useState, useTransition } from "react";
import { runPlayground, type PlaygroundResult } from "@/app/actions/ai-admin";
import type { ModelRow, ProviderView } from "@/lib/ai/types";

/**
 * Try a model before trusting it with paying users.
 *
 * Calls the chosen model directly, never through the router — the question here
 * is what THIS model does, and a router that helpfully substituted a
 * better-scoring one would mean approving a model you never actually ran.
 *
 * Reports the four things that decide whether a model ships: what it wrote, how
 * long it took, how many tokens it burned, and what that cost in rupiah. Latency
 * matters as much as quality for anything a user waits on — a better answer that
 * lands four seconds late loses to a decent one that lands now.
 */

const SAMPLE =
  "Bikin 3 hook buat konten TikTok tentang beli motor bekas di bawah 10 juta. Bahasa Indonesia santai, maksimal 15 kata per hook.";

export function Playground({
  models,
  providers,
}: {
  models: ModelRow[];
  providers: ProviderView[];
}) {
  const active = models.filter((m) => m.is_active);
  const [modelId, setModelId] = useState(active[0]?.id ?? "");
  const [prompt, setPrompt] = useState(SAMPLE);
  const [result, setResult] = useState<PlaygroundResult | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [busy, startTransition] = useTransition();

  const providerLabel = (id: string) => providers.find((p) => p.id === id)?.label ?? "?";

  const run = () => {
    setErr(null);
    setResult(null);
    startTransition(async () => {
      try {
        setResult(await runPlayground(modelId, prompt));
      } catch (e) {
        setErr(e instanceof Error ? e.message : "Gagal manggil model.");
      }
    });
  };

  return (
    <div className="space-y-5">
      <header>
        <h1 className="font-display text-xl font-bold text-ink">Playground</h1>
        <p className="mt-1 text-sm leading-relaxed text-muted">
          Tes model sebelum dipakai user. Gak motong kredit siapa-siapa, tapi
          tetep kepakai kuota provider — dan biayanya beneran dihitung di bawah.
        </p>
      </header>

      {active.length === 0 ? (
        <div className="rounded-xl border border-dashed border-hairline px-4 py-10 text-center">
          <p className="text-sm text-muted">
            Belum ada model aktif. Aktifin dulu di menu Model.
          </p>
        </div>
      ) : (
        <div className="surface-card space-y-3 rounded-xl p-4">
          <label className="block">
            <span className="text-micro text-muted">Model</span>
            <select
              value={modelId}
              onChange={(e) => setModelId(e.target.value)}
              className="mt-1 w-full rounded-lg border border-hairline bg-obsidian px-3 py-2 text-mini text-ink"
            >
              {active.map((m) => (
                <option key={m.id} value={m.id}>
                  {providerLabel(m.provider_id)} · {m.label ?? m.model_id}
                </option>
              ))}
            </select>
          </label>

          <label className="block">
            <span className="text-micro text-muted">Prompt</span>
            <textarea
              rows={5}
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              className="mt-1 w-full resize-y rounded-lg border border-hairline bg-obsidian px-3 py-2 text-mini leading-relaxed text-ink"
            />
          </label>

          <button
            onClick={run}
            disabled={busy || !modelId}
            className="rounded-full bg-ember px-4 py-2 text-mini font-bold text-obsidian disabled:opacity-50"
          >
            {busy ? "Lagi jalan..." : "Jalanin"}
          </button>

          {err && (
            <p className="rounded-lg border border-danger/20 bg-danger/5 px-3 py-2 text-micro leading-relaxed text-danger">
              {err}
            </p>
          )}

          {result && (
            <div className="space-y-3 border-t border-hairline pt-3">
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                {[
                  { k: "Provider", v: result.providerSlug },
                  { k: "Waktu", v: `${(result.latencyMs / 1000).toFixed(1)}s` },
                  {
                    k: "Token",
                    v: `${result.inputTokens}→${result.outputTokens}`,
                  },
                  {
                    k: "Biaya",
                    v:
                      result.costIdr > 0
                        ? `Rp${Math.round(result.costIdr).toLocaleString("id-ID")}`
                        : "belum dihargai",
                  },
                ].map((s) => (
                  <div key={s.k} className="rounded-lg bg-surface px-3 py-2">
                    <p className="text-micro text-muted">{s.k}</p>
                    <p className="mt-0.5 font-mono text-mini text-ink">{s.v}</p>
                  </div>
                ))}
              </div>

              <p className="font-mono text-micro text-muted">{result.modelId}</p>

              <pre className="max-h-96 overflow-auto whitespace-pre-wrap rounded-lg bg-obsidian p-3 font-mono text-micro leading-relaxed text-ink">
                {result.text}
              </pre>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
