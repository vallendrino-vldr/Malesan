import Link from "next/link";

/**
 * Untung apa buntung — the money view of the admin stats page.
 *
 * Three numbers per day, but only two of them are rupiah: money in (approved
 * top-ups) and money out (estimated model cost). Credits burned is a count, not
 * a currency, so it gets its own strip below the axis instead of being drawn on
 * a rupiah scale it does not belong on.
 *
 * Everything here is plain divs. A charting library would be the single
 * heaviest dependency in the project for one 14-column plot, and this page is
 * opened on the same mid-range Android as the rest of the product.
 *
 * The honesty rules this panel enforces, because a money chart that quietly
 * reads zero looks like profit:
 *  - no token prices configured -> the cost half is left EMPTY and labelled,
 *    never drawn as Rp0.
 *  - only one of the two prices set -> cost is an undercount, and says so.
 *  - a day with requests but no token counts (rows written before token
 *    tracking existed) -> excluded from the total and flagged, not treated as
 *    a free day.
 */

export type ProfitDay = {
  /** YYYY-MM-DD. */
  day: string;
  /** Approved top-ups reviewed that day, in IDR. */
  revenue: number;
  /** Estimated model spend that day, in IDR. Meaningless unless priced. */
  cost: number;
  /** Credits users burned that day (a count, not money). */
  credits: number;
  /** Had requests but no token counts, so its cost is unknown rather than zero. */
  untracked: boolean;
};

const nf = new Intl.NumberFormat("id-ID");

/** Exact. For tooltips and any total the owner might reconcile against a bank app. */
function rp(n: number) {
  return `Rp ${nf.format(Math.round(n))}`;
}

/** Headline cards sit two-per-row at 360px, where a nine-digit rupiah overflows. */
function rpShort(n: number) {
  const a = Math.abs(n);
  const sign = n < 0 ? "-" : "";
  if (a >= 1_000_000) {
    return `${sign}Rp ${(a / 1e6).toLocaleString("id-ID", { maximumFractionDigits: 1 })} jt`;
  }
  if (a >= 100_000) return `${sign}Rp ${nf.format(Math.round(a / 1000))} rb`;
  return sign + rp(a);
}

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "Mei", "Jun", "Jul", "Agu", "Sep", "Okt", "Nov", "Des"];

function dayLabel(day: string) {
  const [, m, d] = day.split("-");
  return `${Number(d)} ${MONTHS[Number(m) - 1] ?? m}`;
}

export function ProfitPanel({
  days,
  pricingKnown,
  error,
}: {
  days: ProfitDay[];
  /** False when at least one successful paid-provider call cannot be priced. */
  pricingKnown: boolean;
  /** A failed query reads as Rp0 here, which looks like "no sales". Name it instead. */
  error?: string | null;
}) {
  const priced = pricingKnown;

  const totalRevenue = days.reduce((a, d) => a + d.revenue, 0);
  const totalCost = priced ? days.reduce((a, d) => a + d.cost, 0) : 0;
  const totalCredits = days.reduce((a, d) => a + d.credits, 0);
  const untrackedDays = days.filter((d) => d.untracked).length;

  const margin = totalRevenue - totalCost;
  const marginPct = totalRevenue > 0 ? Math.round((margin / totalRevenue) * 100) : null;

  // One rupiah scale for both halves: a bar above the line and a bar below it
  // are the same height when they are the same amount of money. Splitting the
  // scales would make a Rp500 cost look like it matched a Rp500k day.
  const scale = Math.max(1, ...days.map((d) => Math.max(d.revenue, priced ? d.cost : 0)));
  const maxCredits = Math.max(1, ...days.map((d) => d.credits));

  /** Zero stays invisible; anything above zero keeps a visible sliver. */
  const bar = (v: number, max: number) =>
    v <= 0 ? "0%" : `${Math.min(100, Math.max(5, (v / max) * 100))}%`;

  const chartLabel = priced
    ? `Grafik ${days.length} hari. Masuk ${rp(totalRevenue)}, biaya model ${rp(totalCost)}, sisa ${rp(margin)}.`
    : `Grafik ${days.length} hari. Masuk ${rp(totalRevenue)}. Biaya model belum bisa dihitung karena harga token belum diisi.`;

  return (
    <section>
      <h2 className="eyebrow mb-2 text-muted">Untung rugi · {days.length} hari</h2>

      {error && (
        <p className="mb-2 rounded-xl border border-danger/50 bg-surface px-3 py-2 text-mini leading-relaxed text-danger">
          Data duitnya gagal kebaca ({error}). Angka di bawah jangan dipercaya dulu — nol di sini
          artinya query-nya putus, bukan ga ada pemasukan. Muat ulang halamannya.
        </p>
      )}

      {!priced && (
        <p className="mb-2 rounded-xl border border-ember/45 bg-surface px-3 py-2 text-mini leading-relaxed text-ink">
          Ada pemakaian AI yang harganya belum lengkap, jadi modal dan margin{" "}
          <span className="font-semibold">belum bisa dipercaya</span> — bukan berarti nol. Isi
          harga paket prepaid atau tarif modelnya di{" "}
          <Link href="/admin/ai/models" className="font-semibold text-ember underline underline-offset-2">
            Model AI
          </Link>
          .
        </p>
      )}

      <div className="grid grid-cols-2 gap-2.5">
        <Stat label="Duit masuk" value={rpShort(totalRevenue)} tone="success" note="Top-up disetujui" />
        <Stat
          label="Biaya model"
          value={priced ? rpShort(totalCost) : "Belum kehitung"}
          tone={priced ? "danger" : "muted"}
          note={priced ? "Estimasi dari token kepakai" : "Harga token belum diisi"}
        />
        <Stat
          label="Sisa"
          value={priced ? rpShort(margin) : "?"}
          tone={priced ? (margin >= 0 ? "success" : "danger") : "muted"}
          note={
            priced
              ? marginPct !== null
                ? `${marginPct}% dari duit masuk`
                : "Belum ada pemasukan"
              : "Nunggu harga token"
          }
        />
        <Stat
          label="Kredit kebakar"
          value={nf.format(totalCredits)}
          tone="ink"
          note="Dipakai user, bukan rupiah"
        />
      </div>

      <div className="mt-2.5 rounded-xl border border-hairline bg-surface p-3">
        <div className="flex items-baseline justify-between gap-2 text-micro text-muted">
          <span className="text-success">Masuk</span>
          <span className="tabular">skala {rpShort(scale)}</span>
          <span className={priced ? "text-danger" : ""}>{priced ? "Keluar" : "Keluar (?)"}</span>
        </div>

        <div className="mt-2 flex gap-[2px]" role="img" aria-label={chartLabel}>
          {days.map((d) => (
            <div
              key={d.day}
              className="flex flex-1 flex-col"
              title={`${dayLabel(d.day)} · masuk ${rp(d.revenue)} · keluar ${
                !priced ? "belum kehitung" : d.untracked ? "token belum kecatat" : rp(d.cost)
              } · ${nf.format(d.credits)} kredit`}
            >
              <div className="flex h-16 items-end">
                <div
                  className="w-full rounded-t-[2px] bg-success/80"
                  style={{ height: bar(d.revenue, scale) }}
                />
              </div>
              <div className="h-px bg-hairline" />
              <div className="h-16">
                {priced && !d.untracked && (
                  <div
                    className="w-full rounded-b-[2px] bg-danger/75"
                    style={{ height: bar(d.cost, scale) }}
                  />
                )}
                {/* Unknown, not zero. A blank column would read as a free day. */}
                {priced && d.untracked && (
                  <div className="mx-auto mt-1.5 h-1 w-1 rounded-full bg-muted" />
                )}
              </div>
            </div>
          ))}
        </div>

        {/* Credits live below the axis on their own scale — they are a count of
            work done, not a third pile of money. */}
        <div className="mt-2 flex h-6 items-end gap-[2px]">
          {days.map((d) => (
            <div key={d.day} className="flex h-full flex-1 items-end">
              <div
                className="w-full rounded-t-[2px] bg-ember/45"
                style={{ height: bar(d.credits, maxCredits) }}
              />
            </div>
          ))}
        </div>

        <div className="mt-1.5 flex justify-between text-micro text-muted">
          <span>{days[0] ? dayLabel(days[0].day) : ""}</span>
          <span className="tabular text-ember">
            kredit · puncak {nf.format(maxCredits)}
          </span>
          <span>{days.length ? dayLabel(days[days.length - 1].day) : ""}</span>
        </div>
      </div>

      <p className="mt-1.5 text-micro leading-relaxed text-muted">
        Biaya dibaca dari log model yang benar-benar menjawab, termasuk fallback dan paket prepaid.
        {untrackedDays > 0 && (
          <>
            {" "}
            <span className="text-ember">
              {untrackedDays} hari punya request tapi belum ada catatan tokennya
            </span>
            , jadi hari itu dilewatin, bukan dianggap gratis.
          </>
        )}
      </p>
    </section>
  );
}

function Stat({
  label,
  value,
  note,
  tone,
}: {
  label: string;
  value: string;
  note: string;
  tone: "success" | "danger" | "muted" | "ink";
}) {
  const color =
    tone === "success"
      ? "text-success"
      : tone === "danger"
        ? "text-danger"
        : tone === "muted"
          ? "text-muted"
          : "text-ink";
  return (
    <div className="rounded-xl border border-hairline bg-surface p-3.5">
      <p className="eyebrow text-muted">{label}</p>
      <p className={`tabular mt-1 font-display text-lg font-bold ${color}`}>{value}</p>
      <p className="mt-1 text-micro leading-snug text-muted">{note}</p>
    </div>
  );
}
