"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createVoucher } from "@/app/actions/admin";

/**
 * Vouchers.
 *
 * The previous version submitted through an inline server action that checked
 * `if (code && credits && daysValid)` and otherwise did nothing at all — a
 * duplicate code or a bad number produced no row and no message, so the operator
 * could not tell a rejection from a slow page. It also used `divide-zinc-900`
 * and `text-white`, neither of which exists in DESIGN.md, and a four-column
 * table inside `overflow-x-auto` that pushed the expiry date off a phone screen.
 *
 * Cards on phones, table from `md` up, and every failure says what happened.
 */

export type Voucher = {
  code: string;
  credits: number;
  is_redeemed: boolean;
  expires_at: string | null;
  created_at: string;
};

/** Expired-but-unredeemed is a third state the old page rendered as "Active". */
function statusOf(v: Voucher) {
  if (v.is_redeemed) return { label: "Kepakai", cls: "bg-surface-raised text-muted" };
  if (v.expires_at && new Date(v.expires_at) < new Date())
    return { label: "Kedaluwarsa", cls: "bg-danger/10 text-danger" };
  return { label: "Aktif", cls: "bg-success/10 text-success" };
}

const fmt = (s: string | null) =>
  s ? new Date(s).toLocaleDateString("id-ID", { day: "numeric", month: "short", year: "numeric" }) : "—";

export function VoucherManager({ vouchers }: { vouchers: Voucher[] }) {
  const router = useRouter();
  const [code, setCode] = useState("");
  const [credits, setCredits] = useState("50");
  const [days, setDays] = useState("7");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [ok, setOk] = useState("");
  const [copied, setCopied] = useState("");

  const submit = async () => {
    const c = code.trim().toUpperCase();
    const n = Number(credits);
    const d = Number(days);

    // Validate here and say which field is wrong. The old version silently did
    // nothing, which reads as a broken button.
    if (c.length < 3) return setError("Kode minimal 3 huruf.");
    if (!/^[A-Z0-9]+$/.test(c)) return setError("Kode cuma boleh huruf dan angka, tanpa spasi.");
    if (!Number.isInteger(n) || n < 1) return setError("Jumlah kredit harus angka di atas 0.");
    if (!Number.isInteger(d) || d < 1) return setError("Masa berlaku harus minimal 1 hari.");
    if (vouchers.some((v) => v.code === c)) return setError(`Kode "${c}" udah ada.`);

    setBusy(true);
    setError("");
    setOk("");
    try {
      await createVoucher(c, n, d);
      setOk(`Voucher ${c} jadi — ${n} kredit, berlaku ${d} hari.`);
      setCode("");
      router.refresh();
      setTimeout(() => setOk(""), 4000);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Gagal bikin voucher.");
    } finally {
      setBusy(false);
    }
  };

  const copy = async (c: string) => {
    try {
      await navigator.clipboard.writeText(c);
      setCopied(c);
      setTimeout(() => setCopied(""), 1500);
    } catch {
      /* clipboard blocked — the code is visible on screen anyway */
    }
  };

  const input =
    "w-full skeu-inset rounded-lg border border-hairline bg-obsidian px-3 py-2.5 text-sm text-ink placeholder:text-muted focus:border-ember focus:outline-none";

  return (
    <div className="space-y-5">
      <section className="surface-card rounded-2xl p-4">
        <h2 className="font-display text-[0.9375rem] font-bold text-ink">Bikin voucher baru</h2>
        <p className="mt-1 text-micro leading-relaxed text-muted">
          Kode yang lo kasih ke user buat nambah kredit. Sekali kepakai, mati.
        </p>

        <div className="mt-3 space-y-2">
          <div>
            <label className="text-micro font-semibold text-muted">Kode</label>
            <input
              value={code}
              onChange={(e) => setCode(e.target.value.toUpperCase())}
              placeholder="MALESAN50"
              className={`${input} mt-1 font-mono uppercase`}
            />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="text-micro font-semibold text-muted">Kredit</label>
              <input
                type="number"
                min={1}
                inputMode="numeric"
                value={credits}
                onChange={(e) => setCredits(e.target.value)}
                className={`${input} mt-1 font-mono`}
              />
            </div>
            <div>
              <label className="text-micro font-semibold text-muted">Berlaku (hari)</label>
              <input
                type="number"
                min={1}
                inputMode="numeric"
                value={days}
                onChange={(e) => setDays(e.target.value)}
                className={`${input} mt-1 font-mono`}
              />
            </div>
          </div>
        </div>

        {error && (
          <p className="mt-3 rounded-lg border border-danger/20 bg-danger/10 px-3 py-2 text-xs text-danger">
            {error}
          </p>
        )}
        {ok && (
          <p className="mt-3 rounded-lg border border-success/20 bg-success/10 px-3 py-2 text-xs text-success">
            {ok}
          </p>
        )}

        <button
          onClick={submit}
          disabled={busy}
          className="mt-3 w-full cursor-pointer rounded-lg bg-ember px-4 py-3 font-display text-sm font-bold text-obsidian transition-colors duration-[var(--duration-standard)] ease-heat hover:bg-ember-lo disabled:cursor-not-allowed disabled:opacity-50"
        >
          {busy ? "Bentar..." : "Bikin voucher"}
        </button>
      </section>

      <section>
        <h2 className="eyebrow mb-2 text-muted">
          Semua voucher {vouchers.length > 0 && `· ${vouchers.length}`}
        </h2>

        {vouchers.length === 0 ? (
          <div className="rounded-xl border border-dashed border-hairline px-4 py-10 text-center">
            <p className="text-sm text-muted">Belum ada voucher.</p>
          </div>
        ) : (
          <>
            {/* phones */}
            <div className="space-y-2 md:hidden">
              {vouchers.map((v) => {
                const s = statusOf(v);
                return (
                  <div key={v.code} className="surface-card rounded-xl p-3.5">
                    <div className="flex items-center justify-between gap-3">
                      <button
                        onClick={() => copy(v.code)}
                        className="cursor-pointer rounded bg-obsidian px-2 py-1 font-mono text-sm font-bold text-ember"
                        title="Tap buat nyalin"
                      >
                        {copied === v.code ? "Kesalin!" : v.code}
                      </button>
                      <span className={`rounded px-2 py-0.5 text-micro ${s.cls}`}>{s.label}</span>
                    </div>
                    <p className="mt-2 flex gap-3 text-micro text-muted">
                      <span>
                        <span className="font-mono text-ink">+{v.credits}</span> kredit
                      </span>
                      <span>Kedaluwarsa {fmt(v.expires_at)}</span>
                    </p>
                  </div>
                );
              })}
            </div>

            {/* md and up */}
            <div className="hidden overflow-hidden rounded-2xl border border-hairline bg-surface md:block">
              <table className="w-full text-left text-sm">
                <thead className="border-b border-hairline bg-obsidian text-muted">
                  <tr>
                    <th className="px-5 py-3 font-medium">Kode</th>
                    <th className="px-5 py-3 font-medium">Kredit</th>
                    <th className="px-5 py-3 font-medium">Status</th>
                    <th className="px-5 py-3 font-medium">Kedaluwarsa</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-hairline">
                  {vouchers.map((v) => {
                    const s = statusOf(v);
                    return (
                      <tr key={v.code} className="text-ink">
                        <td className="px-5 py-3">
                          <button
                            onClick={() => copy(v.code)}
                            className="cursor-pointer rounded bg-obsidian px-2 py-1 font-mono font-bold text-ember hover:bg-surface-raised"
                            title="Klik buat nyalin"
                          >
                            {copied === v.code ? "Kesalin!" : v.code}
                          </button>
                        </td>
                        <td className="px-5 py-3 font-mono">+{v.credits}</td>
                        <td className="px-5 py-3">
                          <span className={`rounded px-2 py-0.5 text-micro ${s.cls}`}>
                            {s.label}
                          </span>
                        </td>
                        <td className="px-5 py-3 text-muted">{fmt(v.expires_at)}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </>
        )}
      </section>
    </div>
  );
}
