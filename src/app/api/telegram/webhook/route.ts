import { NextRequest } from "next/server";
import { createClient, SupabaseClient } from "@supabase/supabase-js";
import {
  sendTelegramMessage,
  sendChatAction,
  getTelegramConfig,
  createTelegramForumTopic,
} from "@/lib/telegram";
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

interface TelegramChat {
  id: number;
  type: string;
  title?: string;
}

interface TelegramMessage {
  message_id: number;
  from?: TelegramUser;
  chat?: TelegramChat;
  message_thread_id?: number;
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

  // 2. Handle Inline Button Callbacks
  if (body.callback_query) {
    const cq = body.callback_query;
    const fromId = String(cq.from.id);
    const data = cq.data || "";
    const callbackChatId = cq.message?.chat?.id ? String(cq.message.chat.id) : fromId;
    const callbackThreadId = cq.message?.message_thread_id;

    if (fromId !== adminChatId) {
      console.warn(`[telegram-webhook] unauthorized callback query: ${fromId}`);
      return json({ ok: true });
    }

    if (data.startsWith("approve_topup:")) {
      const topupId = data.replace("approve_topup:", "");
      await handleApproveTopup(topupId, supabase, callbackChatId, callbackThreadId);
    } else if (data.startsWith("reject_topup:")) {
      const topupId = data.replace("reject_topup:", "");
      await handleRejectTopup(topupId, supabase, callbackChatId, callbackThreadId);
    } else if (data.startsWith("exec_action:")) {
      const actionId = data.replace("exec_action:", "");
      const resMsg = await executePendingTelegramAction(actionId, supabase);
      await sendTelegramMessage(resMsg, { chatId: callbackChatId, messageThreadId: callbackThreadId });
    } else if (data.startsWith("cancel_action:")) {
      const actionId = data.replace("cancel_action:", "");
      await supabase.from("app_config").delete().eq("key", `tele_act:${actionId}`);
      await sendTelegramMessage("<b>[DIBATALKAN]</b> Tindakan telah dibatalkan oleh Bos.", {
        chatId: callbackChatId,
        messageThreadId: callbackThreadId,
      });
    } else if (data === "action:stats") {
      await handleStatsCommand(callbackChatId, supabase, callbackThreadId);
    } else if (data === "action:topups") {
      await handleListPendingTopups(callbackChatId, supabase, callbackThreadId);
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
  const chatId = message.chat?.id ? String(message.chat.id) : fromId;
  const messageThreadId = message.message_thread_id;
  const isGroup = chatId.startsWith("-100") || message.chat?.type === "supergroup" || message.chat?.type === "group";

  // Whitelist verification: ONLY respond to the owner
  if (fromId !== adminChatId) {
    console.warn(`[telegram-webhook] unauthorized user access attempt: ${fromId}`);
    if (!isGroup) {
      await sendTelegramMessage("<b>[AKSES DITOLAK]</b> Bot ini khusus owner @malesan_my_id.", { chatId: fromId });
    }
    return json({ ok: true });
  }

  // Trigger real-time "typing..." indicator in Telegram app header / topic
  sendChatAction(chatId, "typing", messageThreadId).catch(() => {});

  // If text starts with a known slash command, handle quickly:
  if (text.startsWith("/")) {
    const [cmd, ...args] = text.split(/\s+/);
    switch (cmd.toLowerCase()) {
      case "/sethq":
      case "/setup_forum":
      case "/setup": {
        if (!isGroup) {
          await sendTelegramMessage(
            "<b>[SETUP PERINGATAN]</b> Perintah <code>/sethq</code> harus dikirim di dalam <b>Grup Forum MALESAN HQ</b>, bukan di DM pribadi, Bos.",
            { chatId: fromId },
          );
          return json({ ok: true });
        }

        await sendTelegramMessage("<b>[MEMPROSES SETUP]</b> Mengonfigurasi seluruh kanal topik MALESAN HQ...", {
          chatId,
          messageThreadId,
        });

        // 1. Save group ID
        await supabase.from("app_config").upsert({
          key: "telegram_group_chat_id",
          value: chatId,
          updated_at: new Date().toISOString(),
        });

        // 2. Automatically create Forum Topics via Telegram Bot API with clean names
        const topicsConfig: Record<string, number> = {};

        const topicDefs = [
          { key: "executive", name: "01-executive-chat", color: 16766590 },
          { key: "topup", name: "02-topup-transaksi", color: 7322096 },
          { key: "users", name: "03-user-growth", color: 9367192 },
          { key: "generation", name: "04-generasi-konten", color: 16478047 },
          { key: "feedback", name: "05-feedback-review", color: 16749490 },
          { key: "error", name: "06-error-sentry", color: 13338331 },
          { key: "otak_kedua", name: "07-otak-kedua", color: 7322096 },
        ];

        for (const t of topicDefs) {
          const res = await createTelegramForumTopic(chatId, t.name, t.color);
          if (res.ok && res.messageThreadId) {
            topicsConfig[t.key] = res.messageThreadId;
            await sendTelegramMessage(
              `<b>[KANAL ${t.name.toUpperCase()}]</b>\nKanal ini siap menerima pembaruan sistem dan interaksi khusus.`,
              {
                chatId,
                messageThreadId: res.messageThreadId,
              },
            );
          }
        }

        // 3. Save forum topics mapping
        await supabase.from("app_config").upsert({
          key: "telegram_forum_topics",
          value: topicsConfig,
          updated_at: new Date().toISOString(),
        });

        await sendTelegramMessage(
          "<b>[SETUP SELESAI]</b> Seluruh kanal topik MALESAN HQ berhasil diaktifkan. Semua notifikasi platform sekarang dialihkan otomatis sesuai kategorinya.",
          { chatId, messageThreadId },
        );

        return json({ ok: true });
      }

      case "/start":
      case "/help":
      case "/menu": {
        await handleMenuCommand(chatId, messageThreadId);
        return json({ ok: true });
      }
      case "/stats": {
        await handleStatsCommand(chatId, supabase, messageThreadId);
        return json({ ok: true });
      }
      case "/topups": {
        await handleListPendingTopups(chatId, supabase, messageThreadId);
        return json({ ok: true });
      }
      case "/voucher": {
        await handleCreateVoucher(chatId, args, supabase, messageThreadId);
        return json({ ok: true });
      }
      case "/broadcast": {
        await handleBroadcastCommand(chatId, args.join(" "), supabase, messageThreadId);
        return json({ ok: true });
      }
      case "/clearnotice": {
        await handleClearNoticeCommand(chatId, supabase, messageThreadId);
        return json({ ok: true });
      }
      case "/ban": {
        await handleBanUser(chatId, args[0], true, supabase, messageThreadId);
        return json({ ok: true });
      }
      case "/unban": {
        await handleBanUser(chatId, args[0], false, supabase, messageThreadId);
        return json({ ok: true });
      }
    }
  }

  // 4. Autonomous Conversational AI Brain: Handles any natural language chat / orders!
  await processTelegramAIMessage(text, chatId, messageThreadId);

  return json({ ok: true });
}

// -------------------------------------------------------------
// Command Handlers (Executive Minimalist Style)
// -------------------------------------------------------------

async function handleMenuCommand(chatId: string, messageThreadId?: number) {
  const menuText = `<b>[MALESAN MISSION CONTROL & AI BRAIN]</b>\n
Halo Bos. Sistem beroperasi penuh dengan Autonomous AI Brain dan dukungan Forum Topics:

• <b>Setup Forum Grup:</b>
  Ketik <code>/sethq</code> di grup Forum untuk auto-create seluruh kanal topik.

• <b>Contoh Perintah Bebas:</b>
  — <i>"Hapus broadcast sekarang"</i>
  — <i>"Pasang banner: Diskon 50% sampai besok malam"</i>
  — <i>"Siapa aja user yang terdaftar?"</i>
  — <i>"Cek user vadlyvldr@gmail.com"</i>
  — <i>"Ada komplain apa hari ini?"</i>
  — <i>"Bikinin ide hook konten edukasi AI"</i>`;

  const inlineKeyboard = {
    inline_keyboard: [
      [
        { text: "Cek Statistik", callback_data: "action:stats" },
        { text: "Antrean Topup", callback_data: "action:topups" },
      ],
      [
        { text: "Buka Malesan.my.id", url: "https://www.malesan.my.id" },
        { text: "Admin Panel", url: "https://www.malesan.my.id/admin" },
      ],
    ],
  };

  await sendTelegramMessage(menuText, {
    chatId,
    messageThreadId,
    replyMarkup: inlineKeyboard,
  });
}

async function handleStatsCommand(chatId: string, supabase: SupabaseClient, messageThreadId?: number) {
  const [usersRes, topupsRes, genRes] = await Promise.all([
    supabase.from("profiles").select("id, is_pro, created_at"),
    supabase.from("topups").select("id, amount, status, created_at").eq("status", "pending"),
    supabase.from("generations").select("id, created_at").gte("created_at", new Date(Date.now() - 24 * 3600 * 1000).toISOString()),
  ]);

  const totalUsers = usersRes.data?.length || 0;
  const proUsers = usersRes.data?.filter((u) => u.is_pro).length || 0;
  const pendingTopups = topupsRes.data?.length || 0;
  const gensToday = genRes.data?.length || 0;

  const now = new Date().toLocaleString("id-ID", { timeZone: "Asia/Jakarta" });

  const text = `<b>[STATUS METRIK PLATFORM]</b>\n
• <b>Total Pengguna:</b> ${totalUsers} (${proUsers} Pro Tier)
• <b>Topup Pending:</b> ${pendingTopups} transaksi
• <b>Generasi 24 Jam:</b> ${gensToday} kali
• <b>Waktu Server:</b> ${now} WIB`;

  await sendTelegramMessage(text, { chatId, messageThreadId });
}

async function handleListPendingTopups(chatId: string, supabase: SupabaseClient, messageThreadId?: number) {
  const { data: topups } = await supabase
    .from("topups")
    .select("id, amount, credits, proof_url, user_id, profiles(email), created_at")
    .eq("status", "pending")
    .order("created_at", { ascending: false });

  if (!topups || topups.length === 0) {
    await sendTelegramMessage("<b>[ANTREAN TOPUP]</b> Tidak ada topup pending saat ini.", {
      chatId,
      messageThreadId,
    });
    return;
  }

  await sendTelegramMessage(`<b>[ANTREAN TOPUP]</b> Ditemukan ${topups.length} transaksi menunggu persetujuan:`, {
    chatId,
    messageThreadId,
  });

  for (const t of topups) {
    const profile = Array.isArray(t.profiles) ? t.profiles[0] : t.profiles;
    const email = (profile as { email?: string })?.email || "user@malesan";
    const formattedRp = Number(t.amount || 0).toLocaleString("id-ID");

    const caption = `<b>[TIKET TOPUP]</b>\n\n• <b>ID:</b> <code>${t.id}</code>\n• <b>User:</b> <code>${escapeHtml(email)}</code>\n• <b>Nominal:</b> Rp ${formattedRp}\n• <b>Paket:</b> ${t.credits} Kredit`;

    const inlineKeyboard = {
      inline_keyboard: [
        [
          { text: "Setujui (Approve)", callback_data: `approve_topup:${t.id}` },
          { text: "Tolak (Reject)", callback_data: `reject_topup:${t.id}` },
        ],
      ],
    };

    await sendTelegramMessage(caption, {
      chatId,
      messageThreadId,
      replyMarkup: inlineKeyboard,
    });
  }
}

async function handleApproveTopup(
  topupId: string,
  supabase: SupabaseClient,
  chatId: string,
  messageThreadId?: number,
) {
  const { data: topup } = await supabase.from("topups").select("*").eq("id", topupId).single();
  if (!topup || topup.status !== "pending") {
    await sendTelegramMessage("Topup ini sudah pernah diproses sebelumnya.", {
      chatId,
      messageThreadId,
    });
    return;
  }

  // Grant credits
  const { error: grantErr } = await supabase.rpc("grant_credits", {
    p_user: topup.user_id,
    p_amount: topup.credits,
    p_bucket: "paid",
    p_reason: `topup_${topupId}`,
  });

  if (grantErr) {
    await sendTelegramMessage(`Gagal menambahkan kredit: ${grantErr.message}`, {
      chatId,
      messageThreadId,
    });
    return;
  }

  await supabase
    .from("topups")
    .update({ status: "approved", approved_at: new Date().toISOString() })
    .eq("id", topupId);

  await sendTelegramMessage(
    `<b>[TOPUP DISETUJUI]</b>\n\n• Tiket: <code>${topupId}</code>\n• Saldo: +${topup.credits} Kredit berhasil dikreditkan ke user.`,
    { chatId, messageThreadId },
  );
}

async function handleRejectTopup(
  topupId: string,
  supabase: SupabaseClient,
  chatId: string,
  messageThreadId?: number,
) {
  const { data: topup } = await supabase.from("topups").select("*").eq("id", topupId).single();
  if (!topup || topup.status !== "pending") {
    await sendTelegramMessage("Topup ini sudah pernah diproses sebelumnya.", {
      chatId,
      messageThreadId,
    });
    return;
  }

  await supabase
    .from("topups")
    .update({ status: "rejected", rejected_at: new Date().toISOString(), reject_reason: "Ditolak oleh admin via Telegram" })
    .eq("id", topupId);

  await sendTelegramMessage(`<b>[TOPUP DITOLAK]</b> Tiket <code>${topupId}</code> telah ditolak.`, {
    chatId,
    messageThreadId,
  });
}

async function handleCreateVoucher(
  chatId: string,
  args: string[],
  supabase: SupabaseClient,
  messageThreadId?: number,
) {
  const [code, creditsStr] = args;
  if (!code || !creditsStr) {
    await sendTelegramMessage(
      "Format salah. Gunakan: <code>/voucher &lt;KODE&gt; &lt;JUMLAH_KREDIT&gt;</code>\nContoh: <code>/voucher DISKON50 50</code>",
      { chatId, messageThreadId },
    );
    return;
  }

  const credits = parseInt(creditsStr, 10);
  if (isNaN(credits) || credits <= 0) {
    await sendTelegramMessage("Jumlah kredit harus berupa angka positif.", {
      chatId,
      messageThreadId,
    });
    return;
  }

  const cleanCode = code.trim().toUpperCase();

  const { error } = await supabase.from("vouchers").insert({
    code: cleanCode,
    credits,
    is_redeemed: false,
  });

  if (error) {
    await sendTelegramMessage(`Gagal membuat voucher: ${error.message}`, {
      chatId,
      messageThreadId,
    });
    return;
  }

  await sendTelegramMessage(
    `<b>[VOUCHER DIBUAT]</b>\n\n• Kode: <code>${cleanCode}</code>\n• Saldo: +${credits} Kredit Paid\n\n<i>Kode voucher ini sudah aktif di sistem.</i>`,
    { chatId, messageThreadId },
  );
}

async function handleBroadcastCommand(
  chatId: string,
  message: string,
  supabase: SupabaseClient,
  messageThreadId?: number,
) {
  if (!message || message.trim().length === 0) {
    await sendTelegramMessage(
      "Format salah. Gunakan: <code>/broadcast &lt;Pesan pengumuman&gt;</code>",
      { chatId, messageThreadId },
    );
    return;
  }

  const text = message.trim();

  await supabase.from("app_config").upsert({
    key: "dashboard_notice",
    value: text,
    updated_at: new Date().toISOString(),
  });

  await sendTelegramMessage(
    `<b>[BANNER DIPASANG]</b>\n\n<i>"${escapeHtml(text)}"</i>\n\nPengumuman ini aktif di bagian atas dashboard seluruh pengguna.`,
    { chatId, messageThreadId },
  );
}

async function handleClearNoticeCommand(chatId: string, supabase: SupabaseClient, messageThreadId?: number) {
  await supabase.from("app_config").upsert({
    key: "dashboard_notice",
    value: "",
    updated_at: new Date().toISOString(),
  });

  await sendTelegramMessage("<b>[BANNER DIBERSIHKAN]</b> Banner pengumuman dashboard telah dinonaktifkan.", {
    chatId,
    messageThreadId,
  });
}

async function handleBanUser(
  chatId: string,
  emailArg: string | undefined,
  isBan: boolean,
  supabase: SupabaseClient,
  messageThreadId?: number,
) {
  if (!emailArg) {
    await sendTelegramMessage("Mohon sebutkan email user yang ingin diatur.", {
      chatId,
      messageThreadId,
    });
    return;
  }

  const cleanEmail = emailArg.trim().toLowerCase();

  const { data: user } = await supabase
    .from("profiles")
    .select("id, email")
    .ilike("email", `%${cleanEmail}%`)
    .maybeSingle();

  if (!user) {
    await sendTelegramMessage(`User dengan email <code>${escapeHtml(cleanEmail)}</code> tidak ditemukan.`, {
      chatId,
      messageThreadId,
    });
    return;
  }

  await supabase
    .from("profiles")
    .update({ is_banned: isBan, ban_reason: isBan ? "Moderasi via Telegram Bot" : null })
    .eq("id", user.id);

  const statusText = isBan ? "DIBLOKIR / BANNED" : "DIAKTIFKAN KEMBALI";
  await sendTelegramMessage(`Akun user <code>${escapeHtml(user.email)}</code> telah <b>${statusText}</b>.`, {
    chatId,
    messageThreadId,
  });
}

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

function escapeHtml(str?: string | null): string {
  return String(str || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}
