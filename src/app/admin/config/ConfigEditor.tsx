"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { setConfig, uploadQrisImage } from "@/app/actions/admin";

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
  clip: "Clip Engine",
  thread: "Thread Engine",
  video: "Video Auto-CC",
  content_strategy: "Strategi 7 Hari (AI Brain)",
};

// Drives three lists at once: the credit-price grid, the kill switches, and the
// order they appear in. A module added here shows up in all of them.
const COST_ORDER = [
  "ide_hari_ini",
  "idea",
  "hook",
  "script",
  "repurpose",
  "vibe",
  "clip",
  "thread",
  "video",
  "content_strategy",
];

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

      {/* ---- dashboard notice ---- */}
      {byKey["dashboard_notice"] && (
        <section>
          <h2 className="eyebrow mb-2 text-muted">Pengumuman dashboard</h2>
          <p className="mb-2 text-micro leading-relaxed text-muted">
            Satu baris yang muncul di atas dashboard semua user. Kosongin terus
            simpan buat nyembunyiin. Berubah tanpa deploy.
          </p>
          <TextRow
            label="Teks pengumuman"
            initial={String(byKey["dashboard_notice"]?.value ?? "")}
            allowEmpty
            busy={busy === "dashboard_notice"}
            saved={ok === "dashboard_notice"}
            onSave={(v) => save("dashboard_notice", v)}
          />
        </section>
      )}

      {/* The old model_free/model_pro controls are deliberately not rendered.
          They are compatibility values for the emergency legacy path, not a
          second AI selector. Exposing them made this page say Gemini while the
          Brain was running DeepSeek. */}
      <section className="rounded-xl border border-hairline px-4 py-3">
        <h2 className="eyebrow mb-2 text-muted">Model per tier</h2>
        <div className="space-y-1.5">
          {(["Free", "Pro"] as const).map((tier) => (
            <div
              key={tier}
              className="flex items-center justify-between gap-3 rounded-lg bg-surface px-3 py-2"
            >
              <span className="text-mini text-ink">{tier}</span>
              <span className="inline-flex items-center gap-1.5 text-micro text-ember-lo font-medium">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="size-3 text-ember">
                  <rect x="4" y="4" width="16" height="16" rx="2" />
                  <rect x="9" y="9" width="6" height="6" />
                  <line x1="9" y1="1" x2="9" y2="4" />
                  <line x1="15" y1="1" x2="15" y2="4" />
                  <line x1="9" y1="20" x2="9" y2="23" />
                  <line x1="15" y1="20" x2="15" y2="23" />
                </svg>
                <span>Mengikuti Otak AI</span>
              </span>
            </div>
          ))}
        </div>
        <p className="mt-2 text-micro leading-relaxed text-muted">
          Semua tier pakai AI yang sama, yaitu yang dipilih di{" "}
          <Link href="/admin/ai" className="text-ember-lo underline-offset-2 hover:underline">
            Otak AI
          </Link>
          .
        </p>
      </section>

      {/* ---- shadow prompt ---- */}
      {byKey["shadow_prompt"] && (
        <section>
          <h2 className="eyebrow mb-2 text-muted">Perintah bayangan</h2>
          <p className="mb-2 text-micro leading-relaxed text-muted">
            Aturan diam-diam yang nempel ke semua generate, di semua modul. User
            gak pernah lihat teksnya — mereka cuma ngerasain hasilnya. Kosongin
            terus simpan buat matiin.
          </p>
          <p className="mb-2 text-micro leading-relaxed text-muted">
            Tulis apa adanya, satu aturan per baris. Contoh:{" "}
            <span className="text-ink">
              jangan pernah pakai frasa &quot;di era digital ini&quot;
            </span>
            ,{" "}
            <span className="text-ink">
              jangan buka tulisan pakai pertanyaan retoris
            </span>
            , <span className="text-ink">hindari emoji</span>.
          </p>
          <TextRow
            label="Isi perintah bayangan"
            initial={String(byKey["shadow_prompt"]?.value ?? "")}
            allowEmpty
            multiline
            busy={busy === "shadow_prompt"}
            saved={ok === "shadow_prompt"}
            onSave={(v) => save("shadow_prompt", v)}
          />
          <p className="mt-2 text-micro leading-relaxed text-muted">
            Makin panjang makin mahal — teksnya ikut kehitung token di tiap
            generate. Beberapa baris udah cukup.
          </p>
        </section>
      )}

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

      {/* ---- video pricing (its own keys, not cost_<module>) ---- */}
      <section>
        <h2 className="eyebrow mb-2 text-muted">Video Auto-CC</h2>
        <div className="grid grid-cols-2 gap-2">
          <NumberRow
            label="Per menit"
            initial={Number(byKey["cost_video_per_min"]?.value ?? 5)}
            busy={busy === "cost_video_per_min"}
            saved={ok === "cost_video_per_min"}
            onSave={(v) => save("cost_video_per_min", v)}
          />
          <NumberRow
            label="Hapus watermark"
            initial={Number(byKey["cost_no_watermark"]?.value ?? 10)}
            busy={busy === "cost_no_watermark"}
            saved={ok === "cost_no_watermark"}
            onSave={(v) => save("cost_no_watermark", v)}
            min={0}
          />
        </div>
      </section>

      {/* ---- payment ---- */}
      <section>
        <h2 className="eyebrow mb-2 text-muted">Pembayaran</h2>
        <p className="mb-2 text-micro leading-relaxed text-muted">
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
              ["qris_image_url", "URL gambar QRIS (atau upload di bawah)"],
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

          <QrisUpload
            current={String(byKey["qris_image_url"]?.value ?? "")}
            onDone={() => router.refresh()}
          />
        </div>
      </section>

      {/* ---- kill switches ---- */}
      <section>
        <h2 className="eyebrow mb-2 text-muted">Saklar modul</h2>
        <p className="mb-2 text-micro leading-relaxed text-muted">
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
  allowEmpty = false,
  multiline = false,
}: {
  label: string;
  hint?: string;
  initial: string;
  onSave: (v: string) => void;
  busy: boolean;
  saved: boolean;
  /** Let an empty value be saved. Off by default so a required field (a model
      id, a bank number) cannot be blanked by accident; on for the notice, whose
      empty state is how you hide it. */
  allowEmpty?: boolean;
  /** Prose that runs to paragraphs (the shadow prompt) instead of one token. */
  multiline?: boolean;
}) {
  const [v, setV] = useState(initial);
  const dirty = v.trim() !== initial;
  const field =
    "min-w-0 rounded-lg border border-hairline bg-obsidian px-3 py-2 text-xs text-ink focus:border-ember focus:outline-none";

  return (
    <div className="rounded-xl border border-hairline bg-surface p-3">
      <div className="flex items-center justify-between">
        <label className="text-sm font-semibold text-ink">{label}</label>
        {saved && <span className="text-micro text-success">Tersimpan</span>}
      </div>
      {hint && <p className="mt-0.5 text-micro text-muted">{hint}</p>}
      <div className={`mt-2 flex gap-2 ${multiline ? "flex-col items-end" : ""}`}>
        {multiline ? (
          <textarea
            value={v}
            onChange={(e) => setV(e.target.value)}
            rows={6}
            aria-label={label}
            className={`${field} w-full resize-y leading-relaxed`}
          />
        ) : (
          <input
            value={v}
            onChange={(e) => setV(e.target.value)}
            className={`${field} flex-1 font-mono`}
          />
        )}
        <button
          onClick={() => onSave(v.trim())}
          disabled={!dirty || busy || (!allowEmpty && !v.trim())}
          className="shrink-0 cursor-pointer rounded-lg bg-ember px-3 py-2 text-xs font-bold text-obsidian disabled:cursor-not-allowed disabled:opacity-40"
        >
          {busy ? "..." : "Simpan"}
        </button>
      </div>
    </div>
  );
}

function NumberRow({
  label,
  initial,
  onSave,
  busy,
  saved,
  min = 1,
  ariaLabel,
}: {
  label: string;
  initial: number;
  onSave: (v: number) => void;
  busy: boolean;
  saved: boolean;
  /** Credit prices start at 1 — a free module would be a bug. Token cost is
      rupiah and 0 is a real answer: "belum diisi". */
  min?: number;
  ariaLabel?: string;
}) {
  const [v, setV] = useState(String(initial));
  const n = Number(v);
  // `Number("") === 0`, so a cleared field looked like a deliberate zero. On the
  // credit prices that was harmless — their min of 1 rejected it — but the token
  // cost rows pass min 0, where 0 is the value that means "belum diisi" and
  // switches the profit dashboard's cost line back off. Clearing the box would
  // have armed the OK button on a visually blank field and saved that.
  const dirty = v.trim() !== "" && Number.isInteger(n) && n >= min && n !== initial;

  return (
    <div className="rounded-xl border border-hairline bg-surface p-3">
      <div className="flex items-center justify-between gap-1">
        <label className="truncate text-mini font-semibold text-ink">{label}</label>
        {saved && <span className="text-micro text-success">✓</span>}
      </div>
      <div className="mt-2 flex gap-1.5">
        <input
          type="number"
          min={min}
          inputMode="numeric"
          value={v}
          onChange={(e) => setV(e.target.value)}
          aria-label={ariaLabel ?? `Harga kredit ${label}`}
          className="w-full min-w-0 rounded-lg border border-hairline bg-obsidian px-2.5 py-2 font-mono text-xs text-ink focus:border-ember focus:outline-none"
        />
        <button
          onClick={() => onSave(n)}
          disabled={!dirty || busy}
          className="shrink-0 cursor-pointer rounded-lg bg-ember px-2.5 py-2 text-micro font-bold text-obsidian disabled:cursor-not-allowed disabled:opacity-40"
        >
          {busy ? "..." : "OK"}
        </button>
      </div>
    </div>
  );
}

/**
 * Direct upload for the QRIS code.
 *
 * The URL field alone was a dead end: it assumed the owner could already host
 * an image somewhere, which is exactly the thing a non-coder cannot do. This
 * takes the file, puts it in the public bucket, and writes the resulting URL
 * into `qris_image_url` in one step.
 */
function QrisUpload({ current, onDone }: { current: string; onDone: () => void }) {
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [ok, setOk] = useState(false);

  const pick = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = ""; // let the same file be re-picked after a failure
    if (!file) return;

    setBusy(true);
    setErr("");
    setOk(false);
    try {
      const fd = new FormData();
      fd.append("file", file);
      await uploadQrisImage(fd);
      setOk(true);
      onDone();
      setTimeout(() => setOk(false), 2500);
    } catch (e: unknown) {
      setErr(e instanceof Error ? e.message : "Gagal upload.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="rounded-xl border border-hairline bg-surface p-3">
      <div className="flex items-center justify-between">
        <label className="text-sm font-semibold text-ink">Upload QRIS</label>
        {ok && <span className="text-micro text-success">Keunggah</span>}
      </div>
      <p className="mt-0.5 text-micro leading-relaxed text-muted">
        Pilih gambar QRIS-nya langsung — gak perlu bikin link dulu. PNG atau JPG,
        maksimal 2MB.
      </p>

      {current && (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={current}
          alt="QRIS sekarang"
          className="mt-2 max-h-40 w-auto rounded-lg bg-white p-2"
        />
      )}

      <label
        className={`mt-2 flex cursor-pointer items-center justify-center rounded-lg border border-dashed px-3 py-3 text-xs font-bold transition-colors duration-[var(--duration-standard)] ease-heat ${
          busy
            ? "border-hairline text-muted"
            : "border-ember/40 text-ember-lo hover:border-ember hover:bg-ember/5"
        }`}
      >
        <input
          type="file"
          accept="image/png,image/jpeg,image/webp"
          onChange={pick}
          disabled={busy}
          className="hidden"
        />
        {busy ? "Lagi ngunggah..." : current ? "Ganti gambar QRIS" : "Pilih gambar QRIS"}
      </label>

      {err && (
        <p className="mt-2 rounded-lg border border-danger/20 bg-danger/10 px-3 py-2 text-micro text-danger">
          {err}
        </p>
      )}
    </div>
  );
}
