import { NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { isVideoEnabled } from "@/lib/config";
import { generate } from "@/lib/gemini/client";
import { aiRateLimit } from "@/lib/rate-limit";

export const runtime = "nodejs";
export const maxDuration = 30;

const MAX_LINES = 250;
const MAX_CHARS = 12_000;

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return json({ error: "Sesi lo udah habis. Masuk lagi ya." }, 401);

  const { data: profile } = await supabase
    .from("profiles")
    .select("is_banned")
    .eq("id", user.id)
    .single();
  if (!profile) return json({ error: "Profil gak ketemu." }, 404);
  if (profile.is_banned) return json({ error: "Akun lo lagi dibekuin." }, 403);

  const limited = await aiRateLimit(user.id, "video_translate", 8);
  if (limited) return limited;
  if (!(await isVideoEnabled())) {
    return json({ error: "Fitur video lagi dimatiin sementara. Coba lagi nanti ya." }, 503);
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return json({ error: "Teksnya gak kebaca. Coba lagi." }, 400);
  }
  if (!body || typeof body !== "object") return json({ error: "Teksnya gak valid." }, 400);

  const input = body as { lines?: unknown; target?: unknown };
  const target = input.target === "en" ? "en" : input.target === "id" ? "id" : null;
  const lines = Array.isArray(input.lines)
    ? input.lines.map((line) => String(line).trim()).filter(Boolean)
    : [];
  const chars = lines.reduce((total, line) => total + line.length, 0);
  if (!target) return json({ error: "Bahasa tujuan harus Indonesia atau Inggris." }, 400);
  if (!lines.length || lines.length > MAX_LINES || chars > MAX_CHARS) {
    return json({ error: "Teks subtitle terlalu panjang buat sekali terjemah." }, 413);
  }

  const language = target === "en" ? "natural conversational English" : "Bahasa Indonesia percakapan yang natural";
  const prompt = `Terjemahkan setiap baris subtitle ke ${language}.
Pertahankan makna, nada, nama, angka, dan punchline. Jangan tambah penjelasan.
Jumlah dan urutan hasil WAJIB tepat ${lines.length} baris karena tiap indeks terikat timestamp video.

INPUT JSON:
${JSON.stringify(lines)}`;
  const schema = {
    type: "OBJECT",
    properties: {
      lines: {
        type: "ARRAY",
        items: { type: "STRING" },
        minItems: lines.length,
        maxItems: lines.length,
      },
    },
    required: ["lines"],
  };

  try {
    const raw = await generate({ prompt, schema, tier: "free" });
    const parsed = JSON.parse(raw) as { lines?: unknown };
    if (!Array.isArray(parsed.lines) || parsed.lines.length !== lines.length) {
      throw new Error("translation line count mismatch");
    }
    const translated = parsed.lines.map((line) => String(line).trim());
    if (translated.some((line) => !line)) throw new Error("empty translation line");
    return json({ lines: translated, target });
  } catch (error) {
    console.error("video translation failed", error);
    return json({ error: "Terjemahan lagi gagal. Subtitle asli lo tetap aman — coba lagi bentar." }, 502);
  }
}

function json(body: unknown, status = 200) {
  return Response.json(body, { status });
}
