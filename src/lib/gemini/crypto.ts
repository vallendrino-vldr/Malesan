import "server-only";
import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";

/**
 * AES-256-GCM for BYOK keys at rest.
 *
 * GCM rather than CBC because it authenticates: a tampered ciphertext fails to
 * decrypt instead of silently yielding garbage that then gets sent to Google as
 * an API key.
 *
 * Stored format is `iv.tag.ciphertext`, each base64url. The IV is random per
 * encryption — reusing an IV under GCM leaks the key stream, so never cache it.
 *
 * If ENCRYPTION_KEY is lost or rotated, every stored key becomes undecryptable
 * and users must re-enter theirs. There is no recovery path by design.
 */

function key(): Buffer {
  const raw = process.env.ENCRYPTION_KEY;
  if (!raw) {
    throw new Error("ENCRYPTION_KEY is not set. BYOK storage cannot operate without it.");
  }
  const buf = Buffer.from(raw, "base64");
  if (buf.length !== 32) {
    throw new Error(
      `ENCRYPTION_KEY must decode to 32 bytes for AES-256, got ${buf.length}. Generate one with: node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"`,
    );
  }
  return buf;
}

export function encryptSecret(plaintext: string): string {
  const iv = randomBytes(12); // 96-bit IV is the GCM standard
  const cipher = createCipheriv("aes-256-gcm", key(), iv);
  const ct = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  return [
    iv.toString("base64url"),
    cipher.getAuthTag().toString("base64url"),
    ct.toString("base64url"),
  ].join(".");
}

export function decryptSecret(stored: string): string {
  const [ivB64, tagB64, ctB64] = stored.split(".");
  if (!ivB64 || !tagB64 || !ctB64) {
    throw new Error("Stored key is malformed; expected iv.tag.ciphertext");
  }
  const decipher = createDecipheriv(
    "aes-256-gcm",
    key(),
    Buffer.from(ivB64, "base64url"),
  );
  decipher.setAuthTag(Buffer.from(tagB64, "base64url"));
  return Buffer.concat([
    decipher.update(Buffer.from(ctB64, "base64url")),
    decipher.final(),
  ]).toString("utf8");
}

/** Safe to show a user which key they stored, without revealing it. */
export function maskKey(plaintext: string): string {
  if (plaintext.length <= 8) return "••••";
  return `${plaintext.slice(0, 4)}…${plaintext.slice(-4)}`;
}
