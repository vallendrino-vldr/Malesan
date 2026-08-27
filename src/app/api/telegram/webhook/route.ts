import { NextRequest } from "next/server";
import { createClient, SupabaseClient } from "@supabase/supabase-js";
import { sendTelegramMessage, sendChatAction, getTelegramConfig } from "@/lib/telegram";
import { processTelegramAIMessage, executePendingTelegramAction } from "@/lib/telegram-ai";

export const runtime = "nodejs";
export const maxDuration = 30;

// Service role client for secure admin database actions
function getAdminSupabase(): SupabaseClient {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY!;
  return createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

interface TelegramUser {
  id: number;
  first_name?: string;
  username?: string;
}

interface TelegramMessage {
  message_id: number;
  from?: TelegramUser;
  text?: string;
}

interface TelegramCallbackQuery {
  id: string;
  from: TelegramUser;
  data?: string;
  message?: TelegramMessage;
}

interface TelegramUpdate {
  update_id: number;
  message?: TelegramMessage;
  callback_query?: TelegramCallbackQuery;
}

export async function POST(request: NextRequest) {
  const config = await getTelegramConfig();
  const adminChatId = config.chatId || process.env.TELEGRAM_ADMIN_CHAT_ID;
  const webhookSecret = process.env.TELEGRAM_WEBHOOK_SECRET || "malesan_tele_sec_7a8f9c2d1b0e3f4a9821";

  // 1. Verify Secret Header if present
  const secretHeader = request.headers.get("x-telegram-bot-api-secret-token");
  if (secretHeader && secretHeader !== webhookSecret) {
    console.warn("[telegram-webhook] unauthorized secret token attempt");
    return new Response("Unauthorized", { status: 401 });
  }

  let body: TelegramUpdate;
  try {
    body = (await request.json()) as TelegramUpdate;
  } catch {
    return new Response("Bad Request", { status: 400 });
  }

  const supabase = getAdminSupabase();

  // 2. Handle Inline Keyboard Button Callbacks
  if (body.callback_query) {
    const cb = body.callback_query;
    const fromId = String(cb.from?.id);
    const data = String(cb.data || "");
    const callbackQueryId = cb.id;

    // Answer callback query so Telegram spinner stops
    await answerCallbackQuery(callbackQueryId);

    // Whitelist check
    if (fromId !== adminChatId) {
      await sendTelegramMessage("⛔ <i>Akses ditolak. Lo bukan admin Malesan.</i>", { chatId: fromId });
      return json({ ok: true });
    }

    if (data.startsWith("approve_topup:")) {
      const topupId = data.replace("approve_topup:", "");
      await handleApproveTopup(topupId, supabase);
    } else if (data.startsWith("reject_topup:")) {
      const topupId = data.replace("reject_topup:", "");
      await handleRejectTopup(topupId, supabase);
    } else if (data.startsWith("exec_action:")) {
      const actionId = data.replace("exec_action:", "");
      const resMsg = await executePendingTelegramAction(actionId, supabase);
      await sendTelegramMessage(resMsg, { chatId: fromId });
    } else if (data.startsWith("cancel_action:")) {
      const actionId = data.replace("cancel_action:", "");
      await supabase.from("app_config").delete().eq("key", `tele_act:${actionId}`);
      await sendTelegramMessage("❌ <b>Tindakan telah dibatalkan oleh Bos.</b>", { chatId: fromId });
    } else if (data === "action:stats") {
      await handleStatsCommand(fromId, supabase);
    } else if (data === "action:topups") {
      await handleListPendingTopups(fromId, supabase);
    }

    return json({ ok: true });
  }

  // 3. Handle Text Messages & Slash Commands
  const message = body.message;
  if (!message || !message.text) {
    return json({ ok: true });
  }

  const fromId = String(message.from?.id);
  const text = message.text.trim();

  // Whitelist verification: ONLY respond to the owner
  if (fromId !== adminChatId) {
    console.warn(`[telegram-webhook] unauthorized user access attempt: ${fromId}`);
    await sendTelegramMessage("⛔ <i>Akses Ditolak. Bot ini khusus owner @malesan_my_id.</i>", { chatId: fromId });
    return json({ ok: true });
  }

  // Trigger real-time "typing..." indicator in Telegram app header
  sendChatAction(fromId, "typing").catch(() => {});

  // If text starts with a known slash command, handle quickly:
  if (text.startsWith("/")) {
    const [cmd, ...args] = text.split(/\s+/);
    switch (cmd.toLowerCase()) {
      case "/start":
      case "/help":
      case "/menu": {
        await handleMenuCommand(fromId);
        return json({ ok: true });
      }
      case "/stats": {
        await handleStatsCommand(fromId, supabase);
        return json({ ok: true });
      }
      case "/topups": {
        await handleListPendingTopups(fromId, supabase);
        return json({ ok: true });
      }
      case "/voucher": {
        await handleCreateVoucher(fromId, args, supabase);
        return json({ ok: true });
      }
      case "/broadcast": {
        await handleBroadcastCommand(fromId, args.join(" "), supabase);
        return json({ ok: true });
      }
      case "/clearnotice": {
        await handleClearNoticeCommand(fromId, supabase);
        return json({ ok: true });
      }
      case "/ban": {
        await handleBanUser(fromId, args[0], true, supabase);
        return json({ ok: true });
      }
      case "/unban": {
        await handleBanUser(fromId, args[0], false, supabase);
        return json({ ok: true });
      }
    }
  }

  // 4. Autonomous Conversational AI Brain: Handles any natural language chat / orders!
  await processTelegramAIMessage(text, fromId);

  return json({ ok: true });
}

// -------------------------------------------------------------
// Command Handlers
// -------------------------------------------------------------

async function handleMenuCommand(chatId: string) {
  const menuText = `🎛 <b>MALESAN MISSION CONTROL & AI BRAIN</b> 🚀\n
Halo Bos! Bot ini sekarang dilengkapi <b>Autonomous AI Brain</b>. Lo bisa chat bebas bahasa Indonesia apa aja (gak perlu pakai garis miring / slash lagi):

💬 <b>Contoh Obrolan Bebas:</b>
• <i>"Hapus broadcast sekarang"</i>
• <i>"Pasang banner: Diskon 50% sampai besok malam"</i>
• <i>"Ada komplain apa hari ini?"</i>
• <i>"Berapa total user yang aktif hari ini?"</i>
• <i>"Kasih 50 kredit buat user budi@gmail.com"</i>
• <i>"Bikinin ide konten viral buat promo Malesan"</i>

<i>Atau klik menu cepat di bawah ini:</i>`;

  const inlineKeyboard = {
    inline_keyboard: [
      [
        { text: "📊 Cek Statistik", callback_data: "action:stats" },
        { text: "💳 Antrean Topup", callback_data: "action:topups" },
      ],
      [
        { text: "🌐 Buka Malesan.my.id", url: "https://malesan.my.id/app" },
        { text: "👑 Admin Panel", url: "https://malesan.my.id/admin" },
      ],
    ],
  };

  await sendTelegramMessage(menuText, { chatId, replyMarkup: inlineKeyboard });
}

async function handleStatsCommand(chatId: string, supabase: SupabaseClient) {
  try {
    const { count: totalUsers } = await supabase
      .from("profiles")
      .select("id", { count: "exact", head: true });

    const startOfDay = new Date();
    startOfDay.setHours(0, 0, 0, 0);

    const { count: gensToday } = await supabase
      .from("generations")
      .select("id", { count: "exact", head: true })
      .gte("created_at", startOfDay.toISOString());

    const { count: pendingTopups } = await supabase
      .from("topups")
      .select("id", { count: "exact", head: true })
      .eq("status", "pending");

    const { data: todayTopups } = await supabase
      .from("topups")
      .select("amount_idr")
      .eq("status", "approved")
      .gte("created_at", startOfDay.toISOString());

    const totalRevenueToday = (todayTopups || []).reduce((acc: number, t: { amount_idr?: number }) => acc + (t.amount_idr || 0), 0);

    const now = new Date().toLocaleString("id-ID", { timeZone: "Asia/Jakarta" });

    const statsText = `📊 <b>RINGKASAN STATISTIK MALESAN</b>
⏰ <i>Update: ${now} WIB</i>

👥 <b>Total Pengguna:</b> <b>${totalUsers || 0} Akun</b>
⚡ <b>Generasi Konten Hari Ini:</b> <b>${gensToday || 0} Kali</b>
💳 <b>Topup Pending:</b> <b>${pendingTopups || 0} Transaksi</b>
💰 <b>Pemasukan Hari Ini:</b> <b>Rp ${totalRevenueToday.toLocaleString("id-ID")}</b>

🛡 <b>Server Health:</b> 🟢 <b>Normal / Optimal</b>`;

    const inlineKeyboard = {
      inline_keyboard: [
        [
          { text: "🔄 Refresh Stats", callback_data: "action:stats" },
          { text: "💳 Cek Topup", callback_data: "action:topups" },
        ],
      ],
    };

    await sendTelegramMessage(statsText, { chatId, replyMarkup: inlineKeyboard });
  } catch (err) {
    console.error("[telegram-stats] failed:", err);
    await sendTelegramMessage("❌ Gagal mengambil data statistik database.", { chatId });
  }
}

async function handleListPendingTopups(chatId: string, supabase: SupabaseClient) {
  try {
    const { data: pending } = await supabase
      .from("topups")
      .select("id, user_id, amount_idr, credits, proof_url, created_at, profiles(email)")
      .eq("status", "pending")
      .order("created_at", { ascending: false })
      .limit(5);

    if (!pending || pending.length === 0) {
      await sendTelegramMessage("✅ <b>Semua Bersih!</b> Tidak ada antrean topup pending saat ini.", { chatId });
      return;
    }

    for (const item of pending as Array<{ id: string; user_id: string; amount_idr?: number; credits: number; profiles?: { email?: string } | { email?: string }[] }>) {
      const email = Array.isArray(item.profiles) ? item.profiles[0]?.email : item.profiles?.email || item.user_id;
      const formattedRp = Number(item.amount_idr || 0).toLocaleString("id-ID");
      const caption = `💳 <b>ANTREAN TOPUP PENDING</b>\n\n👤 <b>User:</b> <code>${escapeHtml(email || "User")}</code>\n💵 <b>Nominal:</b> Rp ${formattedRp}\n💎 <b>Paket:</b> ${item.credits} Kredit\n🧾 <b>ID:</b> <code>${item.id}</code>`;

      const inlineKeyboard = {
        inline_keyboard: [
          [
            { text: "✅ Setujui", callback_data: `approve_topup:${item.id}` },
            { text: "❌ Tolak", callback_data: `reject_topup:${item.id}` },
          ],
        ],
      };

      await sendTelegramMessage(caption, { chatId, replyMarkup: inlineKeyboard });
    }
  } catch (err) {
    console.error("[telegram-topups] failed:", err);
    await sendTelegramMessage("❌ Gagal mengambil antrean topup.", { chatId });
  }
}

async function handleApproveTopup(topupId: string, supabase: SupabaseClient) {
  try {
    const { data: topup, error: fetchErr } = await supabase
      .from("topups")
      .select("id, user_id, credits, amount_idr, status, profiles(email)")
      .eq("id", topupId)
      .single();

    if (fetchErr || !topup) {
      await sendTelegramMessage(`❌ Topup ID <code>${topupId}</code> tidak ditemukan.`);
      return;
    }

    if (topup.status !== "pending") {
      await sendTelegramMessage(`ℹ️ Topup ini sudah berstatus: <b>${String(topup.status).toUpperCase()}</b>.`);
      return;
    }

    // 1. Grant credits first atomically via database function
    const { error: grantErr } = await supabase.rpc("grant_credits", {
      p_user: topup.user_id,
      p_amount: topup.credits,
      p_bucket: "paid",
      p_reason: `telegram_topup_${topupId}`,
    });

    if (grantErr) {
      console.error("[telegram-approve] grant_credits RPC failed:", grantErr);
      await sendTelegramMessage(`❌ Gagal menambahkan kredit ke database: ${grantErr.message}`);
      return;
    }

    // 2. Update status to approved
    await supabase.from("topups").update({
      status: "approved",
      reviewed_at: new Date().toISOString(),
    }).eq("id", topupId);

    const userEmail = (topup.profiles as { email?: string } | null)?.email || topup.user_id;
    const confirmationText = `✅ <b>TOPUP BERHASIL DISETUJUI!</b>\n\n👤 <b>User:</b> <code>${escapeHtml(userEmail)}</code>\n💎 <b>Kredit Ditambahkan:</b> +${topup.credits} Kredit\n💵 <b>Nominal:</b> Rp ${Number(topup.amount_idr || 0).toLocaleString("id-ID")}`;

    await sendTelegramMessage(confirmationText);
  } catch (err) {
    console.error("[telegram-approve] error:", err);
    await sendTelegramMessage(`❌ Gagal menyetujui topup: ${String(err)}`);
  }
}

async function handleRejectTopup(topupId: string, supabase: SupabaseClient) {
  try {
    await supabase.from("topups").update({ status: "rejected", reviewed_at: new Date().toISOString() }).eq("id", topupId);
    await sendTelegramMessage(`❌ <b>TOPUP DITOLAK</b>\nID: <code>${topupId}</code> telah ditandai ditolak.`);
  } catch (err) {
    console.error("[telegram-reject] error:", err);
    await sendTelegramMessage(`❌ Gagal menolak topup: ${String(err)}`);
  }
}

async function handleCreateVoucher(chatId: string, args: string[], supabase: SupabaseClient) {
  if (args.length < 2) {
    await sendTelegramMessage(
      `⚠️ <b>Format Salah!</b>\n\nKetik: <code>/voucher KODE JUMLAH_KREDIT [MAX_CLAIM]</code>\n<i>Contoh: /voucher PROMO50 50 10</i>`,
      { chatId },
    );
    return;
  }

  const code = args[0].toUpperCase().trim();
  const credits = parseInt(args[1], 10);

  if (isNaN(credits) || credits <= 0) {
    await sendTelegramMessage("⚠️ Jumlah kredit harus berupa angka positif!", { chatId });
    return;
  }

  try {
    const { error } = await supabase.from("vouchers").insert({
      code,
      credits,
      is_redeemed: false,
      created_at: new Date().toISOString(),
    });

    if (error) {
      await sendTelegramMessage(`❌ Gagal membuat voucher: ${error.message}`, { chatId });
      return;
    }

    const successText = `🎟 <b>VOUCHER BERHASIL DIBUAT!</b>\n\n🔑 <b>Kode:</b> <code>${code}</code>\n💎 <b>Hadiah:</b> <b>+${credits} Kredit</b>\n\n<i>Tinggal salin kode di atas dan bagikan ke user!</i>`;

    await sendTelegramMessage(successText, { chatId });
  } catch (err) {
    console.error("[telegram-voucher] error:", err);
    await sendTelegramMessage("❌ Terjadi kesalahan saat menyimpan voucher.", { chatId });
  }
}

async function handleBroadcastCommand(chatId: string, message: string, supabase: SupabaseClient) {
  if (!message.trim()) {
    await sendTelegramMessage(
      `⚠️ <b>Format Salah!</b>\n\nKetik: <code>/broadcast Pesan pengumuman disini</code>\n<i>Contoh: /broadcast Halo kreator, server sedang maintenance 10 menit ya!</i>`,
      { chatId },
    );
    return;
  }

  try {
    await supabase.from("app_config").upsert({
      key: "dashboard_notice",
      value: message.trim(),
      updated_at: new Date().toISOString(),
    });

    await sendTelegramMessage(
      `📢 <b>PENGUMUMAN BERHASIL DIPASANG!</b>\n\nPesan berikut sekarang tampil di dashboard seluruh user:\n<i>"${escapeHtml(message.trim())}"</i>\n\nKetik /clearnotice untuk menghapus.`,
      { chatId },
    );
  } catch (err) {
    console.error("[telegram-broadcast] error:", err);
    await sendTelegramMessage("❌ Gagal memasang broadcast.", { chatId });
  }
}

async function handleClearNoticeCommand(chatId: string, supabase: SupabaseClient) {
  try {
    await supabase.from("app_config").upsert({
      key: "dashboard_notice",
      value: "",
      updated_at: new Date().toISOString(),
    });

    await sendTelegramMessage("🧹 <b>Banner pengumuman berhasil dihapus dari dashboard.</b>", { chatId });
  } catch (err) {
    console.error("[telegram-clearnotice] error:", err);
    await sendTelegramMessage("❌ Gagal menghapus notice.", { chatId });
  }
}

async function handleBanUser(chatId: string, email: string, isBanned: boolean, supabase: SupabaseClient) {
  if (!email || !email.includes("@")) {
    await sendTelegramMessage(
      `⚠️ <b>Format Salah!</b>\n\nKetik: <code>${isBanned ? "/ban" : "/unban"} user@email.com</code>`,
      { chatId },
    );
    return;
  }

  try {
    const { data: user, error: findErr } = await supabase
      .from("profiles")
      .select("id, email")
      .eq("email", email.trim().toLowerCase())
      .single();

    if (findErr || !user) {
      await sendTelegramMessage(`❌ User dengan email <code>${escapeHtml(email)}</code> tidak ditemukan.`, { chatId });
      return;
    }

    await supabase.from("profiles").update({ is_banned: isBanned }).eq("id", user.id);

    const actionText = isBanned ? "🚫 <b>AKUN DIBEKUKAN (BANNED)!</b>" : "🔓 <b>AKUN DIBUKA KEMBALI (UNBANNED)!</b>";
    await sendTelegramMessage(
      `${actionText}\n\n👤 <b>User:</b> <code>${escapeHtml(email)}</code>\nStatus telah diperbarui di database.`,
      { chatId },
    );
  } catch (err) {
    console.error("[telegram-ban] error:", err);
    await sendTelegramMessage("❌ Gagal memperbarui status user.", { chatId });
  }
}

async function answerCallbackQuery(callbackQueryId: string) {
  const config = await getTelegramConfig();
  const token = config.token || process.env.TELEGRAM_BOT_TOKEN;
  if (!token) return;
  try {
    await fetch(`https://api.telegram.org/bot${token}/answerCallbackQuery`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ callback_query_id: callbackQueryId }),
    });
  } catch {
    // Ignore callback ack failure
  }
}

function json(body: unknown) {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
}

function escapeHtml(str: string): string {
  return String(str || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}
