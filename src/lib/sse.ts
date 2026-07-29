/**
 * Shared SSE client helpers.
 *
 * Both bugs this file exists to prevent were shipped at once and were fatal:
 *
 * 1. `buffer.split("\\n\\n")` — in TS source that is a literal backslash-n
 *    backslash-n, not two newlines. It never matches an SSE frame separator,
 *    so the reader drains the whole stream and yields nothing. The UI sits on
 *    its loading state forever and reports no error, because no error was ever
 *    parsed either.
 *
 * 2. Reading the error body twice (`res.json()` then `res.text()` in the catch)
 *    throws "body stream already read", masking the real HTTP status. A body is
 *    a one-shot stream — read it once as text, then try to parse.
 */

/** Read a non-OK response body exactly once and pull the best message out of it. */
export async function readErrorBody(res: Response, fallback = "Gagal."): Promise<string> {
  let raw = "";
  try {
    raw = await res.text();
  } catch {
    return fallback;
  }
  if (!raw.trim()) return fallback;
  try {
    const j = JSON.parse(raw);
    return j.error || j.message || raw;
  } catch {
    // Plain-text body — several routes return `new Response("...", {status})`.
    return raw;
  }
}

/**
 * Consume an SSE stream, invoking `onMessage` for every parsed `data:` payload.
 * Return `true` from `onMessage` to stop early (used for the terminal frame).
 */
export async function readSSE(
  res: Response,
  onMessage: (msg: Record<string, unknown>) => boolean | void,
): Promise<void> {
  const reader = res.body?.getReader();
  if (!reader) throw new Error("Gak ada respons dari server.");

  const decoder = new TextDecoder();
  let buffer = "";
  let stop = false;

  const drain = (flush: boolean) => {
    const frames = buffer.replace(/\r\n/g, "\n").split("\n\n");
    buffer = flush ? "" : (frames.pop() ?? "");
    for (const frame of frames) {
      for (const line of frame.split("\n")) {
        if (!line.startsWith("data:")) continue;
        const payload = line.slice(5).trim();
        if (!payload) continue;
        try {
          if (onMessage(JSON.parse(payload)) === true) stop = true;
        } catch {
          /* partial or malformed frame — the terminal frame is authoritative */
        }
      }
    }
  };

  try {
    while (!stop) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      drain(false);
    }
    drain(true);
  } finally {
    reader.cancel().catch(() => {});
  }
}

/** Strip a ```json fence off a model response. Real newlines, not escaped ones. */
export function stripFence(s: string): string {
  return s.replace(/^```json\n?/, "").replace(/^```\n?/, "").replace(/\n?```$/, "");
}
