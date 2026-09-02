import { NextResponse } from "next/server";
import { createPairingSession } from "@/lib/auth/desktop-device-flow";

export async function POST() {
  const code = await createPairingSession();
  return NextResponse.json({
    code,
    connectUrl: `https://www.malesan.my.id/auth/desktop?code=${code}`,
  });
}

export async function GET() {
  const code = await createPairingSession();
  return NextResponse.json({
    code,
    connectUrl: `https://www.malesan.my.id/auth/desktop?code=${code}`,
  });
}
