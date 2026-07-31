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

/** Plain-language reading of the common upstream failures. */
function explain(r: Row): { title: string; fix: string } {
  const m = r.message.toLowerCase();
  if (r.status === 429 || m.includes("rate limit") || m.includes("quota")) {
    return {
      title: "Kuota Gemini kepentok",
      fix: "Key ini udah nyampe batas harian. Tambah key baru di env, atau tunggu reset jam 07:00 WIB (00:00 Pacific).",
    };
  }
  if (r.status === 404 || m.includes("not found")) {
    return {
      title: "Model gak ketemu",
      fix: `Id model "${r.model ?? "?"}" gak dikenal Google. Cek ejaannya di Otak AI — salah satu huruf aja bikin semua generate gagal.`,
    };
  }
  if (r.status === 403 || m.includes("permission") || m.includes("api key")) {
    return {
      title: "Key ditolak",
      fix: "API key-nya gak valid, dicabut, atau Generative Language API belum diaktifin di project Google-nya.",
    };
  }
  if (r.status === 400 || m.includes("invalid")) {
    return {
      title: "Request ditolak",
      fix: "Biasanya schema atau prompt kepanjangan. Ini bug di sisi kita, bukan salah user.",
    };
  }
  if ((r.status ?? 0) >= 500 || m.includes("unavailable") || m.includes("overloaded")) {
    return {
      title: "Server Gemini lagi bermasalah",
      fix: "Dari sisi Google. Sistem udah otomatis nyoba key lain dan retry — kalau sering, kurangi beban.",
    };
  }
  return { title: "Error lain", fix: "Baca pesan aslinya di bawah." };
}

const timeAgo = (iso: string) => {
  const mins = Math.floor((Date.now() - new Date(iso).getTime()) / 60000);
  if (mins < 1) return "barusan";
  if (mins < 60) return `${mins} menit lalu`;
  const h = Math.floor(mins / 60);
  if (h < 24) return `${h} jam lalu`;
  return `${Math.floor(h / 24)} hari lalu`;
};

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
    const key = `${info.title}|${r.status ?? ""}|${r.model ?? ""}`;
    const g = groups.get(key);
    if (g) g.rows.push(r);
    else groups.set(key, { rows: [r], info });
  }
  const grouped = [...groups.values()].sort((a, b) => b.rows.length - a.rows.length);

  return (
    <div className="space-y-5">
      <LiveRefresh tables={["error_log"]} label="Error baru tercatat" />

      <header>
        <h1 className="font-display text-xl font-bold text-ink">Error</h1>
        <p className="mt-1 text-sm leading-relaxed text-muted">
          Kenapa gagal, bukan cuma berapa kali. Dikelompokin biar seratus kejadian
          dari satu masalah kebaca sebagai satu masalah.
        </p>
      </header>

      {grouped.length === 0 ? (
        <div className="rounded-xl border border-dashed border-hairline px-4 py-10 text-center">
          <p className="text-sm text-muted">
            Belum ada error tercatat. Kalau grafik nunjukin error tapi di sini
            kosong, berarti error-nya kejadian sebelum pencatatan ini dipasang.
          </p>
        </div>
      ) : (
        <div className="space-y-2.5">
          {grouped.map((g, i) => {
            const latest = g.rows[0];
            return (
              <div key={i} className="surface-card rounded-xl p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="font-display text-[0.9375rem] font-bold text-ink">
                      {g.info.title}
                    </p>
                    <p className="mt-0.5 flex flex-wrap gap-x-2 text-micro text-muted">
                      {latest.status && <span className="text-danger">HTTP {latest.status}</span>}
                      {latest.model && <span>{latest.model}</span>}
                      {latest.key_index != null && <span>key {latest.key_index}</span>}
                      <span>{timeAgo(latest.created_at)}</span>
                    </p>
                  </div>
                  <span className="shrink-0 rounded-full bg-danger/10 px-2.5 py-1 font-mono text-micro text-danger">
                    {g.rows.length}×
                  </span>
                </div>

                <p className="mt-2.5 rounded-lg border border-ember/20 bg-ember/5 px-3 py-2 text-mini leading-relaxed text-ember-lo">
                  {g.info.fix}
                </p>

                <details className="mt-2">
                  <summary className="cursor-pointer text-micro text-muted hover:text-ink">
                    Pesan asli dari Google
                  </summary>
                  <pre className="mt-1.5 max-h-40 overflow-auto whitespace-pre-wrap rounded-lg bg-obsidian p-2.5 font-mono text-micro leading-relaxed text-muted">
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
