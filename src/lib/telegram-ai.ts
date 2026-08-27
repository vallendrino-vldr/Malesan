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

interface TelegramSessionContext {
  lastInspectedUser?: {
    id: string;
    email: string;
    displayName: string;
    role: string;
    isPro: boolean;
    isBanned: boolean;
    creditsFree: number;
    creditsPaid: number;
    totalCredits: number;
  };
  lastAction?: string;
  history: Array<{ role: "user" | "assistant"; text: string; timestamp: number }>;
}

async function getTelegramSessionContext(
  supabase: SupabaseClient,
  chatId: string,
  messageThreadId?: number,
): Promise<TelegramSessionContext> {
  const key = `tele_ctx:${chatId}${messageThreadId ? `:${messageThreadId}` : ""}`;
  try {
    const { data } = await supabase.from("app_config").select("value").eq("key", key).maybeSingle();
    if (data?.value) {
      return typeof data.value === "string" ? JSON.parse(data.value) : data.value;
    }
  } catch {}
  return { history: [] };
}

async function saveTelegramSessionContext(
  supabase: SupabaseClient,
  chatId: string,
  ctx: TelegramSessionContext,
  messageThreadId?: number,
) {
  const key = `tele_ctx:${chatId}${messageThreadId ? `:${messageThreadId}` : ""}`;
  try {
    if (ctx.history && ctx.history.length > 8) {
      ctx.history = ctx.history.slice(-8);
    }
    await supabase.from("app_config").upsert({
      key,
      value: ctx,
      updated_at: new Date().toISOString(),
    });
  } catch (e) {
    console.error("[telegram-ai] Failed to save session context:", e);
  }
}

interface AIIntentResult {
  intent: "action" | "chat" | "proposal";
  actionType:
    | "list_users"
    | "inspect_user"
    | "set_user_credits"
    | "grant_credits"
    | "set_user_role"
    | "set_user_pro"
    | "clear_broadcast"
    | "set_broadcast"
    | "stats"
    | "topups"
    | "ban_user"
    | "unban_user"
    | "create_voucher"
    | "list_vouchers"
    | "get_errors"
    | "get_feedback"
    | "set_module_cost"
    | "toggle_module"
    | "set_ai_provider"
    | "generate_hooks"
    | "roast_hook"
    | "save_otak_kedua"
    | "none";
  payload?: {
    message?: string;
    email?: string;
    amount?: number;
    code?: string;
    credits?: number;
    role?: "admin" | "user";
    isPro?: boolean;
    moduleKey?: string;
    cost?: number;
    enabled?: boolean;
    provider?: string;
    reason?: string;
    topic?: string;
    hookText?: string;
    referenceText?: string;
  };
  replyText: string;
  needsConfirmation: boolean;
}

export function extractEmailFromText(text: string): string | null {
  const m = text.match(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/i);
  return m ? m[0].toLowerCase() : null;
}

export function extractNumberFromText(text: string): number | null {
  const patterns = [
    /(?:jadi|ke|menjadi|set|ubah|rubah)\s*([+-]?\d+)/i,
    /(?:tambah|tambahin|isi|beri|topup|plus|\+)\s*([+-]?\d+)/i,
    /(?:kurang|kurangi|potong|minus|-)\s*(\d+)/i,
    /(\d+)\s*(?:kredit|credit|cr|poin|point)/i,
    /\b(\d+)\b/
  ];

  for (const p of patterns) {
    const m = text.match(p);
    if (m && m[1] !== undefined) {
      const n = Number(m[1]);
      if (!isNaN(n)) return n;
    }
  }
  return null;
}

export function matchFastPathIntent(text: string, lastInspectedEmail?: string): { actionType: string; payload: Record<string, unknown> } | null {
  const clean = text.trim();

  // 1. Bare email: "vadlyvldr@gmail.com"
  if (/^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/i.test(clean)) {
    return {
      actionType: "inspect_user",
      payload: { email: clean.toLowerCase() },
    };
  }

  // 2. Explicit inspect: "cek vadlyvldr@gmail.com", "detail user vadlyvldr"
  const inspectMatch = clean.match(/^(?:cek|periksa|inspect|info|profil|detail)\s*(?:user\s*|pengguna\s*)?([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}|[a-zA-Z0-9_-]{3,})$/i);
  if (inspectMatch && inspectMatch[1]) {
    return {
      actionType: "inspect_user",
      payload: { email: inspectMatch[1].toLowerCase() },
    };
  }

  const emailInText = extractEmailFromText(clean);
  const targetEmail = emailInText || lastInspectedEmail;

  // 3. Set credits: "Rubah saldo kreditnya jadi 50", "Set kredit 50", "Ubah kredit jadi 50", "vadlyvldr@gmail.com set kredit 50"
  const setCreditsMatch = clean.match(/(?:rubah|ubah|set|jadikan|ganti)\s*(?:saldo\s*)?(?:kreditnya\s*|kredit\s*)?(?:jadi\s*|ke\s*)?(\d+)/i);
  if (setCreditsMatch && setCreditsMatch[1] !== undefined && targetEmail) {
    return {
      actionType: "set_user_credits",
      payload: {
        email: targetEmail,
        credits: Number(setCreditsMatch[1]),
      },
    };
  }

  // 4. Grant credits: "Tambah 50", "Tambah 50 kredit", "+50", "vadlyvldr@gmail.com tambah 50 kredit"
  const grantCreditsMatch = clean.match(/(?:tambah|tambahin|isi|beri|topup|plus|\+)\s*(\d+)/i);
  if (grantCreditsMatch && grantCreditsMatch[1] !== undefined && targetEmail) {
    return {
      actionType: "grant_credits",
      payload: {
        email: targetEmail,
        amount: Number(grantCreditsMatch[1]),
      },
    };
  }

  return null;
}

export async function processTelegramAIMessage(
  userText: string,
  chatId: string,
  messageThreadId?: number,
  isVoiceNote = false,
) {
  const supabase = getAdminSupabase();

  // Send real-time typing indicator to Telegram app / topic
  sendChatAction(chatId, "typing", messageThreadId).catch(() => {});

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

  // 3. Fetch active conversation session context (last inspected user & recent turns)
  const sessionCtx = await getTelegramSessionContext(supabase, chatId, messageThreadId);

  let activeUserSection = "";
  if (sessionCtx.lastInspectedUser) {
    const u = sessionCtx.lastInspectedUser;
    activeUserSection = `
Konteks User Aktif yang Baru Saja Diinspeksi / Dibahas:
• Email: ${u.email}
• Nama: ${u.displayName || "Tanpa Nama"}
• Peran: ${u.role === "admin" ? "Admin (Owner)" : "Kreator"}
• Paket: ${u.isPro ? "PRO TIER" : "Free Tier"}
• Saldo Saat Ini: ${u.totalCredits} Kredit (Free: ${u.creditsFree}, Paid: ${u.creditsPaid})
• Status: ${u.isBanned ? "BANNED" : "Aktif Normal"}`;
  }

  let recentHistorySection = "";
  if (sessionCtx.history && sessionCtx.history.length > 0) {
    recentHistorySection = `
Riwayat Percakapan Terakhir:
` + sessionCtx.history.slice(-4).map(h => `- ${h.role === "user" ? "Boss" : "Asisten"}: "${h.text.replace(/\n+/g, " ").slice(0, 150)}"`).join("\n");
  }

  const voicePrefix = isVoiceNote ? "(Pesan ini dikirim via Voice Note oleh Bos)\n" : "";

  const prompt = `Kamu adalah "Malesan Executive AI" — Chief of Staff super cerdas, strategis, proaktif, dan setia milik Boss / Owner platform Malesan (aplikasi AI content creation workspace kreator Indonesia).
Boss berbicara santai dalam bahasa Indonesia sehari-hari.

${snapshotContext}
${currentConfigSummary}
${activeUserSection}
${recentHistorySection}

${voicePrefix}TUGAS KAMU:
Analisis pesan dari Boss dan tentukan apakah itu perintah aksi (action/proposal) atau obrolan/konsultasi strategi/marketing (chat).

Daftar Tool / Aksi yang Tersedia:
1. list_users: melihat daftar user terdaftar (needsConfirmation: false)
2. inspect_user: cek detail user tertentu (payload: { email: "user@email.com" atau nama }). (needsConfirmation: false)
3. set_user_credits: setel saldo kredit user ke angka target tertentu (contoh: "rubah kreditnya jadi 50", "set kredit vadlyvldr jadi 100"). (payload: { email: "user@email.com", credits: 50, reason: "alasan" }). (needsConfirmation: false jika delta <= 200, true jika delta > 200)
4. grant_credits: tambah/kurangi saldo kredit user (payload: { email: "user@email.com", amount: 100, reason: "bonus" }). (needsConfirmation: false jika <= 100, true jika > 100)
5. set_user_role: ubah peran user (payload: { email: "user@email.com", role: "admin" | "user" }). (needsConfirmation: true)
6. set_user_pro: ubah status PRO user (payload: { email: "user@email.com", isPro: true | false }). (needsConfirmation: false)
7. clear_broadcast: menghapus banner pengumuman di dashboard. (needsConfirmation: false)
8. set_broadcast: pasang banner pengumuman (payload: { message: "isi pengumuman" }). (needsConfirmation: false)
9. stats: ringkasan statistik komprehensif, performa, revenue, & top module. (needsConfirmation: false)
10. topups: cek antrean topup manual pending. (needsConfirmation: false)
11. get_errors: cek error log / issue teknis terkini di sistem. (needsConfirmation: false)
12. get_feedback: baca feedback & review dari user. (needsConfirmation: false)
13. list_vouchers: lihat daftar voucher aktif. (needsConfirmation: false)
14. create_voucher: buat voucher baru (payload: { code: "KODE", credits: 50 }). (needsConfirmation: false)
15. ban_user: bekukan akun user nakal (payload: { email: "user@email.com", reason: "spam/abuse" }). (needsConfirmation: true)
16. unban_user: buka blokir akun user (payload: { email: "user@email.com" }). (needsConfirmation: false)

Fitur Studio & Knowledge In-Chat:
17. generate_hooks: buatkan 3 hook video viral untuk topik tertentu (payload: { topic: "topik konten" }). (needsConfirmation: false)
18. roast_hook: uji dan bedah kelemahan hook konten, prediksi retensi %, dan berikan versi perbaikan (payload: { hookText: "teks hook" }). (needsConfirmation: false)
19. save_otak_kedua: simpan catatan, ide, atau tautan referensi ke Otak Kedua / DNA Akun Owner (payload: { referenceText: "isi catatan / link referensi" }). (needsConfirmation: false)

Konfigurasi Sistem:
20. set_module_cost: ubah harga kredit modul (payload: { moduleKey: "hook", cost: 2 }). (needsConfirmation: true). PERINGATAN: HANYA gunakan jika Boss menyebutkan modul tertentu (seperti hook, script, video, ide).
21. toggle_module: matikan / nyalakan modul tertentu (payload: { moduleKey: "video", enabled: false }). (needsConfirmation: true)
22. set_ai_provider: ganti AI provider utama (payload: { provider: "gemini" | "groq" }). (needsConfirmation: true)
23. none: obrolan bebas, konsultasi ide konten, copy marketing, analisis bisnis, dll. (needsConfirmation: false)

PANDUAN RESOLUSI KONTEKS & PRONOUN KETAT:
- Jika Boss mengatakan "rubah kreditnya jadi X", "tambah 20 kredit", "banned dia", "jadikan admin" tanpa menyebut email, MAKA OTOMATIS gunakan email dari "Konteks User Aktif" di atas!
- Pesan "rubah kreditnya jadi 50" adalah actionType "set_user_credits" dengan credits: 50. JANGAN PERNAH salah mengira ini sebagai set_module_cost!

Pesan dari Boss:
"${userText}"

ATURAN GAYA & FORMATTING KETAT:
- DILARANG KERAS MENGGUNAKAN EMOJI APAPUN. Tampilan harus clean, minimalis, profesional, elegan, ala executive terminal/COO.
- Gunakan struktur tipografi yang rapi: Header kapital/bold, bullet point standar •, code block monospace.
- Panggil "Bos", gunakan bahasa Indonesia santai tapi berbobot, tajam, dan solutif.
- Output HANYA JSON sesuai format schema.`;

  const schema = {
    type: "OBJECT",
    properties: {
      intent: { type: "STRING", enum: ["action", "chat", "proposal"] },
      actionType: {
        type: "STRING",
        enum: [
          "list_users",
          "inspect_user",
          "set_user_credits",
          "grant_credits",
          "set_user_role",
          "set_user_pro",
          "clear_broadcast",
          "set_broadcast",
          "stats",
          "topups",
          "ban_user",
          "unban_user",
          "create_voucher",
          "list_vouchers",
          "get_errors",
          "get_feedback",
          "set_module_cost",
          "toggle_module",
          "set_ai_provider",
          "generate_hooks",
          "roast_hook",
          "save_otak_kedua",
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
          role: { type: "STRING", enum: ["admin", "user"] },
          isPro: { type: "BOOLEAN" },
          moduleKey: { type: "STRING" },
          cost: { type: "NUMBER" },
          enabled: { type: "BOOLEAN" },
          provider: { type: "STRING" },
          reason: { type: "STRING" },
          topic: { type: "STRING" },
          hookText: { type: "STRING" },
          referenceText: { type: "STRING" },
        },
      },
      replyText: { type: "STRING" },
      needsConfirmation: { type: "BOOLEAN" },
    },
    required: ["intent", "actionType", "replyText", "needsConfirmation"],
  };

  try {
    const fastPath = matchFastPathIntent(userText, sessionCtx.lastInspectedUser?.email);
    let parsed: AIIntentResult;

    if (fastPath) {
      parsed = {
        intent: "action",
        actionType: fastPath.actionType as AIIntentResult["actionType"],
        payload: fastPath.payload,
        replyText: "",
        needsConfirmation: false,
      };
    } else {
      const rawRes = await generate({
        prompt: `System: You are the Malesan Executive AI Telegram Controller. Strictly avoid tacky emojis. Maintain clean executive typography. Return strict JSON only.\n\n${prompt}`,
        schema,
      });

      try {
        parsed = JSON.parse(rawRes.trim()) as AIIntentResult;
      } catch {
        console.warn("[telegram-ai] Failed to parse JSON response:", rawRes);
        await sendTelegramMessage(rawRes || "Siap Bos, ada yang bisa saya bantu?", {
          chatId,
          messageThreadId,
        });
        return;
      }
    }

    // Resolve target email from session context or userText if empty
    const extractedEmail = extractEmailFromText(userText);
    const extractedNumber = extractNumberFromText(userText);

    if (!parsed.payload) parsed.payload = {};
    if (!parsed.payload.email) {
      parsed.payload.email = extractedEmail || sessionCtx.lastInspectedUser?.email;
    }

    // A. Human-In-The-Loop Confirmation Flow
    if (parsed.needsConfirmation && parsed.actionType !== "none") {
      const actionId = `act_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;

      await supabase.from("app_config").upsert({
        key: `tele_act:${actionId}`,
        value: JSON.stringify({
          actionType: parsed.actionType,
          payload: parsed.payload,
          createdAt: Date.now(),
        }),
        updated_at: new Date().toISOString(),
      });

      let summary = "";
      switch (parsed.actionType) {
        case "set_user_credits":
          summary = `Ubah total kredit <code>${escapeHtml(parsed.payload?.email)}</code> jadi ${parsed.payload?.credits} Kredit`;
          break;
        case "grant_credits":
          summary = `Tambah ${parsed.payload?.amount} Kredit ke <code>${escapeHtml(parsed.payload?.email)}</code>`;
          break;
        case "set_user_role":
          summary = `Ubah peran <code>${escapeHtml(parsed.payload?.email)}</code> jadi <b>${parsed.payload?.role?.toUpperCase()}</b>`;
          break;
        case "ban_user":
          summary = `Blokir akun <code>${escapeHtml(parsed.payload?.email)}</code> (Alasan: ${escapeHtml(parsed.payload?.reason || "-")})`;
          break;
        case "set_module_cost":
          summary = `Ubah tarif modul <b>${MODULE_LABELS[parsed.payload?.moduleKey || ""] || parsed.payload?.moduleKey}</b> jadi ${parsed.payload?.cost} Kredit`;
          break;
        case "toggle_module":
          summary = `Ubah status modul <b>${MODULE_LABELS[parsed.payload?.moduleKey || ""] || parsed.payload?.moduleKey}</b> jadi ${parsed.payload?.enabled ? "AKTIF" : "NONAKTIF (KILL-SWITCH)"}`;
          break;
        case "set_ai_provider":
          summary = `Ganti AI Provider utama ke <b>${escapeHtml(parsed.payload?.provider?.toUpperCase())}</b>`;
          break;
        default:
          summary = `Eksekusi ${parsed.actionType}`;
      }

      const proposalText = `<b>[KONFIRMASI TINDAKAN]</b>\n\n${parsed.replyText}\n\n• <b>Rincian Aksi:</b> ${summary}\n\n<i>Gunakan tombol di bawah untuk eksekusi:</i>`;

      await sendTelegramMessage(proposalText, {
        chatId,
        messageThreadId,
        replyMarkup: {
          inline_keyboard: [
            [
              { text: "Eksekusi Sekarang", callback_data: `exec_action:${actionId}` },
              { text: "Batalkan", callback_data: `cancel_action:${actionId}` },
            ],
          ],
        },
      });
      return;
    }

    // B. Direct Execution of Safe / Read / Direct Operations
    switch (parsed.actionType) {
      case "set_user_credits": {
        const email = String(parsed.payload?.email || extractedEmail || sessionCtx.lastInspectedUser?.email || "").trim().toLowerCase();

        let targetCredits: number | null = null;
        if (typeof parsed.payload?.credits === "number" && !isNaN(parsed.payload.credits)) {
          targetCredits = parsed.payload.credits;
        } else if (typeof parsed.payload?.amount === "number" && !isNaN(parsed.payload.amount)) {
          targetCredits = parsed.payload.amount;
        } else {
          targetCredits = extractedNumber;
        }

        if (!email) {
          await sendTelegramMessage("Mohon sebutkan email user yang ingin diubah kreditnya, Bos.", { chatId, messageThreadId });
          return;
        }

        if (targetCredits === null) {
          await sendTelegramMessage("Mohon sebutkan nominal target saldo kredit yang diinginkan, Bos (contoh: <i>'Rubah kreditnya jadi 50'</i>).", { chatId, messageThreadId });
          return;
        }

        const { data: user } = await supabase
          .from("profiles")
          .select("id, email, display_name, role, is_pro, is_banned, credits_free, credits_paid")
          .or(`email.ilike.%${email}%,display_name.ilike.%${email}%`)
          .limit(1)
          .maybeSingle();

        if (!user) {
          await sendTelegramMessage(`User <code>${escapeHtml(email)}</code> tidak ditemukan di database.`, { chatId, messageThreadId });
          return;
        }

        const currentFree = user.credits_free || 0;
        const currentPaid = user.credits_paid || 0;
        const currentTotal = currentFree + currentPaid;
        const target = Math.max(0, targetCredits);
        const delta = target - currentTotal;

        let newFree = currentFree;
        let newPaid = currentPaid;
        if (target >= currentFree) {
          newPaid = target - currentFree;
        } else {
          newFree = target;
          newPaid = 0;
        }

        await supabase
          .from("profiles")
          .update({ credits_free: newFree, credits_paid: newPaid })
          .eq("id", user.id);

        if (delta !== 0) {
          await supabase.from("credit_ledger").insert({
            user_id: user.id,
            delta: delta,
            bucket: "paid",
            reason: parsed.payload?.reason || "admin_set_credits_via_telegram",
            ref_id: crypto.randomUUID(),
            balance_after: target,
          });
        }

        // Update session context
        sessionCtx.lastInspectedUser = {
          id: user.id,
          email: user.email,
          displayName: user.display_name || "Tanpa Nama",
          role: user.role,
          isPro: user.is_pro,
          isBanned: user.is_banned,
          creditsFree: newFree,
          creditsPaid: newPaid,
          totalCredits: target,
        };
        sessionCtx.history.push(
          { role: "user", text: userText, timestamp: Date.now() },
          { role: "assistant", text: `Saldo kredit ${user.email} diubah jadi ${target}`, timestamp: Date.now() },
        );
        await saveTelegramSessionContext(supabase, chatId, sessionCtx, messageThreadId);

        const deltaText = delta > 0 ? `+${delta}` : `${delta}`;
        const responseMsg = `<b>[SALDO KREDIT DIUBAH]</b>\n\n• <b>User:</b> <code>${escapeHtml(user.email)}</code> (${escapeHtml(user.display_name || "Tanpa Nama")})\n• <b>Saldo Lama:</b> ${currentTotal} Kredit (Free: ${currentFree}, Paid: ${currentPaid})\n• <b>Saldo Baru:</b> ${target} Kredit (Free: ${newFree}, Paid: ${newPaid})\n• <b>Penyesuaian:</b> ${deltaText} Kredit\n• <b>Status:</b> Berhasil diperbarui secara atomik di database.`;

        await sendTelegramMessage(responseMsg, { chatId, messageThreadId });
        return;
      }

      case "grant_credits": {
        const email = String(parsed.payload?.email || extractedEmail || sessionCtx.lastInspectedUser?.email || "").trim().toLowerCase();

        let amount: number | null = null;
        if (typeof parsed.payload?.amount === "number" && !isNaN(parsed.payload.amount) && parsed.payload.amount !== 0) {
          amount = parsed.payload.amount;
        } else if (typeof parsed.payload?.credits === "number" && !isNaN(parsed.payload.credits) && parsed.payload.credits !== 0) {
          amount = parsed.payload.credits;
        } else {
          amount = extractedNumber;
        }

        if (!email) {
          await sendTelegramMessage("Mohon sebutkan email user yang ingin ditambah kreditnya, Bos.", { chatId, messageThreadId });
          return;
        }

        if (amount === null || amount === 0) {
          await sendTelegramMessage("Mohon sebutkan nominal kredit yang ingin ditambahkan, Bos (contoh: <i>'Tambah 50 kredit'</i>).", { chatId, messageThreadId });
          return;
        }

        const { data: user } = await supabase
          .from("profiles")
          .select("id, email, display_name, role, is_pro, is_banned, credits_free, credits_paid")
          .or(`email.ilike.%${email}%,display_name.ilike.%${email}%`)
          .limit(1)
          .maybeSingle();

        if (!user) {
          await sendTelegramMessage(`User <code>${escapeHtml(email)}</code> tidak ditemukan di database.`, { chatId, messageThreadId });
          return;
        }

        const { error: grantErr } = await supabase.rpc("grant_credits", {
          p_user: user.id,
          p_amount: amount,
          p_bucket: "paid",
          p_reason: parsed.payload?.reason || "telegram_admin_grant",
        });

        if (grantErr) {
          await sendTelegramMessage(`Gagal menambahkan kredit: ${grantErr.message}`, { chatId, messageThreadId });
          return;
        }

        const newPaid = (user.credits_paid || 0) + amount;
        const newTotal = (user.credits_free || 0) + newPaid;

        sessionCtx.lastInspectedUser = {
          id: user.id,
          email: user.email,
          displayName: user.display_name || "Tanpa Nama",
          role: user.role,
          isPro: user.is_pro,
          isBanned: user.is_banned,
          creditsFree: user.credits_free || 0,
          creditsPaid: newPaid,
          totalCredits: newTotal,
        };
        sessionCtx.history.push(
          { role: "user", text: userText, timestamp: Date.now() },
          { role: "assistant", text: `Tambah ${amount} kredit ke ${user.email}`, timestamp: Date.now() },
        );
        await saveTelegramSessionContext(supabase, chatId, sessionCtx, messageThreadId);

        const responseMsg = `<b>[KREDIT DITAMBAHKAN]</b>\n\n• <b>User:</b> <code>${escapeHtml(user.email)}</code> (${escapeHtml(user.display_name || "Tanpa Nama")})\n• <b>Nominal Masuk:</b> +${amount} Kredit Paid\n• <b>Saldo Total Sekarang:</b> ${newTotal} Kredit\n• <b>Status:</b> Berhasil masuk ke akun user.`;

        await sendTelegramMessage(responseMsg, { chatId, messageThreadId });
        return;
      }

      case "set_user_role": {
        const email = String(parsed.payload?.email || sessionCtx.lastInspectedUser?.email || "").trim().toLowerCase();
        const role = parsed.payload?.role === "admin" ? "admin" : "user";

        if (!email) {
          await sendTelegramMessage("Mohon sebutkan email user, Bos.", { chatId, messageThreadId });
          return;
        }

        const { data: user } = await supabase.from("profiles").select("id, email, display_name").or(`email.ilike.%${email}%,display_name.ilike.%${email}%`).limit(1).maybeSingle();
        if (!user) {
          await sendTelegramMessage(`User <code>${escapeHtml(email)}</code> tidak ditemukan.`, { chatId, messageThreadId });
          return;
        }

        await supabase.from("profiles").update({ role }).eq("id", user.id);
        const responseMsg = `<b>[PERAN PENGGUNA DIUBAH]</b>\n\n• <b>User:</b> <code>${escapeHtml(user.email)}</code>\n• <b>Peran Baru:</b> <b>${role.toUpperCase()}</b>`;
        await sendTelegramMessage(responseMsg, { chatId, messageThreadId });
        return;
      }

      case "set_user_pro": {
        const email = String(parsed.payload?.email || sessionCtx.lastInspectedUser?.email || "").trim().toLowerCase();
        const isPro = Boolean(parsed.payload?.isPro);

        if (!email) {
          await sendTelegramMessage("Mohon sebutkan email user, Bos.", { chatId, messageThreadId });
          return;
        }

        const { data: user } = await supabase.from("profiles").select("id, email, display_name").or(`email.ilike.%${email}%,display_name.ilike.%${email}%`).limit(1).maybeSingle();
        if (!user) {
          await sendTelegramMessage(`User <code>${escapeHtml(email)}</code> tidak ditemukan.`, { chatId, messageThreadId });
          return;
        }

        await supabase.from("profiles").update({ is_pro: isPro }).eq("id", user.id);
        const statusText = isPro ? "PRO TIER (Aktif)" : "Free Tier (Reguler)";
        const responseMsg = `<b>[STATUS PAKET DIUBAH]</b>\n\n• <b>User:</b> <code>${escapeHtml(user.email)}</code>\n• <b>Paket Baru:</b> <b>${statusText}</b>`;
        await sendTelegramMessage(responseMsg, { chatId, messageThreadId });
        return;
      }

      case "generate_hooks": {
        const topic = parsed.payload?.topic || userText;
        const hookPrompt = `Buat 3 opsi hook video pendek viral (TikTok/Reels) tentang topik: "${topic}".
Format output:
1. Hook Pola Penasaran (Curiosity Gap) + Estimasi Retensi %
2. Hook Pola Kontras / Tamparan Realita + Estimasi Retensi %
3. Hook Pola Solusi Instan (Problem-Action) + Estimasi Retensi %
DILARANG MENGGUNAKAN EMOJI.`;

        const hookResult = await generate({ prompt: hookPrompt });
        const cleanHooks = hookResult.replace(/[🌀-🧿☀-⛿✀-➿🇠-🇿🨀-🫿]/gu, "");
        const responseMsg = `<b>[HASIL HOOK LAB IN-CHAT]</b>\n• <b>Topik:</b> ${escapeHtml(topic)}\n\n${cleanHooks}`;
        await sendTelegramMessage(responseMsg, { chatId, messageThreadId });
        return;
      }

      case "roast_hook": {
        const hook = parsed.payload?.hookText || userText;
        const roastPrompt = `Bedah dan uji kelemahan hook konten ini terhadap psikologi penonton Indonesia:
"${hook}"

Berikan:
1. Skor Prediksi Retensi 3 Detik Awal (1-100%)
2. Analisis Kelemahan (Kenapa audiens bisa skip)
3. 2 Versi Revisi Lebih Tajam & Nendang
DILARANG MENGGUNAKAN EMOJI.`;

        const roastResult = await generate({ prompt: roastPrompt });
        const cleanRoast = roastResult.replace(/[🌀-🧿☀-⛿✀-➿🇠-🇿🨀-🫿]/gu, "");
        const responseMsg = `<b>[EVALUASI HOOK & PREDIKSI RETENSI]</b>\n• <b>Hook Diuji:</b> "<i>${escapeHtml(hook)}</i>"\n\n${cleanRoast}`;
        await sendTelegramMessage(responseMsg, { chatId, messageThreadId });
        return;
      }

      case "save_otak_kedua": {
        const ref = parsed.payload?.referenceText || userText;
        // Fetch admin user
        const { data: adminProfile } = await supabase.from("profiles").select("id").eq("role", "admin").limit(1).maybeSingle();
        if (adminProfile) {
          const { data: existingDna } = await supabase.from("creator_dna").select("brand_notes").eq("user_id", adminProfile.id).maybeSingle();
          const oldNotes = existingDna?.brand_notes || "";
          const newNotes = oldNotes ? `${oldNotes}\n\n• [${new Date().toLocaleDateString("id-ID")}] ${ref}` : `• [${new Date().toLocaleDateString("id-ID")}] ${ref}`;

          await supabase.from("creator_dna").upsert({
            user_id: adminProfile.id,
            brand_notes: newNotes,
            updated_at: new Date().toISOString(),
          });
        }

        await sendTelegramMessage(
          `<b>[OTAK KEDUA DIPERBARUI]</b>\n\n• <b>Catatan Disimpan:</b>\n<i>"${escapeHtml(ref)}"</i>\n\nReferensi ini otomatis terintegrasi ke dalam AI Studio Malesan lo, Bos.`,
          { chatId, messageThreadId },
        );
        return;
      }

      case "list_users": {
        const { data: users, error: uErr } = await supabase
          .from("profiles")
          .select("id, email, display_name, role, is_pro, is_banned, credits_free, credits_paid, created_at")
          .order("created_at", { ascending: false })
          .limit(15);

        if (uErr || !users || users.length === 0) {
          await sendTelegramMessage("<b>[DAFTAR PENGGUNA]</b> Belum ada user terdaftar di database.", {
            chatId,
            messageThreadId,
          });
          return;
        }

        const userRows = users
          .map((u, i) => {
            const roleBadge = u.role === "admin" ? "Admin" : "User";
            const proBadge = u.is_pro ? "PRO" : "Free";
            const statusBadge = u.is_banned ? "Banned" : "Aktif";
            const totalCredits = (u.credits_free || 0) + (u.credits_paid || 0);
            return `<b>${i + 1}. ${escapeHtml(u.display_name || "Tanpa Nama")}</b> (<code>${escapeHtml(u.email)}</code>)\n   • Status: ${roleBadge} | ${proBadge} | ${statusBadge}\n   • Saldo: ${totalCredits} Kredit (Free: ${u.credits_free || 0}, Paid: ${u.credits_paid || 0})`;
          })
          .join("\n\n");

        const message = `<b>[DAFTAR PENGGUNA TERDAFTAR]</b> (Total: ${users.length} Akun Terkini)\n\n${userRows}\n\n<i>Ketik <code>Cek user &lt;email&gt;</code> untuk inspeksi mendalam satu user.</i>`;
        await sendTelegramMessage(message, { chatId, messageThreadId });
        return;
      }

      case "inspect_user": {
        const query = String(parsed.payload?.email || "").trim().toLowerCase();
        if (!query) {
          await sendTelegramMessage("Mohon sebutkan email user yang ingin dicek, Bos.", {
            chatId,
            messageThreadId,
          });
          return;
        }

        const { data: users } = await supabase
          .from("profiles")
          .select("id, email, display_name, role, is_pro, is_banned, ban_reason, credits_free, credits_paid, created_at")
          .or(`email.ilike.%${query}%,display_name.ilike.%${query}%`)
          .limit(1);

        const user = users?.[0];

        if (!user) {
          await sendTelegramMessage(`User <code>${escapeHtml(query)}</code> tidak ditemukan di database.\nKetik <b>"Daftar user"</b> untuk melihat semua akun yang ada, Bos.`, {
            chatId,
            messageThreadId,
          });
          return;
        }

        const { count: genCount } = await supabase
          .from("generations")
          .select("id", { count: "exact", head: true })
          .eq("user_id", user.id);

        const joined = new Date(user.created_at).toLocaleDateString("id-ID", { dateStyle: "medium" });
        const totalCredits = (user.credits_free || 0) + (user.credits_paid || 0);
        const roleText = user.role === "admin" ? "Admin (Owner)" : "Kreator";

        // Record to session context for subsequent pronoun / credit modification requests
        sessionCtx.lastInspectedUser = {
          id: user.id,
          email: user.email,
          displayName: user.display_name || "Tanpa Nama",
          role: user.role,
          isPro: user.is_pro,
          isBanned: user.is_banned,
          creditsFree: user.credits_free || 0,
          creditsPaid: user.credits_paid || 0,
          totalCredits,
        };
        sessionCtx.history.push(
          { role: "user", text: userText, timestamp: Date.now() },
          { role: "assistant", text: `Detail user: ${user.email} (Saldo: ${totalCredits})`, timestamp: Date.now() },
        );
        await saveTelegramSessionContext(supabase, chatId, sessionCtx, messageThreadId);

        const userCard = `<b>[DETAIL PROFIL PENGGUNA]</b>\n\n• <b>Email:</b> <code>${escapeHtml(user.email)}</code>\n• <b>Nama:</b> ${escapeHtml(user.display_name || "Tanpa Nama")}\n• <b>Peran:</b> ${roleText}\n• <b>Paket:</b> ${user.is_pro ? "PRO TIER (Aktif)" : "Free Tier"}\n• <b>Saldo Kredit:</b> ${totalCredits} (Free: ${user.credits_free || 0}, Paid: ${user.credits_paid || 0})\n• <b>Generasi Konten:</b> ${genCount || 0} kali\n• <b>Terdaftar:</b> ${joined}\n• <b>Status Akun:</b> ${user.is_banned ? `BANNED (${escapeHtml(user.ban_reason || "-")})` : "Aktif Normal"}`;

        await sendTelegramMessage(userCard, { chatId, messageThreadId });
        return;
      }

      case "get_errors": {
        const { data: errs } = await supabase
          .from("error_logs")
          .select("error_message, module_name, created_at")
          .order("created_at", { ascending: false })
          .limit(5);

        if (!errs || errs.length === 0) {
          await sendTelegramMessage("<b>[SYSTEM HEALTH]</b> Semua sistem sehat. Tidak ada error tercatat dalam riwayat.", {
            chatId,
            messageThreadId,
          });
          return;
        }

        const errList = errs
          .map(
            (e, i) =>
              `<b>${i + 1}. [${escapeHtml(e.module_name || "Sistem")}]</b>\n<i>${escapeHtml(String(e.error_message).slice(0, 120))}</i>`,
          )
          .join("\n\n");

        await sendTelegramMessage(`<b>[LOG ERROR TERAKHIR]</b>\n\n${errList}`, {
          chatId,
          messageThreadId,
        });
        return;
      }

      case "get_feedback": {
        const { data: fbs } = await supabase
          .from("feedback")
          .select("rating, comment, module_name, created_at, profiles(email)")
          .order("created_at", { ascending: false })
          .limit(5);

        if (!fbs || fbs.length === 0) {
          await sendTelegramMessage("Belum ada feedback baru yang masuk dari user.", {
            chatId,
            messageThreadId,
          });
          return;
        }

        const fbList = (fbs as Array<{ rating: number; comment?: string; module_name?: string; profiles?: { email?: string } | { email?: string }[] }>)
          .map((f, i) => {
            const email = Array.isArray(f.profiles) ? f.profiles[0]?.email : f.profiles?.email || "User";
            return `<b>${i + 1}. Rating ${f.rating}/5</b> - <code>${escapeHtml(email)}</code>\n• Modul: ${escapeHtml(f.module_name || "Umum")}\n• Catatan: "${escapeHtml(f.comment || "Tanpa catatan")}"`;
          })
          .join("\n\n");

        await sendTelegramMessage(`<b>[FEEDBACK TERBARU USER]</b>\n\n${fbList}`, {
          chatId,
          messageThreadId,
        });
        return;
      }

      case "list_vouchers": {
        const { data: vouchers } = await supabase
          .from("vouchers")
          .select("code, credits, is_redeemed, created_at")
          .order("created_at", { ascending: false })
          .limit(10);

        if (!vouchers || vouchers.length === 0) {
          await sendTelegramMessage("Belum ada voucher yang dibuat.", {
            chatId,
            messageThreadId,
          });
          return;
        }

        const list = vouchers
          .map(
            (v, i) =>
              `<b>${i + 1}. <code>${escapeHtml(v.code)}</code></b> — ${v.credits} Kredit [${v.is_redeemed ? "Terpakai" : "Aktif"}]`,
          )
          .join("\n");

        await sendTelegramMessage(`<b>[DAFTAR VOUCHER TERBARU]</b>\n\n${list}`, {
          chatId,
          messageThreadId,
        });
        return;
      }

      case "create_voucher": {
        const code = String(parsed.payload?.code || `PROMO${Math.random().toString(36).slice(2, 6).toUpperCase()}`).trim().toUpperCase();
        const credits = Number(parsed.payload?.credits || 50);

        const { error } = await supabase.from("vouchers").insert({
          code,
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
          `<b>[VOUCHER BERHASIL DIBUAT]</b>\n\n• <b>Kode:</b> <code>${code}</code>\n• <b>Nominal:</b> +${credits} Kredit Paid\n\n<i>Kode voucher ini sudah aktif dan siap dibagikan ke user.</i>`,
          { chatId, messageThreadId },
        );
        return;
      }

      case "clear_broadcast": {
        await supabase.from("app_config").upsert({
          key: "dashboard_notice",
          value: "",
          updated_at: new Date().toISOString(),
        });
        await sendTelegramMessage("<b>[PENGUMUMAN DIHAPUS]</b> Banner pengumuman dashboard telah dibersihkan.", {
          chatId,
          messageThreadId,
        });
        return;
      }

      case "set_broadcast": {
        const msg = String(parsed.payload?.message || "").trim();
        if (!msg) {
          await sendTelegramMessage("Pesan pengumuman tidak boleh kosong, Bos.", {
            chatId,
            messageThreadId,
          });
          return;
        }
        await supabase.from("app_config").upsert({
          key: "dashboard_notice",
          value: msg,
          updated_at: new Date().toISOString(),
        });
        await sendTelegramMessage(
          `<b>[BANNER PENGUMUMAN DIPASANG]</b>\n\n<i>"${escapeHtml(msg)}"</i>\n\nSemua user sekarang melihat pengumuman ini di dashboard.`,
          { chatId, messageThreadId },
        );
        return;
      }

      case "unban_user": {
        const email = String(parsed.payload?.email || "").trim().toLowerCase();
        if (email) {
          await supabase.from("profiles").update({ is_banned: false, ban_reason: null }).ilike("email", `%${email}%`);
        }
        await sendTelegramMessage(`<b>[AKUN DIAKTIFKAN KEMBALI]</b> ${parsed.replyText}`, {
          chatId,
          messageThreadId,
        });
        return;
      }

      case "stats":
      case "topups":
      case "none":
      default: {
        sessionCtx.history.push(
          { role: "user", text: userText, timestamp: Date.now() },
          { role: "assistant", text: parsed.replyText, timestamp: Date.now() },
        );
        await saveTelegramSessionContext(supabase, chatId, sessionCtx, messageThreadId);

        await sendTelegramMessage(parsed.replyText, {
          chatId,
          messageThreadId,
        });
        return;
      }
    }
  } catch (err) {
    console.error("[telegram-ai] error:", err);
    await sendTelegramMessage(
      `Pesan diterima: "${escapeHtml(userText)}".\nKetik /help untuk melihat ringkasan perintah ya, Bos.`,
      { chatId, messageThreadId },
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
    return "Tindakan ini sudah kedaluwarsa atau sudah pernah dieksekusi sebelumnya.";
  }

  let actionData: { actionType: string; payload?: Record<string, unknown>; createdAt: number };
  try {
    actionData = typeof row.value === "string" ? JSON.parse(row.value) : row.value;
  } catch {
    return "Gagal membaca tiket tindakan.";
  }

  await supabase.from("app_config").delete().eq("key", `tele_act:${actionId}`);

  switch (actionData.actionType) {
    case "set_user_credits": {
      const email = String(actionData.payload?.email || "").trim().toLowerCase();
      const targetCredits = Number(actionData.payload?.credits ?? actionData.payload?.amount ?? 0);
      if (!email) return "Email user tidak valid.";

      const { data: user } = await supabase.from("profiles").select("id, email, display_name, credits_free, credits_paid").ilike("email", `%${email}%`).maybeSingle();
      if (!user) return `User <code>${escapeHtml(email)}</code> tidak ditemukan.`;

      const currentFree = user.credits_free || 0;
      const currentPaid = user.credits_paid || 0;
      const currentTotal = currentFree + currentPaid;
      const target = Math.max(0, targetCredits);
      const delta = target - currentTotal;

      let newFree = currentFree;
      let newPaid = currentPaid;
      if (target >= currentFree) {
        newPaid = target - currentFree;
      } else {
        newFree = target;
        newPaid = 0;
      }

      await supabase.from("profiles").update({ credits_free: newFree, credits_paid: newPaid }).eq("id", user.id);
      if (delta !== 0) {
        await supabase.from("credit_ledger").insert({
          user_id: user.id,
          delta: delta,
          bucket: "paid",
          reason: String(actionData.payload?.reason || "admin_set_credits_via_telegram"),
          ref_id: crypto.randomUUID(),
          balance_after: target,
        });
      }

      return `<b>[SALDO KREDIT DIUBAH]</b>\n\n• <b>User:</b> <code>${escapeHtml(user.email)}</code>\n• <b>Saldo Lama:</b> ${currentTotal} Kredit\n• <b>Saldo Baru:</b> ${target} Kredit (Free: ${newFree}, Paid: ${newPaid})\n• <b>Status:</b> Berhasil diperbarui secara atomik.`;
    }

    case "grant_credits": {
      const email = String(actionData.payload?.email || "").trim().toLowerCase();
      const amount = Number(actionData.payload?.amount || 0);
      const reason = String(actionData.payload?.reason || "telegram_admin_bonus");
      if (!email || !amount) return "Data email atau nominal kredit tidak valid.";

      const { data: user } = await supabase.from("profiles").select("id").ilike("email", `%${email}%`).maybeSingle();
      if (!user) return `User dengan email <code>${escapeHtml(email)}</code> tidak ditemukan.`;

      const { error: grantErr } = await supabase.rpc("grant_credits", {
        p_user: user.id,
        p_amount: amount,
        p_bucket: "paid",
        p_reason: reason,
      });

      if (grantErr) return `Gagal menambahkan kredit: ${grantErr.message}`;
      return `<b>[KREDIT DITAMBAHKAN]</b>\n\n+${amount} Kredit paid telah masuk ke akun <code>${escapeHtml(email)}</code>.`;
    }

    case "set_user_role": {
      const email = String(actionData.payload?.email || "").trim().toLowerCase();
      const role = actionData.payload?.role === "admin" ? "admin" : "user";
      if (!email) return "Email tidak valid.";
      await supabase.from("profiles").update({ role }).ilike("email", `%${email}%`);
      return `<b>[PERAN PENGGUNA DIUBAH]</b>\n\nUser <code>${escapeHtml(email)}</code> sekarang memiliki peran <b>${role.toUpperCase()}</b>.`;
    }

    case "set_user_pro": {
      const email = String(actionData.payload?.email || "").trim().toLowerCase();
      const isPro = Boolean(actionData.payload?.isPro);
      if (!email) return "Email tidak valid.";
      await supabase.from("profiles").update({ is_pro: isPro }).ilike("email", `%${email}%`);
      const statusText = isPro ? "PRO TIER (Aktif)" : "Free Tier (Reguler)";
      return `<b>[STATUS PAKET DIUBAH]</b>\n\nUser <code>${escapeHtml(email)}</code> sekarang berstatus <b>${statusText}</b>.`;
    }

    case "ban_user": {
      const email = String(actionData.payload?.email || "").trim().toLowerCase();
      if (!email) return "Email tidak valid.";
      await supabase.from("profiles").update({ is_banned: true, ban_reason: actionData.payload?.reason || "Admin moderation via Telegram" }).ilike("email", `%${email}%`);
      return `<b>[AKUN DIBEKUKAN]</b>\n\nUser <code>${escapeHtml(email)}</code> telah dibanned dari platform.`;
    }

    case "set_module_cost": {
      const moduleKey = String(actionData.payload?.moduleKey || "").trim();
      const cost = Number(actionData.payload?.cost || 0);
      if (!moduleKey || cost < 0) return "Modul atau biaya tidak valid.";

      await supabase.from("app_config").upsert({
        key: `credit_cost_${moduleKey}`,
        value: cost,
        updated_at: new Date().toISOString(),
      });
      return `<b>[HARGA MODUL DIUBAH]</b>\n\nModul <b>${MODULE_LABELS[moduleKey] || moduleKey}</b> sekarang bertarif <b>${cost} Kredit</b>.`;
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

      const statusText = enabled ? "AKTIF" : "NONAKTIF (KILL-SWITCH)";
      return `<b>[STATUS MODUL DIPERBARUI]</b>\n\nModul <b>${MODULE_LABELS[moduleKey] || moduleKey}</b>: ${statusText}.`;
    }

    case "set_ai_provider": {
      const provider = String(actionData.payload?.provider || "gemini").toLowerCase();
      if (!["gemini", "groq"].includes(provider)) return "Provider tidak valid. Pilih gemini atau groq.";

      await supabase.from("app_config").upsert({
        key: "ai_provider",
        value: provider,
        updated_at: new Date().toISOString(),
      });
      return `<b>[AI PROVIDER DIGANTI]</b>\n\nPlatform sekarang menggunakan engine <b>${provider.toUpperCase()}</b>.`;
    }

    default:
      return "Tindakan tidak dikenali.";
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
