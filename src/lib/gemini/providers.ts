/**
 * Provider adapters.
 *
 * `/admin/config` has let the owner pick openai / anthropic / custom for a while
 * and it changed nothing at runtime, because this module only ever spoke the
 * Gemini REST shape. That was the one place the panel lied to its user.
 *
 * Each adapter owns four things: the request URL, the auth header, the request
 * body, and how to pull text and a token count back out. Everything else —
 * key rotation, backoff, usage accounting, error logging — stays shared, because
 * none of that is provider-specific.
 *
 * Streaming stays Gemini-only for now and is handled by the caller: OpenAI and
 * Anthropic use different SSE envelopes, and a half-working stream is worse than
 * a non-streaming call that returns the whole answer.
 */

export type ProviderName = "gemini" | "openai" | "anthropic" | "custom";

export type ProviderRequest = {
  url: string;
  headers: Record<string, string>;
  body: string;
};

/**
 * An image sent alongside the prompt. `data` is raw base64, no data: prefix —
 * every provider below wants it that way and adds its own envelope.
 */
export type InlineImage = { mimeType: string; data: string };

export type Adapter = {
  /** OpenAI-compatible providers can stream, but we only use non-stream here. */
  buildRequest(opts: {
    apiKey: string;
    model: string;
    prompt: string;
    schema?: Record<string, unknown>;
    baseUrl?: string;
    stream: boolean;
    images?: InlineImage[];
  }): ProviderRequest;
  /** Returns the assistant text, or "" when the response carried none. */
  extractText(json: unknown): string;
  extractTokens(json: unknown): number;
};

const GEMINI_ROOT = "https://generativelanguage.googleapis.com/v1beta/models";

/**
 * Schemas are declared in Gemini's dialect (uppercase `OBJECT`/`STRING`).
 * JSON Schema wants them lowercase, so translate rather than maintain two
 * copies of every schema in the codebase.
 */
function toJsonSchema(s: unknown): unknown {
  if (Array.isArray(s)) return s.map(toJsonSchema);
  if (s && typeof s === "object") {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(s as Record<string, unknown>)) {
      out[k] = k === "type" && typeof v === "string" ? v.toLowerCase() : toJsonSchema(v);
    }
    return out;
  }
  return s;
}

const gemini: Adapter = {
  buildRequest({ apiKey, model, prompt, schema, stream, baseUrl, images }) {
    const root = baseUrl?.trim() || GEMINI_ROOT;
    const method = stream ? "streamGenerateContent?alt=sse" : "generateContent";
    // Image parts come before the text so the instruction reads as being about
    // the picture rather than the picture being an afterthought to the prompt.
    const parts = [
      ...(images ?? []).map((i) => ({
        inline_data: { mime_type: i.mimeType, data: i.data },
      })),
      { text: prompt },
    ];
    return {
      url: `${root}/${model}:${method}`,
      headers: { "x-goog-api-key": apiKey, "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ parts }],
        generationConfig: schema
          ? { responseMimeType: "application/json", responseSchema: schema }
          : undefined,
      }),
    };
  },
  extractText: (j) =>
    (j as { candidates?: { content?: { parts?: { text?: string }[] } }[] })?.candidates?.[0]
      ?.content?.parts?.[0]?.text ?? "",
  extractTokens: (j) =>
    (j as { usageMetadata?: { totalTokenCount?: number } })?.usageMetadata?.totalTokenCount ?? 0,
};

/** OpenAI chat-completions. Also covers most "custom" OpenAI-compatible hosts. */
const openai: Adapter = {
  buildRequest({ apiKey, model, prompt, schema, baseUrl, images }) {
    const root = baseUrl?.trim() || "https://api.openai.com/v1";
    // A plain string is the documented shape for text-only; the array form is
    // only needed once an image is attached, and some OpenAI-compatible hosts
    // reject the array form for text, so keep both paths.
    const content = images?.length
      ? [
          ...images.map((i) => ({
            type: "image_url" as const,
            image_url: { url: `data:${i.mimeType};base64,${i.data}` },
          })),
          { type: "text" as const, text: prompt },
        ]
      : prompt;
    return {
      url: `${root.replace(/\/$/, "")}/chat/completions`,
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model,
        messages: [{ role: "user", content }],
        // json_schema needs a name and rejects unknown keys, so send the
        // translated schema under a fixed wrapper.
        response_format: schema
          ? {
              type: "json_schema",
              json_schema: { name: "output", strict: false, schema: toJsonSchema(schema) },
            }
          : undefined,
      }),
    };
  },
  extractText: (j) =>
    (j as { choices?: { message?: { content?: string } }[] })?.choices?.[0]?.message?.content ?? "",
  extractTokens: (j) =>
    (j as { usage?: { total_tokens?: number } })?.usage?.total_tokens ?? 0,
};

const anthropic: Adapter = {
  buildRequest({ apiKey, model, prompt, schema, baseUrl, images }) {
    const root = baseUrl?.trim() || "https://api.anthropic.com/v1";
    // Anthropic has no response_format. Asking for JSON in the prompt is the
    // documented approach; the caller already strips fences via parseJson.
    const text = schema
      ? `${prompt}\n\nBalas HANYA JSON valid yang cocok dengan skema ini, tanpa penjelasan dan tanpa code fence:\n${JSON.stringify(toJsonSchema(schema))}`
      : prompt;
    const content = images?.length
      ? [
          ...images.map((i) => ({
            type: "image" as const,
            source: { type: "base64" as const, media_type: i.mimeType, data: i.data },
          })),
          { type: "text" as const, text },
        ]
      : text;
    return {
      url: `${root.replace(/\/$/, "")}/messages`,
      headers: {
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model,
        max_tokens: 8192,
        messages: [{ role: "user", content }],
      }),
    };
  },
  extractText: (j) => {
    const blocks = (j as { content?: { type?: string; text?: string }[] })?.content ?? [];
    return blocks
      .filter((b) => b.type === "text" && typeof b.text === "string")
      .map((b) => b.text as string)
      .join("");
  },
  extractTokens: (j) => {
    const u = (j as { usage?: { input_tokens?: number; output_tokens?: number } })?.usage;
    return (u?.input_tokens ?? 0) + (u?.output_tokens ?? 0);
  },
};

const ADAPTERS: Record<ProviderName, Adapter> = {
  gemini,
  openai,
  anthropic,
  // "custom" means an OpenAI-compatible endpoint, which is what almost every
  // self-hosted and proxy service exposes. It is not a fourth protocol.
  custom: openai,
};

export function adapterFor(provider: ProviderName): Adapter {
  return ADAPTERS[provider] ?? gemini;
}

/** Only Gemini streams today; anything else must fall back to a single call. */
export function supportsStreaming(provider: ProviderName): boolean {
  return provider === "gemini";
}
