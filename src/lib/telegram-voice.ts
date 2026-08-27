import "server-only";
import { getTelegramConfig } from "./telegram";
import { transcribeAudio } from "./transcribe";

/**
 * Downloads a Telegram voice note / audio file and transcribes it using Groq Whisper.
 */
export async function transcribeTelegramVoice(fileId: string): Promise<string | null> {
  const config = await getTelegramConfig();
  if (!config.token || !fileId) return null;

  try {
    // 1. Get file path from Telegram Bot API
    const fileInfoUrl = `https://api.telegram.org/bot${config.token}/getFile?file_id=${fileId}`;
    const fileInfoRes = await fetch(fileInfoUrl, { signal: AbortSignal.timeout(6000) });
    if (!fileInfoRes.ok) return null;

    const fileInfo = (await fileInfoRes.json()) as { ok: boolean; result?: { file_path: string } };
    const filePath = fileInfo.result?.file_path;
    if (!filePath) return null;

    // 2. Download binary audio file
    const fileDownloadUrl = `https://api.telegram.org/file/bot${config.token}/${filePath}`;
    const fileRes = await fetch(fileDownloadUrl, { signal: AbortSignal.timeout(15000) });
    if (!fileRes.ok) return null;

    const arrayBuffer = await fileRes.arrayBuffer();
    const blob = new Blob([arrayBuffer], { type: "audio/ogg" });

    // 3. Transcribe via Groq Whisper with Indonesian language tuning
    const transcript = await transcribeAudio(blob, "voice.oga", { language: "id" });
    return transcript.text?.trim() || null;
  } catch (err) {
    console.error("[telegram-voice] transcription error:", err);
    return null;
  }
}
