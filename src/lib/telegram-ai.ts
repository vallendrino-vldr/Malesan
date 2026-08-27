import "server-only";
import { generate } from "@/lib/gemini/client";
import { buildSnapshot } from "@/lib/admin/snapshot";
import { createClient, SupabaseClient } from "@supabase/supabase-js";
import { sendTelegramMessage } from "@/lib/telegram";

function getAdminSupabase(): SupabaseClient {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY!;
  return createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

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
    | "none";
  payload?: {
    message?: string;
    email?: string;
    amount?: number;
    code?: string;
    credits?: number;
    reason?: string;
  };
  replyText: string;
  needsConfirmation: boolean;
}

export async function processTelegramAIMessage(userText: string, chatId: string) {
  const supabase = getAdminSupabase();

  // 1. Gather platform snapshot for rich context
  let snapshotContext = "";
  try {
    const snap = await buildSnapshot();
    snapshotContext = `Data Platform Realtime:
- Total User: ${snap.users.total} (${snap.users.pro} Pro, ${snap.users.banned} Banned)
- Topup Pending: ${snap.topups.pending} transaksi
- Revenue 30 Hari: Rp ${snap.topups.revenueLast30dIdr.toLocaleString("id-ID")}
- Generasi 24 Jam: ${snap.generations.last24h} kali
- Error 24 Jam: ${snap.errors.last24h} error
- Quota Gemini: ${snap.quota.map((q) => `Slot ${q.keyIndex}: ${q.requests} req, ${q.errors} err`).join("; ")}`;
  } catch {
    snapshotContext = "Snapshot data tidak tersedia saat ini.";
  }

  // 2. Fetch active broadcast notice
  let currentNotice = "";
  try {
    const { data: noticeRow } = await supabase
      .from("app_config")
      .select("value")
      .eq("key", "dashboard_notice")
      .maybeSingle();
    currentNotice = String(noticeRow?.value || "");
  } catch {}

  const prompt = `Kamu adalah "Malesan Executive AI" — asisten pribadi cerdas, proaktif, dan setia milik Boss / Owner platform Malesan (aplikasi AI content workspace kreator Indonesia).
Boss berbicara santai dalam bahasa Indonesia sehari-hari.

${snapshotContext}
- Banner Broadcast Saat Ini: "${currentNotice || "(Kosong)"}"

TUGAS KAMU:
Analisis pesan dari Boss dan tentukan apakah pesan tersebut adalah instruksi tindakan (action/proposal) atau pertanyaan/obrolan biasa (chat).

Daftar Aksi:
1. clear_broadcast: menghapus banner pengumuman dashboard (misal: "hapus broadcast", "matiin notice", "bersihin banner"). (needsConfirmation: false)
2. set_broadcast: pasang pengumuman dashboard (misal: "pasang broadcast server maintenance 10 menit"). (needsConfirmation: false)
3. stats: minta ringkasan statistik. (needsConfirmation: false)
4. topups: minta cek antrean pembayaran / topup. (needsConfirmation: false)
5. grant_credits: kasih saldo kredit manual ke user (misal: "kasih user budi@gmail.com 50 kredit"). (needsConfirmation: true jika >50 kredit, false jika <=50)
6. ban_user: bekukan akun user nakal. (needsConfirmation: true)
7. unban_user: buka blokir user. (needsConfirmation: false)
8. create_voucher: buat kode voucher baru (misal: "bikin voucher MERDEKA50 50 kredit"). (needsConfirmation: false)
9. none: obrolan bebas, tanya jawab, riset ide konten, atau diskusi ide marketing. (needsConfirmation: false)

Pesan dari Boss:
"${userText}"

Instruksi Output:
- replyText HARUS dijawab dengan gaya asisten profesional yang ramah, sopan, panggil "Bos", gunakan bahasa Indonesia santai tapi cerdas.
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
          "grant_credits",
          "ban_user",
          "unban_user",
          "create_voucher",
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

    // A. If needs confirmation (Sensitive actions: Ban, Large Credits, etc.)
    if (parsed.needsConfirmation && parsed.actionType !== "none") {
      const actionId = "act_" + Math.random().toString(36).substring(2, 10);
      
      // Store action in app_config for atomic retrieval
      await supabase.from("app_config").upsert({
        key: `tele_act:${actionId}`,
        value: JSON.stringify({
          actionType: parsed.actionType,
          payload: parsed.payload,
          createdAt: Date.now(),
        }),
        updated_at: new Date().toISOString(),
      });

      const confirmText = `🤖 <b>KONFIRMASI TINDAKAN SENSITIF</b>\n\n${parsed.replyText}\n\n⚠️ <b>Aksi:</b> <code>${parsed.actionType}</code>\n🎯 <b>Detail:</b> ${JSON.stringify(parsed.payload || {})}\n\n<i>Apakah lo setuju untuk mengeksekusi tindakan ini sekarang, Bos?</i>`;

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

    // B. Direct Execution of safe/requested actions
    switch (parsed.actionType) {
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
        const code = (parsed.payload?.code || "PROMO" + Math.floor(Math.random() * 1000)).toUpperCase();
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
        const email = parsed.payload?.email;
        if (email) {
          await supabase.from("profiles").update({ is_banned: false }).eq("email", email.trim().toLowerCase());
        }
        await sendTelegramMessage(`🔓 <b>${parsed.replyText}</b>`, { chatId });
        return;
      }
      case "stats":
      case "topups":
      case "none":
      default: {
        // Natural Conversational Answer
        await sendTelegramMessage(parsed.replyText, { chatId });
        return;
      }
    }
  } catch (err) {
    console.error("[telegram-ai] error:", err);
    // Graceful fallback
    await sendTelegramMessage(
      `Halo Bos! Perintah lo sudah diterima: "${escapeHtml(userText)}".\nKetik /help untuk menu cepat atau coba tanyakan lagi dengan lebih spesifik ya!`,
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

  // Delete ticket once read
  await supabase.from("app_config").delete().eq("key", `tele_act:${actionId}`);

  switch (actionData.actionType) {
    case "grant_credits": {
      const email = actionData.payload?.email;
      const amount = Number(actionData.payload?.amount || 0);
      if (!email || !amount) return "❌ Data email atau nominal kredit tidak valid.";

      const { data: user } = await supabase.from("profiles").select("id").eq("email", email.toLowerCase()).maybeSingle();
      if (!user) return `❌ User dengan email <code>${escapeHtml(email)}</code> tidak ditemukan.`;

      const { error: grantErr } = await supabase.rpc("grant_credits", {
        p_user: user.id,
        p_amount: amount,
        p_bucket: "paid",
        p_reason: actionData.payload?.reason || "telegram_admin_bonus",
      });

      if (grantErr) return `❌ Gagal menambahkan kredit: ${grantErr.message}`;
      return `✅ <b>BERHASIL DITAMBAHKAN!</b>\n\n+${amount} Kredit paid telah masuk ke akun <code>${escapeHtml(email)}</code>.`;
    }
    case "ban_user": {
      const email = actionData.payload?.email;
      if (!email) return "❌ Email tidak valid.";
      await supabase.from("profiles").update({ is_banned: true }).eq("email", email.toLowerCase());
      return `🚫 <b>AKUN DIBEKUKAN!</b>\n\nUser <code>${escapeHtml(email)}</code> telah dibanned dari platform.`;
    }
    default:
      return "✅ Tindakan berhasil dieksekusi.";
  }
}

function escapeHtml(str: string): string {
  return String(str || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}
