import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";

export default async function ProfilePage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("*, referrals!referrals_referrer_id_fkey(count)")
    .eq("id", user.id)
    .single();

  if (!profile) redirect("/login");

  const referralCount = profile.referrals[0]?.count || 0;
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
  const referralLink = `${baseUrl}/masuk?ref=${profile.referral_code}`;

  return (
    <div className="max-w-3xl mx-auto py-12 px-4 sm:px-6">
      <h1 className="text-3xl font-black text-white mb-8">Profil Lo</h1>

      <div className="space-y-6">
        <div className="bg-zinc-900/50 border border-zinc-800 rounded-2xl p-6">
          <h2 className="text-xl font-bold text-white mb-2">Referral Program</h2>
          <p className="text-zinc-400 mb-6">Ajak temen pake Malesan, dapet bonus 10 credits pas mereka kelar generate konten pertama. Unlimited!</p>
          
          <div className="bg-zinc-950 border border-zinc-800 rounded-xl p-4 flex items-center justify-between mb-6">
            <code className="text-emerald-400 text-lg">{referralLink}</code>
            {/* Native copy is easy but omitting interactive for now since it's a server component. 
                In a real app, we'd add a small client component for the copy button. */}
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="bg-zinc-800/50 p-4 rounded-xl border border-zinc-700/50">
              <div className="text-zinc-400 text-sm mb-1">Total Temen Join</div>
              <div className="text-3xl font-black text-white">{referralCount}</div>
            </div>
            <div className="bg-emerald-500/10 p-4 rounded-xl border border-emerald-500/20">
              <div className="text-emerald-500 text-sm mb-1">Bonus Didapat</div>
              <div className="text-3xl font-black text-emerald-400">{referralCount * 10} <span className="text-sm font-normal text-emerald-500/50">cr</span></div>
            </div>
          </div>
        </div>

        <div className="bg-zinc-900/50 border border-zinc-800 rounded-2xl p-6">
          <h2 className="text-xl font-bold text-white mb-2">Informasi Akun</h2>
          <div className="space-y-4">
            <div>
              <div className="text-zinc-500 text-sm">Email</div>
              <div className="text-white">{profile.email}</div>
            </div>
            <div>
              <div className="text-zinc-500 text-sm">Status</div>
              <div className="text-white mb-6">
                {profile.is_pro ? (
                  <span className="text-emerald-400 font-medium">Pro Member</span>
                ) : (
                  <span className="text-zinc-300">Free Tier</span>
                )}
              </div>
            </div>
            
            <div className="pt-4 border-t border-zinc-800">
              <a href="/app/onboarding" className="inline-block bg-zinc-800 hover:bg-zinc-700 text-white font-medium px-4 py-2 rounded-lg transition-colors">
                Edit Profil DNA Kreator
              </a>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
