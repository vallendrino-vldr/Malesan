import { cookies } from "next/headers";
import { approvePairingSession } from "@/lib/auth/desktop-device-flow";
import { GoogleSignInButton } from "@/components/GoogleSignInButton";

export default async function DesktopAuthPage({
  searchParams,
}: {
  searchParams: Promise<{ code?: string }>;
}) {
  const params = await searchParams;
  const code = params.code || "";
  const cookieStore = await cookies();
  const authCookies = cookieStore
    .getAll()
    .filter((c) => c.name.startsWith("sb-") || c.name.startsWith("malesan_"))
    .map((c) => ({ name: c.name, value: c.value }));

  const hasSession = authCookies.some((c) => c.name.endsWith("-auth-token") || c.name.includes("auth-token"));

  if (hasSession && code) {
    approvePairingSession(code, authCookies);
    return (
      <div className="min-h-screen bg-[#0C0A09] text-[#F2EDE7] flex items-center justify-center p-4">
        <div className="bg-[#161412] border border-[#FF6B00]/40 rounded-3xl p-8 max-w-md w-full text-center shadow-2xl">
          <div className="inline-block bg-emerald-500/15 border border-emerald-500/30 text-emerald-400 px-4 py-1.5 rounded-full text-xs font-semibold mb-4">
            ✓ Sesi Terverifikasi
          </div>
          <h1 className="text-xl font-bold text-[#FF6B00] mb-2">Terhubung ke Malesan Desktop!</h1>
          <p className="text-sm text-stone-400 mb-6 leading-relaxed">
            Sesi akun kamu berhasil dikirimkan ke aplikasi Malesan Studio Desktop. Halaman ini akan menutup otomatis.
          </p>
          <script dangerouslySetInnerHTML={{ __html: `setTimeout(() => { try { window.close(); } catch(e) {} }, 1200);` }} />
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
