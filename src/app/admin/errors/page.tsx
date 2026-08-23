import { createServiceRoleClient } from "@/lib/supabase/server";
import { LiveRefresh } from "@/components/LiveRefresh";

/**
 * Why things failed.
 *
 * The stats page could say "5 errors today" and nothing more, which is not
 * information an operator can act on — the honest answer to "kenapa errornya?"
 * was a shrug. Every Gemini failure now writes its status, model, key and the
 * upstream message here.
 *
 * Errors are grouped by message so a hundred instances of one problem read as
 * one problem, not a hundred.
 */

export const dynamic = "force-dynamic";

type Row = {
  id: number;
  scope: string;
  module: string | null;
  key_index: number | null;
  model: string | null;
  status: number | null;
  message: string;
  created_at: string;
};

/** Plain-language reading: 4 Pertanyaan Kunci Founder */
function explain(r: Row): {
  masalah: string;
  dampak: string;
  sistemAction: string;
  founderAction: string;
  severity: "low" | "medium" | "high";
} {
  const m = r.message.toLowerCase();
  if (r.status === 429 || m.includes("rate limit") || m.includes("quota")) {
    return {
      masalah: "Kuota Harian API AI Kepentok",
      dampak: "Pembuatan konten sempat tertunda atau gagal sebelum berpindah key.",
      sistemAction: "Sistem otomatis merotasi ke key cadangan berikutnya dan refund kredit pengguna jika gagal.",
      founderAction: "Jika semua key habis, tunggu kuota reset jam 07:00 WIB atau tambahkan API key Gemini baru di Vercel env.",
      severity: "high",
    };
  }
  if (r.status === 404 || m.includes("not found")) {
    return {
      masalah: "Model AI Tidak Dikenal Provider",
      dampak: "Semua request yang diarahkan ke model ini akan gagal total.",
      sistemAction: "Sistem mencatat error log dan mencoba fallback ke model default jika terkonfigurasi.",
      founderAction: `Periksa ID model "${r.model ?? "?"}" di menu Otak AI / Provider. Pastikan ejaannya persis dengan dokumentasi provider.`,
      severity: "high",
    };
  }
  if (r.status === 403 || m.includes("permission") || m.includes("api key")) {
    return {
      masalah: "API Key Ditolak oleh Provider",
      dampak: "Request ke provider terkait ditolak dan gagal dieksekusi.",
      sistemAction: "Sistem menonaktifkan sementara key bermasalah dan mencoba key berikutnya.",
      founderAction: "Cek apakah API key dicabut di Google Cloud / AI Studio atau aktifkan Generative Language API.",
      severity: "high",
    };
  }
  if (r.status === 400 || m.includes("invalid")) {
    return {
      masalah: "Format Request Ditolak AI",
      dampak: "Sebagian input teks pengguna yang tidak standar gagal diproses AI.",
      sistemAction: "Sistem memotong input panjang secara otomatis dan membatasi ukuran payload.",
      founderAction: "Tidak ada tindakan mendesak, sistem sudah memproteksi schema input.",
      severity: "medium",
    };
  }
  if ((r.status ?? 0) >= 500 || m.includes("unavailable") || m.includes("overloaded")) {
    return {
      masalah: "Server AI Upstream Sedang Sibuk / Gangguan",
      dampak: "Beberapa percobaan pembuatan konten sempat gagal sementara.",
      sistemAction: "Sistem otomatis melakukan retry ke key/provider alternatif dan memastikan kredit aman.",
      founderAction: "Gangguan berasal dari pihak Google/provider. Pantau status hingga server upstream stabil.",
      severity: "medium",
    };
  }
  return {
    masalah: "Kendala Sistem / Jaringan",
    dampak: "Request tidak berhasil diselesaikan pada percobaan ini.",
    sistemAction: "Sistem mencatat rincian kegagalan dan mengembalikan kredit pengguna.",
    founderAction: "Buka accordion detail teknis di bawah untuk melihat penyebab spesifiknya.",
    severity: "low",
  };
}

function timeAgo(iso: string) {
  const mins = Math.floor((Date.now() - new Date(iso).getTime()) / 60000);
  if (mins < 1) return "barusan";
  if (mins < 60) return `${mins} menit lalu`;
  const h = Math.floor(mins / 60);
  if (h < 24) return `${h} jam lalu`;
  return `${Math.floor(h / 24)} hari lalu`;
}

export default async function AdminErrorsPage() {
  const { data } = await createServiceRoleClient()
    .from("error_log")
    .select("id, scope, module, key_index, model, status, message, created_at")
    .order("created_at", { ascending: false })
    .limit(200);

  const rows = (data as Row[] | null) ?? [];

  // Group by explanation title + status, so repeats collapse.
  const groups = new Map<string, { rows: Row[]; info: ReturnType<typeof explain> }>();
  for (const r of rows) {
    const info = explain(r);
    const key = `${info.masalah}|${r.status ?? ""}|${r.model ?? ""}`;
    const g = groups.get(key);
    if (g) g.rows.push(r);
    else groups.set(key, { rows: [r], info });
  }
  const grouped = [...groups.values()].sort((a, b) => b.rows.length - a.rows.length);

  return (
    <div className="space-y-6">
      <LiveRefresh tables={["error_log"]} label="Error baru tercatat" />

      <header className="border-b border-hairline pb-4">
        <span className="eyebrow text-ember font-bold">Pusat Diagnostik</span>
        <h1 className="mt-1 font-display text-2xl font-bold tracking-display-md text-ink">
          Error Center
        </h1>
        <p className="mt-1 text-xs text-muted leading-relaxed">
          Penyebab kendala yang diterjemahkan menjadi <strong>Masalah → Dampak → Aksi Sistem → Tindakan Founder</strong> agar operasional bisnis tetap aman tanpa kebingungan teknis.
        </p>
      </header>

      {grouped.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-hairline px-4 py-12 text-center bg-surface">
          <span className="text-3xl">✨</span>
          <p className="mt-3 font-display text-base font-bold text-success">
            Tidak Ada Error Tercatat
          </p>
          <p className="mt-1 text-xs text-muted">
            Semua sistem berjalan normal tanpa kendala kegagalan AI.
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {grouped.map((g, i) => {
            const latest = g.rows[0];
            const severityBg =
              g.info.severity === "high"
                ? "border-danger/40 bg-danger/5"
                : "border-amber-500/30 bg-amber-500/5";
            const badgeColor =
              g.info.severity === "high"
                ? "bg-danger/10 text-danger border-danger/30"
                : "bg-amber-500/10 text-amber-400 border-amber-500/30";

            return (
              <div
                key={i}
                className={`surface-card rounded-2xl border p-5 space-y-4 transition-all shadow-xs ${severityBg}`}
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-base">
                        {g.info.severity === "high" ? "🚨" : "⚠️"}
                      </span>
                      <h2 className="font-display text-base font-bold text-ink">
                        {g.info.masalah}
                      </h2>
                    </div>
                    <p className="mt-1 flex flex-wrap items-center gap-x-2 text-micro text-muted font-mono">
                      {latest.status && <span className="text-danger font-semibold">HTTP {latest.status}</span>}
                      {latest.model && <span>• {latest.model}</span>}
                      {latest.key_index != null && <span>• key #{latest.key_index}</span>}
                      <span>• {timeAgo(latest.created_at)}</span>
                    </p>
                  </div>

                  <span
                    className={`shrink-0 rounded-full border px-3 py-1 font-mono text-xs font-bold ${badgeColor}`}
                  >
                    Terjadi {g.rows.length}×
                  </span>
                </div>

                {/* 4 Pertanyaan Kunci Founder */}
                <div className="grid gap-2.5 sm:grid-cols-3">
                  <div className="rounded-xl border border-hairline bg-surface p-3.5 flex flex-col justify-between">
                    <div>
                      <span className="eyebrow text-muted">💥 Dampak ke User</span>
                      <p className="mt-1.5 text-xs leading-relaxed text-ink/90">
                        {g.info.dampak}
                      </p>
                    </div>
                  </div>

                  <div className="rounded-xl border border-hairline bg-surface p-3.5 flex flex-col justify-between">
                    <div>
                      <span className="eyebrow text-muted">🤖 Aksi Otomatis Sistem</span>
                      <p className="mt-1.5 text-xs leading-relaxed text-ink/90">
                        {g.info.sistemAction}
                      </p>
                    </div>
                  </div>

                  <div className="rounded-xl border border-ember/30 bg-ember/10 p-3.5 flex flex-col justify-between">
                    <div>
                      <span className="eyebrow text-ember font-bold">🛠️ Tindakan Founder</span>
                      <p className="mt-1.5 text-xs leading-relaxed text-ember-lo font-medium">
                        {g.info.founderAction}
                      </p>
                    </div>
                  </div>
                </div>

                {/* Technical details (collapsible) */}
                <details className="group border-t border-hairline/60 pt-2.5">
                  <summary className="cursor-pointer text-micro font-semibold text-muted hover:text-ink select-none flex items-center gap-1.5">
                    <span>🔍 Lihat Log Teknis Asli</span>
                  </summary>
                  <pre className="mt-2 max-h-40 overflow-auto whitespace-pre-wrap rounded-xl border border-hairline bg-obsidian p-3 font-mono text-micro leading-relaxed text-muted">
                    {latest.message}
                  </pre>
                </details>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
