import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { parseJson } from "@/lib/gemini/client";
import { runAI } from "@/lib/ai/engine";
import { buildSnapshot, type Snapshot } from "@/lib/admin/snapshot";

/**
 * The admin assistant.
 *
 * What it is: a reader. It gets one snapshot of the platform — queue, errors,
 * quota, users, revenue, config — and answers in plain Indonesian, then names
 * what is worth doing and points at the screen where it is done.
 *
 * What it is deliberately not: something that can act. It cannot approve a
 * payment, move credits, ban an account or change a setting, and that is a
 * design decision rather than an unfinished one. Those operations move real
 * money and real access on a live product, and a model that can be argued into
 * a conclusion should not also be able to execute it — especially when part of
 * what it reads (a top-up proof reading, an error message, an email address) is
 * text a stranger was able to influence. Every recommendation therefore comes
 * back as a destination plus a reason, and a person does the last step.
 *
 * That still removes the actual work, which was never the tapping — it was
 * holding seven screens in your head to notice that the thing at the top of the
 * queue has been waiting nine hours and the automated check flagged it.
 */

export const runtime = "nodejs";
export const maxDuration = 60;

const SCHEMA = {
  type: "OBJECT",
  properties: {
    headline: { type: "STRING" },
    answer: { type: "STRING" },
    attention: {
      type: "ARRAY",
      items: {
        type: "OBJECT",
        properties: {
          severity: { type: "STRING" },
          title: { type: "STRING" },
          detail: { type: "STRING" },
          action: { type: "STRING" },
          href: { type: "STRING" },
        },
        required: ["severity", "title", "detail", "action", "href"],
      },
    },
    allClear: { type: "BOOLEAN" },
  },
  required: ["headline", "answer", "attention", "allClear"],
} as const;

type Answer = {
  headline: string;
  answer: string;
  attention: {
    severity: string;
    title: string;
    detail: string;
    action: string;
    href: string;
  }[];
  allClear: boolean;
};

/** Only these can be linked to. A model-authored href is a redirect waiting to happen. */
const ALLOWED_HREFS = new Set([
  "/admin",
  "/admin/users",
  "/admin/topups",
  "/admin/vouchers",
  "/admin/stats",
  "/admin/errors",
  "/admin/config",
]);

function buildPrompt(snap: Snapshot, question: string) {
  const rupiah = (n: number) => `Rp${n.toLocaleString("id-ID")}`;

  return `Lo operator berpengalaman yang bantu pemilik Malesan — aplikasi AI buat kreator
konten Indonesia — ngurus platformnya. Pemiliknya bukan programmer, jadi jangan
pakai istilah teknis tanpa dijelasin.

Lo cuma BACA dan NGASIH SARAN. Lo gak bisa dan gak boleh ngaku-ngaku udah
ngelakuin apa pun — gak approve topup, gak nambah kredit, gak nge-ban, gak ubah
setting. Yang eksekusi tetap orangnya. Kalau ada yang perlu dikerjain, bilang
apa yang perlu dikerjain dan di halaman mana.

DATA PLATFORM (diambil ${new Date(snap.takenAt).toLocaleString("id-ID")}):

User: ${snap.users.total} total, ${snap.users.pro} Pro, ${snap.users.banned} kena ban, ${snap.users.newLast7d} baru dalam 7 hari.

Topup nunggu review: ${snap.topups.pending}
${
  snap.topups.pendingRows
    .map(
      (t) =>
        `  - ${t.email} · ${rupiah(t.amountIdr)} (${t.credits} kredit) · nunggu ${t.waitingHours} jam · hasil cek otomatis: ${t.verdict}${
          t.flags.length ? ` · catatan: ${t.flags.join("; ")}` : ""
        }`,
    )
    .join("\n") || "  (kosong)"
}
Topup disetujui 30 hari terakhir: ${snap.topups.approvedLast30d} (${rupiah(snap.topups.revenueLast30dIdr)})

Generasi: ${snap.generations.last24h} dalam 24 jam, ${snap.generations.last7d} dalam 7 hari.
Per modul (7 hari): ${
    Object.entries(snap.generations.byModule)
      .map(([m, c]) => `${m}=${c}`)
      .join(", ") || "belum ada"
  }

Error 24 jam terakhir: ${snap.errors.last24h}
${snap.errors.topMessages.map((e) => `  - ${e.count}x ${e.message}`).join("\n") || "  (bersih)"}

Kuota Gemini hari ini (batas gratis 1500/key):
${snap.quota.map((q) => `  - Key ${q.keyIndex}: ${q.requests} request, ${q.errors} error`).join("\n") || "  (belum kepakai)"}

Voucher: ${snap.vouchers.active} aktif, ${snap.vouchers.redeemed} udah kepakai.
Tren aktif: ${snap.trends.active}${snap.trends.newestCapturedAt ? ` (terbaru ${new Date(snap.trends.newestCapturedAt).toLocaleString("id-ID")})` : ""}
Setting: provider=${snap.config.provider ?? "default"}, model=${snap.config.model ?? "default"}, rekening ${snap.config.bankConfigured ? "udah diisi" : "BELUM diisi"}

PERTANYAAN PEMILIK: ${question || "Apa yang perlu gue urus sekarang?"}

Cara jawab:
- headline: satu kalimat, langsung ke kondisi paling penting saat ini.
- answer: jawaban buat pertanyaannya, bahasa santai, maksimal 4 kalimat. Pakai
  angka dari data di atas, jangan ngarang angka yang gak ada.
- attention: hal yang perlu ditindak. Urut dari paling mendesak. Kosongin kalau
  emang gak ada — jangan ngarang kerjaan biar keliatan berguna.
    severity: "tinggi" | "sedang" | "rendah"
    title   : masalahnya apa, singkat
    detail  : kenapa ini penting, pakai angka yang nyata
    action  : apa yang harus dia lakuin, kalimat perintah pendek
    href    : HARUS salah satu dari: /admin, /admin/users, /admin/topups,
              /admin/vouchers, /admin/stats, /admin/errors, /admin/config
- allClear: true kalau attention kosong.

Yang penting dinilai:
- Topup yang nunggu lebih dari 12 jam itu masalah — orang udah bayar.
- Topup dengan hasil cek "fail" atau "suspect" jangan disuruh approve. Suruh
  lihat sendiri dulu.
- Kuota key di atas 80% berarti sebentar lagi mentok.
- Error yang berulang lebih penting daripada error yang sekali doang.
- Tren 0 berarti prompt jalan tanpa konteks tren, hasilnya jadi generik.
- Rekening belum diisi berarti gak ada yang bisa bayar sama sekali.

Balas HANYA JSON valid.`;
}

export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();
  if (profile?.role !== "admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  let question = "";
  try {
    const body = await req.json();
    question = typeof body?.question === "string" ? body.question.slice(0, 500) : "";
  } catch {
    // An empty body means "just tell me what needs attention", which is the
    // most common way this gets used.
  }

  try {
    const snap = await buildSnapshot();
    const { text: raw } = await runAI({
      feature: "admin_assistant",
      prompt: buildPrompt(snap, question),
      schema: SCHEMA as unknown as Record<string, unknown>,
      tier: "pro",
      userId: user.id,
      signal: AbortSignal.timeout(45_000),
    });
    const parsed = parseJson<Answer>(raw);

    // Drop any destination the model invented. It is reading text that users
    // can influence — a proof reading, an error string, an email address — so
    // an href it produces is not automatically safe to render as a link.
    const attention = (parsed.attention ?? []).filter((a) => ALLOWED_HREFS.has(a.href));

    return NextResponse.json({
      ...parsed,
      attention,
      snapshot: snap,
    });
  } catch (err) {
    return NextResponse.json(
      {
        error:
          err instanceof Error
            ? `Asistennya lagi gak bisa mikir: ${err.message}`
            : "Asistennya lagi gak bisa dipakai.",
      },
      { status: 502 },
    );
  }
}
