"use client";

import { useState, useTransition } from "react";
import {
  saveProvider,
  setProviderActive,
  deleteProvider,
  testProviderConnection,
  scanProviderModels,
  refreshBalance,
  type ProviderInput,
} from "@/app/actions/ai-admin";
import type { ProviderView, Protocol } from "@/lib/ai/types";

/**
 * Provider fleet management.
 *
 * The screen is built around one idea: nothing here is trusted until it has been
 * proven. A provider you have just added is a claim — a URL and a secret someone
 * typed. "Tes koneksi" turns it into a fact, and until then the card says so.
 * That is why Test and Scan sit on the card itself rather than behind an edit
 * form: the loop is add → test → scan → enable a model, and every step should be
 * one tap from the thing it describes.
 *
 * The API key is write-only in this UI. It is never sent to the browser, so the
 * field is always empty when editing and an empty field means "leave it alone" —
 * otherwise opening the form and saving would wipe a working key.
 */

/**
 * OpenAI-compatible is first and is the default, because it is the answer for
 * almost every gateway worth adding: SumoPod, Ipeenk, OpenRouter, Groq,
 * Together, DeepSeek and any self-hosted proxy all speak that one shape. There
 * is no per-vendor code anywhere in this system and there should never be — a
 * new gateway is a Base URL, a key and a model id.
 *
 * The other two exist because they are genuinely different wire protocols, not
 * because they are different brands.
 */
const PROTOCOLS: { value: Protocol; label: string; hint: string }[] = [
  {
    value: "openai",
    label: "OpenAI-compatible (paling umum)",
    hint: "SumoPod, Ipeenk, OpenRouter, Groq, DeepSeek, gateway sendiri",
  },
  { value: "gemini", label: "Gemini", hint: "Google Generative Language API langsung" },
  { value: "anthropic", label: "Anthropic", hint: "Claude API langsung" },
];

const EMPTY: ProviderInput = {
  slug: "",
  label: "",
  protocol: "openai",
  baseUrl: "",
  apiKey: "",
  balanceUrl: "",
  balancePath: "",
  balanceCurrency: "USD",
  priority: 100,
  isActive: false,
  notes: "",
};

function timeAgo(iso: string | null): string {
  if (!iso) return "belum pernah";
  const mins = Math.floor((Date.now() - new Date(iso).getTime()) / 60000);
  if (mins < 1) return "barusan";
  if (mins < 60) return `${mins} menit lalu`;
  const h = Math.floor(mins / 60);
  if (h < 24) return `${h} jam lalu`;
  return `${Math.floor(h / 24)} hari lalu`;
}

export function ProviderManager({ providers }: { providers: ProviderView[] }) {
  const [form, setForm] = useState<ProviderInput | null>(null);
  const [busy, startTransition] = useTransition();
  const [note, setNote] = useState<{ id: string; text: string; ok: boolean } | null>(null);

  const run = async (id: string, fn: () => Promise<string>) => {
    setNote({ id, text: "Bentar...", ok: true });
    try {
      setNote({ id, text: await fn(), ok: true });
    } catch (e) {
      setNote({ id, text: e instanceof Error ? e.message : "Gagal.", ok: false });
    }
  };

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!form) return;
    startTransition(async () => {
      try {
        await saveProvider(form);
        setForm(null);
        setNote({ id: "form", text: "Kesimpen.", ok: true });
      } catch (err) {
        setNote({
          id: "form",
          text: err instanceof Error ? err.message : "Gagal nyimpen.",
          ok: false,
        });
      }
    });
  };

  return (
    <div className="space-y-5">
      <header className="flex items-start justify-between gap-3">
        <div>
          <h1 className="font-display text-xl font-bold text-ink">Gateway AI</h1>
          <p className="mt-1 text-sm leading-relaxed text-muted">
            Tambah gateway baru tanpa deploy dan tanpa ngoding. Hampir semua
            layanan (SumoPod, Ipeenk, OpenRouter, Groq) cuma butuh tiga hal:
            Base URL, API key, terus tekan Scan model.
          </p>
        </div>
        <button
          onClick={() => setForm(form ? null : { ...EMPTY })}
          className="shrink-0 rounded-full bg-ember px-4 py-2 text-mini font-bold text-obsidian"
        >
          {form ? "Tutup" : "+ Gateway"}
        </button>
      </header>

      {form && (
        <form onSubmit={submit} className="surface-card space-y-3 rounded-xl p-4">
          <p className="eyebrow text-ember-lo">
            {form.id ? "Edit gateway" : "Gateway baru"}
          </p>

          <div className="grid gap-3 sm:grid-cols-2">
            <label className="block">
              <span className="text-micro text-muted">Nama</span>
              <input
                required
                value={form.label}
                onChange={(e) => setForm({ ...form, label: e.target.value })}
                placeholder="SumoPod"
                className="mt-1 w-full rounded-lg border border-hairline bg-obsidian px-3 py-2 text-mini text-ink"
              />
            </label>
            <label className="block">
              <span className="text-micro text-muted">Slug (dipakai di log)</span>
              <input
                required
                value={form.slug}
                onChange={(e) => setForm({ ...form, slug: e.target.value })}
                placeholder="sumopod"
                className="mt-1 w-full rounded-lg border border-hairline bg-obsidian px-3 py-2 font-mono text-mini text-ink"
              />
            </label>
          </div>

          <label className="block">
            <span className="text-micro text-muted">Protokol</span>
            <select
              value={form.protocol}
              onChange={(e) => setForm({ ...form, protocol: e.target.value as Protocol })}
              className="mt-1 w-full rounded-lg border border-hairline bg-obsidian px-3 py-2 text-mini text-ink"
            >
              {PROTOCOLS.map((p) => (
                <option key={p.value} value={p.value}>
                  {p.label} — {p.hint}
                </option>
              ))}
            </select>
          </label>

          <label className="block">
            <span className="text-micro text-muted">Base URL</span>
            <input
              value={form.baseUrl ?? ""}
              onChange={(e) => setForm({ ...form, baseUrl: e.target.value })}
              placeholder="https://ai.sumopod.com/v1"
              className="mt-1 w-full rounded-lg border border-hairline bg-obsidian px-3 py-2 font-mono text-mini text-ink"
            />
          </label>

          <label className="block">
            <span className="text-micro text-muted">
              API key {form.id && "(kosongin kalau gak mau diganti)"}
            </span>
            <input
              type="password"
              autoComplete="off"
              value={form.apiKey ?? ""}
              onChange={(e) => setForm({ ...form, apiKey: e.target.value })}
              placeholder={form.id ? "••••••••" : "sk-..."}
              className="mt-1 w-full rounded-lg border border-hairline bg-obsidian px-3 py-2 font-mono text-mini text-ink"
            />
            <span className="mt-1 block text-micro text-muted">
              Disimpen terenkripsi. Gak pernah dikirim balik ke browser.
            </span>
          </label>

          <details className="rounded-lg border border-hairline px-3 py-2">
            <summary className="cursor-pointer text-micro text-muted">
              Saldo & prioritas (opsional)
            </summary>
            <div className="mt-3 grid gap-3 sm:grid-cols-2">
              <label className="block">
                <span className="text-micro text-muted">URL saldo</span>
                <input
                  value={form.balanceUrl ?? ""}
                  onChange={(e) => setForm({ ...form, balanceUrl: e.target.value })}
                  placeholder="https://ai.sumopod.com/balance"
                  className="mt-1 w-full rounded-lg border border-hairline bg-obsidian px-3 py-2 font-mono text-micro text-ink"
                />
              </label>
              <label className="block">
                <span className="text-micro text-muted">Path angkanya (mis. data.balance)</span>
                <input
                  value={form.balancePath ?? ""}
                  onChange={(e) => setForm({ ...form, balancePath: e.target.value })}
                  placeholder="balance"
                  className="mt-1 w-full rounded-lg border border-hairline bg-obsidian px-3 py-2 font-mono text-micro text-ink"
                />
              </label>
              <label className="block">
                <span className="text-micro text-muted">Batas saldo rendah</span>
                <input
                  type="number"
                  step="any"
                  value={form.lowBalanceThreshold ?? ""}
                  onChange={(e) =>
                    setForm({
                      ...form,
                      lowBalanceThreshold: e.target.value ? Number(e.target.value) : null,
                    })
                  }
                  className="mt-1 w-full rounded-lg border border-hairline bg-obsidian px-3 py-2 text-micro text-ink"
                />
              </label>
              <label className="block">
                <span className="text-micro text-muted">Prioritas (kecil = didahulukan)</span>
                <input
                  type="number"
                  value={form.priority ?? 100}
                  onChange={(e) => setForm({ ...form, priority: Number(e.target.value) })}
                  className="mt-1 w-full rounded-lg border border-hairline bg-obsidian px-3 py-2 text-micro text-ink"
                />
              </label>
            </div>
          </details>

          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={form.isActive ?? false}
              onChange={(e) => setForm({ ...form, isActive: e.target.checked })}
            />
            <span className="text-mini text-ink">Aktifin sekarang</span>
          </label>

          {note?.id === "form" && (
            <p className={`text-micro ${note.ok ? "text-ember-lo" : "text-danger"}`}>{note.text}</p>
          )}

          <div className="flex gap-2">
            <button
              type="submit"
              disabled={busy}
              className="rounded-full bg-ember px-4 py-2 text-mini font-bold text-obsidian disabled:opacity-50"
            >
              {busy ? "Nyimpen..." : "Simpan"}
            </button>
            <button
              type="button"
              onClick={() => setForm(null)}
              className="rounded-full border border-hairline px-4 py-2 text-mini text-muted"
            >
              Batal
            </button>
          </div>
        </form>
      )}

      <div className="space-y-2.5">
        {providers.length === 0 && (
          <div className="rounded-xl border border-dashed border-hairline px-4 py-10 text-center">
            <p className="text-sm text-muted">Belum ada gateway. Tambah satu di atas.</p>
          </div>
        )}

        {providers.map((p) => (
          <div key={p.id} className="surface-card rounded-xl p-4">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="font-display text-[0.9375rem] font-bold text-ink">
                  {p.label}{" "}
                  <span className="font-mono text-micro font-normal text-muted">{p.slug}</span>
                </p>
                <p className="mt-0.5 flex flex-wrap gap-x-2 text-micro text-muted">
                  <span>{p.protocol}</span>
                  {p.key_source === "env_gemini_pool" ? (
                    <span className="text-ember-lo">key dari env (pool)</span>
                  ) : (
                    <span>key {p.key_mask ?? "belum diisi"}</span>
                  )}
                  <span>
                    {p.active_model_count}/{p.model_count} model aktif
                  </span>
                  <span>dicek {timeAgo(p.last_checked_at)}</span>
                </p>
              </div>
              <span
                className={`shrink-0 rounded-full px-2.5 py-1 font-mono text-micro ${
                  p.is_active
                    ? "bg-ember/10 text-ember-lo"
                    : "bg-surface text-muted"
                }`}
              >
                {p.is_active ? "aktif" : "mati"}
              </span>
            </div>

            {p.consecutive_failures > 0 && (
              <p className="mt-2 rounded-lg border border-danger/20 bg-danger/5 px-3 py-2 text-micro text-danger">
                Gagal {p.consecutive_failures}× berturut-turut.
                {p.consecutive_failures >= 3 && " Provider ini lagi dilewatin sama router."}
                {p.last_error && <span className="mt-1 block opacity-80">{p.last_error}</span>}
              </p>
            )}

            {note?.id === p.id && (
              <p
                className={`mt-2 rounded-lg px-3 py-2 text-micro ${
                  note.ok
                    ? "border border-ember/20 bg-ember/5 text-ember-lo"
                    : "border border-danger/20 bg-danger/5 text-danger"
                }`}
              >
                {note.text}
              </p>
            )}

            <div className="mt-3 flex flex-wrap gap-1.5">
              <button
                onClick={() =>
                  run(p.id, async () => (await testProviderConnection(p.id)).message)
                }
                className="rounded-full border border-hairline px-3 py-1.5 text-micro text-ink hover:bg-surface"
              >
                Tes koneksi
              </button>
              <button
                onClick={() =>
                  run(p.id, async () => {
                    const r = await scanProviderModels(p.id);
                    return `${r.found} model ketemu — ${r.added} baru, ${r.updated} diperbarui. Aktifin di menu Model.`;
                  })
                }
                className="rounded-full border border-hairline px-3 py-1.5 text-micro text-ink hover:bg-surface"
              >
                Scan model
              </button>
              {p.balance_url && (
                <button
                  onClick={() =>
                    run(p.id, async () => {
                      const b = await refreshBalance(p.id);
                      if (b.amount === null) return "Saldonya gak kebaca — cek URL/path-nya.";
                      const left =
                        b.daysLeft !== null ? ` (~${Math.floor(b.daysLeft)} hari lagi)` : "";
                      return `Saldo: ${b.amount} ${b.currency}${left}${b.low ? " — UDAH TIPIS" : ""}`;
                    })
                  }
                  className="rounded-full border border-hairline px-3 py-1.5 text-micro text-ink hover:bg-surface"
                >
                  Cek saldo
                </button>
              )}
              <button
                onClick={() =>
                  startTransition(async () => {
                    await setProviderActive(p.id, !p.is_active);
                  })
                }
                className="rounded-full border border-hairline px-3 py-1.5 text-micro text-ink hover:bg-surface"
              >
                {p.is_active ? "Matiin" : "Aktifin"}
              </button>
              <button
                onClick={() =>
                  setForm({
                    id: p.id,
                    slug: p.slug,
                    label: p.label,
                    protocol: p.protocol,
                    baseUrl: p.base_url ?? "",
                    apiKey: "",
                    balanceUrl: p.balance_url ?? "",
                    balancePath: p.balance_path ?? "",
                    balanceCurrency: p.balance_currency,
                    lowBalanceThreshold: p.low_balance_threshold,
                    priority: p.priority,
                    isActive: p.is_active,
                    notes: p.notes ?? "",
                  })
                }
                className="rounded-full border border-hairline px-3 py-1.5 text-micro text-ink hover:bg-surface"
              >
                Edit
              </button>
              {p.key_source !== "env_gemini_pool" && (
                <button
                  onClick={() => {
                    if (!confirm(`Hapus gateway "${p.label}"? Semua modelnya ikut kehapus.`)) return;
                    startTransition(async () => {
                      try {
                        await deleteProvider(p.id);
                      } catch (e) {
                        setNote({
                          id: p.id,
                          text: e instanceof Error ? e.message : "Gagal hapus.",
                          ok: false,
                        });
                      }
                    });
                  }}
                  className="rounded-full border border-danger/30 px-3 py-1.5 text-micro text-danger hover:bg-danger/5"
                >
                  Hapus
                </button>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
