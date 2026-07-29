import { NextResponse } from "next/server";
import { createServiceRoleClient } from "@/lib/supabase/server";

export const runtime = "edge";

const TRENDS_SYSTEM_PROMPT = `Lo adalah asisten content creator Indonesia. 
Tugas lo: berikan 3-5 trend topik, format, atau angle yang lagi rame dibicarakan audiens Indonesia hari ini (TikTok, Twitter/X, Instagram, YouTube Shorts).
Jangan kasih saran generik kayak "dance challenge". Kasih sesuatu yang spesifik, misalnya "Drama X vs Y" atau "Sound jedag jedug lagu daerah".
Format output HARUS JSON valid dengan skema:
{
  "trends": [
    {
      "title": "Judul Tren Singkat",
      "summary": "Penjelasan 1 kalimat kenapa ini rame dan cara pakenya",
      "category": "lifestyle | tech | entertainment | news | comedy",
      "region": "ID"
    }
  ]
}`;

export async function GET(req: Request) {
  const authHeader = req.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const supabase = createServiceRoleClient();
    
    // Deactivate old trends
    await supabase.from("trends").update({ is_active: false }).eq("is_active", true);

    const apiKey = process.env.GEMINI_API_KEY_1;
    if (!apiKey) throw new Error("No Gemini key");

    const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${process.env.GEMINI_MODEL_FREE || "gemini-2.5-flash"}:generateContent?key=${apiKey}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        system_instruction: { parts: [{ text: TRENDS_SYSTEM_PROMPT }] },
        contents: [{ role: "user", parts: [{ text: "Berikan trend hari ini untuk kreator Indonesia." }] }],
        generationConfig: {
          response_mime_type: "application/json",
          temperature: 0.7,
        },
      }),
    });

    if (!res.ok) {
      throw new Error("Failed to fetch from Gemini");
    }

    const data = await res.json();
    const textOutput = data.candidates?.[0]?.content?.parts?.[0]?.text;
    
    if (!textOutput) throw new Error("No output from Gemini");

    const parsed = JSON.parse(textOutput);
    const trends = parsed.trends || [];

    for (const t of trends) {
      await supabase.from("trends").insert({
        source: "google_news",
        title: t.title,
        summary: t.summary,
        category: t.category,
        region: t.region,
        is_active: true
      });
    }

    // Log the cron success (Admin Dashboard step 12)
    await supabase.from("audit_log").insert({
      action: "CRON_TRENDS_SUCCESS",
      metadata: { count: trends.length },
    });

    return NextResponse.json({ success: true, trends });
  } catch (err: unknown) {
    console.error(err);
    const errorMsg = err instanceof Error ? err.message : "Unknown error";
    
    const supabase = createServiceRoleClient();
    await supabase.from("audit_log").insert({
      action: "CRON_TRENDS_FAILED",
      metadata: { error: errorMsg },
    });

    return NextResponse.json({ error: errorMsg }, { status: 500 });
  }
}
