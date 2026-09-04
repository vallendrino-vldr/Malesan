import { NextRequest } from "next/server";
import { createClient, SupabaseClient } from "@supabase/supabase-js";
import { getTelegramConfig, sendTelegramMessage } from "@/lib/telegram";
import { generate } from "@/lib/gemini/client";

export const runtime = "nodejs";
export const maxDuration = 45;

function getAdminSupabase(): SupabaseClient {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY!;
  return createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

export async function GET(request: NextRequest) {
  // 1. Strictly verify Vercel Cron authorization header
  const authHeader = request.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    return new Response("Unauthorized", { status: 401 });
  }

  const supabase = getAdminSupabase();
  const config = await getTelegramConfig();

  const { searchParams } = new URL(request.url);
  const typeParam = searchParams.get("type");
  const nowJakarta = new Date().toLocaleString("id-ID", { timeZone: "Asia/Jakarta" });
  const hour = new Date(new Date().toLocaleString("en-US", { timeZone: "Asia/Jakarta" })).getHours();
  const isMorning = typeParam ? typeParam === "morning" : hour >= 4 && hour < 14;
  const briefingType = isMorning ? "MORNING EXECUTIVE BRIEFING" : "EVENING WRAP-UP BRIEFING";

  const past24hIso = new Date(Date.now() - 24 * 3600 * 1000).toISOString();

  // 2. Fetch metrics
  const [usersRes, newUsersRes, topupsRes, gensRes, feedbackRes] = await Promise.all([
    supabase.from("profiles").select("id, is_pro, created_at"),
    supabase.from("profiles").select("id, email, display_name").gte("created_at", past24hIso),
    supabase.from("topups").select("amount, credits, status, created_at").gte("created_at", past24hIso),
    supabase.from("generations").select("id, module, credits_spent, created_at").gte("created_at", past24hIso),
    supabase.from("feedback").select("rating, comment").gte("created_at", past24hIso),
  ]);

  const totalUsers = usersRes.data?.length || 0;
  const proUsers = usersRes.data?.filter((u) => u.is_pro).length || 0;
  const newUsersCount = newUsersRes.data?.length || 0;

  const approvedTopups = topupsRes.data?.filter((t) => t.status === "approved") || [];
  const pendingTopups = topupsRes.data?.filter((t) => t.status === "pending") || [];
  const revenue24h = approvedTopups.reduce((sum, t) => sum + Number(t.amount || 0), 0);

  const totalGens24h = gensRes.data?.length || 0;
  const totalCreditsBurned = gensRes.data?.reduce((sum, g) => sum + Number(g.credits_spent || 0), 0) || 0;

  // Module distribution
  const modCounts: Record<string, number> = {};
  gensRes.data?.forEach((g) => {
    const mod = g.module || "other";
    modCounts[mod] = (modCounts[mod] || 0) + 1;
  });
  const topModule = Object.entries(modCounts).sort((a, b) => b[1] - a[1])[0]?.[0] || "Belum ada";

  const ratings = feedbackRes.data?.map((f) => Number(f.rating)).filter(Boolean) || [];
  const avgRating = ratings.length > 0 ? (ratings.reduce((a, b) => a + b, 0) / ratings.length).toFixed(1) : "N/A";

  // 3. AI Strategic Growth Suggestion
  let growthAdvice = "";
  try {
    const prompt = `Kamu adalah Chief Growth Strategist untuk platform Malesan (SaaS AI Content Creator Indonesia).
Data 24 Jam Terakhir:
- Pendaftar Baru: ${newUsersCount} user
- Total User: ${totalUsers} (Pro: ${proUsers})
- Omzet 24 Jam: Rp ${revenue24h.toLocaleString("id-ID")}
- Topup Pending: ${pendingTopups.length} transaksi
- Total Generasi Konten: ${totalGens24h} kali (Modul Terlaris: ${topModule})
- Kredit Terbakar: ${totalCreditsBurned} kredit
- Rata-rata Skor Ulasan: ${avgRating}/5 (${feedbackRes.data?.length || 0} ulasan)
Waktu: ${isMorning ? "Pagi hari (08:00 WIB)" : "Malam hari (20:00 WIB)"}

Berikan 1 PARAGRAF SINGKAT (maksimal 3 kalimat), padat, tajam, dan dapat langsung dieksekusi hari ini oleh Bos untuk meningkatkan retensi atau monetisasi Malesan.
DILARANG MENGGUNAKAN EMOJI APAPUN.`;

    growthAdvice = await generate({ prompt });
    growthAdvice = growthAdvice.trim().replace(/[🌀-🧿☀-⛿✀-➿🇠-🇿🨀-🫿]/gu, "");
  } catch {
    growthAdvice = "Fokus perluas distribusi konten di TikTok dan optimasi konversi user gratis ke Pro tier.";
  }

  // 4. Compose Clean Executive Report
  const report = `<b>[${briefingType}]</b>

• <b>Waktu Laporan:</b> ${nowJakarta} WIB
• <b>Pendaftar Baru:</b> +${newUsersCount} pengguna (Total: ${totalUsers} | Pro: ${proUsers})
• <b>Omzet 24 Jam:</b> Rp ${revenue24h.toLocaleString("id-ID")} (${approvedTopups.length} transaksi disetujui, ${pendingTopups.length} pending)
• <b>Aktivitas Produksi:</b> ${totalGens24h} generasi konten
• <b>Konsumsi Kredit:</b> ${totalCreditsBurned} kredit terbakar (Top: ${topModule})
• <b>Kepuasan Pengguna:</b> Skor ${avgRating}/5

<b>[REKOMENDASI STRATEGIS EKSEKUTIF]</b>
<i>"${growthAdvice}"</i>`;

  // 5. Deliver to Executive topic or Admin DM
  await sendTelegramMessage(report, {
    messageThreadId: config.topics?.executive,
  });

  return new Response(JSON.stringify({ ok: true, metrics: { totalUsers, newUsersCount, revenue24h, totalGens24h } }), {
    headers: { "Content-Type": "application/json" },
  });
}
