"use client";

import { useState, useTransition } from "react";
import { saveRoute, clearRoute, previewRoute } from "@/app/actions/ai-admin";
import {
  AI_FEATURES,
  CAPABILITIES,
  type Capability,
  type ModelRow,
  type ProviderView,
  type RouteMode,
  type RoutePrefer,
  type RouteRow,
} from "@/lib/ai/types";

/**
 * Feature routing — which model serves which part of the product.
 *
 * The default state of every feature is "no route", which means the legacy
 * Gemini path. That is shown plainly rather than hidden, because it is the
 * honest description of what is happening and because it is the thing to return
 * to when a new provider misbehaves: "Balikin ke default" is one tap and needs
 * no understanding of routing at all.
 *
 * Three modes, matching the engine:
 *   Manual  — this model, then these backups, in this order.
 *   Smart   — score every qualifying model on cost/speed/quality and pick.
 *   (none)  — legacy path.
 *
 * Fallback is not a fourth mode. It is the tail of the chain in both modes,
 * because "what happens when this fails" is not a different strategy, it is part
 * of the same one.
 */

const PREFERS: { value: RoutePrefer; label: string; hint: string }[] = [
  { value: "cheap", label: "Hemat", hint: "Paling murah yang memenuhi syarat" },
  { value: "fast", label: "Cepat", hint: "Model ringan, buat yang user-nya nunggu" },
  { value: "quality", label: "Pintar", hint: "Model premium/reasoning duluan" },
  { value: "balanced", label: "Seimbang", hint: "Campuran murah, cepat, pintar" },
];

type Draft = {
  mode: RouteMode;
  primaryModelId: string | null;
  fallbackModelIds: string[];
  requiredCapabilities: Capability[];
  prefer: RoutePrefer;
  isActive: boolean;
};

export function RoutingManager({
  routes,
  models,
  providers,
}: {
  routes: RouteRow[];
  models: ModelRow[];
  providers: ProviderView[];
}) {
  const [open, setOpen] = useState<string | null>(null);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [busy, startTransition] = useTransition();
  const [note, setNote] = useState<{ key: string; text: string; ok: boolean } | null>(null);

  const activeModels = models.filter((m) => m.is_active);
  const providerLabel = (id: string) => providers.find((p) => p.id === id)?.label ?? "?";
  const modelLabel = (m: ModelRow) =>
    `${providerLabel(m.provider_id)} · ${m.label ?? m.model_id}`;
  const findModel = (id: string | null) => (id ? models.find((m) => m.id === id) : undefined);

  const routeOf = (feature: string) => routes.find((r) => r.feature === feature) ?? null;

  const startEdit = (feature: string) => {
    const r = routeOf(feature);
    const spec = AI_FEATURES.find((f) => f.key === feature);
    setOpen(feature);
    setNote(null);
    setDraft(
      r
        ? {
            mode: r.mode,
            primaryModelId: r.primary_model_id,
            fallbackModelIds: r.fallback_model_ids,
            requiredCapabilities: r.required_capabilities,
            prefer: r.prefer,
            isActive: r.is_active,
          }
        : {
            mode: "manual",
            primaryModelId: null,
            fallbackModelIds: [],
            requiredCapabilities: [],
            prefer: spec?.suggested ?? "balanced",
            isActive: true,
          },
    );
  };

  const commit = (feature: string) => {
    if (!draft) return;
    startTransition(async () => {
      try {
        await saveRoute({ feature, ...draft });
        const p = await previewRoute(feature);
        setNote({
          key: feature,
          text: `Kesimpen. ${p.reason} ${p.chain.length ? `Urutan: ${p.chain.join(" → ")}` : ""}`,
          ok: true,
        });
        setOpen(null);
        setDraft(null);
      } catch (e) {
        setNote({
          key: feature,
          text: e instanceof Error ? e.message : "Gagal nyimpen.",
          ok: false,
        });
      }
    });
  };

  return (
    <div className="space-y-5">
      <header>
        <h1 className="font-display text-xl font-bold text-ink">Routing</h1>
        <p className="mt-1 text-sm leading-relaxed text-muted">
          Nentuin fitur mana pakai model mana. Yang belum diatur otomatis pakai
          jalur Gemini lama — aman, dan itu tombol balik kalau ada yang aneh.
        </p>
      </header>

      {activeModels.length === 0 && (
        <p className="rounded-lg border border-ember/20 bg-ember/5 px-3 py-2 text-micro text-ember-lo">
          Belum ada model aktif. Aktifin dulu minimal satu di menu Model, baru
          routing bisa dipakai.
        </p>
      )}

      <div className="space-y-2.5">
        {AI_FEATURES.map((f) => {
          const r = routeOf(f.key);
          const primary = findModel(r?.primary_model_id ?? null);
          const isOpen = open === f.key;

          return (
            <div key={f.key} className="surface-card rounded-xl p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="font-display text-mini font-bold text-ink">{f.label}</p>
                  <p className="mt-0.5 text-micro leading-relaxed text-muted">{f.note}</p>
                  <p className="mt-1.5 text-micro">
                    {r && r.is_active ? (
                      <span className="text-ember-lo">
                        {r.mode === "manual"
                          ? `Manual: ${primary ? modelLabel(primary) : "model utamanya udah gak aktif"}`
                          : `Smart (${PREFERS.find((p) => p.value === r.prefer)?.label})`}
                        {r.fallback_model_ids.length > 0 &&
                          ` + ${r.fallback_model_ids.length} cadangan`}
                      </span>
                    ) : (
                      <span className="text-muted">Default (Gemini lama)</span>
                    )}
                  </p>
                </div>
                <button
                  onClick={() => (isOpen ? setOpen(null) : startEdit(f.key))}
                  className="shrink-0 rounded-full border border-hairline px-3 py-1.5 text-micro text-ink hover:bg-surface"
                >
                  {isOpen ? "Tutup" : "Atur"}
                </button>
              </div>

              {note?.key === f.key && (
                <p
                  className={`mt-2 rounded-lg px-3 py-2 text-micro leading-relaxed ${
                    note.ok
                      ? "border border-ember/20 bg-ember/5 text-ember-lo"
                      : "border border-danger/20 bg-danger/5 text-danger"
                  }`}
                >
                  {note.text}
                </p>
              )}

              {isOpen && draft && (
                <div className="mt-3 space-y-3 border-t border-hairline pt-3">
                  <div className="flex gap-1.5">
                    {(["manual", "smart"] as RouteMode[]).map((m) => (
                      <button
                        key={m}
                        onClick={() => setDraft({ ...draft, mode: m })}
                        className={`rounded-full px-3 py-1.5 text-micro ${
                          draft.mode === m
                            ? "bg-ember font-bold text-obsidian"
                            : "border border-hairline text-muted"
                        }`}
                      >
                        {m === "manual" ? "Manual" : "Smart"}
                      </button>
                    ))}
                  </div>

                  {draft.mode === "smart" && (
                    <label className="block">
                      <span className="text-micro text-muted">Prioritasin</span>
                      <select
                        value={draft.prefer}
                        onChange={(e) =>
                          setDraft({ ...draft, prefer: e.target.value as RoutePrefer })
                        }
                        className="mt-1 w-full rounded-lg border border-hairline bg-obsidian px-3 py-2 text-mini text-ink"
                      >
                        {PREFERS.map((p) => (
                          <option key={p.value} value={p.value}>
                            {p.label} — {p.hint}
                          </option>
                        ))}
                      </select>
                    </label>
                  )}

                  <label className="block">
                    <span className="text-micro text-muted">
                      Model utama {draft.mode === "smart" && "(opsional — dipaksa duluan)"}
                    </span>
                    <select
                      value={draft.primaryModelId ?? ""}
                      onChange={(e) =>
                        setDraft({ ...draft, primaryModelId: e.target.value || null })
                      }
                      className="mt-1 w-full rounded-lg border border-hairline bg-obsidian px-3 py-2 text-mini text-ink"
                    >
                      <option value="">— gak dipilih —</option>
                      {activeModels.map((m) => (
                        <option key={m.id} value={m.id}>
                          {modelLabel(m)}
                        </option>
                      ))}
                    </select>
                  </label>

                  <div>
                    <span className="text-micro text-muted">
                      Cadangan kalau yang utama gagal (urut)
                    </span>
                    <div className="mt-1.5 flex flex-wrap gap-1.5">
                      {activeModels
                        .filter((m) => m.id !== draft.primaryModelId)
                        .map((m) => {
                          const picked = draft.fallbackModelIds.includes(m.id);
                          const order = draft.fallbackModelIds.indexOf(m.id) + 1;
                          return (
                            <button
                              key={m.id}
                              type="button"
                              onClick={() =>
                                setDraft({
                                  ...draft,
                                  fallbackModelIds: picked
                                    ? draft.fallbackModelIds.filter((x) => x !== m.id)
                                    : [...draft.fallbackModelIds, m.id],
                                })
                              }
                              className={`rounded-full px-2.5 py-1 text-micro ${
                                picked
                                  ? "bg-ember text-obsidian"
                                  : "border border-hairline text-muted"
                              }`}
                            >
                              {picked && <span className="font-mono">{order}. </span>}
                              {m.label ?? m.model_id}
                            </button>
                          );
                        })}
                    </div>
                  </div>

                  <details className="rounded-lg border border-hairline px-3 py-2">
                    <summary className="cursor-pointer text-micro text-muted">
                      Syarat tambahan
                    </summary>
                    <p className="mt-2 text-micro leading-relaxed text-muted">
                      Fitur ini selalu butuh: {f.requires.join(", ")}. Tambahan di
                      bawah bikin syaratnya makin ketat.
                    </p>
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      {CAPABILITIES.map((c) => (
                        <button
                          key={c}
                          type="button"
                          onClick={() =>
                            setDraft({
                              ...draft,
                              requiredCapabilities: draft.requiredCapabilities.includes(c)
                                ? draft.requiredCapabilities.filter((x) => x !== c)
                                : [...draft.requiredCapabilities, c],
                            })
                          }
                          className={`rounded-full px-2.5 py-1 font-mono text-micro ${
                            draft.requiredCapabilities.includes(c)
                              ? "bg-ember text-obsidian"
                              : "border border-hairline text-muted"
                          }`}
                        >
                          {c}
                        </button>
                      ))}
                    </div>
                  </details>

                  <div className="flex flex-wrap gap-2">
                    <button
                      onClick={() => commit(f.key)}
                      disabled={busy}
                      className="rounded-full bg-ember px-4 py-1.5 text-micro font-bold text-obsidian disabled:opacity-50"
                    >
                      {busy ? "Nyimpen..." : "Simpan"}
                    </button>
                    <button
                      onClick={() =>
                        startTransition(async () => {
                          const p = await previewRoute(f.key);
                          setNote({
                            key: f.key,
                            text: `${p.reason} ${p.chain.length ? `Urutan sekarang: ${p.chain.join(" → ")}` : ""}`,
                            ok: true,
                          });
                        })
                      }
                      className="rounded-full border border-hairline px-4 py-1.5 text-micro text-ink"
                    >
                      Cek urutan
                    </button>
                    {r && (
                      <button
                        onClick={() => {
                          if (!confirm(`Balikin "${f.label}" ke Gemini lama?`)) return;
                          startTransition(async () => {
                            await clearRoute(f.key);
                            setOpen(null);
                            setNote({ key: f.key, text: "Balik ke default.", ok: true });
                          });
                        }}
                        className="ml-auto rounded-full border border-hairline px-4 py-1.5 text-micro text-muted"
                      >
                        Balikin ke default
                      </button>
                    )}
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
