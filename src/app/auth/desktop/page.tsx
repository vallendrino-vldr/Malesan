import { cookies } from "next/headers";
import { approvePairingSession } from "@/lib/auth/desktop-device-flow";
import { createClient } from "@/lib/supabase/server";
import { GoogleSignInButton } from "@/components/GoogleSignInButton";
import Link from "next/link";

export default async function DesktopAuthPage({
  searchParams,
}: {
  searchParams: Promise<{ code?: string; approved?: string }>;
}) {
  const params = await searchParams;
  const rawCode = (params.code || "").trim();
  // Strictly validate code format (alphanumeric, 10-64 chars)
  const code = /^[a-zA-Z0-9_-]{10,64}$/.test(rawCode) ? rawCode : "";
  const isApproved = params.approved === "1";

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // If user is logged in, has valid code, and clicked "Setujui"
  if (user && code && isApproved) {
    const cookieStore = await cookies();
    const allCookies = cookieStore.getAll();
    const authCookies = allCookies
      .filter((c) => c.name.startsWith("sb-") || c.name.startsWith("malesan_"))
      .map((c) => ({ name: c.name, value: c.value }));

    await approvePairingSession(code, authCookies);

    return (
      <div className="min-h-screen bg-[#0C0A09] text-[#F2EDE7] flex items-center justify-center p-4">
        <div className="bg-[#161412] border border-[#FF6B00]/40 rounded-3xl p-8 max-w-md w-full text-center shadow-2xl">
          <div className="inline-block bg-emerald-500/15 border border-emerald-500/30 text-emerald-400 px-4 py-1.5 rounded-full text-xs font-semibold mb-4">
            ✓ Sesi Terverifikasi
          </div>
          <h1 className="text-xl font-bold text-[#FF6B00] mb-2">Terhubung ke Malesan Desktop!</h1>
          <p className="text-sm text-stone-300 font-medium mb-1">
            Halo, {user.user_metadata?.full_name || user.email || "Kreator"}!
          </p>
          <p className="text-xs text-stone-400 mb-6 leading-relaxed">
            Sesi akun kamu berhasil dikirimkan ke aplikasi Malesan Studio Desktop. Halaman ini akan menutup otomatis.
          </p>
          <script dangerouslySetInnerHTML={{ __html: `setTimeout(() => { try { window.close(); } catch(e) {} }, 1200);` }} />
        </div>
      </div>
    );
  }

  // If user is logged in and needs to explicitly approve pairing
  if (user && code) {
    async function handleApprove() {
      "use server";
      const { redirect } = await import("next/navigation");
      redirect(`/auth/desktop?code=${encodeURIComponent(code)}&approved=1`);
    }

    return (
      <div className="min-h-screen bg-[#0C0A09] text-[#F2EDE7] flex items-center justify-center p-4">
        <div className="bg-[#161412] border border-[#FF6B00]/30 rounded-3xl p-8 max-w-md w-full text-center shadow-2xl">
          <div className="w-12 h-12 rounded-2xl bg-ember/10 border border-ember/20 text-ember flex items-center justify-center mx-auto mb-4">
            <svg viewBox="0 0 24 24" className="w-6 h-6 stroke-current fill-none stroke-[2]">
              <rect x="2" y="3" width="20" height="14" rx="2" />
              <line x1="8" y1="21" x2="16" y2="21" />
              <line x1="12" y1="17" x2="12" y2="21" />
            </svg>
          </div>
          <h1 className="text-xl font-bold text-[#F2EDE7] mb-2">Sambungkan Malesan Desktop?</h1>
          <p className="text-xs text-stone-400 mb-6 leading-relaxed">
            Aplikasi desktop Malesan Studio meminta izin untuk masuk menggunakan akun:
          </p>
          
          <div className="bg-[#121214] border border-white/[0.08] rounded-2xl p-4 mb-6 text-left flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-ember/20 text-ember font-bold flex items-center justify-center text-sm shrink-0">
              {(user.user_metadata?.full_name || user.email || "U")[0].toUpperCase()}
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold text-stone-200 truncate">
                {user.user_metadata?.full_name || "Pengguna Malesan"}
              </p>
              <p className="text-xs text-stone-500 truncate">{user.email}</p>
            </div>
          </div>

          <form action={handleApprove} className="flex flex-col gap-3">
            <button
              type="submit"
              className="w-full h-11 bg-ember hover:bg-ember/90 text-obsidian font-bold rounded-xl text-sm transition-colors shadow-lg shadow-ember/20 cursor-pointer"
            >
              Setujui & Hubungkan ke Desktop
            </button>
            <Link
              href="/app"
              className="w-full h-10 bg-white/[0.04] hover:bg-white/[0.08] text-stone-400 hover:text-stone-200 font-medium rounded-xl text-xs transition-colors flex items-center justify-center"
            >
              Batal & Kembali ke Web
            </Link>
          </form>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0C0A09] text-[#F2EDE7] flex items-center justify-center p-4">
      <div className="bg-[#161412] border border-stone-800 rounded-3xl p-8 max-w-md w-full text-center shadow-2xl">
        <h1 className="text-xl font-bold text-[#F2EDE7] mb-2">Masuk ke Malesan Studio Desktop</h1>
        <p className="text-sm text-stone-400 mb-6 leading-relaxed">
          Pilih akun Google kamu untuk menyambungkan akun ke aplikasi desktop.
        </p>
        <GoogleSignInButton next={`/auth/desktop?code=${encodeURIComponent(code)}`} />
      </div>
    </div>
  );
}
