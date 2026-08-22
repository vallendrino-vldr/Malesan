"use client";

import { useState, useTransition } from "react";
import { saveBrain, setAdminMode } from "@/app/actions/ai-admin";
import type { BrainView, Health } from "@/lib/ai/brain";
import type { Quota } from "@/lib/ai/analytics";
import type { AdminMode } from "@/lib/config";
import type { ModelRow, ProviderView } from "@/lib/ai/types";
import { formatIdr } from "@/lib/ai/cost";

/**
 * The Global AI Brain — the one control that matters.
 *
 * This screen answers three questions an owner actually has, in this order:
 * what is my AI right now, is it working, and what happens when it breaks.
 * Everything else in the AI panel is a detail behind that.
 *
 * The status line is deliberately blunt about the one failure that is otherwise
 * invisible: a Brain pointing at a switched-off model does not break the
 * product — routing silently drops to the legacy Gemini path — so without a
 * warning the owner believes they moved to DeepSeek while still paying Google.
 */

const HEALTH: Record<Health, { dot: string; text: string; label: string }> = {
  healthy: { dot: "bg-ember", text: "text-ember-lo", label: "sehat" },
  warning: { dot: "bg-ember/60", text: "text-ember-lo", label: "ada gangguan" },
  limit: { dot: "bg-ember/60", text: "text-ember-lo", label: "kena limit" },
  error: { dot: "bg-danger", text: "text-danger", label: "bermasalah" },
};

function Row({
  role,
  label,
  provider,
  active,
  health,
}: {
  role: string;
  label: string;
  provider: string;
  active: boolean;
  health: Health;
}) {
  const h = HEALTH[active ? health : "error"];
  return (
    <div className="flex items-center justify-between gap-3 rounded-lg bg-surface px-3 py-2.5">
      <div className="min-w-0">
        <p className="text-micro text-muted">{role}</p>
        <p className="mt-0.5 truncate font-display text-mini font-bold text-ink">{label}</p>
        <p className="text-micro text-muted">{provider}</p>
      </div>
      <span className={`flex shrink-0 items-center gap-1.5 text-micro ${h.text}`}>
        <span aria-hidden="true" className={`size-2 rounded-full ${h.dot}`} />
        {active ? h.label : "mati"}
      </span>
    </div>
  );
}

function Bar({ percent }: { percent: number }) {
  return (
    <div
      className="h-1.5 w-full overflow-hidden rounded-full bg-obsidian"
      role="progressbar"
      aria-valuenow={Math.round(percent)}
      aria-valuemin={0}
      aria-valuemax={100}
    >
      <div
        className={`h-full rounded-full ${percent >= 90 ? "bg-danger" : "bg-ember"}`}
        style={{ width: `${Math.min(100, Math.max(0, percent))}%` }}
      />
    </div>
  );
}

export function BrainPanel({
  brain,
  models,
  providers,
  mode,
  quota,
}: {
  brain: BrainView;
  models: ModelRow[];
  providers: ProviderView[];
  mode: AdminMode;
  /** Prepaid package status for the primary model, when it has one. */
  quota: Quota | null;
}) {
  const active = models.filter((m) => m.is_active);
  const [editing, setEditing] = useState(false);
  const [primary, setPrimary] = useState(brain.primary?.modelId ?? "");
  const [fallbacks, setFallbacks] = useState<string[]>(
    brain.fallbacks.map((f) => f.modelId),
  );
  const [err, setErr] = useState<string | null>(null);
  const [busy, startTransition] = useTransition();

  const providerLabel = (id: string) => providers.find((p) => p.id === id)?.label ?? "?";
  const modelLabel = (m: ModelRow) => `${providerLabel(m.provider_id)} · ${m.label ?? m.model_id}`;

  const commit = () => {
    setErr(null);
    startTransition(async () => {
      try {
        await saveBrain(primary || null, fallbacks);
        setEditing(false);
      } catch (e) {
        setErr(e instanceof Error ? e.message : "Gagal nyimpen.");
      }
    });
  };

  return (
    <section className="space-y-3">
      <header className="flex items-start justify-between gap-3">
        <div>
          <h1 className="font-display text-xl font-bold text-ink">Otak AI</h1>
          <p className="mt-1 text-sm leading-relaxed text-muted">
            Satu setelan buat seluruh aplikasi. Ganti di sini, semua fitur ikut —
            gak perlu atur satu-satu.
          </p>
        </div>
        <button
          onClick={() =>
            startTransition(async () => {
              await setAdminMode(mode === "simple" ? "advanced" : "simple");
            })
          }
          className="shrink-0 rounded-full border border-hairline px-3 py-1.5 text-micro text-muted hover:bg-surface hover:text-ink"
        >
          {mode === "simple" ? "Setelan lanjutan" : "Mode simpel"}
        </button>
      </header>

      <div className="surface-card space-y-3 rounded-xl p-4">
        <div className="flex items-center justify-between gap-3">
          <p
            className={`text-mini leading-relaxed ${
              brain.healthy ? "text-ember-lo" : "text-danger"
            }`}
          >
            {brain.status}
          </p>
          {!editing && (
            <button
              onClick={() => setEditing(true)}
              className="shrink-0 rounded-full bg-ember px-4 py-1.5 text-micro font-bold text-obsidian"
            >
              Ganti
            </button>
          )}
        </div>

        {!editing ? (
          <>
            {brain.primary ? (
              <div className="space-y-1.5">
                <Row
                  role="AI utama"
                  label={brain.primary.label}
                  provider={brain.primary.provider}
                  active={brain.primary.active}
                  health={brain.primary.health}
                />

                {/* The prepaid package, in the only terms that matter: how much
                    is left, how much of the money is gone, and when it dies. */}
                {quota && quota.totalTokens !== null && (
                  <div className="rounded-lg bg-surface px-3 py-2.5">
                    <div className="flex items-baseline justify-between gap-3">
                      <p className="text-micro text-muted">Sisa token</p>
                      <p className="font-mono text-mini font-bold text-ink">
                        {(quota.remainingTokens ?? 0).toLocaleString("id-ID")}
                        <span className="text-muted">
                          {" "}
                          / {quota.totalTokens.toLocaleString("id-ID")}
                        </span>
                      </p>
                    </div>
                    <div className="mt-2">
                      <Bar percent={quota.percentUsed ?? 0} />
                    </div>
                    <div className="mt-2 flex flex-wrap justify-between gap-x-3 gap-y-1 text-micro text-muted">
                      <span>
                        Modal {formatIdr(quota.packagePriceIdr ?? 0)} · kepakai{" "}
                        {formatIdr(quota.spentIdr)}
                      </span>
                      {quota.expiresAt && (
                        <span className={quota.expired ? "text-danger" : ""}>
                          {quota.expired ? "Sudah kedaluwarsa" : `Habis ${quota.expiresAt}`}
                        </span>
                      )}
                    </div>
                    {(quota.percentUsed ?? 0) >= 90 && !quota.expired && (
                      <p className="mt-2 text-micro text-danger">
                        Token tinggal dikit. Isi ulang paketnya sebelum habis, atau
                        pastiin cadangannya nyala.
                      </p>
                    )}
                  </div>
                )}

                {brain.fallbacks.map((f, i) => (
                  <Row
                    key={f.modelId}
                    role={`Cadangan ${i + 1}`}
                    label={f.label}
                    provider={f.provider}
                    active={f.active}
                    health={f.health}
                  />
                ))}
                {brain.fallbacks.length === 0 && (
                  <p className="rounded-lg border border-hairline px-3 py-2 text-micro leading-relaxed text-muted">
                    Belum ada cadangan. Kalau AI utamanya lagi ngambek, generate
                    bakal gagal — padahal bisa otomatis pindah ke AI lain.
                  </p>
                )}
              </div>
            ) : (
              <div className="rounded-lg border border-dashed border-hairline px-3 py-6 text-center">
                <p className="text-mini text-muted">
                  Masih pakai Gemini bawaan. Tekan Ganti buat pilih otak AI sendiri.
                </p>
              </div>
            )}

            <p className="text-micro text-muted">
              {brain.followingCount} fitur ngikut otak AI ini
              {brain.overriddenCount > 0 && `, ${brain.overriddenCount} fitur diatur sendiri`}.
            </p>
          </>
        ) : (
          <div className="space-y-3">
            {active.length === 0 && (
              <p className="rounded-lg border border-ember/20 bg-ember/5 px-3 py-2 text-micro leading-relaxed text-ember-lo">
                Belum ada model aktif. Tambah gateway dulu, scan modelnya, terus
                nyalain minimal satu.
              </p>
            )}

            <label className="block">
              <span className="text-micro text-muted">AI utama</span>
              <select
                value={primary}
                onChange={(e) => setPrimary(e.target.value)}
                className="mt-1 w-full rounded-lg border border-hairline bg-obsidian px-3 py-2 text-mini text-ink"
              >
                <option value="">Gemini bawaan (jalur lama)</option>
                {active.map((m) => (
                  <option key={m.id} value={m.id}>
                    {modelLabel(m)}
                  </option>
                ))}
              </select>
            </label>

            <div>
              <span className="text-micro text-muted">
                Cadangan kalau yang utama gagal (urut, boleh kosong)
              </span>
              <div className="mt-1.5 flex flex-wrap gap-1.5">
                {active
                  .filter((m) => m.id !== primary)
                  .map((m) => {
                    const picked = fallbacks.includes(m.id);
                    const order = fallbacks.indexOf(m.id) + 1;
                    return (
                      <button
                        key={m.id}
                        type="button"
                        onClick={() =>
                          setFallbacks(
                            picked
                              ? fallbacks.filter((x) => x !== m.id)
                              : [...fallbacks, m.id],
                          )
                        }
                        className={`rounded-full px-2.5 py-1 text-micro ${
                          picked ? "bg-ember text-obsidian" : "border border-hairline text-muted"
                        }`}
                      >
                        {picked && <span className="font-mono">{order}. </span>}
                        {m.label ?? m.model_id}
                      </button>
                    );
                  })}
              </div>
            </div>

            {err && (
              <p className="rounded-lg border border-danger/20 bg-danger/5 px-3 py-2 text-micro leading-relaxed text-danger">
                {err}
              </p>
            )}

            <div className="flex gap-2">
              <button
                onClick={commit}
                disabled={busy}
                className="rounded-full bg-ember px-4 py-1.5 text-micro font-bold text-obsidian disabled:opacity-50"
              >
                {busy ? "Nyimpen..." : "Simpan"}
              </button>
              <button
                onClick={() => {
                  setEditing(false);
                  setErr(null);
                  setPrimary(brain.primary?.modelId ?? "");
                  setFallbacks(brain.fallbacks.map((f) => f.modelId));
                }}
                className="rounded-full border border-hairline px-4 py-1.5 text-micro text-muted"
              >
                Batal
              </button>
            </div>
          </div>
        )}
      </div>
    </section>
  );
}
