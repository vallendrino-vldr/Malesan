"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { setConfig } from "@/app/actions/admin";

export type ConfigRow = {
  key: string;
  value: unknown;
  description: string | null;
  updated_at: string;
};

const MODULE_LABEL: Record<string, string> = {
  ide_hari_ini: "Ide Hari Ini",
  idea: "Idea Engine",
  hook: "Hook Lab",
  script: "Script Builder",
  repurpose: "Repurpose",
  vibe: "Vibe Coding Kit",
};

const COST_ORDER = ["ide_hari_ini", "idea", "hook", "script", "repurpose", "vibe"];

export function ConfigEditor({ rows }: { rows: ConfigRow[] }) {
  const router = useRouter();
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");
  const [ok, setOk] = useState("");

  const byKey = Object.fromEntries(rows.map((r) => [r.key, r]));
  const modules = (byKey["enabled_modules"]?.value ?? {}) as Record<string, boolean>;

  const save = async (key: string, value: unknown) => {
    setBusy(key);
    setError("");
    setOk("");
    try {
      await setConfig(key, value);
      setOk(key);
      router.refresh();
      setTimeout(() => setOk(""), 1800);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Gagal nyimpen.");
    } finally {
      setBusy("");
    }
  };

  return (
    <div className="space-y-5">
      {error && (
        <p className="rounded-lg border border-danger/20 bg-danger/10 px-3 py-2 text-xs text-danger">
          {error}
        </p>
      )}

      {/* ---- models ---- */}
      <section>
        <h2 className="eyebrow mb-2 text-muted">Model per tier</h2>
        <div className="space-y-2">
          {(["model_free", "model_pro"] as const).map((k) => (
            <TextRow
              key={k}
              label={k === "model_free" ? "Free" : "Pro"}
              hint={byKey[k]?.description ?? undefined}
              initial={String(byKey[k]?.value ?? "")}
              busy={busy === k}
              saved={ok === k}
              onSave={(v) => save(k, v)}
            />
          ))}
        </div>
        <p className="mt-2 text-[11px] leading-relaxed text-muted">
          Salah nulis id model bikin Gemini balikin 404 dan semua generate gagal.
          Cek dulu id-nya bener sebelum simpan.
        </p>
      </section>

      {/* ---- costs ---- */}
      <section>
        <h2 className="eyebrow mb-2 text-muted">Harga kredit per modul</h2>
        <div className="grid grid-cols-2 gap-2">
          {COST_ORDER.map((m) => {
            const k = `cost_${m}`;
            if (!byKey[k]) return null;
            return (
              <NumberRow
                key={k}
                label={MODULE_LABEL[m] ?? m}
                initial={Number(byKey[k]?.value ?? 1)}
                busy={busy === k}
                saved={ok === k}
                onSave={(v) => save(k, v)}
              />
            );
          })}
        </div>
      </section>

      {/* ---- provider ---- */}
      <section>
        <h2 className="eyebrow mb-2 text-muted">Provider AI</h2>
        <p className="mb-2 text-[11px] leading-relaxed text-muted">
          Mau ganti otaknya ke vendor lain? Ganti di sini. Kalau API key
          dikosongin, sistem balik pakai rotasi key Gemini dari env — jadi form
          setengah jadi gak bikin generate mati.
        </p>
        <div className="space-y-2">
          <div className="rounded-xl border border-hairline bg-surface p-3">
            <label className="text-sm font-semibold text-ink">Vendor</label>
            <div className="mt-2 flex flex-wrap gap-2">
              {(["gemini", "openai", "anthropic", "custom"] as const).map((p) => {
                const on = String(byKey["ai_provider"]?.value ?? "gemini") === p;
                return (
                  <button
                    key={p}
                    onClick={() => save("ai_provider", p)}
                    disabled={busy === "ai_provider"}
                    className={`cursor-pointer rounded-full border px-3.5 py-2 text-xs font-semibold capitalize transition-colors duration-[var(--duration-standard)] ease-heat disabled:opacity-50 ${
                      on
                        ? "border-ember/45 bg-ember/10 text-ember"
                        : "border-hairline text-muted hover:text-ink"
                    }`}
                  >
                    {p}
                  </button>
                );
              })}
            </div>
          </div>

          <TextRow
            label="Base URL"
            hint="Kosongin kalau pakai endpoint default vendornya."
            initial={String(byKey["ai_base_url"]?.value ?? "")}
            busy={busy === "ai_base_url"}
            saved={ok === "ai_base_url"}
            onSave={(v) => save("ai_base_url", v)}
          />

          <SecretRow
            label="API key"
            hasValue={!!String(byKey["ai_api_key"]?.value ?? "")}
            busy={busy === "ai_api_key"}
            saved={ok === "ai_api_key"}
            onSave={(v) => save("ai_api_key", v)}
          />
        </div>
      </section>

      {/* ---- payment ---- */}
      <section>
        <h2 className="eyebrow mb-2 text-muted">Pembayaran</h2>
        <p className="mb-2 text-[11px] leading-relaxed text-muted">
          Yang lo ubah di sini langsung kelihatan di halaman top up user.
        </p>

        <div className="mb-2 overflow-hidden rounded-xl border border-hairline bg-surface">
          {(["bank", "qris"] as const).map((m) => {
            const cur = (byKey["payment_methods"]?.value ?? {}) as Record<string, boolean>;
            const on = m === "bank" ? cur.bank !== false : cur.qris === true;
            return (
              <div
                key={m}
                className="flex items-center justify-between border-b border-hairline px-3.5 py-3 last:border-b-0"
              >
                <span className="text-sm uppercase text-ink">{m}</span>
                <button
                  onClick={() => save("payment_methods", { ...cur, [m]: !on })}
                  disabled={busy === "payment_methods"}
                  role="switch"
                  aria-checked={on}
                  aria-label={`${m} ${on ? "nyala" : "mati"}`}
                  className={`relative h-6 w-11 shrink-0 cursor-pointer rounded-full transition-colors duration-[var(--duration-standard)] ease-heat disabled:opacity-50 ${
                    on ? "bg-ember" : "bg-surface-raised"
                  }`}
                >
                  <span
                    className={`absolute top-0.5 size-5 rounded-full bg-obsidian transition-[left] duration-[var(--duration-standard)] ease-heat ${
                      on ? "left-[22px]" : "left-0.5"
                    }`}
                  />
                </button>
              </div>
            );
          })}
        </div>

        <div className="space-y-2">
          {(
            [
              ["bank_name", "Nama bank"],
              ["bank_account_number", "Nomor rekening"],
              ["bank_account_holder", "Atas nama"],
              ["qris_image_url", "URL gambar QRIS"],
              ["payment_note", "Catatan tambahan"],
            ] as const
          ).map(([k, label]) => (
            <TextRow
              key={k}
              label={label}
              initial={String(byKey[k]?.value ?? "")}
              busy={busy === k}
              saved={ok === k}
              onSave={(v) => save(k, v)}
            />
          ))}
        </div>
      </section>

      {/* ---- kill switches ---- */}
      <section>
        <h2 className="eyebrow mb-2 text-muted">Saklar modul</h2>
        <p className="mb-2 text-[11px] leading-relaxed text-muted">
          Matiin modul yang lagi rusak tanpa deploy. User dapet pesan sopan,
          bukan error mentah, dan kreditnya gak kepotong.
        </p>
        <div className="overflow-hidden rounded-xl border border-hairline bg-surface">
          {COST_ORDER.map((m) => {
            const on = modules[m] !== false;
            return (
              <div
                key={m}
                className="flex items-center justify-between border-b border-hairline px-3.5 py-3 last:border-b-0"
              >
                <span className="text-sm text-ink">{MODULE_LABEL[m] ?? m}</span>
                <button
                  onClick={() =>
                    save("enabled_modules", { ...modules, [m]: !on })
                  }
                  disabled={busy === "enabled_modules"}
                  role="switch"
                  aria-checked={on}
                  aria-label={`${MODULE_LABEL[m] ?? m} ${on ? "nyala" : "mati"}`}
                  className={`relative h-6 w-11 shrink-0 cursor-pointer rounded-full transition-colors duration-[var(--duration-standard)] ease-heat disabled:opacity-50 ${
                    on ? "bg-ember" : "bg-surface-raised"
                  }`}
                >
                  <span
                    className={`absolute top-0.5 size-5 rounded-full bg-obsidian transition-[left] duration-[var(--duration-standard)] ease-heat ${
                      on ? "left-[22px]" : "left-0.5"
                    }`}
                  />
                </button>
              </div>
            );
          })}
        </div>
      </section>
    </div>
  );
}

function TextRow({
  label,
  hint,
  initial,
  onSave,
  busy,
  saved,
}: {
  label: string;
  hint?: string;
  initial: string;
  onSave: (v: string) => void;
  busy: boolean;
  saved: boolean;
}) {
  const [v, setV] = useState(initial);
  const dirty = v.trim() !== initial;

  return (
    <div className="rounded-xl border border-hairline bg-surface p-3">
      <div className="flex items-center justify-between">
        <label className="text-sm font-semibold text-ink">{label}</label>
        {saved && <span className="text-[11px] text-success">Tersimpan</span>}
      </div>
      {hint && <p className="mt-0.5 text-[11px] text-muted">{hint}</p>}
      <div className="mt-2 flex gap-2">
        <input
          value={v}
          onChange={(e) => setV(e.target.value)}
          className="min-w-0 flex-1 rounded-lg border border-hairline bg-obsidian px-3 py-2 font-mono text-xs text-ink focus:border-ember focus:outline-none"
        />
        <button
          onClick={() => onSave(v.trim())}
          disabled={!dirty || busy || !v.trim()}
          className="shrink-0 cursor-pointer rounded-lg bg-ember px-3 py-2 text-xs font-bold text-obsidian disabled:cursor-not-allowed disabled:opacity-40"
        >
          {busy ? "..." : "Simpan"}
        </button>
      </div>
    </div>
  );
}

/**
 * Write-only field for secrets. The stored value is never rendered — the row
 * only reports whether one exists. A key that can be read back out of the DOM
 * is a key that leaks through a screenshot or a shared screen.
 */
function SecretRow({
  label,
  hasValue,
  onSave,
  busy,
  saved,
}: {
  label: string;
  hasValue: boolean;
  onSave: (v: string) => void;
  busy: boolean;
  saved: boolean;
}) {
  const [v, setV] = useState("");

  return (
    <div className="rounded-xl border border-hairline bg-surface p-3">
      <div className="flex items-center justify-between">
        <label className="text-sm font-semibold text-ink">{label}</label>
        {saved ? (
          <span className="text-[11px] text-success">Tersimpan</span>
        ) : (
          <span className="text-[11px] text-muted">
            {hasValue ? "Udah keisi · ●●●●●●" : "Belum diisi"}
          </span>
        )}
      </div>
      <div className="mt-2 flex gap-2">
        <input
          type="password"
          value={v}
          onChange={(e) => setV(e.target.value)}
          placeholder={hasValue ? "Ketik key baru buat ganti" : "Tempel API key"}
          autoComplete="off"
          className="min-w-0 flex-1 rounded-lg border border-hairline bg-obsidian px-3 py-2 font-mono text-xs text-ink placeholder:text-muted focus:border-ember focus:outline-none"
        />
        <button
          onClick={() => {
            onSave(v.trim());
            setV("");
          }}
          disabled={busy || !v.trim()}
          className="shrink-0 cursor-pointer rounded-lg bg-ember px-3 py-2 text-xs font-bold text-obsidian disabled:cursor-not-allowed disabled:opacity-40"
        >
          {busy ? "..." : "Simpan"}
        </button>
      </div>
      {hasValue && (
        <button
          onClick={() => onSave("")}
          disabled={busy}
          className="mt-2 cursor-pointer text-[11px] text-muted underline-offset-2 hover:text-danger hover:underline"
        >
          Hapus key (balik ke rotasi Gemini dari env)
        </button>
      )}
    </div>
  );
}

function NumberRow({
  label,
  initial,
  onSave,
  busy,
  saved,
}: {
  label: string;
  initial: number;
  onSave: (v: number) => void;
  busy: boolean;
  saved: boolean;
}) {
  const [v, setV] = useState(String(initial));
  const n = Number(v);
  const dirty = Number.isInteger(n) && n > 0 && n !== initial;

  return (
    <div className="rounded-xl border border-hairline bg-surface p-3">
      <div className="flex items-center justify-between gap-1">
        <label className="truncate text-[11.5px] font-semibold text-ink">{label}</label>
        {saved && <span className="text-[10px] text-success">✓</span>}
      </div>
      <div className="mt-2 flex gap-1.5">
        <input
          type="number"
          min={1}
          inputMode="numeric"
          value={v}
          onChange={(e) => setV(e.target.value)}
          aria-label={`Harga kredit ${label}`}
          className="w-full min-w-0 rounded-lg border border-hairline bg-obsidian px-2.5 py-2 font-mono text-xs text-ink focus:border-ember focus:outline-none"
        />
        <button
          onClick={() => onSave(n)}
          disabled={!dirty || busy}
          className="shrink-0 cursor-pointer rounded-lg bg-ember px-2.5 py-2 text-[11px] font-bold text-obsidian disabled:cursor-not-allowed disabled:opacity-40"
        >
          {busy ? "..." : "OK"}
        </button>
      </div>
    </div>
  );
}
