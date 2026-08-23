/**
 * What a user is allowed to see when the AI fails.
 *
 * Upstream errors are written for whoever operates the gateway, not for an
 * Indonesian creator who pressed a button. Passing them through leaks three
 * things at once: which vendor we use, the shape of our infrastructure, and
 * sometimes a fragment of a key ("Incorrect API key provided: sk-deli***").
 * It also tells the person nothing they can act on.
 *
 * So the raw text goes to `error_log` and `ai_usage_log` where an operator will
 * read it, and the user gets a sentence in the product's own voice that says
 * what happened and what to do — DESIGN.md §6: never apologise, never blame the
 * user, always give the next step.
 *
 * Pure and dependency-free so it can be used from a route, a server action or a
 * client component without dragging the engine along.
 */

export type UserFacingError = {
  /** Shown to the user. Indonesian, no vendor names, no status codes. */
  message: string;
  /** True when trying again in a moment is genuinely likely to work. */
  retryable: boolean;
};

const BUSY: UserFacingError = {
  message: "Malesan lagi penuh banget barusan. Tunggu sebentar terus coba lagi ya.",
  retryable: true,
};

/**
 * Map an internal failure to something worth reading.
 *
 * Matching is on substrings rather than status codes because the error can
 * arrive from any of three protocols plus our own guards, and every one of them
 * words things differently.
 */
export function userFacingError(err: unknown): UserFacingError {
  const raw = (err instanceof Error ? err.message : String(err ?? "")).toLowerCase();

  // Aborted by our own deadline, or the upstream simply never answered.
  if (/abort|timeout|timed out|deadline/.test(raw)) {
    return {
      message:
        "Kelamaan mikirnya, jadi gue stop di tengah. Kredit lo gak kepotong — coba lagi, biasanya lancar.",
      retryable: true,
    };
  }

  // Rate limits and capacity. The user cannot fix this and does not need the number.
  if (/429|rate limit|quota|exceeded|503|high demand|overloaded|unavailable/.test(raw)) {
    return BUSY;
  }

  // Auth, billing and configuration. This is the owner's problem, never the
  // user's, so it must not read like the user did something wrong.
  if (/api key|unauthorized|401|403|invalid_api_key|permission|billing|insufficient/.test(raw)) {
    return {
      message:
        "Ada yang salah di sistemnya, bukan di lo. Udah dicatat buat diperbaiki — coba lagi nanti.",
      retryable: false,
    };
  }

  // The model answered, but not with anything usable.
  if (/json|parse|unterminated|unexpected token|no text|empty/.test(raw)) {
    return {
      message:
        "Jawabannya kepotong di tengah. Kredit lo gak kepotong — coba jalanin lagi.",
      retryable: true,
    };
  }

  if (/network|fetch failed|econn|socket|dns/.test(raw)) {
    return {
      message: "Koneksinya putus di tengah. Kredit lo gak kepotong — coba lagi ya.",
      retryable: true,
    };
  }

  return {
    message: "Kontennya belum berhasil dibikin. Kredit lo gak kepotong — coba lagi sebentar lagi.",
    retryable: true,
  };
}
