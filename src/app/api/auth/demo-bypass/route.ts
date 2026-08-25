import { NextRequest, NextResponse } from "next/server";
import { createClient, createServiceRoleClient } from "@/lib/supabase/server";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}));

    // Support deactivation request
    if (body?.action === "deactivate") {
      const response = NextResponse.json({
        success: true,
        message: "Mode Tester berhasil dinonaktifkan.",
      });

      response.cookies.set("malesan_demo_mode", "", {
        path: "/",
        maxAge: 0,
        sameSite: "lax",
      });

      response.cookies.set("malesan_test_mode", "", {
        path: "/",
        maxAge: 0,
        sameSite: "lax",
      });

      return response;
    }

    const password = body?.password?.trim();

    // Strict password check for creator test/demo bypass
    if (password !== "vadlyvldr") {
      return NextResponse.json(
        { error: "Kata sandi salah. Akses ditolak." },
        { status: 401 }
      );
    }

    const email = process.env.DEV_LOGIN_EMAIL || "vadlyvldr@gmail.com";
    const admin = createServiceRoleClient();

    // 1. Generate magic link token for the owner/creator account
    let linkRes = await admin.auth.admin.generateLink({
      type: "magiclink",
      email,
    });

    // If user doesn't exist yet, create confirmed user
    if (linkRes.error || !linkRes.data?.properties?.hashed_token) {
      await admin.auth.admin.createUser({
        email,
        email_confirm: true,
        user_metadata: { full_name: "VLDR Studio" },
      });

      linkRes = await admin.auth.admin.generateLink({
        type: "magiclink",
        email,
      });
    }

    const hashedToken = linkRes.data?.properties?.hashed_token;
    if (!hashedToken) {
      return NextResponse.json(
        { error: linkRes.error?.message ?? "Gagal membuat sesi demo" },
        { status: 500 }
      );
    }

    // 2. Verify OTP server-side to issue valid Supabase session cookies
    const supabase = await createClient();
    const { error: verifyError } = await supabase.auth.verifyOtp({
      type: "magiclink",
      token_hash: hashedToken,
    });

    if (verifyError) {
      return NextResponse.json({ error: verifyError.message }, { status: 500 });
    }

    // 3. Create response and set demo mode cookies
    const response = NextResponse.json({
      success: true,
      redirect: "/app",
      message: "Akses Mode Demo Diberikan!",
    });

    response.cookies.set("malesan_demo_mode", "1", {
      path: "/",
      maxAge: 60 * 60 * 24 * 7, // 7 days
      sameSite: "lax",
      httpOnly: false,
    });

    response.cookies.set("malesan_test_mode", "1", {
      path: "/",
      maxAge: 60 * 60 * 24 * 7, // 7 days
      sameSite: "lax",
      httpOnly: false,
    });

    return response;
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Terjadi kesalahan server";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
