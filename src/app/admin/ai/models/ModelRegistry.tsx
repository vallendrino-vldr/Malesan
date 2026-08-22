"use client";

import { useState, useTransition } from "react";
import { saveModel, deleteModel } from "@/app/actions/ai-admin";
import { CAPABILITIES, type Capability, type ModelRow, type ProviderView } from "@/lib/ai/types";

/**
 * The model registry.
 *
 * A scan drops models in here inactive with guessed capabilities and, for most
 * providers, no prices. Both of those matter more than they look:
 *
 *   Capabilities are what the router filters on. A model with no `vision` tag
 *   will never be offered the payment-proof feature, however good it is.
 *
 *   Price is what the cost dashboard runs on. A model left at 0 is not free —
 *   it is unpriced, and it makes every report that includes it wrong. The card
 *   says so rather than quietly showing Rp0.
 */

const IDR_PER_USD_HINT = 16_500;

function usdPerMtokToIdr(usd: number): string {
  return `≈Rp${Math.round(usd * IDR_PER_USD_HINT).toLocaleString("id-ID")}`;
}

type Draft = {
  label: string;
  inputPrice: string;
  outputPrice: string;
  capabilities: Capability[];
  supportsStreaming: boolean;
  supportsSchema: boolean;
};

export function ModelRegistry({
  models,
  providers,
}: {
  models: ModelRow[];
  providers: ProviderView[];
}) {
  const [editing, setEditing] = useState<string | null>(null);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [busy, startTransition] = useTransition();
  const [err, setErr] = useState<string | null>(null);
  const [onlyActive, setOnlyActive] = useState(false);

  const byProvider = providers
    .map((p) => ({
      provider: p,
      models: models.filter(
        (m) => m.provider_id === p.id && (!onlyActive || m.is_active),
      ),
    }))
    .filter((g) => g.models.length > 0);

  const startEdit = (m: ModelRow) => {
    setEditing(m.id);
    setErr(null);
    setDraft({
      label: m.label ?? "",
      inputPrice: String(m.input_price_usd_per_mtok ?? 0),
      outputPrice: String(m.output_price_usd_per_mtok ?? 0),
      capabilities: [...m.capabilities],
      supportsStreaming: m.supports_streaming,
      supportsSchema: m.supports_schema,
    });
  };

  const commit = (id: string) => {
    if (!draft) return;
    startTransition(async () => {
      try {
        await saveModel({
          id,
          label: draft.label,
          inputPriceUsdPerMtok: Number(draft.inputPrice) || 0,
          outputPriceUsdPerMtok: Number(draft.outputPrice) || 0,
          capabilities: draft.capabilities,
          supportsStreaming: draft.supportsStreaming,
          supportsSchema: draft.supportsSchema,
        });
        setEditing(null);
        setDraft(null);
      } catch (e) {
        setErr(e instanceof Error ? e.message : "Gagal nyimpen.");
      }
    });
  };

  const toggleCap = (c: Capability) => {
    if (!draft) return;
    setDraft({
      ...draft,
      capabilities: draft.capabilities.includes(c)
        ? draft.capabilities.filter((x) => x !== c)
        : [...draft.capabilities, c],
    });
  };

  return (
    <div className="space-y-5">
      <header className="flex items-start justify-between gap-3">
        <div>
          <h1 className="font-display text-xl font-bold text-ink">Model</h1>
          <p className="mt-1 text-sm leading-relaxed text-muted">
            Model yang aktif aja yang bisa dipilih router. Harga dipakai buat
            ngitung untung — model tanpa harga bikin laporan biayanya salah.
          </p>
        </div>
        <label className="flex shrink-0 items-center gap-2 text-micro text-muted">
          <input
            type="checkbox"
            checked={onlyActive}
            onChange={(e) => setOnlyActive(e.target.checked)}
          />
          aktif aja
        </label>
      </header>

      {err && (
        <p className="rounded-lg border border-danger/20 bg-danger/5 px-3 py-2 text-micro text-danger">
          {err}
        </p>
      )}

      {byProvider.length === 0 && (
        <div className="rounded-xl border border-dashed border-hairline px-4 py-10 text-center">
          <p className="text-sm text-muted">
            Belum ada model. Buka menu Provider, terus tekan &quot;Scan model&quot;.
          </p>
        </div>
      )}

      {byProvider.map(({ provider, models: list }) => (
        <section key={provider.id} className="space-y-2">
          <p className="eyebrow text-ember-lo">
            {provider.label} · {list.filter((m) => m.is_active).length}/{list.length} aktif
          </p>

          {list.map((m) => {
            const unpriced =
              m.input_price_usd_per_mtok === 0 && m.output_price_usd_per_mtok === 0;
            const isEditing = editing === m.id;

            return (
              <div key={m.id} className="surface-card rounded-xl p-3.5">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="font-display text-mini font-bold text-ink">
                      {m.label ?? m.model_id}
                    </p>
                    <p className="mt-0.5 font-mono text-micro text-muted">{m.model_id}</p>
                    <p className="mt-1 flex flex-wrap gap-x-2 gap-y-0.5 text-micro text-muted">
                      {m.context_length && (
                        <span>{(m.context_length / 1000).toFixed(0)}k konteks</span>
                      )}
                      {unpriced ? (
                        <span className="text-danger">harga belum diisi</span>
                      ) : (
                        <span>
                          in ${m.input_price_usd_per_mtok}/Mtok {usdPerMtokToIdr(m.input_price_usd_per_mtok)}
                          {" · "}out ${m.output_price_usd_per_mtok}/Mtok
                        </span>
                      )}
                      {!m.supports_streaming && <span>no-stream</span>}
                    </p>
                    {m.capabilities.length > 0 && (
                      <p className="mt-1.5 flex flex-wrap gap-1">
                        {m.capabilities.map((c) => (
                          <span
                            key={c}
                            className="rounded-full bg-surface px-2 py-0.5 font-mono text-micro text-muted"
                          >
                            {c}
                          </span>
                        ))}
                      </p>
                    )}
                  </div>

                  <button
                    onClick={() =>
                      startTransition(async () => {
                        await saveModel({ id: m.id, isActive: !m.is_active });
                      })
                    }
                    disabled={busy}
                    className={`shrink-0 rounded-full px-2.5 py-1 font-mono text-micro ${
                      m.is_active ? "bg-ember/10 text-ember-lo" : "bg-surface text-muted"
                    }`}
                  >
                    {m.is_active ? "aktif" : "mati"}
                  </button>
                </div>

                {isEditing && draft ? (
                  <div className="mt-3 space-y-3 border-t border-hairline pt-3">
                    <label className="block">
                      <span className="text-micro text-muted">Nama tampilan</span>
                      <input
                        value={draft.label}
                        onChange={(e) => setDraft({ ...draft, label: e.target.value })}
                        className="mt-1 w-full rounded-lg border border-hairline bg-obsidian px-3 py-2 text-mini text-ink"
                      />
                    </label>

                    <div className="grid gap-3 sm:grid-cols-2">
                      <label className="block">
                        <span className="text-micro text-muted">Harga input (USD / 1 juta token)</span>
                        <input
                          type="number"
                          step="any"
                          min="0"
                          value={draft.inputPrice}
                          onChange={(e) => setDraft({ ...draft, inputPrice: e.target.value })}
                          className="mt-1 w-full rounded-lg border border-hairline bg-obsidian px-3 py-2 font-mono text-mini text-ink"
                        />
                      </label>
                      <label className="block">
                        <span className="text-micro text-muted">Harga output (USD / 1 juta token)</span>
                        <input
                          type="number"
                          step="any"
                          min="0"
                          value={draft.outputPrice}
                          onChange={(e) => setDraft({ ...draft, outputPrice: e.target.value })}
                          className="mt-1 w-full rounded-lg border border-hairline bg-obsidian px-3 py-2 font-mono text-mini text-ink"
                        />
                      </label>
                    </div>

                    <div>
                      <span className="text-micro text-muted">Kemampuan</span>
                      <div className="mt-1.5 flex flex-wrap gap-1.5">
                        {CAPABILITIES.map((c) => (
                          <button
                            key={c}
                            type="button"
                            onClick={() => toggleCap(c)}
                            className={`rounded-full px-2.5 py-1 font-mono text-micro ${
                              draft.capabilities.includes(c)
                                ? "bg-ember text-obsidian"
                                : "border border-hairline text-muted"
                            }`}
                          >
                            {c}
                          </button>
                        ))}
                      </div>
                    </div>

                    <div className="flex flex-wrap gap-4">
                      <label className="flex items-center gap-2 text-mini text-ink">
                        <input
                          type="checkbox"
                          checked={draft.supportsStreaming}
                          onChange={(e) =>
                            setDraft({ ...draft, supportsStreaming: e.target.checked })
                          }
                        />
                        Bisa streaming
                      </label>
                      <label className="flex items-center gap-2 text-mini text-ink">
                        <input
                          type="checkbox"
                          checked={draft.supportsSchema}
                          onChange={(e) => setDraft({ ...draft, supportsSchema: e.target.checked })}
                        />
                        Bisa JSON schema
                      </label>
                    </div>

                    <div className="flex gap-2">
                      <button
                        onClick={() => commit(m.id)}
                        disabled={busy}
                        className="rounded-full bg-ember px-4 py-1.5 text-micro font-bold text-obsidian disabled:opacity-50"
                      >
                        Simpan
                      </button>
                      <button
                        onClick={() => {
                          setEditing(null);
                          setDraft(null);
                        }}
                        className="rounded-full border border-hairline px-4 py-1.5 text-micro text-muted"
                      >
                        Batal
                      </button>
                      <button
                        onClick={() => {
                          if (!confirm(`Hapus ${m.model_id} dari daftar?`)) return;
                          startTransition(async () => {
                            await deleteModel(m.id);
                            setEditing(null);
                          });
                        }}
                        className="ml-auto rounded-full border border-danger/30 px-3 py-1.5 text-micro text-danger"
                      >
                        Hapus
                      </button>
                    </div>
                  </div>
                ) : (
                  <button
                    onClick={() => startEdit(m)}
                    className="mt-2 text-micro text-muted underline-offset-2 hover:text-ink hover:underline"
                  >
                    Atur harga & kemampuan
                  </button>
                )}
              </div>
            );
          })}
        </section>
      ))}
    </div>
  );
}
