import { NextRequest } from "next/server";
import { createClient, createServiceRoleClient } from "@/lib/supabase/server";
import { runAI } from "@/lib/ai/engine";
import { parseAIJson } from "@/lib/ai/json";
import { userFacingError } from "@/lib/ai/errors";
import { aiRateLimit } from "@/lib/rate-limit";

export const runtime = "nodejs";
export const maxDuration = 45;

interface NetizenResponse {
  potensiViral: string;
  dayaDebat: string;
  rasioKonversi: string;
  suggestedPinnedComment: string;
  comments: Array<{
    type: string;
    name: string;
    handle: string;
    badgeLabel: string;
    comment: string;
    likes: number;
    timeAgo: string;
  }>;
}

export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return Response.json({ error: "Sesi lo udah habis. Masuk lagi ya." }, { status: 401 });
  }

  const service = createServiceRoleClient();
  const { data: profile } = await service
    .from("profiles")
    .select("is_banned")
    .eq("id", user.id)
    .single();

  if (!profile) return Response.json({ error: "Profil gak ketemu." }, { status: 404 });
  if (profile.is_banned) return Response.json({ error: "Akun lo lagi dibekuin." }, { status: 403 });

  const limited = await aiRateLimit(user.id, "simulate_netizen", 20);
  if (limited) return limited;

  let body: { title?: string; scriptContent?: string; platform?: string } | null;
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "Body gak kebaca." }, { status: 400 });
  }

  const title = (body?.title ?? "").toString().trim();
  const rawScript = (body?.scriptContent ?? "").toString().trim();
  const platform = (body?.platform ?? "TikTok / Reels").toString().trim();

  // Extract clean plain-text script from possible JSON structure
  let extractedScript = rawScript;
  try {
    const parsed = JSON.parse(rawScript);
    if (parsed && typeof parsed === "object") {
      const parts: string[] = [];
      if (Array.isArray(parsed.script)) {
        parsed.script.forEach((scene: { timestamp?: string; spoken?: string; visual?: string }) => {
          if (scene.spoken) parts.push(`[Audio]: ${scene.spoken}`);
          if (scene.visual) parts.push(`[Visual]: ${scene.visual}`);
        });
      }
      if (parsed.caption) parts.push(`[Caption]: ${parsed.caption}`);
      if (parsed.cta?.text) parts.push(`[CTA]: ${parsed.cta.text}`);
      if (parts.length > 0) {
        extractedScript = parts.join("\n");
      }
    }
  } catch {
    // If not JSON, use raw string
  }

  if (!title && !extractedScript) {
    return Response.json({ error: "Naskah atau judul konten masih kosong." }, { status: 400 });
  }

  const prompt = `Lo adalah AI Simulator Kolom Komentar Netizen Sosmed Indonesia (TikTok / Reels / YouTube Shorts).
Tugas lo: Baca naskah/topik konten berikut secara seksama, lalu simulasikan 6 komentar netizen yang BENAR-BENAR FRESH, REALISTIS, dan 100% RELEVAN KHUSUS DENGAN TOPIK INI.

TOPIK / JUDUL: "${title}"
PLATFORM: ${platform}
ISI NASKAH:
"""
${extractedScript.slice(0, 3000) || title}
"""

ATURAN WAJIB:
1. Komentar HARUS merespon detail spesifik dari naskah di atas (contoh: jika bahas motor/CVT, bahas roller/v-belt/bengkel/ongkos; jika bahas coding/bisnis/skincare, sesuaikan secara akurat).
2. DILARANG menggunakan template acak atau membicarakan topik yang tidak ada di naskah.
3. Gunakan bahasa gaul sosmed Indonesia asli (ada slang, typo natural, tanda baca santai, singkatan wajar seperti 'bgt', 'gak', 'beneran', 'anjir', 'wkwk', 'bjir').
4. 6 Karakter Persona Netizen:
   1) type: "skeptis" | name: "Bayu Antiklaim" | handle: "@bayu_analis99" | badgeLabel: "Skeptis / Debat" -> Mempertanyakan validitas klaim di naskah atau ngebandingin sama pengalaman pribadinya.
   2) type: "fomo" | name: "Siska Racun TikTok" | handle: "@siska_checkout_terus" | badgeLabel: "FOMO / Emosi" -> Kaget, panik, atau antusias banget pengen coba/action sekarang.
   3) type: "receh" | name: "Rian Kaum Rebahan" | handle: "@rian_saldo_tipis" | badgeLabel: "Top Komen Receh" -> Komentar lucu/jokes receh, memeable, relate sama nasib dompet/keseharian.
   4) type: "detail" | name: "Dimas Detail Police" | handle: "@dimas_pakar_dadakan" | badgeLabel: "Detail Police" -> Sok tahu/ngasih analisis teknis tambahan atau koreksi kecil sok pintar.
   5) type: "relate" | name: "Nadia Relate Parah" | handle: "@nadiacurhat_id" | badgeLabel: "Curhat Relate" -> Curhat pengalaman nyata yang persis dialami kayak di naskah.
   6) type: "promo" | name: "Farhan Cari Solusi" | handle: "@farhan_tips_id" | badgeLabel: "Pemburu Solusi" -> Nanya solusi praktis, rekomendasi tempat/merk/langkah lanjutannya.

5. suggestedPinnedComment: Buat 1 rekomendasi komentar PIN dari kreator yang memancing perdebatan/engagement tinggi di video ini.
6. potensiViral: string (contoh: "8.9 / 10 (Sangat Tinggi)")
7. dayaDebat: string (contoh: "8.2 / 10 (Panas)")
8. rasioKonversi: string (contoh: "Tinggi (Relate & Curhat)")

Balas HANYA dengan JSON valid format:
{
  "potensiViral": "8.8 / 10 (Tinggi)",
  "dayaDebat": "8.5 / 10 (Aktif)",
  "rasioKonversi": "Tinggi (Relate & Edukasi)",
  "suggestedPinnedComment": "Kalo menurut kalian soal ...",
  "comments": [
    {
      "type": "skeptis",
      "name": "Bayu Antiklaim",
      "handle": "@bayu_analis99",
      "badgeLabel": "Skeptis / Debat",
      "comment": "...",
      "likes": 184,
      "timeAgo": "7m"
    },
    ...
  ]
}`;

  try {
    const { text: rawJson } = await runAI({
      feature: "react_netizen",
      prompt,
      userId: user.id,
      signal: AbortSignal.timeout(35_000),
      budgetMs: 33_000,
    });

    const parsed = parseAIJson<NetizenResponse>(rawJson);
    if (!parsed || !Array.isArray(parsed.comments) || parsed.comments.length === 0) {
      throw new Error("Gagal membentuk komentar AI.");
    }

    return Response.json({
      ok: true,
      potensiViral: parsed.potensiViral || "8.7 / 10 (Tinggi)",
      dayaDebat: parsed.dayaDebat || "8.0 / 10 (Aktif)",
      rasioKonversi: parsed.rasioKonversi || "Tinggi (Relate)",
      suggestedPinnedComment: parsed.suggestedPinnedComment || `Menurut kalian dari poin di atas, mana yang paling sering kejadian? Drop di komentar ya! 👇`,
      comments: parsed.comments.map((c, i) => ({
        id: `ai-${c.type || i}-${Date.now()}`,
        name: c.name || "Netizen Indonesia",
        handle: c.handle || "@warga_net",
        type: c.type || "relate",
        badgeLabel: c.badgeLabel || "Netizen",
        comment: c.comment,
        likes: typeof c.likes === "number" ? c.likes : 45 + Math.floor(Math.random() * 300),
        timeAgo: c.timeAgo || `${(i + 1) * 6}m`,
      })),
    });
  } catch (err) {
    console.error("simulate-netizen error:", err);
    const friendly = userFacingError(err);
    return Response.json(
      {
        error: friendly.message,
        fallback: true,
      },
      { status: friendly.retryable ? 503 : 500 }
    );
  }
}
