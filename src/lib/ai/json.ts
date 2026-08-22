/**
 * Parse structured AI output without tying callers to one provider SDK.
 *
 * The router may answer with DeepSeek, Gemini, OpenAI, or any compatible
 * gateway. Keeping this helper under `gemini/client` made otherwise-routed
 * features look (and eventually behave) provider-specific. Models occasionally
 * wrap valid JSON in a markdown fence, so tolerate that one harmless defect and
 * reject everything else.
 */
export function parseAIJson<T>(raw: string): T {
  try {
    return JSON.parse(raw) as T;
  } catch {
    const cleaned = raw
      .replace(/^\s*```(?:json)?/i, "")
      .replace(/```\s*$/i, "")
      .trim();
    const start = cleaned.search(/[[{]/);
    const end = Math.max(cleaned.lastIndexOf("}"), cleaned.lastIndexOf("]"));
    if (start !== -1 && end > start) {
      return JSON.parse(cleaned.slice(start, end + 1)) as T;
    }
    throw new Error("AI returned unparseable JSON");
  }
}
