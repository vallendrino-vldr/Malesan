import { NextResponse, type NextRequest } from "next/server";
import { claimDesktopTicket } from "@/lib/auth/desktop-ticket";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const ticket = searchParams.get("ticket");

  if (!ticket) {
    return NextResponse.json({ error: "Ticket required" }, { status: 400 });
  }

  const cookies = claimDesktopTicket(ticket);
  if (!cookies) {
    return NextResponse.json({ error: "Invalid or expired ticket" }, { status: 404 });
  }

  return NextResponse.json({ success: true, cookies });
}
