import { NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { spendCredits } from "@/lib/credits";
import { getCost } from "@/lib/config";
import { generate } from "@/lib/gemini/client";
import { aiRateLimit } from "@/lib/rate-limit";
import { transcribeAudio } from "@/lib/transcribe";
import { getScenarioById } from "@/lib/speaking/scenarios";

export const runtime = "nodejs";
export const maxDuration = 45;

const PERSONA_POLLY_MAP: Record<string, string> = {
  david: "Matthew",
  alex: "Joey",
  sarah: "Amy",
  emma: "Joanna",
};

async function getPollyAudio(text: string, persona: string): Promise<{ audioUrl: string | null; audioDataUri: string | null }> {
  try {
    const speaker = PERSONA_POLLY_MAP[persona] || "Matthew";
    const form = new URLSearchParams();
    form.append("msg", text);
    form.append("lang", speaker);
    form.append("source", "ttsmp3");

    const res = await fetch("https://ttsmp3.com/makemp3_new.php", {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
        Origin: "https://ttsmp3.com",
        Referer: "https://ttsmp3.com/",
      },
      body: form.toString(),
      signal: AbortSignal.timeout(4000),
    });

    if (!res.ok) return { audioUrl: null, audioDataUri: null };
    const data = await res.json();
    if (!data.URL) return { audioUrl: null, audioDataUri: null };

    // Fetch audio bytes server-side for instant client base64 playback
    const audioRes = await fetch(data.URL, { signal: AbortSignal.timeout(4000) });
    if (audioRes.ok) {
      const buf = Buffer.from(await audioRes.arrayBuffer());
      return {
        audioUrl: data.URL,
        audioDataUri: `data:audio/mpeg;base64,${buf.toString("base64")}`,
      };
    }

    return { audioUrl: data.URL || null, audioDataUri: null };
  } catch (e) {
    console.warn("[speaking-converse] Polly audio error:", e);
    return { audioUrl: null, audioDataUri: null };
  }
}

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return json({ error: "Sesi lo udah habis. Masuk lagi ya." }, 401);
  }

  const limited = await aiRateLimit(user.id, "speaking_converse", 10);
  if (limited) return limited;

  // Pre-check credits to prevent unauthorized Groq Whisper resource drainage
  const cost = await getCost("speaking_coach").catch(() => 1);
  const { data: profile } = await supabase
    .from("profiles")
    .select("credits_free, credits_paid, is_banned")
    .eq("id", user.id)
    .single();

  if (!profile) return json({ error: "Profil akun tidak ditemukan." }, 404);
  if (profile.is_banned) return json({ error: "Akun ini sedang dibekukan." }, 403);

  const totalCredits = (profile.credits_free ?? 0) + (profile.credits_paid ?? 0);
  if (totalCredits < cost) {
    return json(
      { error: "Kredit kamu tidak mencukupi untuk sesi latihan ini. Top up dulu ya." },
      402
    );
  }

  let textInput = "";
  let persona = "david";
  let level = "intermediate";
  let scenarioId = "daily";
  let history: Array<{ role: "user" | "assistant"; text: string }> = [];

  const contentType = request.headers.get("content-type") || "";

  if (contentType.includes("multipart/form-data")) {
    try {
      const formData = await request.formData();
      const audioFile = formData.get("audio");
      persona = String(formData.get("persona") || "david");
      level = String(formData.get("level") || "intermediate");
      scenarioId = String(formData.get("scenario") || "daily");
      const historyRaw = formData.get("history");
      if (historyRaw) {
        history = JSON.parse(String(historyRaw));
      }

      if (audioFile instanceof Blob) {
        const transcriptRes = await transcribeAudio(audioFile, "user_voice.webm", { language: "en" });
        textInput = transcriptRes.text.trim();
      } else {
        textInput = String(formData.get("text") || "").trim();
      }
    } catch (err) {
      console.error("[speaking-converse] FormData parse error:", err);
      return json({ error: "Gagal memproses rekaman suara." }, 400);
    }
  } else {
    try {
      const body = await request.json();
      textInput = String(body.text || "").trim();
      persona = String(body.persona || "david");
      level = String(body.level || "intermediate");
      scenarioId = String(body.scenario || "daily");
      history = body.history || [];
    } catch {
      return json({ error: "Permintaan tidak valid." }, 400);
    }
  }

  if (!textInput) {
    return json({ error: "Suara atau teks tidak terdengar. Coba bicara lagi." }, 400);
  }

  // Deduct credits server-side
  const spend = await spendCredits(user.id, cost, "speaking_coach");
  if (!spend.ok) {
    return json({ error: spend.message }, spend.reason === "insufficient" ? 402 : 500);
  }

  // Load detailed Global Scenario if matched
  const matchedScenario = getScenarioById(scenarioId);

  // ═══════════════════════════════════════════════════════════════
  // TWO-LAYER PERSONA MASTER PROMPTS (Claude Opus 5 Architecture)
  // ═══════════════════════════════════════════════════════════════
  const PERSONA_PROFILES: Record<string, string> = {
    david: `PERSONA MODULE: DAVID KESSLER (47, Managing Director, PE Midtown Manhattan)
- Core Drive: Time is the only currency he respects. Direct, compressed, zero patience for fluff.
- Speech Mechanics: Short, punchy sentences. Deadpan dry humor. Never uses exclamation marks or emojis.
- Signature Frames: "Look —", "Here's the thing.", "Bottom line.", "Let me stop you.", "That's not what I asked."
- Reaction Bank: "Hm." / "Okay." / "Wait — back up." / "That's a stretch." / "Fine." / "Right." / "So what?"
- Pressure Style: Weaponises the clock ("We've got six minutes"). Holds his frame until the user proves ROI.
- Silent Recast: Naturally re-uses correct grammar in dialogue without breaking character.`,

    sarah: `PERSONA MODULE: SARAH WHITMORE (52, Strategic Advisor London, ex-FCDO Diplomat)
- Core Drive: Exacting precision. Believes imprecise language causes bad deals. Devastatingly polite.
- Speech Mechanics: Measured British sentences with subordinate clauses. Understatement ("That's not ideal" = total disaster).
- Signature Frames: "If I may —", "I wonder whether —", "Forgive me, but —", "I'd gently push back on that."
- Reaction Bank: "Quite." / "Ah." / "I see." / "Hm — interesting." / "Fair enough." / "Go on."
- Pressure Style: Politeness as pressure. Asks one laser question the user cannot dodge, then waits.`,

    alex: `PERSONA MODULE: ALEX REYES (31, Silicon Valley Tech Founder & CTO)
- Core Drive: Velocity. Would rather ship a wrong decision today than wait 3 weeks. Fast, energetic, informal.
- Speech Mechanics: Short, fast, run-together thoughts. Heavy filler ("so basically", "like", "right right right").
- Signature Frames: "Okay so —", "Real talk.", "Can I push back?", "What's the TL;DR?", "Love that. But."
- Reaction Bank: "Oh wow." / "Wait, hold on." / "Okay okay okay." / "Hold up, rewind." / "That's actually sick."
- Pressure Style: Tests whether the user can compress and get to the landing point quickly.`,

    emma: `PERSONA MODULE: EMMA CHO (29, Creator Economy & Brand Partnerships Director, LA)
- Core Drive: Authenticity as a business asset. Smells scripts instantly. Warm exterior, iron commercial interior.
- Speech Mechanics: Conversational, expressive, emotionally attuned. Teasing story-driven humor.
- Signature Frames: "Okay wait —", "Can I be real with you?", "No I love that, but —", "Here's my hesitation."
- Reaction Bank: "Oh my god." / "Okay wait—" / "Fair enough." / "Oof." / "See, that's the thing."
- Pressure Style: Calls out rehearsed/scripted answers: "You sound like you're reading a deck. Just tell me what you actually think."`,
  };

  const activePersonaProfile = PERSONA_PROFILES[persona] || PERSONA_PROFILES.david;

  let scenarioContext = `Skenario Umum: Percakapan harian / profesional bebas sesuai topik pengguna.`;
  if (matchedScenario) {
    scenarioContext = `SCENARIO CONTEXT:
- Title: ${matchedScenario.title} (${matchedScenario.category})
- User Role: ${matchedScenario.setting.user_role}
- Stakes: $${matchedScenario.setting.stakes_usd || "5,000"} USD
- Situation: ${matchedScenario.setting.context_id}
- You are playing: ${matchedScenario.ai_persona.name}, ${matchedScenario.ai_persona.role} at ${matchedScenario.ai_persona.company}
- Your Pressure Tactic: ${matchedScenario.ai_persona.pressure_tactic}
- Your Real Limit (Walk Away Point): ${matchedScenario.ai_persona.walk_away_point}
- Hidden Motivation: ${matchedScenario.setting.hidden_client_motivation}
- Success Criteria: ${matchedScenario.success_criteria.join("; ")}
- Escalation Guides:
  * If user holds frame: ${matchedScenario.ai_followups.if_user_holds_frame}
  * If user folds / concedes: ${matchedScenario.ai_followups.if_user_folds}
  * If user gets defensive: ${matchedScenario.ai_followups.if_user_gets_defensive}`;
  }

  const levelRules: Record<string, string> = {
    beginner: "Target CEFR A2-B1: Kalimat pendek, jelas, tempo bersahabat tanpa istilah yang terlalu rumit.",
    intermediate: "Target CEFR B2: Percakapan bisnis mengalir alami, perhatikan register kesopanan dan ketegasan.",
    advanced: "Target CEFR C1-C2: Idiomatik tinggi, negosiasi tingkat tinggi, pengujian logika bisnis yang ketat.",
  };

  const levelContext = levelRules[level] || levelRules.intermediate;

  const historyContext = history
    .slice(-6)
    .map((h) => `${h.role === "user" ? "User" : "Partner"}: "${h.text}"`)
    .join("\n");

  const prompt = `═══════════════════════════════════════════════════════════════
TWO-LAYER MASTER CONVERSATION ENGINE (INDONESIAN CREATOR & PRO)
═══════════════════════════════════════════════════════════════

${activePersonaProfile}

${levelContext}

${scenarioContext}

Riwayat Percakapan Sebelumnya:
${historyContext || "(Turn Pertama - Buka percakapan sesuai karakter)"}

Ucapan Terbaru Pengguna:
"${textInput}"

═══════════════════════════════════════════════════════════════
ATURAN PRODUKSI OUTPUT DUA LAPIS (STRICT CONTRACT):
═══════════════════════════════════════════════════════════════

1. LAPIS 1: DIALOGUE (replyEn)
   - 100% Bahasa Inggris murni in-character (1-3 kalimat).
   - DILARANG menyinggung grammar, koreksi, atau bahwa ini simulasi.
   - Buka dengan micro-reaction (~60% kemungkinan) dari REACTION BANK persona kamu ("Look —", "Right.", "Wait, hold on.", "Fair enough.").
   - Jika pengguna membuat kesalahan grammar kecil (Tier 1), lakukan SILENT RECAST (ulang bentuk yang benar secara alami di dalam kalimat balasan).
   - Terapkan SCENE DISCIPLINE: Jika pengguna menyerah/minta maaf berlebihan, TEKAN LEBIH JAUH. Jika pengguna memberikan argumen bernas, LUNAKKAN SIKAP.

2. LAPIS 2: COACH & PEDAGOGY (Bahasa Indonesia di field correctionTip / roastComment)
   - correctionTip (Maksimal 3 baris): Berikan analisis taktis jika ada kesalahan bahasa/diplomasi.
     * Jelaskan kenapa salah (misal: Jebakan 'Sungkan', salah tense lampau V2, salah modal 'you must' yang terkesan kasar).
     * Berikan UPGRADE PHRASE bahasa Inggris yang elegan untuk dipakai pengguna.
     * Jika ucapan pengguna sudah bersih dan bagus, kosongkan (null).
   - roastComment: Jika ada kesalahan konyol atau terjemahan harfiah Indoglish, berikan 1 kalimat komentar santai & cerdas khas mentor.

3. LAPIS 3: STRATEGIC REPLIES (suggestedReplies)
   - Berikan 3 pilihan respons taktis dalam bahasa Inggris beserta arti bahasa Indonesianya:
     * Opsi A: The Value Reframe / Strong Position
     * Opsi B: The Diagnostic Question / Counter-Question
     * Opsi C: The Collaborative Trade / Scoped Compromise

4. METRICS & SCORING:
   - fluencyScore: Nilai kelancaran & diplomasi (1-100).
   - pitfallTag: Tag kelemahan (contoh: "Sungkan / Apology Trap", "Scope Creep Defense", "Past Tense V2", "Register Calibration", "Modal Verbs").
   - newVocab: 1 frasa / kosakata profesional tingkat tinggi dari turn ini.
   - missionAccomplished: true jika negosiasi/skenario sudah mencapai titik sepakat yang solid.

ATURAN FORMATTING KETAT:
- DILARANG MENGGUNAKAN EMOJI APAPUN.
- Kembalikan HANYA format JSON sesuai skema.`;

  const schema = {
    type: "OBJECT",
    properties: {
      userTranscribedText: { type: "STRING" },
      replyEn: { type: "STRING" },
      translateId: { type: "STRING" },
      suggestedReplies: {
        type: "ARRAY",
        items: {
          type: "OBJECT",
          properties: {
            en: { type: "STRING" },
            id: { type: "STRING" },
            strategy: { type: "STRING" },
          },
          required: ["en", "id"],
        },
        minItems: 3,
        maxItems: 3,
      },
      correctionTip: { type: "STRING" },
      pitfallTag: { type: "STRING" },
      roastComment: { type: "STRING" },
      fluencyScore: { type: "NUMBER" },
      newVocab: { type: "STRING" },
      missionAccomplished: { type: "BOOLEAN" },
    },
    required: ["replyEn", "translateId", "suggestedReplies", "fluencyScore"],
  };

  try {
    const rawAi = await generate({ prompt, schema, tier: "free" });
    const parsed = JSON.parse(rawAi.trim());
    const replyEn = parsed.replyEn || "Look — let us get straight to the point. What are your terms?";
    const audioData = await getPollyAudio(replyEn, persona);
    const audioUrl = audioData.audioDataUri || audioData.audioUrl || null;

    // Use scenario response options as fallback or enhance with AI
    let finalSuggestions = parsed.suggestedReplies;
    if ((!finalSuggestions || finalSuggestions.length === 0) && matchedScenario?.response_options) {
      finalSuggestions = matchedScenario.response_options.map((opt) => ({
        en: opt.script,
        id: `${opt.strategy}: ${opt.predicted_reaction}`,
        strategy: opt.strategy,
      }));
    }

    return json({
      ok: true,
      userTranscribedText: textInput,
      replyEn,
      audioUrl,
      translateId: parsed.translateId || "Dengar — mari kita langsung ke intinya. Apa syarat dari kamu?",
      suggestedReplies: Array.isArray(finalSuggestions) && finalSuggestions.length > 0
        ? finalSuggestions
        : [
            { en: "That is a fair question, and I would ask the same thing.", id: "Itu pertanyaan yang adil, dan saya akan menanyakan hal yang sama.", strategy: "Value Reframe" },
            { en: "Before we discuss the number, can I clarify your primary timeline?", id: "Sebelum kita bahas angka, boleh saya pastikan timeline utama Anda?", strategy: "Diagnostic Question" },
            { en: "I can reduce the scope to meet your budget, but not the quality.", id: "Saya bisa kurangi cakupan kerja sesuai budget, tapi bukan kualitasnya.", strategy: "Scoped Trade" },
          ],
      correctionTip: parsed.correctionTip || null,
      pitfallTag: parsed.pitfallTag || null,
      roastComment: parsed.roastComment || null,
      fluencyScore: parsed.fluencyScore || 85,
      newVocab: parsed.newVocab || null,
      missionAccomplished: Boolean(parsed.missionAccomplished),
      creditsSpent: cost,
    });
  } catch (err) {
    console.error("[speaking-converse] AI error:", err);
    return json(
      {
        ok: true,
        userTranscribedText: textInput,
        replyEn: "Look — I hear what you are saying. Let us focus on the core deliverable and move forward.",
        audioUrl: null,
        translateId: "Dengar — saya paham maksud kamu. Mari fokus pada hasil kerja utama dan lanjutkan.",
        suggestedReplies: [
          { en: "That is a fair point. Here is how we should structure the scope.", id: "Itu poin yang bagus. Ini cara kita menyusun cakupan kerjanya.", strategy: "Value Reframe" },
          { en: "Let us clarify the deliverables so we are 100% aligned.", id: "Mari kita perjelas deliverable agar kita 100% selaras.", strategy: "Clarification" },
          { en: "I can send over an updated proposal with these milestones.", id: "Saya bisa kirim proposal yang diperbarui dengan target ini.", strategy: "Action Plan" },
        ],
        correctionTip: null,
        pitfallTag: null,
        roastComment: null,
        fluencyScore: 80,
        newVocab: null,
        missionAccomplished: false,
        creditsSpent: cost,
      },
      200,
    );
  }
}

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}
