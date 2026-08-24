/**
 * Universal Indonesian speech text cleaner and normalizer.
 * Safe to import in both Server Routes (Node.js) and Client Components (React 19).
 */

export function cleanScriptForSpeech(raw: string): string {
  if (!raw) return "";
  return raw
    // Remove bracketed cues e.g. [Visual: ...], [Footage: ...], [Text: ...]
    .replace(/\[(?:Visual|Footage|Teks|Scene|Arahan|Audio|Kamera|Shot)[^\]]*\]/gi, "")
    .replace(/\((?:Visual|Footage|Teks|Scene|Arahan|Audio|Kamera|Shot)[^)]*\)/gi, "")
    // Remove generic brackets if they look like metadata
    .replace(/\[\d{1,2}:\d{2}(?:-\d{1,2}:\d{2})?\]/g, "")
    // Remove "Scene 1:", "Voiceover:", "VO:"
    .replace(/^(?:Scene\s*\d+|Voiceover|VO|Dialog|Naskah)\s*:\s*/gim, "")
    // Remove extra whitespace
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Normalises text for natural Indonesian spoken delivery.
 * Replaces abbreviations and internet slang with natural phonetic words
 * and injects micro-pauses for natural cadence and breathing.
 */
export function normalizeIndonesianSpeech(raw: string): string {
  if (!raw) return "";
  let s = cleanScriptForSpeech(raw);

  const slangMap: [RegExp, string][] = [
    [/\byg\b/gi, "yang"],
    [/\bbgt\b/gi, "banget"],
    [/\bgak\b/gi, "nggak"],
    [/\bga\b/gi, "nggak"],
    [/\budh\b/gi, "udah"],
    [/\bsdh\b/gi, "sudah"],
    [/\btp\b/gi, "tapi"],
    [/\bdgn\b/gi, "dengan"],
    [/\bblm\b/gi, "belum"],
    [/\bskrg\b/gi, "sekarang"],
    [/\bdr\b/gi, "dari"],
    [/\bkrn\b/gi, "karena"],
    [/\bjg\b/gi, "juga"],
    [/\bbs\b/gi, "bisa"],
    [/\bkmrn\b/gi, "kemarin"],
    [/\bbbrp\b/gi, "beberapa"],
    [/\bdan lain-lain\b/gi, "dan lain-lain"],
    [/\bdll\b/gi, "dan lain-lain"],
    [/\btsb\b/gi, "tersebut"],
    [/\bttg\b/gi, "tentang"],
    [/\butk\b/gi, "untuk"],
    [/\bhrs\b/gi, "harus"],
    [/\bbnr\b/gi, "bener"],
    [/\bbener2\b/gi, "bener-bener"],
    [/\bcta\b/gi, "call to action"],
    [/\bvt\b/gi, "video tiktok"],
    [/\bfyp\b/gi, "f y p"],
    [/\bwa\b/gi, "whatsapp"],
    [/\bdm\b/gi, "direct message"],
    [/\bcod\b/gi, "c o d"],
    [/\bklik link\b/gi, "klik tautan"],
    [/\bgue\b/gi, "gue"],
    [/\blo\b/gi, "lo"],
    [/\bcvt\b/gi, "c v t"],
    [/\bdot 4\b/gi, "dot empat"],
    [/\bdot 3\b/gi, "dot tiga"],
  ];

  for (const [regex, replacement] of slangMap) {
    s = s.replace(regex, replacement);
  }

  return s;
}
