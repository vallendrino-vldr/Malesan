import { NextResponse, type NextRequest } from "next/server";
import { pollPairingSession } from "@/lib/auth/desktop-device-flow";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const code = searchParams.get("code");
  if (!code) {
    return NextResponse.json({ error: "Missing code" }, { status: 400 });
  }
  const result = await pollPairingSession(code);
  return NextResponse.json(result);
}
