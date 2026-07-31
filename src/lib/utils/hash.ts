/**
 * SHA-256 of a blob, as lowercase hex.
 *
 * Used to fingerprint a payment proof. Two top-ups carrying byte-identical
 * images is the cheapest fraud there is — send one real transfer, then submit
 * the same screenshot again next week — and a hash catches it without anyone
 * having to remember what last month's receipt looked like.
 *
 * Runs in the browser via WebCrypto and on the server via the same API, so the
 * value computed at upload time is the value the server can re-derive.
 */
export async function sha256Hex(data: Blob | ArrayBuffer): Promise<string> {
  const buf = data instanceof Blob ? await data.arrayBuffer() : data;
  const digest = await crypto.subtle.digest("SHA-256", buf);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}
