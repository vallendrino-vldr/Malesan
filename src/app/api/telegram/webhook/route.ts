import { NextRequest } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { sendTelegramMessage } from "@/lib/telegram";

export const runtime = "nodejs";
export const maxDuration = 30;

const TELEGRAM_ADMIN_CHAT_ID = process.env.TELEGRAM_ADMIN_CHAT_ID;
const TELEGRAM_WEBHOOK_SECRET = process.env.TELEGRAM_WEBHOOK_SECRET;

// Service role client for secure admin database actions
function getAdminSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY!;
  return createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

export async function POST(request: NextRequest) {
  // 1. Verify Secret Header if configured
  if (TELEGRAM_WEBHOOK_SECRET) {
    const secretHeader = request.headers.get("x-telegram-bot-api-secret-token");
    if (secretHeader !== TELEGRAM_WEBHOOK_SECRET) {
      console.warn("[telegram-webhook] unauthorized secret token attempt");
      return new Response("Unauthorized", { status: 401 });
    }
  }

  let body: any;
  try {
    body = await request.json();
  } catch {
    return new Response("Bad Request", { status: 400 });
  }

  const supabase = getAdminSupabase();

  // 2. Handle Inline Keyboard Button Callbacks (e.g. [Approve Topup], [Reject Topup], [Refresh])
  if (body.callback_query) {
    const cb = body.callback_query;
    const fromId = String(cb.from?.id);
    const data = String(cb.data || "");
    const callbackQueryId = cb.id;

    // Answer callback query so Telegram spinner stops
    await answerCallbackQuery(callbackQueryId);

    // Whitelist check
    if (fromId !== TELEGRAM_ADMIN_CHAT_ID) {
      await sendTelegramMessage("⛔ <i>Akses ditolak. Lo bukan admin Malesan.</i>", { chatId: fromId });
      return json({ ok: true });
    }

    if (data.startsWith("approve_topup:")) {
      const topupId = data.replace("approve_topup:", "");
      await handleApproveTopup(topupId, supabase, cb.message?.message_id);
    } else if (data.startsWith("reject_topup:")) {
      const topupId = data.replace("reject_topup:", "");
      await handleRejectTopup(topupId, supabase, cb.message?.message_id);
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
  if (fromId !== TELEGRAM_ADMIN_CHAT_ID) {
    console.warn(`[telegram-webhook] unauthorized user access attempt: ${fromId}`);
    await sendTelegramMessage("⛔ <i>Akses Ditolak. Bot ini khusus owner @malesan_my_id.</i>", { chatId: fromId });
    return json({ ok: true });
  }

  const [cmd, ...args] = text.split(/\s+/);

  switch (cmd.toLowerCase()) {
    case "/start":
    case "/help":
    case "/menu": {
      await handleMenuCommand(fromId);
      break;
    }
    case "/stats": {
      await handleStatsCommand(fromId, supabase);
      break;
    }
    case "/topups": {
      await handleListPendingTopups(fromId, supabase);
      break;
    }
    case "/voucher": {
      await handleCreateVoucher(fromId, args, supabase);
      break;
    }
    case "/broadcast": {
      await handleBroadcastCommand(fromId, args.join(" "), supabase);
      break;
    }
    case "/clearnotice": {
      await handleClearNoticeCommand(fromId, supabase);
      break;
    }
    case "/ban": {
      await handleBanUser(fromId, args[0], true, supabase);
      break;
    }
    case "/unban": {
      await handleBanUser(fromId, args[0], false, supabase);
      break;
    }
    default: {
      if (text.startsWith("/")) {
        await sendTelegramMessage(
          `❓ Perintah <code>${escapeHtml(cmd)}</code> gak dikenali.\nKetik /help untuk melihat menu perintah yang tersedia.`,
          { chatId: fromId },
        );
      }
    }
  }

  return json({ ok: true });
}

// -------------------------------------------------------------
// Command Handlers
// -------------------------------------------------------------

async function handleMenuCommand(chatId: string) {
  const menuText = `🎛 <b>MALESAN MISSION CONTROL</b> 🚀\n
Halo Bos! Berikut menu perintah cepat yang bisa lo pakai:

📊 <b>Monitoring & Keuangan</b>
• /stats — Ringkasan user, transaksi & margin hari ini
• /topups — Cek antrean pembayaran pending

🎟 <b>Voucher & Promo</b>
• <code>/voucher KODE JUMLAH_KREDIT</code>
  <i>Contoh: /voucher PROMO50 50</i>

📢 <b>Dashboard Banner</b>
• <code>/broadcast PESAN</code> — Pasang banner pengumuman di web
• /clearnotice — Hapus banner pengumuman

🛡 <b>Moderasi Akun</b>
• <code>/ban user@gmail.com</code> — Bekukan akun user nakal
• <code>/unban user@gmail.com</code> — Buka blokir akun

<i>Tips: Lo juga bisa klik tombol menu di bawah ini:</i>`;

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

async function handleStatsCommand(chatId: string, supabase: any) {
  try {
    // 1. Count users
    const { count: totalUsers } = await supabase
      .from("profiles")
      .select("id", { count: "exact", head: true });

    // 2. Count generations today
    const startOfDay = new Date();
    startOfDay.setHours(0, 0, 0, 0);

    const { count: gensToday } = await supabase
      .from("generations")
      .select("id", { count: "exact", head: true })
      .gte("created_at", startOfDay.toISOString());

    // 3. Count pending topups
    const { count: pendingTopups } = await supabase
      .from("topups")
      .select("id", { count: "exact", head: true })
      .eq("status", "pending");

    // 4. Sum approved revenue today
    const { data: todayTopups } = await supabase
      .from("topups")
      .select("amount")
      .eq("status", "approved")
      .gte("created_at", startOfDay.toISOString());

    const totalRevenueToday = (todayTopups || []).reduce((acc: number, t: any) => acc + (t.amount || 0), 0);

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

async function handleListPendingTopups(chatId: string, supabase: any) {
  try {
    const { data: pending } = await supabase
      .from("topups")
      .select("id, user_id, amount, credits, proof_url, created_at, profiles(email)")
      .eq("status", "pending")
      .order("created_at", { ascending: false })
      .limit(5);

    if (!pending || pending.length === 0) {
      await sendTelegramMessage("✅ <b>Semua Bersih!</b> Tidak ada antrean topup pending saat ini.", { chatId });
      return;
    }

    for (const item of pending) {
      const email = item.profiles?.email || item.user_id;
      const formattedRp = Number(item.amount || 0).toLocaleString("id-ID");
      const caption = `💳 <b>ANTREAN TOPUP PENDING</b>\n\n👤 <b>User:</b> <code>${escapeHtml(email)}</code>\n💵 <b>Nominal:</b> Rp ${formattedRp}\n💎 <b>Paket:</b> ${item.credits} Kredit\n🧾 <b>ID:</b> <code>${item.id}</code>`;

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

async function handleApproveTopup(topupId: string, supabase: any, messageId?: number) {
  try {
    const { data: topup, error: fetchErr } = await supabase
      .from("topups")
      .select("id, user_id, credits, amount, status, profiles(email)")
      .eq("id", topupId)
      .single();

    if (fetchErr || !topup) {
      await sendTelegramMessage(`❌ Topup ID <code>${topupId}</code> tidak ditemukan.`);
      return;
    }

    if (topup.status !== "pending") {
      await sendTelegramMessage(`ℹ️ Topup ini sudah berstatus: <b>${topup.status.toUpperCase()}</b>.`);
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

    const userEmail = topup.profiles?.email || topup.user_id;
    const confirmationText = `✅ <b>TOPUP BERHASIL DISETUJUI!</b>\n\n👤 <b>User:</b> <code>${escapeHtml(userEmail)}</code>\n💎 <b>Kredit Ditambahkan:</b> +${topup.credits} Kredit\n💵 <b>Nominal:</b> Rp ${Number(topup.amount).toLocaleString("id-ID")}`;

    await sendTelegramMessage(confirmationText);
  } catch (err) {
    console.error("[telegram-approve] error:", err);
    await sendTelegramMessage(`❌ Gagal menyetujui topup: ${String(err)}`);
  }
}

async function handleRejectTopup(topupId: string, supabase: any, messageId?: number) {
  try {
    await supabase.from("topups").update({ status: "rejected", updated_at: new Date().toISOString() }).eq("id", topupId);
    await sendTelegramMessage(`❌ <b>TOPUP DITOLAK</b>\nID: <code>${topupId}</code> telah ditandai ditolak.`);
  } catch (err) {
    console.error("[telegram-reject] error:", err);
    await sendTelegramMessage(`❌ Gagal menolak topup: ${String(err)}`);
  }
}

async function handleCreateVoucher(chatId: string, args: string[], supabase: any) {
  if (args.length < 2) {
    await sendTelegramMessage(
      `⚠️ <b>Format Salah!</b>\n\nKetik: <code>/voucher KODE JUMLAH_KREDIT [MAX_CLAIM]</code>\n<i>Contoh: /voucher GRATIS100 100 50</i>`,
      { chatId },
    );
    return;
  }

  const code = args[0].toUpperCase().trim();
  const credits = parseInt(args[1], 10);
  const maxUses = args[2] ? parseInt(args[2], 10) : 1;

  if (isNaN(credits) || credits <= 0) {
    await sendTelegramMessage("⚠️ Jumlah kredit harus berupa angka positif!", { chatId });
    return;
  }

  try {
    const { error } = await supabase.from("vouchers").insert({
      code,
      credits,
      max_uses: maxUses,
      used_count: 0,
      is_active: true,
      created_at: new Date().toISOString(),
    });

    if (error) {
      await sendTelegramMessage(`❌ Gagal membuat voucher: ${error.message}`, { chatId });
      return;
    }

    const successText = `🎟 <b>VOUCHER BERHASIL DIBUAT!</b>\n\n🔑 <b>Kode:</b> <code>${code}</code>\n💎 <b>Hadiah:</b> <b>+${credits} Kredit</b>\n👥 <b>Batas Klaim:</b> ${maxUses} user\n\n<i>Tinggal salin kode di atas dan bagikan ke user!</i>`;

    await sendTelegramMessage(successText, { chatId });
  } catch (err) {
    console.error("[telegram-voucher] error:", err);
    await sendTelegramMessage("❌ Terjadi kesalahan saat menyimpan voucher.", { chatId });
  }
}

async function handleBroadcastCommand(chatId: string, message: string, supabase: any) {
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

async function handleClearNoticeCommand(chatId: string, supabase: any) {
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

async function handleBanUser(chatId: string, email: string, isBanned: boolean, supabase: any) {
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
  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (!token) return;
  try {
    await fetch(`https://api.telegram.org/bot${token}/answerCallbackQuery`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ callback_query_id: callbackQueryId }),
    });
  } catch (e) {
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
