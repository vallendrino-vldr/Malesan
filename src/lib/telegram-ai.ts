import "server-only";
import { generate } from "@/lib/gemini/client";
import { buildSnapshot } from "@/lib/admin/snapshot";
import { createClient, SupabaseClient } from "@supabase/supabase-js";
import { sendTelegramMessage, sendChatAction } from "@/lib/telegram";

function getAdminSupabase(): SupabaseClient {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY!;
  return createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

const MODULE_LABELS: Record<string, string> = {
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

interface AIIntentResult {
  intent: "action" | "chat" | "proposal";
  actionType:
    | "clear_broadcast"
    | "set_broadcast"
    | "stats"
    | "topups"
    | "grant_credits"
    | "ban_user"
    | "unban_user"
    | "create_voucher"
    | "list_vouchers"
    | "inspect_user"
    | "get_errors"
    | "get_feedback"
    | "set_module_cost"
    | "toggle_module"
    | "set_ai_provider"
    | "none";
  payload?: {
    message?: string;
    email?: string;
    amount?: number;
    code?: string;
    credits?: number;
    moduleKey?: string;
    cost?: number;
    enabled?: boolean;
    provider?: string;
    reason?: string;
  };
  replyText: string;
  needsConfirmation: boolean;
}

export async function processTelegramAIMessage(userText: string, chatId: string) {
  const supabase = getAdminSupabase();

  // Send real-time typing indicator to Telegram app
  sendChatAction(chatId, "typing").catch(() => {});

  // 1. Gather comprehensive platform snapshot
  let snapshotContext = "";
  try {
    const snap = await buildSnapshot();
    const topModules = Object.entries(snap.generations.byModule || {})
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([mod, cnt]) => `${MODULE_LABELS[mod] || mod}: ${cnt}x`)
      .join(", ");

    snapshotContext = `Data Platform Realtime:
- Total User: ${snap.users.total} (${snap.users.pro} Pro, ${snap.users.banned} Banned, +${snap.users.newLast7d} dlm 7 hari)
- Topup Pending: ${snap.topups.pending} transaksi
- Revenue 30 Hari: Rp ${snap.topups.revenueLast30dIdr.toLocaleString("id-ID")}
- Generasi Konten 7 Hari: ${snap.generations.last7d} kali (Top: ${topModules || "Belum ada"})`;
  } catch {
    snapshotContext = "Snapshot data tidak tersedia.";
  }

  // 2. Fetch current config & broadcast notice
  let currentConfigSummary = "";
  try {
    const { data: configs } = await supabase.from("app_config").select("key, value");
    const notice = configs?.find((c) => c.key === "dashboard_notice")?.value || "";
    const provider = configs?.find((c) => c.key === "ai_provider")?.value || "gemini";
    const modulesStatus = configs?.find((c) => c.key === "enabled_modules")?.value || {};
    currentConfigSummary = `Status Konfigurasi Saat Ini:
- Banner Notice: "${notice || "(Kosong)"}"
- Provider Utama: ${provider}
- Status Modul Aktif: ${JSON.stringify(modulesStatus)}`;
  } catch {}

  const prompt = `Kamu adalah "Malesan Executive AI" — asisten pribadi Chief of Staff super cerdas, strategis, proaktif, dan setia milik Boss / Owner platform Malesan (aplikasi AI content creation workspace kreator Indonesia).
Boss berbicara santai dalam bahasa Indonesia sehari-hari.

${snapshotContext}
${currentConfigSummary}

TUGAS KAMU:
Analisis pesan dari Boss dan tentukan apakah itu perintah aksi (action/proposal) atau obrolan/konsultasi strategi/marketing (chat).

Daftar Tool / Aksi yang Tersedia:
1. clear_broadcast: menghapus banner pengumuman di dashboard. (needsConfirmation: false)
2. set_broadcast: pasang banner pengumuman (payload: { message: "isi pengumuman" }). (needsConfirmation: false)
3. stats: ringkasan statistik komprehensif, performa, revenue, & top module. (needsConfirmation: false)
4. topups: cek antrean topup manual pending. (needsConfirmation: false)
5. inspect_user: cek detail user tertentu (payload: { email: "user@email.com" }). (needsConfirmation: false)
6. get_errors: cek error log / issue teknis terkini di sistem. (needsConfirmation: false)
7. get_feedback: baca feedback & review dari user. (needsConfirmation: false)
8. list_vouchers: lihat daftar voucher aktif. (needsConfirmation: false)
9. create_voucher: buat voucher baru (payload: { code: "KODE", credits: 50 }). (needsConfirmation: false)
10. unban_user: buka blokir akun user (payload: { email: "user@email.com" }). (needsConfirmation: false)

Aksi Sensitif (Wajib needsConfirmation = true):
11. grant_credits: tambah saldo kredit manual ke user (payload: { email: "user@email.com", amount: 100, reason: "bonus" }). (needsConfirmation: true jika > 50 kredit, false jika <= 50)
12. ban_user: bekukan akun user nakal (payload: { email: "user@email.com", reason: "spam/abuse" }). (needsConfirmation: true)
13. set_module_cost: ubah harga kredit modul (payload: { moduleKey: "hook", cost: 2 }). (needsConfirmation: true)
14. toggle_module: matikan / nyalakan modul tertentu (payload: { moduleKey: "video", enabled: false }). (needsConfirmation: true)
15. set_ai_provider: ganti AI provider utama (payload: { provider: "gemini" / "groq" }). (needsConfirmation: true)
16. none: obrolan bebas, konsultasi ide konten, copy marketing, analisis bisnis, dll. (needsConfirmation: false)

Pesan dari Boss:
"${userText}"

Instruksi Output:
- replyText: Jelaskan jawaban / tindakan dengan gaya eksekutif cerdas, berwawasan tinggi (ala Strategic AI Co-Founder), panggil "Bos", gunakan bahasa Indonesia santai tapi tajam, berbobot, dan proaktif. Gunakan formatting HTML (tebal, miring, list) agar rapi di Telegram.
- Output HANYA JSON sesuai format schema.`;

  const schema = {
    type: "OBJECT",
    properties: {
      intent: { type: "STRING", enum: ["action", "chat", "proposal"] },
      actionType: {
        type: "STRING",
        enum: [
          "clear_broadcast",
          "set_broadcast",
          "stats",
          "topups",
          "inspect_user",
          "get_errors",
          "get_feedback",
          "list_vouchers",
          "create_voucher",
          "grant_credits",
          "ban_user",
          "unban_user",
          "set_module_cost",
          "toggle_module",
          "set_ai_provider",
          "none",
        ],
      },
      payload: {
        type: "OBJECT",
        properties: {
          message: { type: "STRING" },
          email: { type: "STRING" },
          amount: { type: "NUMBER" },
          code: { type: "STRING" },
          credits: { type: "NUMBER" },
          moduleKey: { type: "STRING" },
          cost: { type: "NUMBER" },
          enabled: { type: "BOOLEAN" },
          provider: { type: "STRING" },
          reason: { type: "STRING" },
        },
      },
      replyText: { type: "STRING" },
      needsConfirmation: { type: "BOOLEAN" },
    },
    required: ["intent", "actionType", "replyText", "needsConfirmation"],
  };

  try {
    const rawRes = await generate({
      prompt,
      tier: "free",
      schema,
    });

    const parsed = JSON.parse(rawRes) as AIIntentResult;

    // A. Handle Sensitive Actions with Interactive Proposal Confirmation
    if (parsed.needsConfirmation && parsed.actionType !== "none") {
      const actionId = "act_" + Math.random().toString(36).substring(2, 10);

      await supabase.from("app_config").upsert({
        key: `tele_act:${actionId}`,
        value: JSON.stringify({
          actionType: parsed.actionType,
          payload: parsed.payload,
          createdAt: Date.now(),
        }),
        updated_at: new Date().toISOString(),
      });

      const confirmText = `🤖 <b>PROPOSAL KONFIRMASI TINDAKAN</b>\n\n${parsed.replyText}\n\n⚠️ <b>Tindakan:</b> <code>${parsed.actionType}</code>\n📋 <b>Parameter:</b>\n<code>${JSON.stringify(parsed.payload || {}, null, 2)}</code>\n\n<i>Apakah lo setuju untuk mengeksekusi tindakan ini sekarang, Bos?</i>`;

      const inlineKeyboard = {
        inline_keyboard: [
          [
            { text: "✅ Ya, Eksekusi Sekarang", callback_data: `exec_action:${actionId}` },
            { text: "❌ Batalkan", callback_data: `cancel_action:${actionId}` },
          ],
        ],
      };

      await sendTelegramMessage(confirmText, { chatId, replyMarkup: inlineKeyboard });
      return;
    }

    // B. Direct Execution of Safe / Read Operations
    switch (parsed.actionType) {
      case "inspect_user": {
        const email = String(parsed.payload?.email || "").trim().toLowerCase();
        if (!email) {
          await sendTelegramMessage("⚠️ Mohon sebutkan email user yang ingin dicek.", { chatId });
          return;
        }

        const { data: user } = await supabase
          .from("profiles")
          .select("id, email, is_pro, is_banned, created_at, full_name")
          .eq("email", email)
          .maybeSingle();

        if (!user) {
          await sendTelegramMessage(`❌ User <code>${escapeHtml(email)}</code> tidak ditemukan di database.`, { chatId });
          return;
        }

        const { data: credits } = await supabase
          .from("credits")
          .select("free_balance, paid_balance, bonus_balance")
          .eq("user_id", user.id)
          .maybeSingle();

        const { count: genCount } = await supabase
          .from("generations")
          .select("id", { count: "exact", head: true })
          .eq("user_id", user.id);

        const joined = new Date(user.created_at).toLocaleDateString("id-ID", { dateStyle: "medium" });

        const userCard = `👤 <b>DETAIL PENGGUNA</b>\n\n📧 <b>Email:</b> <code>${escapeHtml(user.email)}</code>\n🏷 <b>Nama:</b> ${escapeHtml(user.full_name || "Tanpa Nama")}\n💎 <b>Paket:</b> ${user.is_pro ? "⭐ <b>PRO</b>" : "Free Tier"}\n💰 <b>Kredit:</b> ${(credits?.free_balance || 0) + (credits?.paid_balance || 0) + (credits?.bonus_balance || 0)} (Free: ${credits?.free_balance || 0}, Paid: ${credits?.paid_balance || 0})\n⚡ <b>Generasi Konten:</b> ${genCount || 0} kali\n📅 <b>Terdaftar:</b> ${joined}\n🛡 <b>Status:</b> ${user.is_banned ? "🚫 <b>BANNED</b>" : "🟢 <b>Aktif</b>"}`;

        await sendTelegramMessage(userCard, { chatId });
        return;
      }

      case "get_errors": {
        const { data: errs } = await supabase
          .from("error_logs")
          .select("error_message, module_name, created_at")
          .order("created_at", { ascending: false })
          .limit(5);

        if (!errs || errs.length === 0) {
          await sendTelegramMessage("✅ <b>Semua Sistem Sehat!</b> Tidak ada error tercatat dalam riwayat.", { chatId });
          return;
        }

        const errList = errs
          .map(
            (e, i) =>
              `<b>${i + 1}. [${escapeHtml(e.module_name || "Sistem")}]</b>\n<i>${escapeHtml(String(e.error_message).slice(0, 120))}</i>`,
          )
          .join("\n\n");

        await sendTelegramMessage(`⚠️ <b>LOG ERROR TERAKHIR:</b>\n\n${errList}`, { chatId });
        return;
      }

      case "get_feedback": {
        const { data: fbs } = await supabase
          .from("feedback")
          .select("rating, comment, module_name, created_at, profiles(email)")
          .order("created_at", { ascending: false })
          .limit(5);

        if (!fbs || fbs.length === 0) {
          await sendTelegramMessage("💌 Belum ada feedback baru yang masuk.", { chatId });
          return;
        }

        const fbList = (fbs as Array<{ rating: number; comment?: string; module_name?: string; profiles?: { email?: string } | { email?: string }[] }>)
          .map((f, i) => {
            const email = Array.isArray(f.profiles) ? f.profiles[0]?.email : f.profiles?.email || "User";
            const stars = "⭐".repeat(Math.max(1, Math.min(5, f.rating)));
            return `<b>${i + 1}. ${stars} (${f.rating}/5)</b> - ${escapeHtml(email)}\n🛠 <i>${escapeHtml(f.module_name || "Umum")}</i>: "${escapeHtml(f.comment || "Tanpa komentar")}"`;
          })
          .join("\n\n");

        await sendTelegramMessage(`💌 <b>FEEDBACK PENGGUNA TERBARU:</b>\n\n${fbList}`, { chatId });
        return;
      }

      case "list_vouchers": {
        const { data: vchs } = await supabase
          .from("vouchers")
          .select("code, credits, is_redeemed, created_at")
          .eq("is_redeemed", false)
          .order("created_at", { ascending: false })
          .limit(10);

        if (!vchs || vchs.length === 0) {
          await sendTelegramMessage("🎟 Tidak ada voucher aktif yang belum terpakai saat ini.", { chatId });
          return;
        }

        const vchList = vchs
          .map((v) => `• <code>${escapeHtml(v.code)}</code> — <b>+${v.credits} Kredit</b>`)
          .join("\n");

        await sendTelegramMessage(`🎟 <b>DAFTAR VOUCHER AKTIF (BELUM TERPAKAI):</b>\n\n${vchList}`, { chatId });
        return;
      }

      case "clear_broadcast": {
        await supabase.from("app_config").upsert({
          key: "dashboard_notice",
          value: "",
          updated_at: new Date().toISOString(),
        });
        await sendTelegramMessage(`🧹 <b>${parsed.replyText}</b>\n\nBanner pengumuman di web sekarang sudah bersih total.`, { chatId });
        return;
      }

      case "set_broadcast": {
        const msg = parsed.payload?.message || userText;
        await supabase.from("app_config").upsert({
          key: "dashboard_notice",
          value: msg,
          updated_at: new Date().toISOString(),
        });
        await sendTelegramMessage(`📢 <b>${parsed.replyText}</b>\n\nPesan berikut sekarang live di dashboard:\n<i>"${escapeHtml(msg)}"</i>`, { chatId });
        return;
      }

      case "create_voucher": {
        const code = (parsed.payload?.code || "PROMO" + Math.floor(Math.random() * 1000)).toUpperCase().trim();
        const credits = parsed.payload?.credits || 50;
        await supabase.from("vouchers").insert({
          code,
          credits,
          is_redeemed: false,
          created_at: new Date().toISOString(),
        });
        await sendTelegramMessage(
          `🎟 <b>${parsed.replyText}</b>\n\n🔑 <b>Kode Voucher:</b> <code>${code}</code>\n💎 <b>Hadiah:</b> +${credits} Kredit\n\n<i>Tinggal salin kodenya dan bagikan!</i>`,
          { chatId },
        );
        return;
      }

      case "unban_user": {
        const email = String(parsed.payload?.email || "").trim().toLowerCase();
        if (email) {
          await supabase.from("profiles").update({ is_banned: false }).eq("email", email);
        }
        await sendTelegramMessage(`🔓 <b>${parsed.replyText}</b>`, { chatId });
        return;
      }

      case "stats":
      case "topups":
      case "none":
      default: {
        await sendTelegramMessage(parsed.replyText, { chatId });
        return;
      }
    }
  } catch (err) {
    console.error("[telegram-ai] error:", err);
    await sendTelegramMessage(
      `Halo Bos! Pesan diterima: "${escapeHtml(userText)}".\nKetik /help atau coba beri instruksi yang lebih rinci ya!`,
      { chatId },
    );
  }
}

export async function executePendingTelegramAction(actionId: string, supabase: SupabaseClient): Promise<string> {
  const { data: row } = await supabase
    .from("app_config")
    .select("value")
    .eq("key", `tele_act:${actionId}`)
    .maybeSingle();

  if (!row || !row.value) {
    return "⚠️ Tindakan ini sudah kedaluwarsa atau sudah pernah dieksekusi sebelumnya.";
  }

  let actionData: { actionType: string; payload?: Record<string, unknown>; createdAt: number };
  try {
    actionData = typeof row.value === "string" ? JSON.parse(row.value) : row.value;
  } catch {
    return "❌ Gagal membaca tiket tindakan.";
  }

  await supabase.from("app_config").delete().eq("key", `tele_act:${actionId}`);

  switch (actionData.actionType) {
    case "grant_credits": {
      const email = String(actionData.payload?.email || "").trim().toLowerCase();
      const amount = Number(actionData.payload?.amount || 0);
      const reason = String(actionData.payload?.reason || "telegram_admin_bonus");
      if (!email || !amount) return "❌ Data email atau nominal kredit tidak valid.";

      const { data: user } = await supabase.from("profiles").select("id").eq("email", email).maybeSingle();
      if (!user) return `❌ User dengan email <code>${escapeHtml(email)}</code> tidak ditemukan.`;

      const { error: grantErr } = await supabase.rpc("grant_credits", {
        p_user: user.id,
        p_amount: amount,
        p_bucket: "paid",
        p_reason: reason,
      });

      if (grantErr) return `❌ Gagal menambahkan kredit: ${grantErr.message}`;
      return `✅ <b>BERHASIL DITAMBAHKAN!</b>\n\n+${amount} Kredit paid telah masuk ke akun <code>${escapeHtml(email)}</code>.`;
    }

    case "ban_user": {
      const email = String(actionData.payload?.email || "").trim().toLowerCase();
      if (!email) return "❌ Email tidak valid.";
      await supabase.from("profiles").update({ is_banned: true }).eq("email", email);
      return `🚫 <b>AKUN DIBEKUKAN!</b>\n\nUser <code>${escapeHtml(email)}</code> telah dibanned dari platform.`;
    }

    case "set_module_cost": {
      const moduleKey = String(actionData.payload?.moduleKey || "").trim();
      const cost = Number(actionData.payload?.cost || 0);
      if (!moduleKey || cost < 0) return "❌ Modul atau biaya tidak valid.";

      await supabase.from("app_config").upsert({
        key: `credit_cost_${moduleKey}`,
        value: cost,
        updated_at: new Date().toISOString(),
      });
      return `✅ <b>HARGA MODUL BERHASIL DIUBAH!</b>\n\nModul <b>${MODULE_LABELS[moduleKey] || moduleKey}</b> sekarang bertarif <b>${cost} Kredit</b>.`;
    }

    case "toggle_module": {
      const moduleKey = String(actionData.payload?.moduleKey || "").trim();
      const enabled = Boolean(actionData.payload?.enabled);

      const { data: existing } = await supabase.from("app_config").select("value").eq("key", "enabled_modules").maybeSingle();
      const currentModules = (existing?.value && typeof existing.value === "object" ? existing.value : {}) as Record<string, boolean>;
      currentModules[moduleKey] = enabled;

      await supabase.from("app_config").upsert({
        key: "enabled_modules",
        value: currentModules,
        updated_at: new Date().toISOString(),
      });

      const statusText = enabled ? "🟢 <b>DIAKTIFKAN</b>" : "🔴 <b>DINONAKTIFKAN (KILL SWITCH)</b>";
      return `⚙️ <b>STATUS MODUL DIPERBARUI!</b>\n\nModul <b>${MODULE_LABELS[moduleKey] || moduleKey}</b> telah ${statusText}.`;
    }

    case "set_ai_provider": {
      const provider = String(actionData.payload?.provider || "").trim().toLowerCase();
      if (!provider) return "❌ Provider tidak valid.";

      await supabase.from("app_config").upsert({
        key: "ai_provider",
        value: provider,
        updated_at: new Date().toISOString(),
      });
      return `🔄 <b>AI PROVIDER DIGANTI!</b>\n\nProvider AI utama Malesan sekarang beralih ke <b>${provider.toUpperCase()}</b>.`;
    }

    default:
      return "✅ Tindakan berhasil dieksekusi.";
  }
}

function escapeHtml(str?: string | null): string {
  return String(str || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}
