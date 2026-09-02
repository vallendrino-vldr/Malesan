interface DesktopAuthTicket {
  cookies: Array<{ name: string; value: string }>;
  expiresAt: number;
}

const globalStore = globalThis as unknown as {
  __malesan_desktop_tickets__?: Map<string, DesktopAuthTicket>;
};

if (!globalStore.__malesan_desktop_tickets__) {
  globalStore.__malesan_desktop_tickets__ = new Map();
}

const tickets = globalStore.__malesan_desktop_tickets__;

export function createDesktopTicket(cookiesList: Array<{ name: string; value: string }>): string {
  const ticket = crypto.randomUUID();
  const now = Date.now();

  // Purge expired tickets
  for (const [k, v] of tickets.entries()) {
    if (v.expiresAt < now) tickets.delete(k);
  }

  tickets.set(ticket, {
    cookies: cookiesList,
    expiresAt: now + 90_000, // 90 seconds TTL
  });

  return ticket;
}

export function claimDesktopTicket(ticket: string): Array<{ name: string; value: string }> | null {
  if (!ticket) return null;
  const item = tickets.get(ticket);
  if (!item) return null;

  tickets.delete(ticket); // strictly one-time use
  if (item.expiresAt < Date.now()) return null;

  return item.cookies;
}
