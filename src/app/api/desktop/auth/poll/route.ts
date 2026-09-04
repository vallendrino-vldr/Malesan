import { NextResponse, type NextRequest } from "next/server";
import { pollPairingSession } from "@/lib/auth/desktop-device-flow";

export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const rawCode = (searchParams.get("code") || "").trim();

  // Validate format strictly (only valid pairing codes)
  if (!rawCode || !/^[a-zA-Z0-9_-]{10,64}$/.test(rawCode)) {
    return NextResponse.json({ error: "Format kode tidak valid" }, { status: 400 });
  }

  const result = await pollPairingSession(rawCode);
  return NextResponse.json(result);
}
