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
    | "list_users"
    | "inspect_user"
    | "clear_broadcast"
    | "set_broadcast"
    | "stats"
    | "topups"
    | "grant_credits"
    | "ban_user"
    | "unban_user"
    | "create_voucher"
    | "list_vouchers"
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

export async function processTelegramAIMessage(
  userText: string,
  chatId: string,
  messageThreadId?: number,
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

  const prompt = `Kamu adalah "Malesan Executive AI" — asisten pribadi Chief of Staff super cerdas, strategis, proaktif, dan setia milik Boss / Owner platform Malesan (aplikasi AI content creation workspace kreator Indonesia).
Boss berbicara santai dalam bahasa Indonesia sehari-hari.

${snapshotContext}
${currentConfigSummary}

TUGAS KAMU:
Analisis pesan dari Boss dan tentukan apakah itu perintah aksi (action/proposal) atau obrolan/konsultasi strategi/marketing (chat).

Daftar Tool / Aksi yang Tersedia:
1. list_users: melihat daftar seluruh user terdaftar di platform (email, nama, status pro, kredit). Gunakan ini jika Boss bertanya "siapa aja?", "daftar user", "list user", "user yang terdaftar". (needsConfirmation: false)
2. inspect_user: cek detail user tertentu (payload: { email: "user@email.com" atau keyword nama/email }). (needsConfirmation: false)
3. clear_broadcast: menghapus banner pengumuman di dashboard. (needsConfirmation: false)
4. set_broadcast: pasang banner pengumuman (payload: { message: "isi pengumuman" }). (needsConfirmation: false)
5. stats: ringkasan statistik komprehensif, performa, revenue, & top module. (needsConfirmation: false)
6. topups: cek antrean topup manual pending. (needsConfirmation: false)
7. get_errors: cek error log / issue teknis terkini di sistem. (needsConfirmation: false)
8. get_feedback: baca feedback & review dari user. (needsConfirmation: false)
9. list_vouchers: lihat daftar voucher aktif. (needsConfirmation: false)
10. create_voucher: buat voucher baru (payload: { code: "KODE", credits: 50 }). (needsConfirmation: false)
11. unban_user: buka blokir akun user (payload: { email: "user@email.com" }). (needsConfirmation: false)

Aksi Sensitif (Wajib needsConfirmation = true):
12. grant_credits: tambah saldo kredit manual ke user (payload: { email: "user@email.com", amount: 100, reason: "bonus" }). (needsConfirmation: true jika > 50 kredit, false jika <= 50)
13. ban_user: bekukan akun user nakal (payload: { email: "user@email.com", reason: "spam/abuse" }). (needsConfirmation: true)
14. set_module_cost: ubah harga kredit modul (payload: { moduleKey: "hook", cost: 2 }). (needsConfirmation: true)
15. toggle_module: matikan / nyalakan modul tertentu (payload: { moduleKey: "video", enabled: false }). (needsConfirmation: true)
16. set_ai_provider: ganti AI provider utama (payload: { provider: "gemini" / "groq" }). (needsConfirmation: true)
17. none: obrolan bebas, konsultasi ide konten, copy marketing, analisis bisnis, dll. (needsConfirmation: false)

Pesan dari Boss:
"${userText}"

ATURAN GAYA & FORMATTING KETAT:
- DILARANG MENGGUNAKAN BANYAK EMOJI/EMOTIKON. Jaga tampilan tetap clean, minimalis, profesional, elegan, ala executive terminal/COO.
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
          "clear_broadcast",
          "set_broadcast",
          "stats",
          "topups",
          "grant_credits",
          "ban_user",
          "unban_user",
          "create_voucher",
          "list_vouchers",
          "get_errors",
          "get_feedback",
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
      prompt: `System: You are the Malesan Executive AI Telegram Controller. Strictly avoid tacky emojis. Maintain clean executive typography. Return strict JSON only.\n\n${prompt}`,
      schema,
    });

    let parsed: AIIntentResult;
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
        case "grant_credits":
          summary = `Tambah ${parsed.payload?.amount} Kredit ke <code>${escapeHtml(parsed.payload?.email)}</code>`;
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

    // B. Direct Execution of Safe / Read Operations
    switch (parsed.actionType) {
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
