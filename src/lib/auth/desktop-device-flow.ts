interface PairingSession {
  code: string;
  status: "pending" | "approved" | "expired";
  cookies?: { name: string; value: string }[];
  createdAt: number;
}

const globalSessions = globalThis as unknown as {
  __malesanPairingSessions?: Map<string, PairingSession>;
};

if (!globalSessions.__malesanPairingSessions) {
  globalSessions.__malesanPairingSessions = new Map<string, PairingSession>();
}

const sessions = globalSessions.__malesanPairingSessions;

function cleanup() {
  const now = Date.now();
  for (const [code, session] of sessions.entries()) {
    if (now - session.createdAt > 180_000) {
      sessions.delete(code);
    }
  }
}

export function createPairingSession(): string {
  cleanup();
  const code = "msk_" + Math.random().toString(36).substring(2, 10) + Math.random().toString(36).substring(2, 10);
  sessions.set(code, {
    code,
    status: "pending",
    createdAt: Date.now(),
  });
  return code;
}

export function approvePairingSession(
  code: string,
  cookies: { name: string; value: string }[]
): boolean {
  cleanup();
  const session = sessions.get(code);
  if (!session) return false;
  session.status = "approved";
  session.cookies = cookies;
  return true;
}

export function pollPairingSession(code: string): {
  status: "pending" | "approved" | "expired";
  cookies?: { name: string; value: string }[];
} {
  cleanup();
  const session = sessions.get(code);
  if (!session) return { status: "expired" };

  if (session.status === "approved") {
    const cookies = session.cookies;
    sessions.delete(code);
    return { status: "approved", cookies };
  }

  return { status: "pending" };
}
