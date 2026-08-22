import "server-only";

import { lookup } from "node:dns/promises";
import { isIP } from "node:net";

const BLOCKED_HOSTS = new Set([
  "localhost",
  "metadata.google.internal",
  "metadata.google.com",
]);

function isPrivateIpv4(address: string): boolean {
  const octets = address.split(".").map(Number);
  if (octets.length !== 4 || octets.some((n) => !Number.isInteger(n) || n < 0 || n > 255)) {
    return true;
  }
  const [a, b] = octets;
  return (
    a === 0 ||
    a === 10 ||
    a === 127 ||
    (a === 100 && b >= 64 && b <= 127) ||
    (a === 169 && b === 254) ||
    (a === 172 && b >= 16 && b <= 31) ||
    (a === 192 && b === 168) ||
    (a === 198 && (b === 18 || b === 19)) ||
    a >= 224
  );
}

function isPrivateIpv6(address: string): boolean {
  const value = address.toLowerCase().split("%")[0];
  if (value === "::" || value === "::1") return true;
  if (
    value.startsWith("fc") ||
    value.startsWith("fd") ||
    /^fe[89a-f]/.test(value) ||
    value.startsWith("ff")
  ) {
    return true;
  }

  // Reject all IPv4-mapped/compatible spellings. URL parsers commonly turn
  // ::ffff:127.0.0.1 into ::ffff:7f00:1, so checking only dotted notation
  // leaves an SSRF bypass even though both addresses reach the same host.
  return value.startsWith("::ffff:") || /^::[0-9a-f]+(?::[0-9a-f]+)?$/.test(value);
}

function isPrivateAddress(address: string): boolean {
  const family = isIP(address);
  if (family === 4) return isPrivateIpv4(address);
  if (family === 6) return isPrivateIpv6(address);
  return true;
}

/**
 * Rejects gateway URLs that could make the server send an API key to an
 * internal service or cloud metadata address. Validation runs again before
 * every custom outbound call, so changing DNS after saving a gateway does not
 * turn the admin form into a permanent SSRF bypass.
 */
export async function assertSafeOutboundUrl(raw: string, label = "URL"): Promise<URL> {
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    throw new Error(`${label} gak valid.`);
  }

  if (url.protocol !== "https:") throw new Error(`${label} wajib pakai HTTPS.`);
  if (url.username || url.password) throw new Error(`${label} gak boleh berisi username/password.`);

  const hostname = url.hostname.toLowerCase().replace(/\.$/, "").replace(/^\[|\]$/g, "");
  if (
    !hostname ||
    BLOCKED_HOSTS.has(hostname) ||
    hostname.endsWith(".localhost") ||
    hostname.endsWith(".local") ||
    hostname.endsWith(".internal") ||
    hostname.endsWith(".lan")
  ) {
    throw new Error(`${label} harus menuju gateway publik.`);
  }

  if (isIP(hostname)) {
    if (isPrivateAddress(hostname)) throw new Error(`${label} gak boleh menuju jaringan internal.`);
    return url;
  }

  let addresses: { address: string }[];
  try {
    addresses = await lookup(hostname, { all: true, verbatim: true });
  } catch {
    throw new Error(`${label} gak bisa ditemukan.`);
  }
  if (!addresses.length || addresses.some(({ address }) => isPrivateAddress(address))) {
    throw new Error(`${label} gak boleh menuju jaringan internal.`);
  }

  return url;
}
