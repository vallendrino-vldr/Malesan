import "server-only";

interface InlineKeyboardButton {
  text: string;
  callback_data?: string;
  url?: string;
}

export interface SendTelegramOptions {
  chatId?: string | number;
  parseMode?: "HTML" | "Markdown" | "MarkdownV2";
  replyMarkup?: {
    inline_keyboard?: InlineKeyboardButton[][];
  };
  disableNotification?: boolean;
}

let cachedConfig: { token?: string; chatId?: string; at: number } | null = null;

export async function getTelegramConfig(): Promise<{ token?: string; chatId?: string }> {
  const envToken = process.env.TELEGRAM_BOT_TOKEN;
  const envChatId = process.env.TELEGRAM_ADMIN_CHAT_ID;
  if (envToken && envChatId) {
    return { token: envToken, chatId: envChatId };
  }

  if (cachedConfig && Date.now() - cachedConfig.at < 60_000) {
    return cachedConfig;
  }

  try {
    const { createServiceRoleClient } = await import("@/lib/supabase/server");
    const { data } = await createServiceRoleClient()
      .from("app_config")
      .select("key, value")
      .in("key", ["telegram_bot_token", "telegram_admin_chat_id"]);

    const dbToken = data?.find((r) => r.key === "telegram_bot_token")?.value as string | undefined;
    const dbChatId = data?.find((r) => r.key === "telegram_admin_chat_id")?.value as string | undefined;

    cachedConfig = {
      token: envToken || dbToken,
      chatId: envChatId || dbChatId,
      at: Date.now(),
    };
    return cachedConfig;
  } catch {
    return { token: envToken, chatId: envChatId };
  }
}

/**
 * Sanitizes arbitrary HTML to only Telegram Bot API supported tags:
 * <b>, <i>, <u>, <s>, <a>, <code>, <pre>, <blockquote>, <tg-spoiler>.
 * Converts <ul>, <ol>, <li> into clean bullet points.
 */
export function sanitizeTelegramHtml(html?: string | null): string {
  if (!html) return "";

  let cleaned = String(html)
    .replace(/</?(ul|ol)>/gi, "")
    .replace(/<li>/gi, "• ")
    .replace(/</li>/gi, "\n")
    .replace(/</?p>/gi, "\n")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/?(h[1-6]|header|div|section|article)>/gi, "\n")
    .replace(/<span(?![^>]*class=["']tg-spoiler["'])[^>]*>(.*?)<\/span>/gi, "$1");

  // Whitelist supported tags only
  cleaned = cleaned.replace(
    /<(?!\/?(b|strong|i|em|u|ins|s|strike|del|a|code|pre|blockquote|tg-spoiler)\b)[^>]+>/gi,
    "",
  );

  // Normalize excessive line breaks
  cleaned = cleaned.replace(/\n{3,}/g, "\n\n").trim();

  return cleaned;
}

/**
 * Sends a typing/action indicator to Telegram so the user sees "typing..." in real-time.
 */
export async function sendChatAction(
  chatId?: string | number,
  action: "typing" | "upload_photo" | "record_video" | "choose_sticker" = "typing",
): Promise<boolean> {
  const config = await getTelegramConfig();
  const token = config.token;
  const targetChatId = chatId || config.chatId;

  if (!token || !targetChatId) return false;

  try {
    const url = `https://api.telegram.org/bot${token}/sendChatAction`;
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ chat_id: targetChatId, action }),
      signal: AbortSignal.timeout(3000),
    });
    return res.ok;
  } catch {
    return false;
  }
}

/**
 * Sends a message to the owner's Telegram chat.
 * Bulletproof delivery: automatically sanitizes HTML and retries in plaintext if Telegram rejects parsing.
 */
export async function sendTelegramMessage(
  text: string,
  options: SendTelegramOptions = {},
): Promise<{ ok: boolean; messageId?: number }> {
  const config = await getTelegramConfig();
  const token = config.token;
  const chatId = options.chatId || config.chatId;

  if (!token || !chatId || !text) {
    return { ok: false };
  }

  const parseMode = options.parseMode || "HTML";
  const processedText = parseMode === "HTML" ? sanitizeTelegramHtml(text) : text;

  try {
    const url = `https://api.telegram.org/bot${token}/sendMessage`;
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: chatId,
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
      console.warn("[telegram] sendMessage initial attempt failed:", res.status, errBody);

      // Resilient Auto-Fallback: If HTML parsing failed, strip all tags and send clean plain text!
      if (res.status === 400 && errBody.includes("can't parse entities")) {
        console.info("[telegram] Retrying delivery with clean plaintext fallback...");
        const plainText = text.replace(/<[^>]*>/g, "").trim();
        const fallbackRes = await fetch(url, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            chat_id: chatId,
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

      return { ok: false };
    }

    const data = (await res.json()) as { ok: boolean; result?: { message_id: number } };
    return { ok: data.ok, messageId: data.result?.message_id };
  } catch (err) {
    console.warn("[telegram] network error or timeout sending message:", err);
    return { ok: false };
  }
}

/**
 * Sends a photo to the owner's Telegram chat.
 */
export async function sendTelegramPhoto(
  photoUrl: string,
  caption?: string,
  options: SendTelegramOptions = {},
): Promise<{ ok: boolean }> {
  const config = await getTelegramConfig();
  const token = config.token;
  const chatId = options.chatId || config.chatId;

  if (!token || !chatId) {
    return { ok: false };
  }

  const processedCaption = caption ? sanitizeTelegramHtml(caption) : undefined;

  try {
    const url = `https://api.telegram.org/bot${token}/sendPhoto`;
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: chatId,
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
// Specialized Helper Notifications
// -------------------------------------------------------------

export function notifyNewUser(data: { email: string; name?: string | null; provider?: string }) {
  const now = new Date().toLocaleString("id-ID", { timeZone: "Asia/Jakarta" });
  const text = `👋 <b>USER BARU TERDAFTAR!</b>\n\n👤 <b>Nama:</b> ${escapeHtml(data.name || "Tanpa Nama")}\n📧 <b>Email:</b> <code>${escapeHtml(data.email)}</code>\n🌐 <b>Login:</b> ${data.provider || "Google OAuth"}\n⏰ <b>Waktu:</b> ${now} WIB`;

  return sendTelegramMessage(text);
}

export function notifyGeneration(data: {
  email: string;
  moduleName: string;
  creditsSpent: number;
  details?: string;
}) {
  const now = new Date().toLocaleString("id-ID", { timeZone: "Asia/Jakarta" });
  const text = `⚡ <b>GENERASI KONTEN</b>\n\n👤 <b>User:</b> <code>${escapeHtml(data.email)}</code>\n🛠 <b>Modul:</b> <b>${escapeHtml(data.moduleName)}</b>\n💎 <b>Kredit:</b> -${data.creditsSpent} Kredit\n📝 <b>Topik/Info:</b> ${escapeHtml(data.details || "-")}\n⏰ <b>Waktu:</b> ${now} WIB`;

  return sendTelegramMessage(text, { disableNotification: true });
}

export function notifyFeedback(data: {
  email: string;
  rating: number;
  comment?: string | null;
  moduleName?: string | null;
}) {
  const stars = "⭐".repeat(Math.max(1, Math.min(5, data.rating)));
  const text = `💌 <b>FEEDBACK DITERIMA!</b>\n\n👤 <b>User:</b> <code>${escapeHtml(data.email)}</code>\n${stars} (<b>${data.rating} / 5</b>)\n🛠 <b>Fitur:</b> ${escapeHtml(data.moduleName || "Umum")}\n💬 <b>Komentar:</b>\n<i>"${escapeHtml(data.comment || "Tanpa catatan tambahan")}"</i>`;

  return sendTelegramMessage(text);
}

export function notifyTopupRequest(data: {
  topupId: string;
  email: string;
  amount: number;
  credits: number;
  proofUrl?: string | null;
}) {
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

  if (data.proofUrl) {
    return sendTelegramPhoto(data.proofUrl, caption, { replyMarkup: inlineKeyboard });
  }

  return sendTelegramMessage(caption, { replyMarkup: inlineKeyboard });
}

export function notifyVoucherRedeemed(data: { email: string; code: string; credits: number }) {
  const now = new Date().toLocaleString("id-ID", { timeZone: "Asia/Jakarta" });
  const text = `🎟 <b>VOUCHER DIKLAIM!</b>\n\n👤 <b>User:</b> <code>${escapeHtml(data.email)}</code>\n🔑 <b>Kode:</b> <code>${escapeHtml(data.code)}</code>\n💎 <b>Hadiah:</b> +${data.credits} Kredit Paid\n⏰ <b>Waktu:</b> ${now} WIB`;

  return sendTelegramMessage(text);
}

export function notifyUserProUpgrade(data: { email: string; isPro: boolean }) {
  const status = data.isPro ? "⭐ <b>PRO STATUS DIAKTIFKAN!</b>" : "ℹ️ <b>PRO STATUS DINONAKTIFKAN</b>";
  const text = `${status}\n\n👤 <b>User:</b> <code>${escapeHtml(data.email)}</code>`;
  return sendTelegramMessage(text);
}

export function notifyCriticalError(data: { module: string; message: string; userEmail?: string }) {
  const text = `🚨 <b>CRITICAL SYSTEM ALERT!</b>\n\n🛠 <b>Modul:</b> ${escapeHtml(data.module)}\n👤 <b>User:</b> ${escapeHtml(data.userEmail || "System/Anonymous")}\n⚠️ <b>Pesan:</b>\n<code>${escapeHtml(data.message.slice(0, 300))}</code>`;
  return sendTelegramMessage(text);
}

export function notifySystemAlert(data: { title: string; message: string }) {
  const text = `⚠️ <b>SYSTEM ALERT: ${escapeHtml(data.title)}</b>\n\n${escapeHtml(data.message)}`;
  return sendTelegramMessage(text);
}

function escapeHtml(str?: string | null): string {
  return String(str || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}
