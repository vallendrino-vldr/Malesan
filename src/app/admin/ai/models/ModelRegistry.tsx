"use client";

import { useState, useTransition } from "react";
import { saveModel, deleteModel } from "@/app/actions/ai-admin";
import {
  CAPABILITIES,
  type Capability,
  type ModelRow,
  type PricingMode,
  type ProviderView,
} from "@/lib/ai/types";
import { costIdr, isPriced, formatIdr } from "@/lib/ai/cost";

/**
 * The model registry.
 *
 * Rewritten around one complaint: a scan drops a hundred models in and the old
 * screen rendered every one as an open card, so finding the three that matter
 * meant scrolling past ninety-seven that did not. Gateways are now collapsed by
 * default and you open the one you are working on.
 *
 * Two other things changed for the same reason — the person reading this owns a
 * business, not a codebase:
 *
 *   The on/off control is a labelled switch showing HOW MANY FEATURES depend on
 *   it. "Dipakai 12 fitur" and "dipakai 0 fitur" are completely different
 *   decisions, and the old checkbox gave no hint which one you were about to make.
 *
 *   An unpriced model says "harga belum tersedia" with a button, instead of
 *   quietly showing $0. Zero is not free — it is unknown, and every cost report
 *   that includes it is wrong.
 */

type Draft = {
  label: string;
  inputPrice: string;
  outputPrice: string;
  capabilities: Capability[];
  supportsStreaming: boolean;
  supportsSchema: boolean;
  pricingMode: PricingMode;
  packagePrice: string;
  packageTokens: string;
  packageExpires: string;
};

export function ModelRegistry({
  models,
  providers,
  usage,
  usdToIdr,
}: {
  models: ModelRow[];
  providers: ProviderView[];
  /** modelRowId -> how many features route to it first. */
  usage: Record<string, number>;
  usdToIdr: number;
}) {
  const [open, setOpen] = useState<string | null>(
    // Open the gateway that has active models, so the screen lands on something
    // useful rather than a wall of closed rows.
    providers.find((p) => p.active_model_count > 0)?.id ?? providers[0]?.id ?? null,
  );
  const [editing, setEditing] = useState<string | null>(null);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [busy, startTransition] = useTransition();
  const [err, setErr] = useState<string | null>(null);
  const [onlyActive, setOnlyActive] = useState(false);

  const groups = providers
    .map((provider) => ({
      provider,
      models: models.filter(
        (m) => m.provider_id === provider.id && (!onlyActive || m.is_active),
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
      pricingMode: m.pricing_mode,
      packagePrice: m.package_price_idr != null ? String(m.package_price_idr) : "",
      packageTokens: m.package_tokens != null ? String(m.package_tokens) : "",
      packageExpires: m.package_expires_at ?? "",
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
          pricingMode: draft.pricingMode,
          packagePriceIdr: draft.packagePrice ? Number(draft.packagePrice) : null,
          packageTokens: draft.packageTokens ? Number(draft.packageTokens) : null,
          packageExpiresAt: draft.packageExpires || null,
        });
        setEditing(null);
        setDraft(null);
      } catch (e) {
        setErr(e instanceof Error ? e.message : "Gagal nyimpen.");
      }
    });
  };

  const toggleActive = (m: ModelRow) =>
    startTransition(async () => {
      try {
        await saveModel({ id: m.id, isActive: !m.is_active });
      } catch (e) {
        setErr(e instanceof Error ? e.message : "Gagal ngubah status.");
      }
    });

  const rupiah = (usd: number) =>
    `≈Rp${Math.round(usd * usdToIdr).toLocaleString("id-ID")}`;

  return (
    <div className="space-y-4">
      <header className="flex items-start justify-between gap-3">
        <div>
          <h1 className="font-display text-xl font-bold text-ink">Model</h1>
          <p className="mt-1 text-sm leading-relaxed text-muted">
            Cuma model yang nyala yang bisa dipilih jadi otak AI. Buka gateway-nya
            buat lihat isinya.
          </p>
        </div>
        <label className="flex shrink-0 items-center gap-2 text-micro text-muted">
          <input
            type="checkbox"
            checked={onlyActive}
            onChange={(e) => setOnlyActive(e.target.checked)}
          />
          yang nyala aja
        </label>
      </header>

      {err && (
        <p className="rounded-lg border border-danger/20 bg-danger/5 px-3 py-2 text-micro text-danger">
          {err}
        </p>
      )}

      {groups.length === 0 && (
        <div className="rounded-xl border border-dashed border-hairline px-4 py-10 text-center">
          <p className="text-sm text-muted">
            Belum ada model. Buka menu Gateway, terus tekan &quot;Scan model&quot;.
          </p>
        </div>
      )}

      {groups.map(({ provider, models: list }) => {
        const isOpen = open === provider.id;
        const activeCount = list.filter((m) => m.is_active).length;

        return (
          <section key={provider.id} className="surface-card overflow-hidden rounded-xl">
            <button
              onClick={() => setOpen(isOpen ? null : provider.id)}
              aria-expanded={isOpen}
              className="flex w-full items-center justify-between gap-3 px-4 py-3.5 text-left hover:bg-surface"
            >
              <div className="min-w-0">
                <p className="font-display text-mini font-bold text-ink">{provider.label}</p>
                <p className="mt-0.5 text-micro text-muted">
                  {activeCount} dari {list.length} model nyala
                  {!provider.is_active && " · gateway lagi mati"}
                </p>
              </div>
              <span
                aria-hidden="true"
                className={`shrink-0 text-muted transition-transform duration-[var(--duration-standard)] ${
                  isOpen ? "rotate-90" : ""
                }`}
              >
                ›
              </span>
            </button>

            {isOpen && (
              <div className="space-y-1.5 border-t border-hairline p-3">
                {list.map((m) => {
                  const unpriced = !isPriced(m);
                  const used = usage[m.id] ?? 0;
                  const isEditing = editing === m.id;

                  return (
                    <div key={m.id} className="rounded-lg bg-surface px-3 py-3">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="font-display text-mini font-bold text-ink">
                            {m.label ?? m.model_id}
                          </p>
                          <p className="mt-0.5 font-mono text-micro text-muted">{m.model_id}</p>
                          <p className="mt-1 text-micro">
                            {used > 0 ? (
                              <span className="text-ember-lo">Dipakai {used} fitur</span>
                            ) : (
                              <span className="text-muted">Belum dipakai fitur mana pun</span>
                            )}
                          </p>
                        </div>

                        {/* A switch with a word on it. The old small checkbox gave
                            no clue what it did or what depended on it. */}
                        <button
                          onClick={() => toggleActive(m)}
                          disabled={busy}
                          role="switch"
                          aria-checked={m.is_active}
                          aria-label={`${m.label ?? m.model_id}: ${m.is_active ? "nyala" : "mati"}`}
                          className={`flex shrink-0 items-center gap-2 rounded-full px-3 py-1.5 text-micro font-bold transition-colors duration-[var(--duration-standard)] ${
                            m.is_active
                              ? "bg-ember text-obsidian"
                              : "border border-hairline text-muted"
                          }`}
                        >
                          <span
                            aria-hidden="true"
                            className={`size-2 rounded-full ${
                              m.is_active ? "bg-obsidian" : "bg-muted"
                            }`}
                          />
                          {m.is_active ? "NYALA" : "MATI"}
                        </button>
                      </div>

                      <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-micro">
                        {m.context_length && (
                          <span className="text-muted">
                            {(m.context_length / 1000).toFixed(0)}k konteks
                          </span>
                        )}
                        {unpriced ? (
                          <>
                            <span className="text-danger">Harga belum tersedia</span>
                            <button
                              onClick={() => startEdit(m)}
                              className="rounded-full border border-hairline px-2.5 py-0.5 text-micro text-ink hover:bg-obsidian"
                            >
                              Isi manual
                            </button>
                          </>
                        ) : m.pricing_mode === "free_quota" ? (
                          <span className="text-ember-lo">Gratis (kuota provider)</span>
                        ) : m.pricing_mode === "prepaid_package" ? (
                          <span className="text-muted">
                            Paket {formatIdr(Number(m.package_price_idr ?? 0))} /{" "}
                            {Number(m.package_tokens ?? 0).toLocaleString("id-ID")} token
                            {m.package_expires_at && ` · sampai ${m.package_expires_at}`}
                          </span>
                        ) : (
                          <span className="text-muted">
                            masuk ${m.input_price_usd_per_mtok}/1jt {rupiah(m.input_price_usd_per_mtok)}
                            {" · "}keluar ${m.output_price_usd_per_mtok}/1jt
                          </span>
                        )}
                      </div>

                      {m.capabilities.length > 0 && (
                        <p className="mt-1.5 flex flex-wrap gap-1">
                          {m.capabilities.map((c) => (
                            <span
                              key={c}
                              className="rounded-full bg-obsidian px-2 py-0.5 font-mono text-micro text-muted"
                            >
                              {c}
                            </span>
                          ))}
                        </p>
                      )}

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

                          {/* Two ways to know a price, because vendors sell two
                              different things. A prepaid buyer should never have
                              to convert their receipt into USD-per-Mtok. */}
                          <div className="flex flex-wrap gap-1.5">
                            {(
                              [
                                ["prepaid_package", "Beli paket token"],
                                ["free_quota", "Gratis (kuota provider)"],
                                ["direct_usd", "Harga per token (USD)"],
                              ] as [PricingMode, string][]
                            ).map(([v, l]) => (
                              <button
                                key={v}
                                type="button"
                                onClick={() => setDraft({ ...draft, pricingMode: v })}
                                className={`rounded-full px-3 py-1.5 text-micro ${
                                  draft.pricingMode === v
                                    ? "bg-ember font-bold text-obsidian"
                                    : "border border-hairline text-muted"
                                }`}
                              >
                                {l}
                              </button>
                            ))}
                          </div>

                          {draft.pricingMode === "free_quota" ? (
                            <p className="rounded-lg border border-ember/20 bg-ember/5 px-3 py-2 text-micro leading-relaxed text-ember-lo">
                              Model ini gratis dari providernya, jadi biayanya
                              dihitung nol — bukan &quot;belum diisi&quot;. Yang
                              membatasi cuma kuota harian provider, bukan uang.
                            </p>
                          ) : draft.pricingMode === "prepaid_package" ? (
                            <>
                              <div className="grid gap-3 sm:grid-cols-3">
                                <label className="block">
                                  <span className="text-micro text-muted">Harga beli (Rp)</span>
                                  <input
                                    type="number"
                                    min="0"
                                    placeholder="2238"
                                    value={draft.packagePrice}
                                    onChange={(e) =>
                                      setDraft({ ...draft, packagePrice: e.target.value })
                                    }
                                    className="mt-1 w-full rounded-lg border border-hairline bg-obsidian px-3 py-2 font-mono text-mini text-ink"
                                  />
                                </label>
                                <label className="block">
                                  <span className="text-micro text-muted">Dapat berapa token</span>
                                  <input
                                    type="number"
                                    min="1"
                                    placeholder="1000000"
                                    value={draft.packageTokens}
                                    onChange={(e) =>
                                      setDraft({ ...draft, packageTokens: e.target.value })
                                    }
                                    className="mt-1 w-full rounded-lg border border-hairline bg-obsidian px-3 py-2 font-mono text-mini text-ink"
                                  />
                                </label>
                                <label className="block">
                                  <span className="text-micro text-muted">Berlaku sampai</span>
                                  <input
                                    type="date"
                                    value={draft.packageExpires}
                                    onChange={(e) =>
                                      setDraft({ ...draft, packageExpires: e.target.value })
                                    }
                                    className="mt-1 w-full rounded-lg border border-hairline bg-obsidian px-3 py-2 font-mono text-mini text-ink"
                                  />
                                </label>
                              </div>
                              {Number(draft.packagePrice) > 0 &&
                                Number(draft.packageTokens) > 0 && (
                                  <p className="text-micro text-muted">
                                    Sistem hitung sendiri:{" "}
                                    <span className="text-ink">
                                      {formatIdr(
                                        costIdr(
                                          {
                                            input_price_usd_per_mtok: 0,
                                            output_price_usd_per_mtok: 0,
                                            pricing_mode: "prepaid_package",
                                            package_price_idr: Number(draft.packagePrice),
                                            package_tokens: Number(draft.packageTokens),
                                          },
                                          { input: 1000, output: 0 },
                                          16500,
                                        ),
                                      )}
                                    </span>{" "}
                                    per 1.000 token.
                                  </p>
                                )}
                            </>
                          ) : (
                            <div className="grid gap-3 sm:grid-cols-2">
                              <label className="block">
                                <span className="text-micro text-muted">
                                  Harga masuk (USD / 1 juta token)
                                </span>
                                <input
                                  type="number"
                                  step="any"
                                  min="0"
                                  value={draft.inputPrice}
                                  onChange={(e) =>
                                    setDraft({ ...draft, inputPrice: e.target.value })
                                  }
                                  className="mt-1 w-full rounded-lg border border-hairline bg-obsidian px-3 py-2 font-mono text-mini text-ink"
                                />
                              </label>
                              <label className="block">
                                <span className="text-micro text-muted">
                                  Harga keluar (USD / 1 juta token)
                                </span>
                                <input
                                  type="number"
                                  step="any"
                                  min="0"
                                  value={draft.outputPrice}
                                  onChange={(e) =>
                                    setDraft({ ...draft, outputPrice: e.target.value })
                                  }
                                  className="mt-1 w-full rounded-lg border border-hairline bg-obsidian px-3 py-2 font-mono text-mini text-ink"
                                />
                              </label>
                            </div>
                          )}

                          <div>
                            <span className="text-micro text-muted">Kemampuan</span>
                            <div className="mt-1.5 flex flex-wrap gap-1.5">
                              {CAPABILITIES.map((c) => (
                                <button
                                  key={c}
                                  type="button"
                                  onClick={() =>
                                    setDraft({
                                      ...draft,
                                      capabilities: draft.capabilities.includes(c)
                                        ? draft.capabilities.filter((x) => x !== c)
                                        : [...draft.capabilities, c],
                                    })
                                  }
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
                                onChange={(e) =>
                                  setDraft({ ...draft, supportsSchema: e.target.checked })
                                }
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
                        !unpriced && (
                          <button
                            onClick={() => startEdit(m)}
                            className="mt-2 text-micro text-muted underline-offset-2 hover:text-ink hover:underline"
                          >
                            Ubah harga & kemampuan
                          </button>
                        )
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </section>
        );
      })}
    </div>
  );
}
