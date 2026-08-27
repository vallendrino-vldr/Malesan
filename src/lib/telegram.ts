import "server-only";

interface InlineKeyboardButton {
  text: string;
  callback_data?: string;
  url?: string;
}

export interface SendTelegramOptions {
  chatId?: string | number;
  messageThreadId?: number;
  parseMode?: "HTML" | "Markdown" | "MarkdownV2";
  replyMarkup?: {
    inline_keyboard?: InlineKeyboardButton[][];
  };
  disableNotification?: boolean;
}

export interface TelegramForumTopics {
  executive?: number;
  topup?: number;
  users?: number;
  generation?: number;
  feedback?: number;
  error?: number;
  otak_kedua?: number;
}

export interface TelegramConfig {
  token?: string;
  chatId?: string; // DM Admin Chat ID
  groupChatId?: string; // Forum Supergroup ID
  topics?: TelegramForumTopics;
}

let cachedConfig: (TelegramConfig & { at: number }) | null = null;

export async function getTelegramConfig(): Promise<TelegramConfig> {
  const envToken = process.env.TELEGRAM_BOT_TOKEN;
  const envChatId = process.env.TELEGRAM_ADMIN_CHAT_ID;

  if (cachedConfig && Date.now() - cachedConfig.at < 30_000) {
    return cachedConfig;
  }

  try {
    const { createServiceRoleClient } = await import("@/lib/supabase/server");
    const { data } = await createServiceRoleClient()
      .from("app_config")
      .select("key, value")
      .in("key", [
        "telegram_bot_token",
        "telegram_admin_chat_id",
        "telegram_group_chat_id",
        "telegram_forum_topics",
      ]);

    const dbToken = data?.find((r) => r.key === "telegram_bot_token")?.value as string | undefined;
    const dbChatId = data?.find((r) => r.key === "telegram_admin_chat_id")?.value as string | undefined;
    const dbGroupChatId = data?.find((r) => r.key === "telegram_group_chat_id")?.value as string | undefined;
    const rawTopics = data?.find((r) => r.key === "telegram_forum_topics")?.value;

    let dbTopics: TelegramForumTopics | undefined;
    if (rawTopics) {
      dbTopics = typeof rawTopics === "string" ? JSON.parse(rawTopics) : rawTopics;
    }

    cachedConfig = {
      token: envToken || dbToken,
      chatId: envChatId || dbChatId,
      groupChatId: dbGroupChatId,
      topics: dbTopics,
      at: Date.now(),
    };
    return cachedConfig;
  } catch {
    return { token: envToken, chatId: envChatId };
  }
}

/**
 * Creates a Forum Topic in a Supergroup with Topics enabled.
 */
export async function createTelegramForumTopic(
  groupChatId: string | number,
  name: string,
  iconColor?: number,
): Promise<{ ok: boolean; messageThreadId?: number }> {
  const config = await getTelegramConfig();
  const token = config.token;
  if (!token || !groupChatId) return { ok: false };

  try {
    const url = `https://api.telegram.org/bot${token}/createForumTopic`;
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: groupChatId,
        name,
        icon_color: iconColor,
      }),
      signal: AbortSignal.timeout(6000),
    });

    if (!res.ok) {
      const err = await res.text();
      console.warn("[telegram] createForumTopic failed:", res.status, err);
      return { ok: false };
    }

    const data = (await res.json()) as { ok: boolean; result?: { message_thread_id: number } };
    return { ok: data.ok, messageThreadId: data.result?.message_thread_id };
  } catch (err) {
    console.warn("[telegram] createForumTopic network error:", err);
    return { ok: false };
  }
}

/**
 * Splits extra-long text (> 3800 chars) into neat paragraph chunks.
 */
export function splitTelegramMessage(text: string, maxLen = 3800): string[] {
  if (!text || text.length <= maxLen) return [text || ""];

  const chunks: string[] = [];
  let remaining = text.trim();

  while (remaining.length > 0) {
    if (remaining.length <= maxLen) {
      chunks.push(remaining);
      break;
    }

    let splitIdx = remaining.lastIndexOf("\n\n", maxLen);
    if (splitIdx === -1 || splitIdx < maxLen * 0.4) {
      splitIdx = remaining.lastIndexOf("\n", maxLen);
    }
    if (splitIdx === -1 || splitIdx < maxLen * 0.4) {
      splitIdx = remaining.lastIndexOf(" ", maxLen);
    }
    if (splitIdx === -1 || splitIdx === 0) {
      splitIdx = maxLen;
    }

    chunks.push(remaining.slice(0, splitIdx).trim());
    remaining = remaining.slice(splitIdx).trim();
  }

  return chunks.filter(Boolean);
}

/**
 * Sanitizes arbitrary HTML to only Telegram Bot API supported tags.
 */
export function sanitizeTelegramHtml(html?: string | null): string {
  if (!html) return "";

  let cleaned = String(html)
    .replace(/<\/?(ul|ol)>/gi, "")
    .replace(/<li>/gi, "• ")
    .replace(/<\/li>/gi, "\n")
    .replace(/<\/?p>/gi, "\n")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/?(h[1-6]|header|div|section|article)>/gi, "\n")
    .replace(/<span(?![^>]*class=["']tg-spoiler["'])[^>]*>(.*?)<\/span>/gi, "$1");

  cleaned = cleaned.replace(
    /<(?!\/?(b|strong|i|em|u|ins|s|strike|del|a|code|pre|blockquote|tg-spoiler)\b)[^>]+>/gi,
    "",
  );

  cleaned = cleaned.replace(/\n{3,}/g, "\n\n").trim();
  return cleaned;
}

/**
 * Sends a typing/action indicator to Telegram in direct chat or specific forum topic.
 */
export async function sendChatAction(
  chatId?: string | number,
  action: "typing" | "upload_photo" | "record_video" | "choose_sticker" = "typing",
  messageThreadId?: number,
): Promise<boolean> {
  const config = await getTelegramConfig();
  const token = config.token;
  const targetChatId = chatId || config.groupChatId || config.chatId;

  if (!token || !targetChatId) return false;

  try {
    const url = `https://api.telegram.org/bot${token}/sendChatAction`;
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: targetChatId,
        action,
        message_thread_id: messageThreadId,
      }),
      signal: AbortSignal.timeout(3000),
    });
    return res.ok;
  } catch {
    return false;
  }
}

/**
 * Sends a single chunk message to Telegram with topic support and plaintext retry fallback.
 */
async function sendSingleTelegramMessage(
  token: string,
  chatId: string | number,
  rawText: string,
  options: SendTelegramOptions,
): Promise<{ ok: boolean; messageId?: number }> {
  const parseMode = options.parseMode || "HTML";
  const processedText = parseMode === "HTML" ? sanitizeTelegramHtml(rawText) : rawText;

  const url = `https://api.telegram.org/bot${token}/sendMessage`;

  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: chatId,
        message_thread_id: options.messageThreadId,
        text: processedText,
        parse_mode: parseMode,
        reply_markup: options.replyMarkup,
        disable_notification: options.disableNotification,
        disable_web_page_preview: true,
      }),
      signal: AbortSignal.timeout(6000),
    });

    if (!res.ok) {
      const errBody = await res.text();

      // Auto-fallback: if HTML formatting failed, strip all tags and deliver cleanly in plain text
      if (res.status === 400 && errBody.includes("can't parse entities")) {
        const plainText = rawText.replace(/<[^>]*>/g, "").trim();
        const fallbackRes = await fetch(url, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            chat_id: chatId,
            message_thread_id: options.messageThreadId,
            text: plainText,
            reply_markup: options.replyMarkup,
            disable_notification: options.disableNotification,
            disable_web_page_preview: true,
          }),
          signal: AbortSignal.timeout(6000),
        });

        if (fallbackRes.ok) {
          const fallbackData = (await fallbackRes.json()) as { ok: boolean; result?: { message_id: number } };
          return { ok: true, messageId: fallbackData.result?.message_id };
        }
      }

      console.warn("[telegram] sendMessage failed:", res.status, errBody);
      return { ok: false };
    }

    const data = (await res.json()) as { ok: boolean; result?: { message_id: number } };
    return { ok: data.ok, messageId: data.result?.message_id };
  } catch (err) {
    console.warn("[telegram] network error sending chunk:", err);
    return { ok: false };
  }
}

/**
 * Main delivery entry point with automatic chunking and Forum Topic routing!
 */
export async function sendTelegramMessage(
  text: string,
  options: SendTelegramOptions = {},
): Promise<{ ok: boolean; messageId?: number }> {
  const config = await getTelegramConfig();
  const token = config.token;
  const chatId = options.chatId || config.groupChatId || config.chatId;

  if (!token || !chatId || !text) {
    return { ok: false };
  }

  const chunks = splitTelegramMessage(text, 3800);

  let lastMessageId: number | undefined;
  for (let i = 0; i < chunks.length; i++) {
    const chunk = chunks[i];
    const isLast = i === chunks.length - 1;
    const chunkOptions: SendTelegramOptions = {
      ...options,
      replyMarkup: isLast ? options.replyMarkup : undefined,
    };

    const res = await sendSingleTelegramMessage(token, chatId, chunk, chunkOptions);
    if (res.ok) {
      lastMessageId = res.messageId;
    }
  }

  return { ok: true, messageId: lastMessageId };
}

/**
 * Sends a photo to Telegram with Forum Topic routing support.
 */
export async function sendTelegramPhoto(
  photoUrl: string,
  caption?: string,
  options: SendTelegramOptions = {},
): Promise<{ ok: boolean }> {
  const config = await getTelegramConfig();
  const token = config.token;
  const chatId = options.chatId || config.groupChatId || config.chatId;

  if (!token || !chatId) {
    return { ok: false };
  }

  const processedCaption = caption ? sanitizeTelegramHtml(caption).slice(0, 1024) : undefined;

  try {
    const url = `https://api.telegram.org/bot${token}/sendPhoto`;
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: chatId,
        message_thread_id: options.messageThreadId,
        photo: photoUrl,
        caption: processedCaption,
        parse_mode: options.parseMode || "HTML",
        reply_markup: options.replyMarkup,
      }),
      signal: AbortSignal.timeout(6000),
    });

    return { ok: res.ok };
  } catch (err) {
    console.warn("[telegram] sendPhoto error:", err);
    return { ok: false };
  }
}

// -------------------------------------------------------------
// Specialized Helper Notifications (Routed to Forum Topics)
// -------------------------------------------------------------

export async function notifyNewUser(data: { email: string; name?: string | null; provider?: string }) {
  const config = await getTelegramConfig();
  const now = new Date().toLocaleString("id-ID", { timeZone: "Asia/Jakarta" });
  const text = `👋 <b>USER BARU TERDAFTAR!</b>\n\n👤 <b>Nama:</b> ${escapeHtml(data.name || "Tanpa Nama")}\n📧 <b>Email:</b> <code>${escapeHtml(data.email)}</code>\n🌐 <b>Login:</b> ${data.provider || "Google OAuth"}\n⏰ <b>Waktu:</b> ${now} WIB`;

  return sendTelegramMessage(text, {
    messageThreadId: config.topics?.users,
  });
}

export async function notifyGeneration(data: {
  email: string;
  moduleName: string;
  creditsSpent: number;
  details?: string;
}) {
  const config = await getTelegramConfig();
  const now = new Date().toLocaleString("id-ID", { timeZone: "Asia/Jakarta" });
  const text = `⚡ <b>GENERASI KONTEN</b>\n\n👤 <b>User:</b> <code>${escapeHtml(data.email)}</code>\n🛠 <b>Modul:</b> <b>${escapeHtml(data.moduleName)}</b>\n💎 <b>Kredit:</b> -${data.creditsSpent} Kredit\n📝 <b>Topik/Info:</b> ${escapeHtml(data.details || "-")}\n⏰ <b>Waktu:</b> ${now} WIB`;

  return sendTelegramMessage(text, {
    disableNotification: true,
    messageThreadId: config.topics?.generation,
  });
}

export async function notifyFeedback(data: {
  email: string;
  rating: number;
  comment?: string | null;
  moduleName?: string | null;
}) {
  const config = await getTelegramConfig();
  const stars = "⭐".repeat(Math.max(1, Math.min(5, data.rating)));
  const text = `💌 <b>FEEDBACK DITERIMA!</b>\n\n👤 <b>User:</b> <code>${escapeHtml(data.email)}</code>\n${stars} (<b>${data.rating} / 5</b>)\n🛠 <b>Fitur:</b> ${escapeHtml(data.moduleName || "Umum")}\n💬 <b>Komentar:</b>\n<i>"${escapeHtml(data.comment || "Tanpa catatan tambahan")}"</i>`;

  return sendTelegramMessage(text, {
    messageThreadId: config.topics?.feedback,
  });
}

export async function notifyTopupRequest(data: {
  topupId: string;
  email: string;
  amount: number;
  credits: number;
  proofUrl?: string | null;
}) {
  const config = await getTelegramConfig();
  const formattedRp = Number(data.amount || 0).toLocaleString("id-ID");
  const caption = `🚨 <b>REQUEST TOPUP KREDIT!</b>\n\n👤 <b>User:</b> <code>${escapeHtml(data.email)}</code>\n💵 <b>Nominal:</b> <b>Rp ${formattedRp}</b>\n💎 <b>Paket:</b> <b>${data.credits} Kredit</b>\n🧾 <b>ID:</b> <code>${data.topupId}</code>\n\n<i>Klik tombol di bawah untuk menyetujui langsung dari HP:</i>`;

  const inlineKeyboard = {
    inline_keyboard: [
      [
        { text: "✅ Setujui (Approve)", callback_data: `approve_topup:${data.topupId}` },
        { text: "❌ Tolak (Reject)", callback_data: `reject_topup:${data.topupId}` },
      ],
    ],
  };

  const options: SendTelegramOptions = {
    replyMarkup: inlineKeyboard,
    messageThreadId: config.topics?.topup,
  };

  if (data.proofUrl) {
    return sendTelegramPhoto(data.proofUrl, caption, options);
  }

  return sendTelegramMessage(caption, options);
}

export async function notifyVoucherRedeemed(data: { email: string; code: string; credits: number }) {
  const config = await getTelegramConfig();
  const now = new Date().toLocaleString("id-ID", { timeZone: "Asia/Jakarta" });
  const text = `🎟 <b>VOUCHER DIKLAIM!</b>\n\n👤 <b>User:</b> <code>${escapeHtml(data.email)}</code>\n🔑 <b>Kode:</b> <code>${escapeHtml(data.code)}</code>\n💎 <b>Hadiah:</b> +${data.credits} Kredit Paid\n⏰ <b>Waktu:</b> ${now} WIB`;

  return sendTelegramMessage(text, {
    messageThreadId: config.topics?.users,
  });
}

export async function notifyUserProUpgrade(data: { email: string; isPro: boolean }) {
  const config = await getTelegramConfig();
  const status = data.isPro ? "⭐ <b>PRO STATUS DIAKTIFKAN!</b>" : "ℹ️ <b>PRO STATUS DINONAKTIFKAN</b>";
  const text = `${status}\n\n👤 <b>User:</b> <code>${escapeHtml(data.email)}</code>`;
  return sendTelegramMessage(text, {
    messageThreadId: config.topics?.users,
  });
}

export async function notifyCriticalError(data: { module: string; message: string; userEmail?: string }) {
  const config = await getTelegramConfig();
  const text = `🚨 <b>CRITICAL SYSTEM ALERT!</b>\n\n🛠 <b>Modul:</b> ${escapeHtml(data.module)}\n👤 <b>User:</b> ${escapeHtml(data.userEmail || "System/Anonymous")}\n⚠️ <b>Pesan:</b>\n<code>${escapeHtml(data.message.slice(0, 300))}</code>`;
  return sendTelegramMessage(text, {
    messageThreadId: config.topics?.error,
  });
}

export async function notifySystemAlert(data: { title: string; message: string }) {
  const config = await getTelegramConfig();
  const text = `⚠️ <b>SYSTEM ALERT: ${escapeHtml(data.title)}</b>\n\n${escapeHtml(data.message)}`;
  return sendTelegramMessage(text, {
    messageThreadId: config.topics?.error,
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
