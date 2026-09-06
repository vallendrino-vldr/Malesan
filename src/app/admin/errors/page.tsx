import Link from "next/link";
import { createServiceRoleClient } from "@/lib/supabase/server";
import { LiveRefresh } from "@/components/LiveRefresh";
import { ErrorActionCenter } from "./ErrorActionCenter";
import { ErrorListAccordion } from "./ErrorListAccordion";

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

      <div className="flex items-center justify-between">
        <Link
          href="/admin"
          className="inline-flex items-center gap-1.5 text-xs font-medium text-muted transition hover:text-ink"
        >
          <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 19.5L3 12m0 0l7.5-7.5M3 12h18" />
          </svg>
          Kembali ke Ringkasan
        </Link>
      </div>

      <header className="border-b border-hairline pb-4">
        <span className="eyebrow text-ember font-bold">Pusat Diagnostik</span>
        <h1 className="mt-1 font-display text-2xl font-bold tracking-display-md text-ink">
          Error Center
        </h1>
        <p className="mt-1 text-xs text-muted leading-relaxed">
          Penyebab kendala yang diterjemahkan menjadi <strong>Masalah → Dampak → Aksi Sistem → Tindakan Founder</strong> agar operasional bisnis tetap aman tanpa kebingungan teknis.
        </p>
      </header>

      {/* Action Center for Founder */}
      <ErrorActionCenter totalErrors={rows.length} />

      {grouped.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-hairline px-4 py-12 text-center bg-surface">
          <div className="mx-auto flex size-12 items-center justify-center rounded-full bg-success/15 border border-success/30 text-success">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="size-6">
              <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
              <polyline points="22 4 12 14.01 9 11.01" />
            </svg>
          </div>
          <p className="mt-3 font-display text-base font-bold text-success">
            Tidak Ada Error Tercatat
          </p>
          <p className="mt-1 text-xs text-muted">
            Semua sistem berjalan normal tanpa kendala kegagalan AI.
          </p>
        </div>
      ) : (
        <ErrorListAccordion initialGroups={grouped} />
      )}
    </div>
  );
}
